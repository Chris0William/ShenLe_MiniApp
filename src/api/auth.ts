import type {
  AdminResult,
  CompleteProfileInput,
  LoginUserOutput,
  UploadAvatarOutput,
  WxLoginOutput,
  WxOpenIdOutput,
} from '@/types/shenle'
import { getApiBaseUrl } from '@/utils/shenle'
import { get, post } from './request'

export function getUserInfo(silent = false) {
  return get<LoginUserOutput>('/api/sysAuth/getUserInfo', undefined, { silent })
}

export function logout() {
  return post<void>('/api/sysAuth/logout')
}

export function getWxOpenId(jsCode: string) {
  return get<WxOpenIdOutput>('/api/sysWxOpen/wxOpenId', { JsCode: jsCode }, { auth: false })
}

export function wxOpenIdLogin(openId: string) {
  return post<WxLoginOutput>('/api/sysWxOpen/wxOpenIdLogin', { openId }, { auth: false })
}

export function completeProfile(input: CompleteProfileInput) {
  return post<WxLoginOutput>('/api/sysWxOpen/completeProfile', input as unknown as Record<string, unknown>, { auth: false })
}

export function uploadAvatar(openId: string, tempFilePath: string): Promise<UploadAvatarOutput> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${getApiBaseUrl()}/api/sysWxOpen/uploadAvatar`,
      filePath: tempFilePath,
      name: 'file',
      formData: { openId },
      success(res) {
        try {
          const body = JSON.parse(res.data) as AdminResult<UploadAvatarOutput>
          if (body.code === 200) {
            resolve(body.result)
            return
          }
          const message = body.message || '头像上传失败'
          uni.showToast({ title: message, icon: 'none' })
          reject(new Error(message))
        }
        catch (error) {
          reject(error)
        }
      },
      fail(error) {
        uni.showToast({ title: '头像上传失败', icon: 'none' })
        reject(error)
      },
    })
  })
}
