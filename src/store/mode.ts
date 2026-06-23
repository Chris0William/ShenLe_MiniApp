import { reactive } from 'vue'
import { SHENLE_TOKEN_KEY, SHENLE_USER_KEY } from '@/utils/shenle'

export type AppMode = 'user' | 'admin' | 'landlord'

const APP_MODE_KEY = 'app-mode'

/**
 * 读取初始模式。
 * admin 模式前提：有 token 且 storage 里 accountType≥888。
 * 直接读 storage（不依赖 pinia 已初始化），以便 tabbar/store 这类非 pinia 单例也能用。
 * 登出 / 401（已清 token）后，下次冷启动必回 user。
 */
function readInitialMode(): AppMode {
  try {
    const saved = uni.getStorageSync(APP_MODE_KEY)
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY)
    const user = uni.getStorageSync(SHENLE_USER_KEY)
    const isAdmin = !!token && (user?.accountType || 0) >= 888
    if (saved === 'admin' && isAdmin)
      return 'admin'
    if (saved === 'landlord' && !!token && !!user?.isLandlord)
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
    this.mode = next
    uni.setStorageSync(APP_MODE_KEY, next)
  },
})
