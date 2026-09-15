import { SHENLE_TOKEN_KEY } from '@/utils/shenle'

let revision = 0
let loginRevision = 0

export function invalidateSessionContext() {
  loginRevision += 1
  revision += 1
}

export function invalidateAuthorizationContext() {
  revision += 1
}

export function captureSessionContext() {
  return { token: String(uni.getStorageSync(SHENLE_TOKEN_KEY) || ''), revision, loginRevision }
}

export function isCurrentSession(context: ReturnType<typeof captureSessionContext>) {
  return context.revision === revision && isCurrentLogin(context)
}

export function isCurrentLogin(context: ReturnType<typeof captureSessionContext>) {
  return context.loginRevision === loginRevision && context.token === String(uni.getStorageSync(SHENLE_TOKEN_KEY) || '')
}

export class StaleSessionError extends Error {
  constructor() {
    super('会话已切换，本次响应已忽略')
    this.name = 'StaleSessionError'
  }
}
