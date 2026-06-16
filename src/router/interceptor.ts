import { useShenleAuthStore } from '@/store/auth'
/**
 * by 菲鸽 on 2025-08-19
 * 路由拦截，通常也是登录拦截
 * 黑、白名单的配置，请看 config.ts 文件， EXCLUDE_LOGIN_PATH_LIST
 */
import { tabbarStore } from '@/tabbar/store'
import { getLastPage, parseUrlToObj } from '@/utils/index'

export const FG_LOG_ENABLE = false

// 仅管理端独有页需要 888 门控。
// 共享页（地图/房源列表 admin/property-list/楼盘房源 community-properties/详情/我的 admin/mine）
// 用户模式也要可达，因此不在此列——其管理动作由各页 canManage 控制显隐。
const PROTECTED_PATHS = [
  '/pages/admin/dashboard/index',
  '/pages/admin/sales-control/index',
  '/pages/common/building-manage/index',
  '/pages/common/community-manage/index',
  '/pages/common/property-form/index',
  '/pages/common/region-manage/index',
  '/pages/common/tag-manage/index',
]

function needsLogin(path: string) {
  return PROTECTED_PATHS.some(item => path === item || path.startsWith(item))
}

function toLogin(path: string) {
  uni.navigateTo({
    url: `/pages/common/login/index?redirect=${encodeURIComponent(path)}`,
  })
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

    const auth = useShenleAuthStore()
    if (needsLogin(path)) {
      if (!auth.isLogin) {
        toLogin(path)
        return false
      }
      // 管理端独有页仅 888 可用；非 888 不踢死，提示后留在用户端
      if (!auth.isAdmin) {
        uni.showToast({ title: '仅管理员可使用管理端', icon: 'none' })
        return false
      }
    }

    // 处理直接进入路由非首页时，tabbarIndex 不正确的问题
    tabbarStore.setAutoCurIdx(path)
  },
}

export const routeInterceptor = {
  install() {
    uni.addInterceptor('navigateTo', navigateToInterceptor)
    uni.addInterceptor('reLaunch', navigateToInterceptor)
    uni.addInterceptor('redirectTo', navigateToInterceptor)
    uni.addInterceptor('switchTab', navigateToInterceptor)
  },
}
