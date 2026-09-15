import { version } from '../../package.json'

/** 当前应用版本号：构建时取自 package.json，上传体验版/审核时必须使用同一版本号 */
export const APP_VERSION: string = version

/** 微信运行渠道：正式版 / 体验版 / 开发版 */
export const APP_CHANNEL: string = resolveChannelLabel()

/** 接口环境：测试环境 / 正式环境 */
export const API_ENV_LABEL: string = (import.meta.env.VITE_SERVER_BASEURL || '').includes('/test-api')
  ? '测试环境'
  : '正式环境'

function resolveChannelLabel(): string {
  try {
    const info = typeof uni !== 'undefined' ? uni?.getAccountInfoSync?.() : undefined
    const env = info?.miniProgram?.envVersion
    if (env === 'release')
      return '正式版'
    if (env === 'trial')
      return '体验版'
  }
  catch {
    // 低版本基础库或非微信环境无此 API，视为开发版
  }
  return '开发版'
}
