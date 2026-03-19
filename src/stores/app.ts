import { defineStore } from 'pinia'
import { ref } from 'vue'

export type AppMode = 'user' | 'admin'

/** Tab 页标识 */
export type TabKey =
  | 'user-home' | 'user-map' | 'user-mine'
  | 'admin-map' | 'admin-property-list' | 'admin-dashboard' | 'admin-sales-control' | 'admin-mine'

const DEFAULT_TABS: Record<AppMode, TabKey> = {
  user: 'user-home',
  admin: 'admin-dashboard',
}

export const useAppStore = defineStore('app', () => {
  const mode = ref<AppMode>('user')
  const currentTab = ref<TabKey>('user-home')

  /** 状态栏高度（px），用于页面顶部安全区 */
  const statusBarHeight = ref(44)
  try {
    const info = uni.getSystemInfoSync()
    statusBarHeight.value = info.statusBarHeight || 44
  } catch {}

  /** 页面头部 padding-top 样式（状态栏 + 间距） */
  const headerPaddingStyle = (extraPx = 10) =>
    `${statusBarHeight.value + extraPx}px`

  function loadMode() {
    const saved = uni.getStorageSync('appMode') as AppMode
    if (saved === 'admin' || saved === 'user') {
      mode.value = saved
    }
    currentTab.value = DEFAULT_TABS[mode.value]
  }

  /** 切换模式 (用户端 ↔ 管理端)，只更新状态，Shell 自动响应 */
  function switchMode(target: AppMode) {
    mode.value = target
    uni.setStorageSync('appMode', target)
    currentTab.value = DEFAULT_TABS[target]
  }

  /** 切换当前 Tab */
  function switchTab(tab: TabKey) {
    currentTab.value = tab
  }

  return { mode, currentTab, statusBarHeight, headerPaddingStyle, loadMode, switchMode, switchTab }
})
