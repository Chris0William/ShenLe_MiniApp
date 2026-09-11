import type { ShenLeId } from '@/types/shenle'
import { downloadFile } from '@/api/file'

export interface SaveVideoSource {
  fileId?: ShenLeId | null
  url?: string | null
}

export type VideoDownloadCandidate
  = | { kind: 'local', value: string }
    | { kind: 'remote', value: string }
    | { kind: 'file', value: ShenLeId }

function isRemoteUrl(url: string) {
  return /^https?:\/\//i.test(url)
}

function downloadRemoteVideo(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.downloadFile({
      url,
      success: (result) => {
        const tempPath = result.tempFilePath || ''
        if (result.statusCode === 200 && tempPath && !tempPath.toLowerCase().endsWith('.json'))
          resolve(result.tempFilePath)
        else
          reject(new Error(`视频下载失败: ${result.statusCode}`))
      },
      fail: reject,
    })
  })
}

export function getVideoDownloadCandidates(source: SaveVideoSource): VideoDownloadCandidate[] {
  const url = String(source.url || '')
  const candidates: VideoDownloadCandidate[] = []

  if (url)
    candidates.push({ kind: isRemoteUrl(url) ? 'remote' : 'local', value: url })
  if (source.fileId != null)
    candidates.push({ kind: 'file', value: source.fileId })

  return candidates
}

async function resolveVideoFilePath(source: SaveVideoSource) {
  const candidates = getVideoDownloadCandidates(source)
  let lastError: unknown = new Error('视频地址无效')

  for (const candidate of candidates) {
    try {
      if (candidate.kind === 'local')
        return candidate.value
      if (candidate.kind === 'remote')
        return await downloadRemoteVideo(candidate.value)
      return await downloadFile(candidate.value)
    }
    catch (error) {
      lastError = error
    }
  }

  throw lastError
}

function saveLocalVideo(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.saveVideoToPhotosAlbum({ filePath, success: () => resolve(), fail: reject })
  })
}

export function isAlbumPermissionDenied(error: unknown) {
  const message = String((error as { errMsg?: string } | undefined)?.errMsg || error || '').toLowerCase()
  return message.includes('auth deny')
    || message.includes('authorize:fail')
    || message.includes('permission denied')
}

async function promptOpenAlbumSetting() {
  const result = await new Promise<UniApp.ShowModalRes>((resolve) => {
    uni.showModal({
      title: '需要相册权限',
      content: '请在设置中允许保存到相册，然后重新点击保存。',
      confirmText: '去设置',
      success: resolve,
      fail: () => resolve({ confirm: false, cancel: true }),
    })
  })
  if (result.confirm)
    uni.openSetting({})
}

export async function saveVideoToAlbum(source: SaveVideoSource) {
  if (!getVideoDownloadCandidates(source).length) {
    uni.showToast({ title: '视频地址无效', icon: 'none', duration: 3000 })
    return false
  }

  uni.showLoading({ title: '正在保存', mask: true })
  try {
    const filePath = await resolveVideoFilePath(source)
    await saveLocalVideo(filePath)
    uni.hideLoading()
    uni.showToast({ title: '已保存到相册', icon: 'success', duration: 3000 })
    return true
  }
  catch (error) {
    uni.hideLoading()
    console.error('save video to album failed', error)
    if (isAlbumPermissionDenied(error))
      await promptOpenAlbumSetting()
    else
      uni.showToast({ title: '视频保存失败，请稍后重试', icon: 'none', duration: 3000 })
    return false
  }
}

export async function showVideoSaveActionSheet(source: SaveVideoSource) {
  const action = await new Promise<{ tapIndex: number } | null>((resolve) => {
    uni.showActionSheet({
      itemList: ['保存视频'],
      success: result => resolve({ tapIndex: result.tapIndex }),
      fail: () => resolve(null),
    })
  })

  if (action?.tapIndex !== 0)
    return false
  return saveVideoToAlbum(source)
}
