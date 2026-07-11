import type { CustomTabBarItem, CustomTabBarItemBadge } from './types'
import { computed, reactive } from 'vue'

import { modeStore } from '@/store/mode'
import { adminTabbarList, landlordTabbarList, selectedTabbarStrategy, TABBAR_STRATEGY_MAP, userTabbarList } from './config'

function normalize(list: CustomTabBarItem[]) {
  return list.map(item => ({
    ...item,
    pagePath: item.pagePath.startsWith('/') ? item.pagePath : `/${item.pagePath}`, // 统一成 '/' 开头
  }))
}

const baseUserList = reactive<CustomTabBarItem[]>(normalize(userTabbarList))
const baseAdminList = reactive<CustomTabBarItem[]>(normalize(adminTabbarList))
const baseLandlordList = reactive<CustomTabBarItem[]>(normalize(landlordTabbarList))

/** 随 mode 切换的 tab 集（用户 3 项 / 管理 5 项 / 盘源对接人 3 项） */
const tabbarList = computed(() =>
  modeStore.mode === 'admin'
    ? baseAdminList
    : modeStore.mode === 'landlord'
      ? baseLandlordList
      : baseUserList,
)

export function isPageTabbar(path: string) {
  if (selectedTabbarStrategy === TABBAR_STRATEGY_MAP.NO_TABBAR) {
    return false
  }
  const _path = path.split('?')[0]
  return tabbarList.value.some(item => item.pagePath === _path)
}

/**
 * 自定义 tabbar 的状态管理，原生 tabbar 无需关注本文件
 * tabbar 状态，增加 storageSync 保证刷新浏览器时在正确的 tabbar 页面
 * 使用reactive简单状态，而不是 pinia 全局状态
 */
const tabbarStore = reactive({
  curIdx: uni.getStorageSync('app-tabbar-index') || 0,
  prevIdx: uni.getStorageSync('app-tabbar-index') || 0,
  setCurIdx(idx: number) {
    this.curIdx = idx
    uni.setStorageSync('app-tabbar-index', idx)
  },
  setTabbarItemBadge(idx: number, badge: CustomTabBarItemBadge) {
    const list = tabbarList.value
    if (list[idx]) {
      list[idx].badge = badge
    }
  },
  setAutoCurIdx(path: string) {
    const list = tabbarList.value
    if (list.length === 0) {
      this.setCurIdx(0)
      return
    }
    // '/' 当做首页
    if (path === '/') {
      this.setCurIdx(0)
      return
    }
    const index = list.findIndex(item => item.pagePath === path)
    // console.log('tabbarList:', tabbarList)
    if (index === -1) {
      const pagesPathList = getCurrentPages().map(item => item.route.startsWith('/') ? item.route : `/${item.route}`)
      // console.log(pagesPathList)
      const flag = list.some(item => pagesPathList.includes(item.pagePath))
      if (!flag) {
        this.setCurIdx(0)
        return
      }
    }
    else {
      this.setCurIdx(index)
    }
  },
  restorePrevIdx() {
    if (this.prevIdx === this.curIdx)
      return
    this.setCurIdx(this.prevIdx)
    this.prevIdx = uni.getStorageSync('app-tabbar-index') || 0
  },
})

export { tabbarList, tabbarStore }
