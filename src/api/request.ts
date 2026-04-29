import type { AdminResult } from '@/types/shenle'
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

let redirectingLogin = false

function cleanQuery(data?: Record<string, unknown>) {
  if (!data)
    return undefined
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== ''))
}

function redirectToLogin() {
  if (redirectingLogin)
    return
  redirectingLogin = true
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  const route = current?.route ? `/${current.route}` : '/pages/admin/dashboard/index'
  uni.navigateTo({
    url: `/pages/common/login/index?redirect=${encodeURIComponent(route)}`,
    complete: () => {
      setTimeout(() => {
        redirectingLogin = false
      }, 800)
    },
  })
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
          if (!silent) {
            uni.showToast({ title: '登录已过期', icon: 'none' })
            redirectToLogin()
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
        if (!silent) {
          uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
        }
        reject(error)
      },
    })
  })
}

export const get = <T>(url: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'url' | 'data' | 'method'>) =>
  request<T>({ url, data, method: 'GET', ...options })

export const post = <T>(url: string, data?: Record<string, unknown>, options?: Omit<RequestOptions, 'url' | 'data' | 'method'>) =>
  request<T>({ url, data, method: 'POST', ...options })
