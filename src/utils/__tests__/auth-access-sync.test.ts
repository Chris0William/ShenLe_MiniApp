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
})
