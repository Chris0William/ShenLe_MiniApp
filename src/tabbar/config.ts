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

const MAP_TAB: CustomTabBarItem = { text: '地图', pagePath: 'pages/user/map/index', iconType: 'unocss', icon: 'i-carbon-location' }
const PROPERTY_TAB: CustomTabBarItem = { text: '房源', pagePath: 'pages/admin/property-list/index', iconType: 'unocss', icon: 'i-carbon-building' }
const DASHBOARD_TAB: CustomTabBarItem = { text: '工作台', pagePath: 'pages/admin/dashboard/index', iconType: 'unocss', icon: 'i-carbon-dashboard' }
const SALES_TAB: CustomTabBarItem = { text: '销控', pagePath: 'pages/admin/sales-control/index', iconType: 'unocss', icon: 'i-carbon-table-split' }
const MINE_TAB: CustomTabBarItem = { text: '我的', pagePath: 'pages/admin/mine/index', iconType: 'unocss', icon: 'i-carbon-user' }

/** 用户模式 tab：地图 / 房源 / 我的（房源只读、我的展示用户视图） */
export const userTabbarList: CustomTabBarItem[] = [MAP_TAB, PROPERTY_TAB, MINE_TAB]

/** 管理模式 tab：地图 / 房源 / 工作台 / 销控 / 我的（地图第一，与用户端一致） */
export const adminTabbarList: CustomTabBarItem[] = [MAP_TAB, PROPERTY_TAB, DASHBOARD_TAB, SALES_TAB, MINE_TAB]

/** 盘源对接人模式 tab：地图 / 房源 / 我的（与用户端相同入口，盘源对接人身份由后端控制权限） */
export const landlordTabbarList: CustomTabBarItem[] = [MAP_TAB, PROPERTY_TAB, MINE_TAB]

// 原生 tabBar.list 取并集（5 项，与现状一致；微信原生 list 最多 5 项，运行时由自定义组件按 mode 裁剪）
export const customTabbarList: CustomTabBarItem[] = [MAP_TAB, PROPERTY_TAB, DASHBOARD_TAB, SALES_TAB, MINE_TAB]

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
