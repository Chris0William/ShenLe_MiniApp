import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ access: vi.fn(), prepare: vi.fn(), login: vi.fn(), profile: vi.fn() }))
vi.mock('@/api/user-manage', () => ({ getMyAccess: api.access }))
vi.mock('@/api/auth', () => ({
  prepareWxLogin: api.prepare,
  loginWithWxTicket: api.login,
  getUserInfo: api.profile,
  logout: vi.fn(async () => {}),
  completeProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}))

let storage: Map<string, any>

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  storage = new Map()
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.has(key) ? structuredClone(storage.get(key)) : '',
    setStorageSync: (key: string, value: unknown) => storage.set(key, JSON.parse(JSON.stringify(value))),
    removeStorageSync: (key: string) => storage.delete(key),
    $on: vi.fn(),
    $emit: vi.fn(),
    login: (options: { success: (result: { code: string }) => void }) => options.success({ code: 'wx-code' }),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function session(accountType: number, isLandlord = false) {
  storage.set('shenle_token', 'session-a')
  storage.set('shenle_user', { id: '123', nickName: 'test', accountType, isLandlord, canEnterLandlordPortal: isLandlord })
  storage.set('app-mode', 'admin')
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const { useShenleAuthStore } = await import('@/store/auth')
  const { modeStore } = await import('@/store/mode')
  return { auth: useShenleAuthStore(), modeStore }
}

describe('current-account access synchronization with real Pinia store', () => {
  it.each([888, 999])('shows both portals after account %i is assigned landlord', async (accountType) => {
    const { auth, modeStore } = await session(accountType)
    expect(auth.canEnterLandlordPortal).toBe(false)
    api.access.mockResolvedValueOnce({ accountType, isLandlord: true, canEnterLandlordPortal: true, canEnterRestrictedAdmin: true })
    await auth.refreshAccess()
    expect(auth.canEnterAdmin).toBe(true)
    expect(auth.canEnterLandlordPortal).toBe(true)
    expect(auth.isLandlordOnly).toBe(false)
    expect(modeStore.mode).toBe('admin')
    expect(storage.get('shenle_user').canEnterLandlordPortal).toBe(true)
  })

  it.each([888, 999])('can exit landlord portal after account %i signs out and logs in again', async (accountType) => {
    const { auth, modeStore } = await session(accountType, true)
    modeStore.setMode('landlord')
    await auth.signOut()
    api.prepare.mockResolvedValueOnce({ loginTicket: 'ticket', needProfile: false, needPhone: false })
    api.login.mockResolvedValueOnce({ userId: '123', nickName: 'test', accountType, accessToken: 'session-b' })
    api.access.mockResolvedValueOnce({ accountType, isLandlord: true, canEnterLandlordPortal: true, canEnterRestrictedAdmin: true })
    expect(await auth.wxLoginStep1()).toBe('done')
    modeStore.setMode('user')
    expect(modeStore.mode).toBe('user')
    expect(auth.canEnterAdmin).toBe(true)
    expect(auth.canEnterLandlordPortal).toBe(true)
    modeStore.setMode('landlord')
    expect(modeStore.mode).toBe('landlord')
    modeStore.setMode('admin')
    expect(modeStore.mode).toBe('admin')
  })

  it('continues to restrict a non-admin landlord', async () => {
    const { auth, modeStore } = await session(777, true)
    api.access.mockResolvedValueOnce({ accountType: 777, isLandlord: true, canEnterLandlordPortal: true, canEnterRestrictedAdmin: true })
    await auth.refreshAccess()
    expect(auth.canEnterAdmin).toBe(false)
    expect(auth.canManageDictionaries).toBe(false)
    modeStore.setMode('admin')
    expect(modeStore.mode).toBe('landlord')
  })

  it('does not restore permissions from an old request after sign-out', async () => {
    const { auth } = await session(999)
    let resolve!: (access: unknown) => void
    api.access.mockReturnValueOnce(new Promise((done) => {
      resolve = done
    }))
    const pending = auth.refreshAccess()
    await auth.signOut()
    resolve({ accountType: 999, isLandlord: true, canEnterLandlordPortal: true })
    await pending
    expect(auth.user).toBeNull()
    expect(storage.has('shenle_user')).toBe(false)
  })

  it('merges concurrent access refreshes for the same session', async () => {
    const { auth } = await session(999)
    api.access.mockResolvedValueOnce({ accountType: 999, isLandlord: true, canEnterLandlordPortal: true })
    await Promise.all([auth.refreshAccess(), auth.refreshAccess()])
    expect(api.access).toHaveBeenCalledTimes(1)
  })

  it('applies a custom role to an account below the legacy admission level', async () => {
    const { auth, modeStore } = await session(666)
    api.access.mockResolvedValueOnce({
      accountType: 666,
      rbacEnabled: true,
      isRbacManaged: true,
      permissionKeys: ['portal.admin', 'supply.read', 'dictionary.manage'],
      roleCodes: ['custom'],
    })
    await auth.refreshAccess()
    expect(auth.canEnterAdmin).toBe(true)
    expect(auth.canViewRealData).toBe(true)
    expect(auth.canManageDictionaries).toBe(true)
    expect(auth.isGuest).toBe(false)
    expect(modeStore.mode).toBe('admin')
  })

  it('revokes cached administrator capabilities without logging out', async () => {
    const { auth, modeStore } = await session(888)
    api.access.mockResolvedValueOnce({ accountType: 888, rbacEnabled: true, isRbacManaged: true, permissionKeys: [], roleCodes: [] })
    await auth.refreshAccess()
    expect(auth.canEnterAdmin).toBe(false)
    expect(auth.canViewRealData).toBe(false)
    expect(auth.canDeleteSupply).toBe(false)
    expect(auth.canManageDictionaries).toBe(false)
    expect(modeStore.mode).toBe('user')
  })

  it('clears managed cache fields when an old backend is restored', async () => {
    const { auth } = await session(888)
    api.access.mockResolvedValueOnce({ accountType: 888, isRbacManaged: true, permissionKeys: [], roleCodes: [] })
    await auth.refreshAccess()
    expect(auth.canEnterAdmin).toBe(false)
    api.access.mockResolvedValueOnce({ accountType: 888, canEnterRestrictedAdmin: true })
    await auth.refreshAccess()
    expect(auth.isRbacManaged).toBe(false)
    expect(auth.canEnterAdmin).toBe(true)
  })

  it('does not merge an old profile response into a different account', async () => {
    const { auth } = await session(888)
    let complete!: (profile: unknown) => void
    api.profile.mockReturnValueOnce(new Promise((resolve) => {
      complete = resolve
    }))
    const pending = auth.refreshUser()
    auth.setToken('session-b')
    auth.setUser({ id: '456', account: '', nickName: 'new', accountType: 777 })
    complete({ id: '123', account: '', nickName: 'old', accountType: 888 })
    await expect(pending).resolves.toBeNull()
    expect(auth.user?.id).toBe('456')
    expect(api.access).not.toHaveBeenCalled()
  })

  it('does not apply an old access response after a same-token login', async () => {
    const { auth } = await session(888)
    let complete!: (access: unknown) => void
    api.access.mockReturnValueOnce(new Promise((resolve) => {
      complete = resolve
    }))
    const pending = auth.refreshAccess()
    auth.setToken('session-a')
    auth.setUser({ id: '123', account: '', nickName: 'new', accountType: 777 })
    complete({ accountType: 999 })
    await expect(pending).resolves.toBeNull()
    expect(auth.user?.accountType).toBe(777)
  })

  it('does not let an old logout completion remove a new same-token login', async () => {
    const { auth } = await session(888)
    const { logout } = await import('@/api/auth')
    let complete!: () => void
    vi.mocked(logout).mockReturnValueOnce(new Promise((resolve) => {
      complete = () => resolve(undefined)
    }))
    const pending = auth.signOut()
    auth.setToken('session-a')
    auth.setUser({ id: '123', account: '', nickName: 'new', accountType: 888 })
    complete()
    await pending
    expect(auth.isLogin).toBe(true)
    expect(auth.user?.nickName).toBe('new')
  })

  it('invalidates pending data when authorization version changes without a new token', async () => {
    const { auth } = await session(888)
    const { captureSessionContext, isCurrentSession } = await import('@/utils/session-context')
    api.access.mockResolvedValueOnce({ accountType: 888, authorizationRevision: 1 })
    await auth.refreshAccess()
    const previous = captureSessionContext()
    api.access.mockResolvedValueOnce({ accountType: 888, authorizationRevision: 2 })
    await auth.refreshAccess()
    expect(auth.token).toBe('session-a')
    expect(isCurrentSession(previous)).toBe(false)
    expect(uni.$emit).toHaveBeenCalledWith('shenle:access-changed')
  })

  it('does not invalidate requests for a nickname-only change or reordered grants', async () => {
    const { auth } = await session(888)
    const { captureSessionContext, isCurrentSession } = await import('@/utils/session-context')
    auth.setUser({ ...auth.user!, permissionKeys: ['supply.read', 'supply.write'] })
    const previous = captureSessionContext()
    auth.setUser({ ...auth.user!, nickName: 'renamed', permissionKeys: ['supply.write', 'supply.read'] })
    expect(isCurrentSession(previous)).toBe(true)
  })

  it('still completes a requested logout when a concurrent authorization refresh changes scope', async () => {
    const { auth } = await session(888)
    const { logout } = await import('@/api/auth')
    let complete!: () => void
    vi.mocked(logout).mockReturnValueOnce(new Promise((resolve) => {
      complete = () => resolve(undefined)
    }))
    const pending = auth.signOut()
    auth.setUser({ ...auth.user!, authorizationRevision: 2 })
    complete()
    await pending
    expect(auth.isLogin).toBe(false)
    expect(auth.user).toBeNull()
  })
})
