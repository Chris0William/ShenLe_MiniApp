import type { AdminResult } from '@/types/common'

export const BASE_URL = 'https://fmcs.deerservice.com/api/sl'

function getToken(): string {
  return uni.getStorageSync('token') || ''
}

/** 401 登录处理器：返回 true 表示登录成功可重试 */
type LoginHandler = () => Promise<boolean>
let onUnauthorized: LoginHandler | null = null
let loginPromise: Promise<boolean> | null = null

/** 注册 401 登录处理器（由 App.vue 调用） */
export function setUnauthorizedHandler(handler: LoginHandler) {
  onUnauthorized = handler
}

/** 通用请求封装（canRetry 防止重试后再次 401 死循环） */
function doRequest<T>(method: 'GET' | 'POST', url: string, data?: any, canRetry = true): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      success(res) {
        // 后端所有响应均为 HTTP 200，真实状态码在 body.code 中
        const body = res.data as AdminResult<T>
        const is401 = body.code === 401

        // 401 → 尝试自动登录后重试
        if (is401 && canRetry && onUnauthorized) {
          if (!loginPromise) {
            loginPromise = onUnauthorized().finally(() => { loginPromise = null })
          }
          loginPromise
            .then((ok) => {
              if (ok) {
                doRequest<T>(method, url, data, false).then(resolve).catch(reject)
              } else {
                reject(new Error('未授权，请重新登录'))
              }
            })
            .catch(() => reject(new Error('未授权，请重新登录')))
          return
        }

        if (is401) {
          uni.removeStorageSync('token')
          reject(new Error('未授权，请重新登录'))
          return
        }

        if (body.code === 200) {
          resolve(body.result)
        } else {
          uni.showToast({ title: body.message || '请求失败', icon: 'none' })
          reject(new Error(body.message))
        }
      },
      fail(err) {
        uni.showToast({ title: '网络异常', icon: 'none' })
        reject(err)
      },
    })
  })
}

/** GET 请求（canRetry=false 跳过 401 自动重试，用于登录等接口） */
export function get<T>(url: string, data?: any, canRetry = true): Promise<T> {
  const params = data
    ? Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))
    : undefined
  return doRequest<T>('GET', url, params, canRetry)
}

/** POST 请求（canRetry=false 跳过 401 自动重试，用于登录等接口） */
export function post<T>(url: string, data?: any, canRetry = true): Promise<T> {
  return doRequest<T>('POST', url, data, canRetry)
}
