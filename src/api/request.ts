import type { AdminResult } from '@/types/shenle'
import { promptProtectedLogin } from '@/utils/login-flow'
import { captureSessionContext, invalidateSessionContext, isCurrentSession, StaleSessionError } from '@/utils/session-context'
import { getApiBaseUrl, SHENLE_TOKEN_KEY, SHENLE_USER_KEY } from '@/utils/shenle'

export type RequestMethod = 'GET' | 'POST'

export interface RequestOptions {
  url: string
  method?: RequestMethod
  data?: Record<string, unknown>
  header?: Record<string, string>
  auth?: boolean
  silent?: boolean
  timeout?: number
}

let promptingLogin = false

function appendQuery(url: string, data?: Record<string, unknown>) {
  if (!data)
    return url

  const pairs: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '')
      continue

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== undefined && item !== null && item !== '')
          pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(item))}`)
      }
      continue
    }

    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }

  if (!pairs.length)
    return url
  return `${url}${url.includes('?') ? '&' : '?'}${pairs.join('&')}`
}

function promptLoginAgain() {
  if (promptingLogin)
    return
  promptingLogin = true
  promptProtectedLogin('登录状态已失效，请重新登录后继续')
  setTimeout(() => {
    promptingLogin = false
  }, 800)
}

export function request<T>({ url, method = 'GET', data, header, auth = true, silent = false, timeout }: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const context = captureSessionContext()
    const token = context.token
    uni.request({
      url: method === 'GET'
        ? appendQuery(`${getApiBaseUrl()}${url}`, data)
        : `${getApiBaseUrl()}${url}`,
      method,
      data: method === 'GET' ? undefined : data,
      header: {
        'Content-Type': 'application/json',
        ...header,
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      timeout,
      success(res) {
        if (auth && !isCurrentSession(context)) {
          reject(new StaleSessionError())
          return
        }
        const body = res.data as AdminResult<T>
        if (res.statusCode >= 200 && res.statusCode < 300 && body?.code === 200) {
          resolve(body.result)
          return
        }

        // 401=token 失效/过期；403=被强制下线（权限变更后进登录黑名单，JwtHandler context.Fail()）。
        // 本应用所有业务鉴权失败走 Oops.Oh()（200 信封 + 业务码），不会产生 403，故 403 只可能是黑名单 → 同样需重新登录。
        if (body?.code === 401 || body?.code === 403 || res.statusCode === 401 || res.statusCode === 403) {
          if (auth) {
            invalidateSessionContext()
            uni.removeStorageSync(SHENLE_TOKEN_KEY)
            uni.removeStorageSync(SHENLE_USER_KEY)
            uni.$emit('shenle:session-changed')
            // 当前会话失效时同步Pinia；旧会话401已在回调开头排除。
            uni.$emit('shenle:unauthorized')
            if (!silent)
              promptLoginAgain()
          }
          reject(new Error(body?.message || '未授权'))
          return
        }

        const message = body?.message || `请求失败(${res.statusCode})`
        if (!silent) {
          uni.showToast({ title: message, icon: 'none' })
        }
        reject(new Error(message))
      },
      fail(error) {
        if (auth && !isCurrentSession(context)) {
          reject(new StaleSessionError())
          return
        }
        console.error('request fail:', error)
        if (!silent) {
          uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        }
        reject(error)
      },
    })
  })
}

export function get<T>(url: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'url' | 'data' | 'method'>) {
  return request<T>({ url, data, method: 'GET', ...options })
}

export function post<T>(url: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'url' | 'data' | 'method'>) {
  return request<T>({ url, data, method: 'POST', ...options })
}
