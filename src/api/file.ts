import type { AdminResult, ImageOutput } from '@/types/shenle'
import { getApiBaseUrl, SHENLE_TOKEN_KEY } from '@/utils/shenle'

const fileCache = new Map<string, string>()

export function uploadFile(filePath: string): Promise<ImageOutput> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    uni.uploadFile({
      url: `${getApiBaseUrl()}/api/sysFile/uploadFile`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        let body: AdminResult<ImageOutput>
        try {
          body = JSON.parse(res.data) as AdminResult<ImageOutput>
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
        if (res.statusCode === 200 && res.tempFilePath) {
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
