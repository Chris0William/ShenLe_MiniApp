import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  login as apiLogin,
  getUserInfo,
  getWxOpenId,
  wxOpenIdLogin,
  completeProfile,
  uploadAvatar,
  type LoginInput,
} from '@/api/auth'
import { BASE_URL } from '@/api/http'

export const useUserStore = defineStore('user', () => {
  const token = ref('')
  const openId = ref('')
  const nickName = ref('')
  const avatar = ref('')
  const isAdmin = ref(false)

  /** 登录弹窗状态: '' 隐藏, 'login' 微信登录按钮, 'profile' 完善资料表单 */
  const popupStep = ref<'' | 'login' | 'profile'>('')
  const showLoginPopup = computed(() => popupStep.value !== '')

  const isLoggedIn = computed(() => !!token.value)

  /** 头像完整 URL（处理后端返回的相对路径） */
  const avatarUrl = computed(() => {
    if (!avatar.value) return ''
    if (avatar.value.startsWith('http')) return avatar.value
    return `${BASE_URL}/${avatar.value}`
  })

  // 弹窗登录完成回调
  let _loginResolve: ((ok: boolean) => void) | null = null

  function loadFromStorage() {
    token.value = uni.getStorageSync('token') || ''
    openId.value = uni.getStorageSync('openId') || ''
    nickName.value = uni.getStorageSync('nickName') || ''
    avatar.value = uni.getStorageSync('avatar') || ''
    isAdmin.value = uni.getStorageSync('isAdmin') === 'true'
  }

  function saveToStorage() {
    uni.setStorageSync('token', token.value)
    uni.setStorageSync('openId', openId.value)
    uni.setStorageSync('nickName', nickName.value)
    uni.setStorageSync('avatar', avatar.value)
    uni.setStorageSync('isAdmin', isAdmin.value ? 'true' : 'false')
  }

  function setUser(data: { token: string; openId?: string; nickName?: string; avatar?: string; isAdmin?: boolean }) {
    token.value = data.token
    if (data.openId !== undefined) openId.value = data.openId
    if (data.nickName !== undefined) nickName.value = data.nickName
    if (data.avatar !== undefined) avatar.value = data.avatar
    if (data.isAdmin !== undefined) isAdmin.value = data.isAdmin
    saveToStorage()
  }

  /** 账号密码登录 */
  async function login(input: LoginInput) {
    const res = await apiLogin(input)
    token.value = res.accessToken
    uni.setStorageSync('token', res.accessToken)
    const user = await getUserInfo()
    nickName.value = user.realName || user.account
    avatar.value = user.avatar || ''
    isAdmin.value = user.accountType >= 888
    saveToStorage()
  }

  /**
   * 弹窗第一步：wx.login → getWxOpenId → wxOpenIdLogin
   * 如果是老用户直接完成登录；新用户返回 'needProfile' 需进入第二步
   */
  async function wxLoginStep1(): Promise<'done' | 'needProfile'> {
    const { code } = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject })
    })
    const wxRes = await getWxOpenId(code)
    openId.value = wxRes.openId
    uni.setStorageSync('openId', wxRes.openId)

    const loginRes = await wxOpenIdLogin(wxRes.openId)
    if (loginRes.needProfile) {
      return 'needProfile'
    }
    // 老用户 → 直接拿到 token
    token.value = loginRes.accessToken
    nickName.value = loginRes.nickName || '微信用户'
    avatar.value = loginRes.avatar || ''
    isAdmin.value = loginRes.accountType >= 888
    saveToStorage()
    return 'done'
  }

  /**
   * 弹窗第二步：上传头像 + 完善资料 → 获取 token
   * @param profileNickName 用户填写的昵称
   * @param avatarTempPath 微信 chooseAvatar 返回的临时文件路径
   */
  async function wxLoginStep2(profileNickName: string, avatarTempPath: string) {
    // 上传头像到后端
    const fileRes = await uploadAvatar(openId.value, avatarTempPath)
    const avatarUrl = fileRes.url

    // 完善资料并创建用户
    const profileRes = await completeProfile({
      openId: openId.value,
      nickName: profileNickName,
      avatar: avatarUrl,
    })
    token.value = profileRes.accessToken
    nickName.value = profileRes.nickName || profileNickName
    avatar.value = avatarUrl
    isAdmin.value = false
    saveToStorage()
  }

  /**
   * 静默登录：用已存储的 openId 直接换 token
   * 用于 App 启动时自动续期
   */
  async function autoLogin() {
    if (!openId.value) return false
    // 清除过期 token，防止 auth 接口带上旧 JWT 导致 401 死锁
    token.value = ''
    uni.removeStorageSync('token')
    try {
      const loginRes = await wxOpenIdLogin(openId.value)
      if (loginRes.needProfile) {
        // 用户被删了，需要重新注册 → 需要弹窗收集资料
        return false
      }
      token.value = loginRes.accessToken
      nickName.value = loginRes.nickName || '微信用户'
      avatar.value = loginRes.avatar || ''
      isAdmin.value = loginRes.accountType >= 888
      saveToStorage()
      return true
    } catch {
      openId.value = ''
      uni.removeStorageSync('openId')
      return false
    }
  }

  /**
   * 401 处理器
   * 1. 清除过期 token（防止后续请求继续带旧 JWT）
   * 2. 有 openId → 静默登录
   * 3. 失败 → 弹出登录弹窗
   */
  async function handleUnauthorized(): Promise<boolean> {
    token.value = ''
    uni.removeStorageSync('token')
    if (openId.value) {
      const ok = await autoLogin()
      if (ok) return true
    }
    return new Promise((resolve) => {
      _loginResolve = resolve
      popupStep.value = 'login'
    })
  }

  /** 弹窗登录完成后调用 */
  function onPopupLoginDone(success: boolean) {
    popupStep.value = ''
    if (_loginResolve) {
      _loginResolve(success)
      _loginResolve = null
    }
  }

  function logout() {
    token.value = ''
    openId.value = ''
    nickName.value = ''
    avatar.value = ''
    isAdmin.value = false
    uni.removeStorageSync('token')
    uni.removeStorageSync('openId')
    uni.removeStorageSync('nickName')
    uni.removeStorageSync('avatar')
    uni.removeStorageSync('isAdmin')
    popupStep.value = 'login'
  }

  return {
    token, openId, nickName, avatar, avatarUrl, isAdmin, isLoggedIn,
    showLoginPopup, popupStep,
    loadFromStorage, saveToStorage, setUser,
    login, wxLoginStep1, wxLoginStep2, autoLogin, handleUnauthorized, onPopupLoginDone,
    logout,
  }
})
