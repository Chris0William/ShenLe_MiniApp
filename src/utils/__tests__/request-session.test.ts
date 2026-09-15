import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prompt = vi.hoisted(() => vi.fn())
vi.mock('@/utils/login-flow', () => ({ promptProtectedLogin: prompt }))
vi.mock('@/utils/shenle', () => ({
  SHENLE_TOKEN_KEY: 'shenle_token',
  SHENLE_USER_KEY: 'shenle_user',
  getApiBaseUrl: () => 'https://example.test',
}))

let storage: Map<string, unknown>
let callbacks: { success: (response: any) => void, fail: (error: any) => void }

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.useFakeTimers()
  storage = new Map([['shenle_token', 'account-a']])
  vi.stubGlobal('uni', {
    getStorageSync: (key: string) => storage.get(key) || '',
    removeStorageSync: (key: string) => storage.delete(key),
    request: vi.fn((options) => { callbacks = options }),
    showToast: vi.fn(),
    $emit: vi.fn(),
  })
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('request session isolation', () => {
  it.each([401, 403])('ignores an old %i instead of logging out the new account', async (code) => {
    const { get } = await import('@/api/request')
    const pending = get('/private')
    storage.set('shenle_token', 'account-b')
    callbacks.success({ statusCode: code, data: { code } })
    await expect(pending).rejects.toMatchObject({ name: 'StaleSessionError' })
    expect(storage.get('shenle_token')).toBe('account-b')
    expect(uni.$emit).not.toHaveBeenCalled()
    expect(prompt).not.toHaveBeenCalled()
  })

  it('does not deliver successful private data from the previous account', async () => {
    const { get } = await import('@/api/request')
    const pending = get('/private')
    storage.set('shenle_token', 'account-b')
    callbacks.success({ statusCode: 200, data: { code: 200, result: { private: 'a' } } })
    await expect(pending).rejects.toMatchObject({ name: 'StaleSessionError' })
    expect(uni.showToast).not.toHaveBeenCalled()
  })

  it('rejects old responses even when a later session has the same token value', async () => {
    const { get } = await import('@/api/request')
    const { invalidateSessionContext } = await import('@/utils/session-context')
    const pending = get('/private')
    invalidateSessionContext()
    callbacks.success({ statusCode: 200, data: { code: 200, result: {} } })
    await expect(pending).rejects.toMatchObject({ name: 'StaleSessionError' })
  })

  it('silences old network failures after an account switch', async () => {
    const { get } = await import('@/api/request')
    const pending = get('/private')
    storage.set('shenle_token', 'account-b')
    callbacks.fail({ errMsg: 'request:fail timeout' })
    await expect(pending).rejects.toMatchObject({ name: 'StaleSessionError' })
    expect(uni.showToast).not.toHaveBeenCalled()
  })

  it('still clears the current session on a current authentication failure', async () => {
    const { get } = await import('@/api/request')
    const pending = get('/private')
    callbacks.success({ statusCode: 401, data: { code: 401 } })
    await expect(pending).rejects.toThrow('未授权')
    expect(storage.has('shenle_token')).toBe(false)
    expect(uni.$emit).toHaveBeenCalledWith('shenle:unauthorized')
    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('does not let a public/login endpoint failure clear an existing session', async () => {
    const { post } = await import('@/api/request')
    const pending = post('/login-ticket', {}, { auth: false })
    callbacks.success({ statusCode: 401, data: { code: 401 } })
    await expect(pending).rejects.toThrow()
    expect(storage.get('shenle_token')).toBe('account-a')
    expect(uni.$emit).not.toHaveBeenCalled()
    expect(prompt).not.toHaveBeenCalled()
  })

  it('requires both HTTP and business success', async () => {
    const { get } = await import('@/api/request')
    const pending = get('/private', undefined, { silent: true })
    callbacks.success({ statusCode: 500, data: { code: 200, result: 'invalid' } })
    await expect(pending).rejects.toThrow('请求失败(500)')
  })
})
