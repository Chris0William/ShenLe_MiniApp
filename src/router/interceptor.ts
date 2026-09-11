import type { App } from 'vue'
import { useShenleAuthStore } from '@/store/auth'
import { isLandlordOnlySession, modeStore } from '@/store/mode'
/**
 * by 菲鸽 on 2025-08-19
 * 路由拦截，通常也是登录拦截
 * 黑、白名单的配置，请看 config.ts 文件， EXCLUDE_LOGIN_PATH_LIST
 */
import { tabbarStore } from '@/tabbar/store'
import { getLastPage, parseUrlToObj } from '@/utils/index'
import { promptProtectedLogin } from '@/utils/login-flow'

export const FG_LOG_ENABLE = false

// 全量管理端独有页。房东维护人不能进入系统字典、用户或身份管理。
// 共享页（地图/房源列表 admin/property-list/楼盘房源 community-properties/详情/我的 admin/mine）
// 用户模式也要可达，因此不在此列——其管理动作由各页 canManage 控制显隐。
const PROTECTED_PATHS = [
  '/pages/admin/user-manage/index', // 超管页，登录+管理员先过守卫，999 由页面自守卫
  '/pages/admin/application-detail/index', // 用户申请资料详情，仅超级管理员
  '/pages/admin/landlord-manage/index',
  '/pages/admin/landlord-profile-manage/index',
  '/pages/common/region-manage/index',
  '/pages/common/tag-manage/index',
]

// 管理端或房东端共享页面；后端继续校验具体楼盘数据范围。
const PORTAL_PATHS = [
  '/pages/admin/dashboard/index',
  '/pages/admin/sales-control/index',
  '/pages/landlord/my-communities/index',
  '/pages/landlord/account/index',
  '/pages/common/community-manage/index',
  '/pages/common/building-manage/index',
  '/pages/common/property-form/index',
]

function needsLogin(path: string) {
  return PROTECTED_PATHS.some(item => path === item || path.startsWith(item))
}

function needsPortalAccess(path: string) {
  return PORTAL_PATHS.some(item => path === item || path.startsWith(item))
}

export function landlordRedirect(path: string) {
  if (path === '/pages/landlord/my-communities/index')
    return '/pages/admin/sales-control/index'
  if (needsLogin(path) || path === '/pages/admin/property-list/index' || path === '/pages/common/apply/index')
    return '/pages/user/map/index'
  return ''
}

let landlordRedirectPending = false

function enforceLandlordRoute(path: string) {
  if (!isLandlordOnlySession())
    return true
  modeStore.setMode('landlord')
  const target = landlordRedirect(path)
  if (!target)
    return true
  if (!landlordRedirectPending) {
    landlordRedirectPending = true
    // 初始加载及返回旧页面时，等当前导航结束再重建房东端页面栈。
    setTimeout(() => {
      uni.reLaunch({
        url: target,
        complete: () => {
          landlordRedirectPending = false
        },
      })
    }, 0)
  }
  return false
}

export const navigateToInterceptor = {
  // 注意，这里的url是 '/' 开头的，如 '/pages/index/index'，跟 'pages.json' 里面的 path 不同
  // 增加对相对路径的处理，BY 网友 @ideal
  invoke({ url, query }: { url: string, query?: Record<string, string> }) {
    if (url === undefined) {
      return
    }
    let { path, query: _query } = parseUrlToObj(url)

    FG_LOG_ENABLE && console.log('\n\n路由拦截器:-------------------------------------')
    FG_LOG_ENABLE && console.log('路由拦截器 1: url->', url, ', query ->', query)
    const myQuery = { ..._query, ...query }
    // /pages/route-interceptor/index?name=feige&age=30
    FG_LOG_ENABLE && console.log('路由拦截器 2: path->', path, ', _query ->', _query)
    FG_LOG_ENABLE && console.log('路由拦截器 3: myQuery ->', myQuery)

    // 处理相对路径
    if (!path.startsWith('/')) {
      const currentPath = getLastPage()?.route || ''
      const normalizedCurrentPath = currentPath.startsWith('/') ? currentPath : `/${currentPath}`
      const baseDir = normalizedCurrentPath.substring(0, normalizedCurrentPath.lastIndexOf('/'))
      path = `${baseDir}/${path}`
    }

    // // 处理路由不存在的情况
    // if (path !== '/' && !getAllPages().some(page => page.path === path)) {
    //   console.warn('路由不存在:', path)
    //   return false // 明确表示阻止原路由继续执行
    // }

    // // 插件页面
    // if (url.startsWith('plugin://')) {
    //   FG_LOG_ENABLE && console.log('路由拦截器 4: plugin:// 路径 ==>', url)
    //   path = url
    // }

    if (!enforceLandlordRoute(path))
      return false
    const auth = useShenleAuthStore()
    if (needsLogin(path)) {
      if (!auth.isLogin) {
        promptProtectedLogin('登录管理员账号后可使用管理端功能')
        return false
      }
      // 管理端独有页仅 888 可用；非 888 不踢死，提示后留在业务员端
      if (!auth.isAdmin) {
        uni.showToast({ title: '仅管理员可使用管理端', icon: 'none' })
        return false
      }
    }
    if (needsPortalAccess(path)) {
      if (!auth.isLogin) {
        promptProtectedLogin('登录后可使用楼栋/房源管理功能')
        return false
      }
      if (!auth.canEnterAdmin && !auth.canEnterLandlordPortal) {
        uni.showToast({ title: '当前账号没有管理权限', icon: 'none' })
        return false
      }
    }

    // 处理直接进入路由非首页时，tabbarIndex 不正确的问题
    tabbarStore.setAutoCurIdx(path)
  },
}

export const routeInterceptor = {
  install(app: App) {
    app.mixin({
      onShow() {
        const route = getLastPage()?.route
        if (route)
          enforceLandlordRoute(route.startsWith('/') ? route : `/${route}`)
      },
    })
    uni.addInterceptor('navigateTo', navigateToInterceptor)
    uni.addInterceptor('reLaunch', navigateToInterceptor)
    uni.addInterceptor('redirectTo', navigateToInterceptor)
    uni.addInterceptor('switchTab', navigateToInterceptor)
  },
}
