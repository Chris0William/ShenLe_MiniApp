import type { LoginUserOutput, WxLoginOutput } from '@/types/shenle'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { completeProfile, getUserInfo, loginWithWxTicket, logout, prepareWxLogin, uploadAvatar } from '@/api/auth'
import { getMyAccess } from '@/api/user-manage'
import { modeStore } from '@/store/mode'
import { SHENLE_TOKEN_KEY, SHENLE_USER_KEY } from '@/utils/shenle'

export const useShenleAuthStore = defineStore('shenle-auth', () => {
  const token = ref<string>(uni.getStorageSync(SHENLE_TOKEN_KEY) || '')
  const user = ref<LoginUserOutput | null>(uni.getStorageSync(SHENLE_USER_KEY) || null)
  const loginTicket = ref('')

  // 新登录链路不再让客户端持有 OpenId，清理旧版本遗留值。
  uni.removeStorageSync('shenle_openid')
  uni.removeStorageSync('openId')

  // 请求层 401 时只能清 storage，这里同步清内存态；
  // 否则 isLogin 仍为 true，登录页会把过期用户弹回业务页，形成来回横跳死循环
  uni.$on('shenle:unauthorized', () => {
    token.value = ''
    user.value = null
    loginTicket.value = ''
    // 同步退回用户端，避免过期后仍停留在管理端外壳（tabbar/视图与已登出状态不一致）
    modeStore.setMode('user')
  })

  const isLogin = computed(() => !!token.value)
  const isAdmin = computed(() => (user.value?.accountType || 0) >= 888) // 888 管理员可进管理端
  const isSuperAdmin = computed(() => (user.value?.accountType || 0) >= 999) // 999 超级管理员可用户管理
  const canUseApp = computed(() => (user.value?.accountType || 0) >= 777) // 777 普通用户可正常使用
  const isGuest = computed(() => isLogin.value && (user.value?.accountType || 0) < 777) // 666 游客需申请
  const canViewRealData = computed(() => canUseApp.value || isAdmin.value)
  const isLandlord = computed(() => !!user.value?.isLandlord)
  const landlordApplyStatus = computed(() => user.value?.landlordApplyStatus)
  const canViewSupplyActivity = computed(() => !!user.value?.canViewSupplyActivity)
  const canUseMineFilters = computed(() => !!user.value?.canUseMineFilters)
  const canFilterBySupplyOperator = computed(() => !!user.value?.canFilterBySupplyOperator)
  const displayName = computed(() => (isLogin.value ? user.value?.nickName || '微信用户' : '未登录'))

  function setToken(value: string) {
    token.value = value
    if (value)
      uni.setStorageSync(SHENLE_TOKEN_KEY, value)
    else
      uni.removeStorageSync(SHENLE_TOKEN_KEY)
  }

  function setUser(value: LoginUserOutput | null) {
    user.value = value
    if (value)
      uni.setStorageSync(SHENLE_USER_KEY, value)
    else
      uni.removeStorageSync(SHENLE_USER_KEY)
  }

  function toLoginUser(session: WxLoginOutput): LoginUserOutput {
    return {
      id: session.userId,
      account: '',
      nickName: session.nickName || '',
      avatar: session.avatar || '',
      accountType: session.accountType,
    }
  }

  async function mergeIsLandlord() {
    try {
      const access = await getMyAccess()
      if (user.value) {
        user.value = {
          ...user.value,
          ...access,
          isLandlord: !!access.isLandlord,
        }
        uni.setStorageSync(SHENLE_USER_KEY, user.value)
      }
      // 纯盘源对接人（非管理员）强制切换到盘源对接人端；setMode 写 storage，登录后 reLaunch 重建页面时
      // readInitialMode（5.1）会读到正确模式。不在此处 reLaunch，避免与 finishLogin 的 reLaunch 重复。
      if (user.value?.isLandlord && (user.value?.accountType || 0) < 888 && modeStore.mode !== 'landlord')
        modeStore.setMode('landlord')
    }
    catch {}
  }

  async function applyWxSession(session: WxLoginOutput) {
    setToken(session.accessToken)
    setUser(toLoginUser(session))
    await mergeIsLandlord()
  }

  async function refreshUser(silent = false) {
    if (!token.value)
      return null
    const profile = await getUserInfo(silent)
    setUser(profile)
    await mergeIsLandlord()
    return profile
  }

  async function getWxLoginCode() {
    const res = await new Promise<UniApp.LoginRes>((resolve, reject) => {
      uni.login({ provider: 'weixin', success: resolve, fail: reject })
    })
    if (!res.code)
      throw new Error('微信登录凭证为空')
    return res.code
  }

  async function wxLoginStep1(): Promise<'done' | 'needProfile' | 'needPhone'> {
    const code = await getWxLoginCode()
    const prepared = await prepareWxLogin(code)
    loginTicket.value = prepared.loginTicket

    if (prepared.needProfile)
      return 'needProfile'
    if (prepared.needPhone)
      return 'needPhone'

    const session = await loginWithWxTicket(prepared.loginTicket)
    await applyWxSession(session)
    loginTicket.value = ''
    return 'done'
  }

  async function wxLoginWithPhone(phoneCode: string) {
    if (!loginTicket.value)
      throw new Error('请先完成微信授权')

    const session = await loginWithWxTicket(loginTicket.value, phoneCode)
    await applyWxSession(session)
    loginTicket.value = ''
  }

  async function wxLoginStep2(nickName: string, avatarTempPath: string, phoneCode: string) {
    if (!loginTicket.value)
      throw new Error('请先完成微信授权')

    const file = await uploadAvatar(loginTicket.value, avatarTempPath)
    const session = await completeProfile({
      loginTicket: loginTicket.value,
      nickName,
      avatar: file.url,
      phoneCode,
    })
    await applyWxSession(session)
    loginTicket.value = ''
  }

  async function signOut() {
    try {
      if (token.value)
        await logout()
    }
    catch {}
    finally {
      setToken('')
      setUser(null)
      loginTicket.value = ''
      modeStore.setMode('user')
    }
  }

  return {
    token,
    user,
    isLogin,
    isAdmin,
    isSuperAdmin,
    canUseApp,
    canViewRealData,
    isGuest,
    isLandlord,
    landlordApplyStatus,
    canViewSupplyActivity,
    canUseMineFilters,
    canFilterBySupplyOperator,
    displayName,
    setToken,
    setUser,
    wxLoginStep1,
    wxLoginWithPhone,
    wxLoginStep2,
    refreshUser,
    signOut,
  }
})
