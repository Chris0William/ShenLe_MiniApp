/**
 * 自定义导航栏页面的顶部安全区计算。
 * 自定义导航时页面内容从屏幕最顶端开始，必须为状态栏 + 微信胶囊按钮预留高度，
 * 否则页头会被胶囊遮挡。
 */
let cachedTopPx: number | null = null

/** 顶部安全内边距（px）：胶囊按钮底边 + 8px 间距，取不到时回退状态栏高度 + 44px */
export function getSafeTopPx(): number {
  if (cachedTopPx !== null)
    return cachedTopPx

  let top = 0
  try {
    const rect = uni.getMenuButtonBoundingClientRect?.()
    if (rect?.bottom)
      top = rect.bottom + 8
  }
  catch {}

  if (!top) {
    try {
      const info = uni.getWindowInfo?.() ?? uni.getSystemInfoSync()
      top = (info.statusBarHeight || 24) + 44
    }
    catch {
      top = 68
    }
  }

  cachedTopPx = top
  return top
}

/** 绑定到自定义导航页面根节点的 style */
export function useSafeTopStyle(): Record<string, string> {
  return { paddingTop: `${getSafeTopPx()}px` }
}
