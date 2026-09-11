import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/store/auth', () => ({ useShenleAuthStore: () => ({ isLogin: true, isAdmin: true, canEnterAdmin: true, canEnterLandlordPortal: true }) }))
vi.mock('@/tabbar/store', () => ({ tabbarStore: { setAutoCurIdx: vi.fn() } }))
vi.mock('@/utils/index', () => ({
  getLastPage: () => ({ route: 'pages/admin/property-list/index' }),
  parseUrlToObj: (url: string) => ({ path: url.split('?')[0], query: {} }),
}))

let storage: Map<string, unknown>
const landlord = { isLandlord: true, canEnterLandlordPortal: true, accountType: 777 }

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  storage = new Map<string, unknown>([['shenle_token', 'test-token'], ['shenle_user', landlord], ['app-mode', 'user']])
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    removeStorageSync: (key: string) => storage.delete(key),
    addInterceptor: vi.fn(),
    reLaunch: vi.fn((options: { complete?: () => void }) => options.complete?.()),
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('landlord-only portal', () => {
  it.each(['user', 'admin'])('ignores the saved %s mode', async (saved) => {
    storage.set('app-mode', saved)
    storage.set('shenle_user', { ...landlord, isMaintainer: true, canEnterRestrictedAdmin: true })
    const { modeStore } = await import('@/store/mode')
    expect(modeStore.mode).toBe('landlord')
    modeStore.setMode(saved as 'user' | 'admin')
    expect(modeStore.mode).toBe('landlord')
    expect(storage.get('app-mode')).toBe('landlord')
  })

  it('forces landlord mode when login code requests user mode', async () => {
    storage.delete('shenle_token')
    const { modeStore } = await import('@/store/mode')
    storage.set('shenle_token', 'new-session')
    modeStore.setMode('user')
    expect(modeStore.mode).toBe('landlord')
  })

  it.each([888, 999])('lets landlord administrator %i restore and switch between all three portals', async (accountType) => {
    storage.set('shenle_user', { ...landlord, accountType, canEnterRestrictedAdmin: true })
    storage.set('app-mode', 'admin')
    const { modeStore } = await import('@/store/mode')
    expect(modeStore.mode).toBe('admin')
    for (const mode of ['user', 'landlord', 'admin'] as const) {
      modeStore.setMode(mode)
      expect(modeStore.mode).toBe(mode)
      expect(storage.get('app-mode')).toBe(mode)
    }
    const { navigateToInterceptor } = await import('@/router/interceptor')
    expect(navigateToInterceptor.invoke({ url: '/pages/admin/property-list/index' })).not.toBe(false)
    expect(navigateToInterceptor.invoke({ url: '/pages/admin/user-manage/index' })).not.toBe(false)
    await vi.runAllTimersAsync()
    expect(uni.reLaunch).not.toHaveBeenCalled()
  })

  it.each([888, 999])('allows landlord administrator %i to use a salesperson share code', async (accountType) => {
    storage.set('shenle_user', { ...landlord, accountType })
    const { useLandlordShareStore } = await import('@/store/landlord-share')
    const share = useLandlordShareStore()
    expect(share.capture(`ls_${'a'.repeat(28)}`)).toBe(true)
    expect(share.hasContext.value).toBe(true)
  })

  it('allows visitor preview after logout', async () => {
    const { modeStore } = await import('@/store/mode')
    storage.delete('shenle_token')
    storage.delete('shenle_user')
    modeStore.setMode('user')
    expect(modeStore.mode).toBe('user')
  })

  it('preserves administrator and maintainer switching without landlord identity', async () => {
    storage.set('shenle_user', { accountType: 888, isMaintainer: true, canEnterRestrictedAdmin: true })
    const { modeStore } = await import('@/store/mode')
    modeStore.setMode('admin')
    expect(modeStore.mode).toBe('admin')
    modeStore.setMode('user')
    expect(modeStore.mode).toBe('user')
  })

  it('does not accept a salesperson share scope for landlords', async () => {
    const { useLandlordShareStore } = await import('@/store/landlord-share')
    const share = useLandlordShareStore()
    expect(share.capture(`ls_${'a'.repeat(28)}`)).toBe(false)
    expect(share.hasContext.value).toBe(false)
    expect(storage.has('shenle_landlord_share_token')).toBe(false)
  })

  it.each(['/pages/admin/property-list/index', '/pages/common/apply/index', '/pages/admin/user-manage/index'])(
    'redirects forbidden deep link %s to the landlord map',
    async (url) => {
      const { navigateToInterceptor } = await import('@/router/interceptor')
      expect(navigateToInterceptor.invoke({ url })).toBe(false)
      await vi.runAllTimersAsync()
      expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/user/map/index' }))
    },
  )

  it('keeps landlord tabs and room editing reachable', async () => {
    const { navigateToInterceptor } = await import('@/router/interceptor')
    for (const url of ['/pages/user/map/index', '/pages/admin/sales-control/index', '/pages/admin/dashboard/index', '/pages/admin/mine/index', '/pages/common/property-form/index?id=123'])
      expect(navigateToInterceptor.invoke({ url })).not.toBe(false)
    expect(uni.reLaunch).not.toHaveBeenCalled()
  })

  it('guards a cached salesperson page when navigating back', async () => {
    const { routeInterceptor } = await import('@/router/interceptor')
    const mixin = vi.fn()
    routeInterceptor.install({ mixin } as any)
    mixin.mock.calls[0][0].onShow()
    await vi.runAllTimersAsync()
    expect(uni.reLaunch).toHaveBeenCalledWith(expect.objectContaining({ url: '/pages/user/map/index' }))
  })
})
