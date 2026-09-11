import type { AdminResult, BindSlMediaPosterInput, CleanupSlMediaDraftInput, ImageOutput, RenameSlMediaInput, ShenLeId } from '@/types/shenle'
import type { MediaTrace } from '@/utils/media-diagnostics'
import JSONBigInt from 'json-bigint'
import { getApiBaseUrl, SHENLE_TOKEN_KEY } from '@/utils/shenle'
import { post } from './request'

const fileCache = new Map<string, string>()
const losslessJson = JSONBigInt({ storeAsString: true })
const MIN_VIDEO_POSTER_SIZE = 256
const UPLOAD_TIMEOUT_MS = 60_000
const FILE_INFO_TIMEOUT_MS = 5_000

export interface UploadFileOptions {
  belongId?: ShenLeId | null
  fileType?: string
  trace?: MediaTrace
  stage?: string
}

export interface UploadMediaFileOptions extends UploadFileOptions {
  kind: 'image' | 'video'
  posterPath?: string
  onUploaded?: (file: ImageOutput) => void
  trace?: MediaTrace
}

export interface UploadedMediaOutput extends ImageOutput {
  posterLocalPath?: string
  posterPending?: boolean
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
  return post<void>('/api/slMediaDraft/bindPoster', input as unknown as Record<string, unknown>, { timeout: 30_000 })
}

export function renameMedia(input: RenameSlMediaInput) {
  return post<string>('/api/slMedia/rename', input as unknown as Record<string, unknown>)
}

function getLocalFileSize(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`读取媒体信息超时（${FILE_INFO_TIMEOUT_MS / 1000}秒）`)), FILE_INFO_TIMEOUT_MS)
    uni.getFileInfo({
      filePath,
      success: result => {
        clearTimeout(timer)
        resolve(result.size)
      },
      fail: error => {
        clearTimeout(timer)
        reject(error)
      },
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
  options?.trace?.info(`${options.stage || 'file'}.request.start`, {
    kind: options.fileType?.startsWith('image:') ? 'poster' : options.fileType === 'video' ? 'video' : 'file',
    provider: 'uni',
  })
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    let settled = false
    let task: { abort?: () => void } | undefined
    const timer = setTimeout(() => {
      if (settled)
        return
      settled = true
      task?.abort?.()
      const error = new Error(`上传超时（${UPLOAD_TIMEOUT_MS / 1000}秒）`)
      options?.trace?.fail(`${options.stage || 'file'}.request.timeout`, error, { provider: 'uni' })
      uni.showToast({ title: '上传超时，请重试', icon: 'none' })
      reject(error)
    }, UPLOAD_TIMEOUT_MS)
    const resolveOnce = (value: ImageOutput) => {
      if (settled)
        return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const rejectOnce = (error: unknown) => {
      if (settled)
        return
      settled = true
      clearTimeout(timer)
      reject(error)
    }
    try {
      task = uni.uploadFile({
      url: `${getApiBaseUrl()}/api/sysFile/uploadFile`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      formData: buildUploadFormData(options),
      success(res) {
        if (settled)
          return
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = `上传失败（HTTP ${res.statusCode}）`
          options?.trace?.fail(`${options.stage || 'file'}.request.http-fail`, new Error(message), {
            httpStatus: res.statusCode,
            kind: options.fileType?.startsWith('image:') ? 'poster' : options.fileType === 'video' ? 'video' : 'file',
            provider: 'uni',
          })
          uni.showToast({ title: message, icon: 'none' })
          rejectOnce(new Error(message))
          return
        }
        let body: AdminResult<ImageOutput>
        try {
          body = parseUploadResponse(res.data)
        }
        catch {
          options?.trace?.fail(`${options.stage || 'file'}.response.parse-fail`, new Error('上传响应解析失败'), {
            httpStatus: res.statusCode,
            provider: 'uni',
          })
          uni.showToast({ title: '上传失败', icon: 'none' })
          rejectOnce(new Error('上传响应解析失败'))
          return
        }
        if (body.code === 200) {
          options?.trace?.info(`${options.stage || 'file'}.request.success`, {
            httpStatus: res.statusCode,
            businessCode: body.code,
            provider: 'uni',
          })
          resolveOnce(body.result)
          return
        }
        options?.trace?.fail(`${options.stage || 'file'}.response.business-fail`, new Error(body.message || '上传失败'), {
          httpStatus: res.statusCode,
          businessCode: body.code,
          provider: 'uni',
        })
        uni.showToast({ title: body.message || '上传失败', icon: 'none' })
        rejectOnce(new Error(body.message || '上传失败'))
      },
      fail(error) {
        if (settled)
          return
        options?.trace?.fail(`${options.stage || 'file'}.request.fail`, error, { provider: 'uni' })
        uni.showToast({ title: '上传失败', icon: 'none' })
        rejectOnce(error)
      },
      })
    }
    catch (error) {
      rejectOnce(error)
    }
  })
}

export async function uploadMediaFile(filePath: string, options: UploadMediaFileOptions): Promise<UploadedMediaOutput> {
  options.trace?.info('media.upload.start', { kind: options.kind, provider: 'uni' })
  let media: ImageOutput
  try {
    media = await uploadFile(filePath, {
    belongId: options.belongId,
    fileType: options.kind,
    trace: options.trace,
    stage: 'media',
    })
    options.trace?.info('media.upload.success', { kind: options.kind, provider: 'uni' })
  }
  catch (error) {
    options.trace?.fail('media.upload.fail', error, { kind: options.kind, provider: 'uni' })
    throw error
  }
  options.onUploaded?.(media)

  if (options.kind !== 'video')
    return media

  const posterPath = await usablePosterPath(options.posterPath)
  if (!posterPath)
    return media

  try {
    options.trace?.info('poster.upload.start', { kind: 'poster', hasPoster: true, provider: 'uni' })
    const poster = await uploadFile(posterPath, {
      belongId: options.belongId,
      fileType: 'image:video_poster',
      trace: options.trace,
      stage: 'poster',
    })
    options.trace?.info('poster.upload.success', { kind: 'poster', hasPoster: true, provider: 'uni' })
    options.onUploaded?.(poster)
    options.trace?.info('poster.bind.start', { kind: 'poster', hasPoster: true, provider: 'uni' })
    await bindMediaPoster({ videoFileId: media.id, posterFileId: poster.id })
    options.trace?.info('poster.bind.success', { kind: 'poster', hasPoster: true, provider: 'uni' })
    return {
      ...media,
      posterFileId: poster.id,
      posterUrl: poster.url,
      posterLocalPath: posterPath,
    }
  }
  catch (error) {
    // 视频本体已经成功，封面属于增强能力。保留视频并让页面继续保存。
    options.trace?.fail('poster.optional-fail', error, { kind: 'poster', hasPoster: true, provider: 'uni' })
    return {
      ...media,
      posterLocalPath: posterPath,
      posterPending: true,
    }
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
