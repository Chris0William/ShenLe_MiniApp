/** 媒体文件类型判断（楼盘媒体池同时存图片与视频，后端 fileType/suffix 不总是齐全） */
export type MediaKind = 'image' | 'video'

const IMAGE_SUFFIXES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic']
const VIDEO_SUFFIXES = ['.mp4', '.mov', '.m4v', '.avi', '.webm']

export function extensionOf(value?: string | null) {
  const clean = String(value || '').split('?')[0].toLowerCase()
  const index = clean.lastIndexOf('.')
  return index >= 0 ? clean.slice(index) : ''
}

export function mediaKindOf(fileType?: string | null, suffixOrUrl?: string | null): MediaKind {
  const type = String(fileType || '').toLowerCase()
  const suffix = extensionOf(suffixOrUrl)
  if (type.startsWith('video') || VIDEO_SUFFIXES.includes(suffix))
    return 'video'
  return 'image'
}

/**
 * 视频首帧缩略图 URL（COS 数据万象截帧）。
 * 万象服务未开通时该 URL 返回 400，调用方需用 image @error 回退到占位块。
 */
export function videoSnapshotUrl(url?: string | null): string {
  const value = String(url || '')
  if (!value.includes('.myqcloud.com/'))
    return ''
  return `${value}${value.includes('?') ? '&' : '?'}ci-process=snapshot&time=0.1&format=jpg`
}
