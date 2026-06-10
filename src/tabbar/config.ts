import type { TabBar } from '@uni-helper/vite-plugin-uni-pages'
import type { CustomTabBarItem, NativeTabBarItem } from './types'

export const TABBAR_STRATEGY_MAP = {
  NO_TABBAR: 0,
  NATIVE_TABBAR: 1,
  CUSTOM_TABBAR: 2,
}

export const selectedTabbarStrategy = TABBAR_STRATEGY_MAP.CUSTOM_TABBAR

export const nativeTabbarList: NativeTabBarItem[] = [
  {
    iconPath: 'static/tabbar/home.png',
    selectedIconPath: 'static/tabbar/homeHL.png',
    pagePath: 'pages/admin/dashboard/index',
    text: '工作台',
  },
  {
    iconPath: 'static/tabbar/personal.png',
    selectedIconPath: 'static/tabbar/personalHL.png',
    pagePath: 'pages/admin/mine/index',
    text: '我的',
  },
]

export const customTabbarList: CustomTabBarItem[] = [
  {
    text: '工作台',
    pagePath: 'pages/admin/dashboard/index',
    iconType: 'unocss',
    icon: 'i-carbon-dashboard',
  },
  {
    text: '房源',
    pagePath: 'pages/admin/property-list/index',
    iconType: 'unocss',
    icon: 'i-carbon-building',
  },
  {
    text: '地图',
    pagePath: 'pages/user/map/index',
    iconType: 'unocss',
    icon: 'i-carbon-location',
  },
  {
    text: '销控',
    pagePath: 'pages/admin/sales-control/index',
    iconType: 'unocss',
    icon: 'i-carbon-table-split',
  },
  {
    text: '我的',
    pagePath: 'pages/admin/mine/index',
    iconType: 'unocss',
    icon: 'i-carbon-user',
  },
]

export const tabbarCacheEnable
  = [TABBAR_STRATEGY_MAP.NATIVE_TABBAR, TABBAR_STRATEGY_MAP.CUSTOM_TABBAR].includes(selectedTabbarStrategy)

export const customTabbarEnable = [TABBAR_STRATEGY_MAP.CUSTOM_TABBAR].includes(selectedTabbarStrategy)

export const needHideNativeTabbar = selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR

const _tabbarList = customTabbarEnable ? customTabbarList.map(item => ({ text: item.text, pagePath: item.pagePath })) : nativeTabbarList
export const tabbarList = customTabbarEnable ? customTabbarList : nativeTabbarList

const _tabbar: TabBar = {
  custom: selectedTabbarStrategy === TABBAR_STRATEGY_MAP.CUSTOM_TABBAR,
  color: '#7a8780',
  selectedColor: '#126b4f',
  backgroundColor: '#fbfcf7',
  borderStyle: 'white',
  height: '56px',
  fontSize: '10px',
  iconWidth: '24px',
  spacing: '3px',
  list: _tabbarList as unknown as TabBar['list'],
}

export const tabBar = tabbarCacheEnable ? _tabbar : undefined
