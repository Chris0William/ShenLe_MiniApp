import { reactive } from 'vue'
import { SHENLE_TOKEN_KEY, SHENLE_USER_KEY } from '@/utils/shenle'

export type AppMode = 'user' | 'admin' | 'landlord'
export type ModeChangeListener = (next: AppMode, previous: AppMode) => void

const APP_MODE_KEY = 'app-mode'
const modeChangeListeners = new Set<ModeChangeListener>()

export function isLandlordOnlySession() {
  const user = uni.getStorageSync(SHENLE_USER_KEY)
  return !!uni.getStorageSync(SHENLE_TOKEN_KEY) && !!user?.isLandlord && (user.accountType || 0) < 888
}

export function onModeChange(listener: ModeChangeListener) {
  modeChangeListeners.add(listener)
  return () => modeChangeListeners.delete(listener)
}

/**
 * 读取初始模式。
 * admin 模式前提：有 token 且 storage 里 accountType≥888。
 * 直接读 storage（不依赖 pinia 已初始化），以便 tabbar/store 这类非 pinia 单例也能用。
 * 登出 / 401（已清 token）后，下次冷启动必回 user。
 */
function readInitialMode(): AppMode {
  try {
    if (isLandlordOnlySession())
      return 'landlord'
    const saved = uni.getStorageSync(APP_MODE_KEY)
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY)
    const user = uni.getStorageSync(SHENLE_USER_KEY)
    const accountType = user?.accountType || 0
    const canEnterAdmin = !!token && (accountType >= 888 || !!user?.canEnterRestrictedAdmin)
    const canEnterLandlord = !!token && !!user?.canEnterLandlordPortal
    // 只有房东端身份、没有受限管理端身份的账号默认进入房东端。
    if (canEnterLandlord && !canEnterAdmin)
      return 'landlord'
    if (saved === 'admin' && canEnterAdmin)
      return 'admin'
    if (saved === 'landlord' && canEnterLandlord)
      return 'landlord'
    return 'user'
  }
  catch {
    return 'user'
  }
}

export const modeStore = reactive({
  mode: readInitialMode() as AppMode,
  setMode(next: AppMode) {
    if (isLandlordOnlySession())
      next = 'landlord'
    const previous = this.mode
    this.mode = next
    uni.setStorageSync(APP_MODE_KEY, next)
    if (previous === next)
      return
    for (const listener of [...modeChangeListeners]) {
      try {
        listener(next, previous)
      }
      catch {}
    }
  },
})
