import type { MediaTrace } from '@/utils/media-diagnostics'
import { MEDIA_SELECTION_BATCH_LIMIT } from '@/utils/media'
import { createMediaTrace, isMediaPickerCancel, mediaErrorMessage } from '@/utils/media-diagnostics'

export interface FallbackMediaFile {
  tempFilePath: string
  fileType: 'image' | 'video'
}

interface FallbackImageResult {
  tempFilePaths?: string[]
}

interface FallbackVideoResult {
  tempFilePath?: string
}

interface FallbackMediaApi {
  chooseImage: (options: {
    count: number
    sizeType: string[]
    sourceType: string[]
    success: (result: FallbackImageResult) => void
    fail: (error: unknown) => void
  }) => void
  chooseVideo?: (options: {
    sourceType: string[]
    compressed: boolean
    maxDuration: number
    success: (result: FallbackVideoResult) => void
    fail: (error: unknown) => void
  }) => void
  showActionSheet: (options: {
    itemList: string[]
    success: (result: { tapIndex: number }) => void
    fail: (error: unknown) => void
  }) => void
}

export function chooseMediaFallback(
  onSelected: (files: FallbackMediaFile[]) => void,
  onFailed: (error: unknown) => void,
  trace: MediaTrace = createMediaTrace('picker-fallback'),
) {
  const wxApi = (globalThis as unknown as { wx?: Partial<FallbackMediaApi> }).wx
  const uniApi = uni as unknown as Partial<FallbackMediaApi>
  const api = typeof wxApi?.showActionSheet === 'function' ? wxApi : uniApi
  const fail = (stage: string, error: unknown) => {
    if (isMediaPickerCancel(error)) {
      trace.info(`${stage}.cancel`)
      return
    }
    trace.fail(stage, error)
    onFailed(error)
  }
  trace.info('fallback.menu.start', { provider: api === wxApi ? 'wx' : 'uni' })
  if (typeof api.showActionSheet !== 'function') {
    fail('fallback.menu.unavailable', new Error('当前平台不支持媒体选择回退'))
    return
  }

  try {
    api.showActionSheet({
      itemList: ['选择图片', '选择视频'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) {
          if (typeof api.chooseImage !== 'function') {
            fail('fallback.image.unavailable', new Error('当前平台不支持图片选择'))
            return
          }
          trace.info('fallback.image.start')
          try {
            api.chooseImage({
              count: MEDIA_SELECTION_BATCH_LIMIT,
              sizeType: ['compressed'],
              sourceType: ['album', 'camera'],
              success: (result) => {
                const files = (result.tempFilePaths || [])
                  .filter(Boolean)
                  .map(tempFilePath => ({ tempFilePath, fileType: 'image' as const }))
                trace.info('fallback.image.success', { count: files.length })
                if (files.length)
                  onSelected(files)
                else
                  fail('fallback.image.empty', new Error('未选择图片'))
              },
              fail: error => fail('fallback.image.fail', error),
            })
          }
          catch (error) { fail('fallback.image.throw', error) }
          return
        }

        if (tapIndex === 1 && typeof api.chooseVideo === 'function') {
          trace.info('fallback.video.start')
          try {
            api.chooseVideo({
              sourceType: ['album', 'camera'],
              compressed: true,
              maxDuration: 60,
              success: (result) => {
                trace.info('fallback.video.success', { count: result.tempFilePath ? 1 : 0 })
                if (result.tempFilePath)
                  onSelected([{ tempFilePath: result.tempFilePath, fileType: 'video' }])
                else
                  fail('fallback.video.empty', new Error('未选择视频'))
              },
              fail: error => fail('fallback.video.fail', error),
            })
          }
          catch (error) { fail('fallback.video.throw', error) }
          return
        }

        fail('fallback.video.unavailable', new Error('当前平台不支持视频选择'))
      },
      fail: (error) => {
        fail('fallback.menu.fail', error)
      },
    })
  }
  catch (error) { fail('fallback.menu.throw', error) }
}

export function mediaPickerErrorText(error: unknown) {
  return mediaErrorMessage(error)
}
