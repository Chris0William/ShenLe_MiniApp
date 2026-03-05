import { BASE_URL } from './http'

export interface FileOutput {
  id: string
  fileName: string
  url: string
}

/** 上传文件 */
export function uploadFile(filePath: string): Promise<FileOutput> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || ''
    uni.uploadFile({
      url: `${BASE_URL}/api/sysFile/uploadFile`,
      filePath,
      name: 'file',
      header: {
        Authorization: `Bearer ${token}`,
      },
      success(res) {
        if (res.statusCode === 200) {
          const body = JSON.parse(res.data)
          if (body.code === 200) {
            resolve(body.result)
          } else {
            uni.showToast({ title: body.message || '上传失败', icon: 'none' })
            reject(new Error(body.message))
          }
        } else {
          reject(new Error(`上传失败: ${res.statusCode}`))
        }
      },
      fail(err) {
        uni.showToast({ title: '上传失败', icon: 'none' })
        reject(err)
      },
    })
  })
}

/** 获取文件预览URL（直接URL，需要认证） */
export function getPreviewUrl(fileId: string): string {
  return `${BASE_URL}/api/sysFile/Preview/${fileId}`
}

/** 内存缓存：fileId → 本地临时路径 */
const fileCache = new Map<string, string>()

/** 下载文件到本地临时路径（带 token 认证），结果会缓存 */
export function downloadFile(fileId: string): Promise<string> {
  const cached = fileCache.get(fileId)
  if (cached) return Promise.resolve(cached)

  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || ''
    uni.downloadFile({
      url: `${BASE_URL}/api/sysFile/Preview/${fileId}`,
      header: {
        Authorization: `Bearer ${token}`,
      },
      success(res) {
        if (res.statusCode === 200 && res.tempFilePath) {
          fileCache.set(fileId, res.tempFilePath)
          resolve(res.tempFilePath)
        } else {
          reject(new Error(`下载失败: ${res.statusCode}`))
        }
      },
      fail(err) {
        reject(err)
      },
    })
  })
}

/** 批量下载文件，返回 fileId → 本地临时路径 的映射 */
export async function downloadFiles(fileIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  await Promise.all(
    fileIds.map(async (id) => {
      try {
        const path = await downloadFile(id)
        result.set(id, path)
      } catch {}
    }),
  )
  return result
}
