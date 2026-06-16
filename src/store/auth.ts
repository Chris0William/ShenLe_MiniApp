import type { LoginUserOutput, WxLoginOutput } from '@/types/shenle'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { completeProfile, getUserInfo, getWxOpenId, logout, uploadAvatar, wxOpenIdLogin } from '@/api/auth'
import { modeStore } from '@/store/mode'
import { SHENLE_OPENID_KEY, SHENLE_TOKEN_KEY, SHENLE_USER_KEY } from '@/utils/shenle'

export const useShenleAuthStore = defineStore('shenle-auth', () => {
  const token = ref<string>(uni.getStorageSync(SHENLE_TOKEN_KEY) || '')
  const openId = ref<string>(uni.getStorageSync(SHENLE_OPENID_KEY) || uni.getStorageSync('openId') || '')
  const user = ref<LoginUserOutput | null>(uni.getStorageSync(SHENLE_USER_KEY) || null)

  // 请求层 401 时只能清 storage，这里同步清内存态；
  // 否则 isLogin 仍为 true，登录页会把过期用户弹回业务页，形成来回横跳死循环
  uni.$on('shenle:unauthorized', () => {
    token.value = ''
    user.value = null
  })

  const isLogin = computed(() => !!token.value)
  const isAdmin = computed(() => (user.value?.accountType || 0) >= 888)
  const displayName = computed(() => user.value?.realName || user.value?.account || '未登录')

  function setToken(value: string) {
    token.value = value
    if (value)
      uni.setStorageSync(SHENLE_TOKEN_KEY, value)
    else
      uni.removeStorageSync(SHENLE_TOKEN_KEY)
  }

  function setOpenId(value: string) {
    openId.value = value
    if (value)
      uni.setStorageSync(SHENLE_OPENID_KEY, value)
    else
      uni.removeStorageSync(SHENLE_OPENID_KEY)
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
      realName: session.nickName || '微信用户',
      avatar: session.avatar || '',
      accountType: session.accountType,
    }
  }

  async function applyWxSession(session: WxLoginOutput) {
    setToken(session.accessToken)
    setUser(toLoginUser(session))
  }

  async function refreshUser(silent = false) {
    if (!token.value)
      return null
    const profile = await getUserInfo(silent)
    setUser(profile)
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

  async function wxLoginStep1(): Promise<'done' | 'needProfile'> {
    const code = await getWxLoginCode()
    const wxRes = await getWxOpenId(code)
    setOpenId(wxRes.openId)

    const session = await wxOpenIdLogin(wxRes.openId)
    if (session.needProfile)
      return 'needProfile'

    await applyWxSession(session)
    return 'done'
  }

  async function wxLoginStep2(nickName: string, avatarTempPath: string) {
    if (!openId.value)
      throw new Error('请先完成微信授权')

    const file = await uploadAvatar(openId.value, avatarTempPath)
    const session = await completeProfile({
      openId: openId.value,
      nickName,
      avatar: file.url,
    })
    await applyWxSession({ ...session, needProfile: false })
  }

  async function autoLogin() {
    if (!openId.value)
      return false

    setToken('')
    setUser(null)
    try {
      const session = await wxOpenIdLogin(openId.value)
      if (session.needProfile)
        return false
      await applyWxSession(session)
      return true
    }
    catch {
      setOpenId('')
      return false
    }
  }

  async function signOut() {
    try {
      if (token.value)
        await logout()
    }
    catch {}
    finally {
      setToken('')
      setOpenId('')
      setUser(null)
      modeStore.setMode('user')
    }
  }

  return {
    token,
    openId,
    user,
    isLogin,
    isAdmin,
    displayName,
    setToken,
    setOpenId,
    setUser,
    wxLoginStep1,
    wxLoginStep2,
    autoLogin,
    refreshUser,
    signOut,
  }
})
