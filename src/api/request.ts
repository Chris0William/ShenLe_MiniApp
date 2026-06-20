import type { AdminResult } from '@/types/shenle'
import { promptProtectedLogin } from '@/utils/login-flow'
import { getApiBaseUrl, SHENLE_TOKEN_KEY, SHENLE_USER_KEY } from '@/utils/shenle'

export type RequestMethod = 'GET' | 'POST'

export interface RequestOptions {
  url: string
  method?: RequestMethod
  data?: Record<string, unknown>
  header?: Record<string, string>
  auth?: boolean
  silent?: boolean
}

let promptingLogin = false

function cleanQuery(data?: Record<string, unknown>) {
  if (!data)
    return undefined
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

function promptLoginAgain() {
  if (promptingLogin)
    return
  promptingLogin = true
  promptProtectedLogin('登录状态已过期，请重新登录后继续')
  setTimeout(() => {
    promptingLogin = false
  }, 800)
}

export function request<T>({ url, method = 'GET', data, header, auth = true, silent = false }: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    uni.request({
      url: `${getApiBaseUrl()}${url}`,
      method,
      data: method === 'GET' ? cleanQuery(data) : data,
      header: {
        'Content-Type': 'application/json',
        ...header,
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        const body = res.data as AdminResult<T>
        if (body?.code === 200) {
          resolve(body.result)
          return
        }

        if (body?.code === 401 || res.statusCode === 401) {
          uni.removeStorageSync(SHENLE_TOKEN_KEY)
          uni.removeStorageSync(SHENLE_USER_KEY)
          // 通知 auth store 同步清理内存登录态（storage 与 pinia 不同步会造成登录页/业务页来回横跳）
          uni.$emit('shenle:unauthorized')
          if (!silent) {
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
