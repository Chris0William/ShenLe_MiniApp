import type { AdminResult, BindSlMediaPosterInput, CleanupSlMediaDraftInput, ImageOutput, RenameSlMediaInput, ShenLeId } from '@/types/shenle'
import JSONBigInt from 'json-bigint'
import { getApiBaseUrl, SHENLE_TOKEN_KEY } from '@/utils/shenle'
import { post } from './request'

const fileCache = new Map<string, string>()
const losslessJson = JSONBigInt({ storeAsString: true })
const MIN_VIDEO_POSTER_SIZE = 256

export interface UploadFileOptions {
  belongId?: ShenLeId | null
  fileType?: string
}

export interface UploadMediaFileOptions extends UploadFileOptions {
  kind: 'image' | 'video'
  posterPath?: string
  onUploaded?: (file: ImageOutput) => void
}

export interface UploadedMediaOutput extends ImageOutput {
  posterLocalPath?: string
}

export function buildUploadFormData(options?: UploadFileOptions) {
  if (options?.belongId == null && !options?.fileType)
    return undefined

  return {
    ...(options.belongId == null ? {} : { belongId: String(options.belongId) }),
    ...(options.fileType ? { fileType: options.fileType } : {}),
  }
}

export function parseUploadResponse(raw: string): AdminResult<ImageOutput> {
  return losslessJson.parse(raw) as AdminResult<ImageOutput>
}

export function createMediaDraftSession() {
  return post<ShenLeId>('/api/slMediaDraft/createSession')
}

export function cleanupMediaDraft(input: CleanupSlMediaDraftInput) {
  return post<number>('/api/slMediaDraft/cleanup', input as unknown as Record<string, unknown>)
}

export function bindMediaPoster(input: BindSlMediaPosterInput) {
  return post<void>('/api/slMediaDraft/bindPoster', input as unknown as Record<string, unknown>)
}

export function renameMedia(input: RenameSlMediaInput) {
  return post<string>('/api/slMedia/rename', input as unknown as Record<string, unknown>)
}

function getLocalFileSize(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    uni.getFileInfo({
      filePath,
      success: result => resolve(result.size),
      fail: reject,
    })
  })
}

async function usablePosterPath(filePath?: string) {
  if (!filePath)
    return undefined

  try {
    const size = await getLocalFileSize(filePath)
    if (size >= MIN_VIDEO_POSTER_SIZE)
      return filePath
    console.warn(`ignore invalid video poster: ${size} bytes`)
  }
  catch (error) {
    console.warn('ignore unreadable video poster', error)
  }
  return undefined
}

export function uploadFile(filePath: string, options?: UploadFileOptions): Promise<ImageOutput> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    uni.uploadFile({
      url: `${getApiBaseUrl()}/api/sysFile/uploadFile`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      formData: buildUploadFormData(options),
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = `上传失败（HTTP ${res.statusCode}）`
          uni.showToast({ title: message, icon: 'none' })
          reject(new Error(message))
          return
        }
        let body: AdminResult<ImageOutput>
        try {
          body = parseUploadResponse(res.data)
        }
        catch {
          uni.showToast({ title: '上传失败', icon: 'none' })
          reject(new Error('上传响应解析失败'))
          return
        }
        if (body.code === 200) {
          resolve(body.result)
          return
        }
        uni.showToast({ title: body.message || '上传失败', icon: 'none' })
        reject(new Error(body.message || '上传失败'))
      },
      fail(error) {
        uni.showToast({ title: '上传失败', icon: 'none' })
        reject(error)
      },
    })
  })
}

export async function uploadMediaFile(filePath: string, options: UploadMediaFileOptions): Promise<UploadedMediaOutput> {
  const media = await uploadFile(filePath, {
    belongId: options.belongId,
    fileType: options.kind,
  })
  options.onUploaded?.(media)

  if (options.kind !== 'video')
    return media

  const posterPath = await usablePosterPath(options.posterPath)
  if (!posterPath)
    return media

  const poster = await uploadFile(posterPath, {
    belongId: options.belongId,
    fileType: 'image:video_poster',
  })
  options.onUploaded?.(poster)
  await bindMediaPoster({ videoFileId: media.id, posterFileId: poster.id })
  return {
    ...media,
    posterFileId: poster.id,
    posterUrl: poster.url,
    posterLocalPath: posterPath,
  }
}

export function getPreviewUrl(fileId: string | number) {
  return `${getApiBaseUrl()}/api/sysFile/Preview/${fileId}`
}

export function downloadFile(fileId: string | number): Promise<string> {
  const key = String(fileId)
  const cached = fileCache.get(key)
  if (cached)
    return Promise.resolve(cached)

  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    uni.downloadFile({
      url: getPreviewUrl(key),
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        const tempPath = res.tempFilePath || ''
        if (res.statusCode === 200 && tempPath && !tempPath.toLowerCase().endsWith('.json')) {
          fileCache.set(key, res.tempFilePath)
          resolve(res.tempFilePath)
          return
        }
        reject(new Error(`下载失败: ${res.statusCode}`))
      },
      fail(error) {
        reject(error)
      },
    })
  })
}
