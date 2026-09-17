import { useShenleAuthStore } from '@/store/auth'
import { promptProtectedLogin } from '@/utils/login-flow'

/**
 * 动作级登录/准入拦截（微信合规：浏览免登录，关键动作才要登录）。
 * - 未登录 → 弹窗引导去登录
 * - 666 游客（被降级）→ 提示找管理员扫码申请（申请入口仅限业务员申请码，界面点击不再进入）
 * - 已获得 supply.read → 放行返回 true
 * @param tip 自定义提示文案
 * @returns 是否可继续执行该动作
 */
export function ensureCanUse(tip = '登录后即可使用该功能'): boolean {
  const auth = useShenleAuthStore()
  if (!auth.isLogin) {
    promptProtectedLogin(tip)
    return false
  }
  if (auth.isRbacManaged && !auth.canViewRealData) {
    uni.showToast({ title: '当前账号无权查看盘源，请联系管理员', icon: 'none', duration: 3000 })
    return false
  }
  if (auth.isGuest) {
    uni.showToast({ title: '如需申请成为业务员，请联系管理员获取申请二维码', icon: 'none', duration: 3000 })
    return false
  }
  return true
}
