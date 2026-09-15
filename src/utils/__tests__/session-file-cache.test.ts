import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let token: string
let base: string
vi.mock('@/utils/shenle', () => ({
  SHENLE_TOKEN_KEY: 'shenle_token',
  getApiBaseUrl: () => base,
}))

beforeEach(() => {
  vi.resetModules()
  token = 'a'
  base = 'https://test.example'
  vi.stubGlobal('uni', { getStorageSync: () => token })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('bounded session file cache', () => {
  it('shares one in-flight download for identical file IDs', async () => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const download = deferred<string>()
    const fetch = vi.fn(() => download.promise)
    const cache = createSessionFileCache(fetch, vi.fn())
    const a = cache.download('1')
    const b = cache.download('1')
    expect(fetch).toHaveBeenCalledTimes(1)
    download.resolve('/tmp/one')
    expect(await a).toBe('/tmp/one')
    expect(await b).toBe('/tmp/one')
  })

  it('checks existence before reusing a local path and retries missing files', async () => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const fetch = vi.fn().mockResolvedValueOnce('/tmp/old').mockResolvedValueOnce('/tmp/new')
    const exists = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const cache = createSessionFileCache(fetch, exists)
    await cache.download('1')
    expect(await cache.download('1')).toBe('/tmp/old')
    expect(await cache.download('1')).toBe('/tmp/new')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not share a path or download across accounts', async () => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const old = deferred<string>()
    const fetch = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValueOnce('/tmp/b')
    const cache = createSessionFileCache(fetch, vi.fn().mockResolvedValue(true))
    const pending = cache.download('1')
    token = 'b'
    expect(await cache.download('1')).toBe('/tmp/b')
    old.resolve('/tmp/a')
    await expect(pending).rejects.toMatchObject({ name: 'StaleSessionError' })
    expect(await cache.download('1')).toBe('/tmp/b')
  })

  it('rejects a cached path when the account changes during its existence check', async () => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const exists = deferred<boolean>()
    const cache = createSessionFileCache(vi.fn().mockResolvedValue('/tmp/a'), () => exists.promise)
    await cache.download('1')
    const pending = cache.download('1')
    token = 'b'
    exists.resolve(true)
    await expect(pending).rejects.toMatchObject({ name: 'StaleSessionError' })
  })

  it('isolates backends as well as users', async () => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const fetch = vi.fn().mockResolvedValueOnce('/tmp/test').mockResolvedValueOnce('/tmp/other')
    const cache = createSessionFileCache(fetch, vi.fn().mockResolvedValue(true))
    await cache.download('1')
    base = 'https://another.example'
    expect(await cache.download('1')).toBe('/tmp/other')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('evicts the least recently used reference at capacity', async () => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const fetch = vi.fn(async (id: string) => `/tmp/${id}`)
    const cache = createSessionFileCache(fetch, vi.fn().mockResolvedValue(true), 2)
    await cache.download('1')
    await cache.download('2')
    await cache.download('1')
    await cache.download('3')
    await cache.download('1')
    expect(fetch).toHaveBeenCalledTimes(3)
    await cache.download('2')
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('expires paths without extending the TTL on cache hits', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-11T00:00:00Z'))
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const fetch = vi.fn().mockResolvedValue('/tmp/a')
    const cache = createSessionFileCache(fetch, vi.fn().mockResolvedValue(true), 2, 1000)
    await cache.download('1')
    vi.advanceTimersByTime(500)
    await cache.download('1')
    vi.advanceTimersByTime(501)
    await cache.download('1')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('clearing a pending download does not let its finalizer clear the replacement', async () => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const first = deferred<string>()
    const second = deferred<string>()
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const cache = createSessionFileCache(fetch, vi.fn())
    const a = cache.download('1')
    cache.clear()
    const b = cache.download('1')
    first.resolve('/tmp/old')
    await expect(a).rejects.toMatchObject({ name: 'StaleSessionError' })
    const duplicate = cache.download('1')
    expect(fetch).toHaveBeenCalledTimes(2)
    second.resolve('/tmp/current')
    await expect(b).resolves.toBe('/tmp/current')
    await expect(duplicate).resolves.toBe('/tmp/current')
  })

  it('does not cache download errors', async () => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    const fetch = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce('/tmp/retry')
    const cache = createSessionFileCache(fetch, vi.fn())
    await expect(cache.download('1')).rejects.toThrow('failed')
    await expect(cache.download('1')).resolves.toBe('/tmp/retry')
  })

  it.each([0, -1, Number.NaN])('rejects invalid capacity %s', async (capacity) => {
    const { createSessionFileCache } = await import('@/utils/session-file-cache')
    expect(() => createSessionFileCache(vi.fn(), vi.fn(), capacity)).toThrow(RangeError)
  })
})
