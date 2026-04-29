import type { AdminResult, ImageOutput } from '@/types/shenle'
import { getApiBaseUrl, SHENLE_TOKEN_KEY } from '@/utils/shenle'

export function uploadFile(filePath: string): Promise<ImageOutput> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    uni.uploadFile({
      url: `${getApiBaseUrl()}/api/sysFile/uploadFile`,
      filePath,
      name: 'file',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(res) {
        const body = JSON.parse(res.data) as AdminResult<ImageOutput>
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
