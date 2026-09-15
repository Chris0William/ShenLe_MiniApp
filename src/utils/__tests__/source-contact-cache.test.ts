import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ profile: vi.fn(), communities: vi.fn() }))
vi.mock('@/api/source-contact-portal', () => ({
  getSourceContactProfile: api.profile,
  getSourceContactCommunityList: api.communities,
}))

let storage: Map<string, any>
let events: Map<string, Set<(...args: any[]) => void>>

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  storage = new Map<string, any>([
    ['shenle_token', 'a'],
    ['shenle_user', { accountType: 888, isLandlord: true, canEnterLandlordPortal: true }],
    ['app-mode', 'landlord'],
  ])
  events = new Map()
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.get(key) || '',
    setStorageSync: (key: string, value: any) => storage.set(key, value),
    $on: (name: string, callback: (...args: any[]) => void) => {
      if (!events.has(name))
        events.set(name, new Set())
      events.get(name)!.add(callback)
    },
    $off: (name: string, callback: (...args: any[]) => void) => events.get(name)?.delete(callback),
    $emit: (name: string) => { events.get(name)?.forEach(callback => callback()) },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

async function setup() {
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const { useSourceContactStore } = await import('@/store/source-contact')
  const { modeStore } = await import('@/store/mode')
  return { store: useSourceContactStore(), modeStore }
}

describe('source contact cache isolation', () => {
  it('deduplicates ordinary in-flight loads', async () => {
    const profile = deferred<any>()
    api.profile.mockReturnValue(profile.promise)
    api.communities.mockResolvedValue([])
    const { store } = await setup()
    const first = store.load()
    const second = store.load()
    expect(api.profile).toHaveBeenCalledTimes(1)
    profile.resolve({ userId: 'a' })
    await Promise.all([first, second])
  })

  it('clear blocks an old response and its finalizer from affecting a new load', async () => {
    const oldProfile = deferred<any>()
    const newProfile = deferred<any>()
    api.profile.mockReturnValueOnce(oldProfile.promise).mockReturnValueOnce(newProfile.promise)
    api.communities.mockResolvedValue([])
    const { store } = await setup()
    const old = store.load()
    store.clear()
    storage.set('shenle_token', 'b')
    const current = store.load()
    oldProfile.resolve({ userId: 'a' })
    await old
    expect(store.profile).toBeNull()
    expect(store.loading).toBe(true)
    newProfile.resolve({ userId: 'b' })
    await current
    expect(store.profile?.userId).toBe('b')
    expect(store.loading).toBe(false)
  })

  it('does not use another account warm cache even when storage changes without an event', async () => {
    api.profile.mockResolvedValueOnce({ userId: 'a' }).mockResolvedValueOnce({ userId: 'b' })
    api.communities.mockResolvedValue([])
    const { store } = await setup()
    await store.load()
    storage.set('shenle_token', 'b')
    await store.load()
    expect(api.profile).toHaveBeenCalledTimes(2)
    expect(store.profile?.userId).toBe('b')
  })

  it('clears data on a portal switch and does not mix API namespaces', async () => {
    api.profile.mockResolvedValue({ userId: 'a' })
    api.communities.mockResolvedValue([{ id: '1' }])
    const { store, modeStore } = await setup()
    await store.load()
    modeStore.setMode('admin')
    expect(store.profile).toBeNull()
    expect(store.communities).toEqual([])
    await store.load()
    expect(api.profile).toHaveBeenCalledTimes(2)
  })

  it('a forced refresh replaces an older pending load', async () => {
    const oldProfile = deferred<any>()
    api.profile.mockReturnValueOnce(oldProfile.promise).mockResolvedValueOnce({ userId: 'new' })
    api.communities.mockResolvedValue([])
    const { store } = await setup()
    const old = store.load()
    await store.load(true)
    oldProfile.resolve({ userId: 'old' })
    await old
    expect(store.profile?.userId).toBe('new')
  })

  it('does not cache a failure as an empty success', async () => {
    api.profile.mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce({ userId: 'a' })
    api.communities.mockResolvedValue([])
    const { store } = await setup()
    await expect(store.load()).rejects.toThrow('failed')
    await store.load()
    expect(api.profile).toHaveBeenCalledTimes(2)
    expect(store.profile?.userId).toBe('a')
  })

  it('clears immediately on a session event', async () => {
    api.profile.mockResolvedValue({ userId: 'a' })
    api.communities.mockResolvedValue([{ id: '1' }])
    const { store } = await setup()
    await store.load()
    uni.$emit('shenle:session-changed')
    expect(store.profile).toBeNull()
    expect(store.activeCommunityId).toBeNull()
  })
})
