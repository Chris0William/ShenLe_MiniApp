import { useShenleAuthStore } from '@/store/auth'
import { promptProtectedLogin } from '@/utils/login-flow'

/**
 * 动作级登录/准入拦截（微信合规：浏览免登录，关键动作才要登录）。
 * - 未登录 → 弹窗引导去登录
 * - 666 游客（被降级）→ 引导去申请页
 * - 777+ → 放行返回 true
 * @param tip 自定义提示文案
 * @returns 是否可继续执行该动作
 */
export function ensureCanUse(tip = '登录后即可使用该功能'): boolean {
  const auth = useShenleAuthStore()
  if (!auth.isLogin) {
    promptProtectedLogin(tip)
    return false
  }
  if (auth.isGuest) {
    uni.navigateTo({ url: '/pages/common/apply/index' })
    return false
  }
  return true
}
