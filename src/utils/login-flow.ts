export const LOGIN_REQUEST_EVENT = 'shenle:login-request'
const PROTECTED_LOGIN_MODAL_CLOSE_DELAY_MS = 320

export interface LoginRequestOptions {
  reason?: string
  redirect?: string
  onSuccess?: () => void
  onCancel?: () => void
}

export interface LoginRequestPayload extends LoginRequestOptions {
  handled: boolean
  hostRoute: string
  onSuccess?: () => void
  onCancel?: () => void
}

function currentRoute() {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1]
  if (!current?.route)
    return '/pages/user/map/index'
  return current.route.startsWith('/') ? current.route : `/${current.route}`
}

// 登录后的重定向目标：仅在此处规避“回到登录页本身”。
// 注意：hostRoute 必须用真实路由（currentRoute），不能套用此规避——否则登录页自身的同意组件永远匹配不上，按钮会失效并叠页。
function redirectTarget() {
  const route = currentRoute()
  return route.includes('/pages/common/login') ? '/pages/user/map/index' : route
}

export function requestLogin(options: LoginRequestOptions = {}): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const settle = (value: boolean) => {
      if (settled)
        return
      settled = true
      resolve(value)
    }
    const payload: LoginRequestPayload = {
      ...options,
      handled: false,
      hostRoute: currentRoute(),
      redirect: options.redirect || redirectTarget(),
      onSuccess: () => {
        options.onSuccess?.()
        settle(true)
      },
      onCancel: () => {
        options.onCancel?.()
        settle(false)
      },
    }

    uni.$emit(LOGIN_REQUEST_EVENT, payload)

    setTimeout(() => {
      if (payload.handled)
        return
      const redirect = encodeURIComponent(payload.redirect || redirectTarget())
      uni.navigateTo({ url: `/pages/common/login/index?redirect=${redirect}` })
      settle(false)
    }, 80)
  })
}

export function promptProtectedLogin(tip = '登录后即可使用该功能') {
  uni.showModal({
    title: '需要登录后继续',
    content: tip,
    confirmText: '登录',
    cancelText: '取消',
    confirmColor: '#126b4f',
    success: (res) => {
      if (res.confirm)
        setTimeout(() => requestLogin({ reason: tip }), PROTECTED_LOGIN_MODAL_CLOSE_DELAY_MS)
    },
  })
}
