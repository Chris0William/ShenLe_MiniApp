import type { ShenLeId } from '@/types/shenle'
import { renameMedia } from '@/api/file'

export const MEDIA_EDIT_ACTIONS = ['查看', '编辑媒体名称', '设置为封面'] as const
export const MEDIA_RENAME_ACTIONS = ['编辑媒体名称'] as const

export type MediaEditAction = 'view' | 'rename' | 'cover'

export interface RenameEditableMediaOptions {
  id: ShenLeId
  fileName?: string | null
  suffix?: string | null
  onRenamed: (fileName: string) => void
}

interface EditableModalResult {
  confirm: boolean
  content?: string
}

const ACTION_BY_INDEX: MediaEditAction[] = ['view', 'rename', 'cover']
const MAX_MEDIA_NAME_LENGTH = 112

function normalizeSuffix(suffix?: string | null) {
  const value = String(suffix || '').trim()
  if (!value)
    return ''
  return value.startsWith('.') ? value : `.${value}`
}

export function mediaBaseName(fileName?: string | null, suffix?: string | null) {
  const value = String(fileName || '').trim()
  const normalizedSuffix = normalizeSuffix(suffix)
  if (normalizedSuffix && value.toLowerCase().endsWith(normalizedSuffix.toLowerCase()))
    return value.slice(0, -normalizedSuffix.length).trimEnd()
  return value
}

export function createMediaLongPressGuard(duration = 1000, now: () => number = Date.now) {
  let suppressUntil = 0
  return {
    mark() {
      suppressUntil = now() + duration
    },
    consumeTap() {
      if (now() > suppressUntil)
        return false
      suppressUntil = 0
      return true
    },
  }
}

export function showMediaEditActionSheet(): Promise<MediaEditAction | null> {
  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: [...MEDIA_EDIT_ACTIONS],
      success: result => resolve(ACTION_BY_INDEX[result.tapIndex] || null),
      fail: () => resolve(null),
    })
  })
}

export function showMediaRenameActionSheet(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showActionSheet({
      itemList: [...MEDIA_RENAME_ACTIONS],
      success: result => resolve(result.tapIndex === 0),
      fail: () => resolve(false),
    })
  })
}

function promptMediaName(fileName?: string | null, suffix?: string | null) {
  return new Promise<string | null>((resolve) => {
    uni.showModal({
      title: '编辑媒体名称',
      content: mediaBaseName(fileName, suffix),
      editable: true,
      placeholderText: '请输入媒体名称',
      confirmText: '保存',
      success: (result) => {
        const modalResult = result as EditableModalResult
        resolve(modalResult.confirm ? String(modalResult.content || '').trim() : null)
      },
      fail: () => resolve(null),
    })
  })
}

async function validatedMediaName(fileName?: string | null, suffix?: string | null) {
  const name = await promptMediaName(fileName, suffix)
  if (name === null)
    return null
  if (!name) {
    uni.showToast({ title: '媒体名称不能为空', icon: 'none' })
    return null
  }
  if (name.length > MAX_MEDIA_NAME_LENGTH) {
    uni.showToast({ title: '媒体名称不能超过112个字符', icon: 'none' })
    return null
  }
  return name
}

export async function renameEditableMedia(options: RenameEditableMediaOptions) {
  const name = await validatedMediaName(options.fileName, options.suffix)
  if (name === null)
    return false

  uni.showLoading({ title: '正在保存', mask: true })
  try {
    const fileName = await renameMedia({ id: options.id, name })
    options.onRenamed(fileName)
    uni.showToast({ title: '名称已更新', icon: 'success' })
    return true
  }
  catch {
    return false
  }
  finally {
    uni.hideLoading()
  }
}
