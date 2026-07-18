/** 媒体文件类型判断（楼盘媒体池同时存图片与视频，后端 fileType/suffix 不总是齐全） */
export type MediaKind = 'image' | 'video'

export const MEDIA_SELECTION_BATCH_LIMIT = 9

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

export function isLocalMediaUrl(value?: string | null) {
  const url = String(value || '').toLowerCase()
  return url.startsWith('wxfile://')
    || url.startsWith('file://')
    || url.startsWith('blob:')
    || url.startsWith('_doc/')
    || /^https?:\/\/tmp\//.test(url)
}
