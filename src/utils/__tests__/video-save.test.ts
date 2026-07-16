import { afterEach, describe, expect, it, vi } from 'vitest'
import { getVideoDownloadCandidates, isAlbumPermissionDenied, showVideoSaveActionSheet } from '../video-save'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('video save errors', () => {
  it('recognizes WeChat album permission failures', () => {
    expect(isAlbumPermissionDenied({ errMsg: 'saveVideoToPhotosAlbum:fail auth deny' })).toBe(true)
    expect(isAlbumPermissionDenied({ errMsg: 'authorize:fail permission denied' })).toBe(true)
    expect(isAlbumPermissionDenied({ errMsg: 'downloadFile:fail timeout' })).toBe(false)
  })

  it('prefers the playable media URL before the file preview endpoint', () => {
    expect(getVideoDownloadCandidates({ fileId: '123', url: 'https://cdn.example.com/video.mp4' })).toEqual([
      { kind: 'remote', value: 'https://cdn.example.com/video.mp4' },
      { kind: 'file', value: '123' },
    ])
    expect(getVideoDownloadCandidates({ fileId: '123', url: 'wxfile://tmp/video.mp4' })).toEqual([
      { kind: 'local', value: 'wxfile://tmp/video.mp4' },
      { kind: 'file', value: '123' },
    ])
  })

  it('saves only after the long-press action is selected', async () => {
    const showActionSheet = vi.fn((options: { success: (result: { tapIndex: number }) => void }) => options.success({ tapIndex: 0 }))
    const saveVideoToPhotosAlbum = vi.fn((options: { success: () => void }) => options.success())
    vi.stubGlobal('uni', {
      showActionSheet,
      showLoading: vi.fn(),
      saveVideoToPhotosAlbum,
      showToast: vi.fn(),
      hideLoading: vi.fn(),
    })

    await expect(showVideoSaveActionSheet({ url: 'wxfile://tmp/video.mp4' })).resolves.toBe(true)
    expect(showActionSheet).toHaveBeenCalledWith(expect.objectContaining({ itemList: ['保存视频'] }))
    expect(saveVideoToPhotosAlbum).toHaveBeenCalledOnce()
  })

  it('does nothing when the long-press action sheet is cancelled', async () => {
    const saveVideoToPhotosAlbum = vi.fn()
    vi.stubGlobal('uni', {
      showActionSheet: vi.fn((options: { fail: () => void }) => options.fail()),
      saveVideoToPhotosAlbum,
    })

    await expect(showVideoSaveActionSheet({ url: 'wxfile://tmp/video.mp4' })).resolves.toBe(false)
    expect(saveVideoToPhotosAlbum).not.toHaveBeenCalled()
  })
})
