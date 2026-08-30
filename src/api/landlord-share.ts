import type { CreateLandlordShareCodeOutput, ResolveLandlordShareOutput, ShenLeId } from '@/types/shenle'
import { getApiBaseUrl, SHENLE_TOKEN_KEY } from '@/utils/shenle'
import { post } from './request'

export function createLandlordShareCode() {
  return post<CreateLandlordShareCodeOutput>('/api/slLandlordShare/createCode')
}

export function resolveLandlordShare(shareToken: string) {
  return post<ResolveLandlordShareOutput>('/api/slLandlordShare/resolve', { shareToken })
}

export function downloadShareCode(fileId: ShenLeId): Promise<string> {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync(SHENLE_TOKEN_KEY) as string
    uni.downloadFile({
      url: `${getApiBaseUrl()}/api/sysFile/Preview/${fileId}`,
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: result => result.statusCode === 200 && result.tempFilePath
        ? resolve(result.tempFilePath)
        : reject(new Error(`二维码下载失败（HTTP ${result.statusCode}）`)),
      fail: reject,
    })
  })
}
