import type { LoginUserOutput, MyAccessOutput, WxLoginOutput } from '@/types/shenle'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { completeProfile, getUserInfo, loginWithWxTicket, logout, prepareWxLogin, uploadAvatar } from '@/api/auth'
import { getMyAccess } from '@/api/user-manage'
import { modeStore } from '@/store/mode'
import { authorizationSignature, getPortalAccess, hasPermission, isAdministratorIdentity, resolvePortalMode } from '@/utils/authorization'
import { captureSessionContext, invalidateAuthorizationContext, invalidateSessionContext, isCurrentLogin, isCurrentSession } from '@/utils/session-context'
import { SHENLE_TOKEN_KEY, SHENLE_USER_KEY } from '@/utils/shenle'

export const useShenleAuthStore = defineStore('shenle-auth', () => {
  const token = ref<string>(uni.getStorageSync(SHENLE_TOKEN_KEY) || '')
  const user = ref<LoginUserOutput | null>(uni.getStorageSync(SHENLE_USER_KEY) || null)
  const loginTicket = ref('')
  let accessRequest: { context: ReturnType<typeof captureSessionContext>, promise: Promise<MyAccessOutput | null> } | null = null

  // 新登录链路不再让客户端持有 OpenId，清理旧版本遗留值。
  uni.removeStorageSync('shenle_openid')
  uni.removeStorageSync('openId')

  // 请求层 401 时只能清 storage，这里同步清内存态；
  // 否则 isLogin 仍为 true，登录页会把过期用户弹回业务页，形成来回横跳死循环
  uni.$on('shenle:unauthorized', () => {
    token.value = ''
    user.value = null
    loginTicket.value = ''
    // 同步退回业务员端，避免过期后仍停留在管理端外壳（tabbar/视图与已登出状态不一致）
    modeStore.setMode('user')
  })

  const isLogin = computed(() => !!token.value)
  const isAdmin = computed(() => isAdministratorIdentity(user.value))
  const isSuperAdmin = computed(() => (user.value?.accountType || 0) >= 999) // 999 超级管理员可用户管理
  const isRbacManaged = computed(() => user.value?.isRbacManaged === true)
  const canUseApp = computed(() => isLogin.value && hasPermission(user.value, 'supply.read', (user.value?.accountType || 0) >= 777))
  const isGuest = computed(() => isLogin.value && !canUseApp.value && (user.value?.accountType || 0) < 777)
  const portalAccess = computed(() => getPortalAccess(user.value))
  const canViewRealData = computed(() => canUseApp.value && (!isRbacManaged.value
    || (modeStore.mode === 'user' ? portalAccess.value.business : modeStore.mode === 'admin' ? portalAccess.value.admin : portalAccess.value.landlord)))
  const isLandlord = computed(() => !!user.value?.isLandlord)
  const isLandlordOnly = computed(() => isLogin.value && portalAccess.value.landlordOnly)
  const isSourceContact = computed(() => !!user.value?.isSourceContact)
  const isMaintainer = computed(() => !!user.value?.isMaintainer)
  const canEnterLandlordPortal = computed(() => isLogin.value && portalAccess.value.landlord)
  const canEnterRestrictedAdmin = computed(() => hasPermission(user.value, 'portal.admin', !!user.value?.canEnterRestrictedAdmin))
  const canEnterAdmin = computed(() => isLogin.value && portalAccess.value.admin)
  const canCreateSupply = computed(() => hasPermission(user.value, 'supply.create', !!user.value?.canCreateSupply))
  const canBatchWriteSupply = computed(() => hasPermission(user.value, 'supply.batch', !!user.value?.canBatchWriteSupply))
  const canManageLandlords = computed(() => hasPermission(user.value, 'landlord.manage', !!user.value?.canManageLandlords))
  const canSetCommunityHotLevel = computed(() => hasPermission(user.value, 'community.hot', !!user.value?.canSetCommunityHotLevel))
  const canManageDictionaries = computed(() => hasPermission(user.value, 'dictionary.manage', isAdmin.value))
  const canWriteSupply = computed(() => hasPermission(user.value, 'supply.write', !!user.value?.canWriteAllSupply || !!user.value?.canWriteAssignedSupply))
  const canDeleteSupply = computed(() => hasPermission(user.value, 'supply.delete', isAdmin.value))
  const landlordApplyStatus = computed(() => user.value?.landlordApplyStatus)
  const canViewSupplyActivity = computed(() => hasPermission(user.value, 'supply.activity', !!user.value?.canViewSupplyActivity))
  const canUseMineFilters = computed(() => hasPermission(user.value, 'supply.mine-filter', !!user.value?.canUseMineFilters))
  const canFilterBySupplyOperator = computed(() => hasPermission(user.value, 'supply.operator-filter', !!user.value?.canFilterBySupplyOperator))
  const displayName = computed(() => (isLogin.value ? user.value?.nickName || '微信用户' : '未登录'))

  function setToken(value: string) {
    // 同秒重新登录也可能得到相同JWT，仍要隔离上一个登录流程的请求。
    const changed = token.value !== value || !!value
    if (changed)
      invalidateSessionContext()
    token.value = value
    if (value)
      uni.setStorageSync(SHENLE_TOKEN_KEY, value)
    else
      uni.removeStorageSync(SHENLE_TOKEN_KEY)
    if (changed)
      uni.$emit('shenle:session-changed')
  }

  function setUser(value: LoginUserOutput | null) {
    const accessChanged = authorizationSignature(user.value) !== authorizationSignature(value)
    user.value = value
    if (value)
      uni.setStorageSync(SHENLE_USER_KEY, value)
    else
      uni.removeStorageSync(SHENLE_USER_KEY)
    if (accessChanged) {
      invalidateAuthorizationContext()
      uni.$emit('shenle:access-changed')
    }
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

  function refreshAccess(silent = false): Promise<MyAccessOutput | null> {
    const requestToken = token.value
    const context = captureSessionContext()
    if (!requestToken)
      return Promise.resolve(null)
    if (accessRequest && isCurrentSession(accessRequest.context))
      return accessRequest.promise
    const promise = getMyAccess(silent).then((access) => {
      // 登出或换号后，旧请求不能覆盖新会话权限。
      if (!isCurrentSession(context) || token.value !== requestToken || !user.value)
        return null
      setUser({
        ...user.value,
        ...access,
        authorizationRevision: access.authorizationRevision ?? 0,
        isRbacManaged: access.isRbacManaged === true,
        rbacEnabled: access.rbacEnabled === true,
        permissionKeys: access.permissionKeys || [],
        roleCodes: access.roleCodes || [],
        isLandlord: !!access.isLandlord,
      })
      // 普通房东锁定房东端；管理员、超管保留当前端，跳转仍由登录/路由流程处理。
      if (isRbacManaged.value)
        modeStore.setMode(resolvePortalMode(modeStore.mode, user.value, isLogin.value))
      else if (isLandlordOnly.value && modeStore.mode !== 'landlord')
        modeStore.setMode('landlord')
      else if (modeStore.mode === 'landlord' && !canEnterLandlordPortal.value)
        modeStore.setMode(canEnterAdmin.value ? 'admin' : 'user')
      return access
    }).finally(() => {
      if (accessRequest?.promise === promise)
        accessRequest = null
    })
    accessRequest = { context, promise }
    return promise
  }

  async function mergeAccess() {
    try {
      await refreshAccess()
    }
    catch (error) {
      console.warn('refresh account access failed', error)
    }
  }

  async function applyWxSession(session: WxLoginOutput) {
    setToken(session.accessToken)
    setUser(toLoginUser(session))
    await mergeAccess()
  }

  async function refreshUser(silent = false) {
    if (!token.value)
      return null
    const context = captureSessionContext()
    const profile = await getUserInfo(silent)
    if (!isCurrentSession(context) || !user.value)
      return null
    setUser({ ...user.value, ...profile })
    await mergeAccess()
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
    const context = captureSessionContext()
    try {
      if (token.value)
        await logout()
    }
    catch {}
    finally {
      if (isCurrentLogin(context)) {
        setToken('')
        setUser(null)
        loginTicket.value = ''
        modeStore.setMode('user')
      }
    }
  }

  return {
    token,
    user,
    isLogin,
    isAdmin,
    isSuperAdmin,
    isRbacManaged,
    canUseApp,
    canViewRealData,
    isGuest,
    isLandlord,
    isLandlordOnly,
    isSourceContact,
    isMaintainer,
    canEnterLandlordPortal,
    canEnterRestrictedAdmin,
    canEnterAdmin,
    canCreateSupply,
    canBatchWriteSupply,
    canManageLandlords,
    canSetCommunityHotLevel,
    canManageDictionaries,
    canWriteSupply,
    canDeleteSupply,
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
    refreshAccess,
    signOut,
  }
})
