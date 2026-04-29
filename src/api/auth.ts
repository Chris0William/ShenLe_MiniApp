import { get, post } from './request'
import type {
  AdminResult,
  CompleteProfileInput,
  LoginUserOutput,
  UploadAvatarOutput,
  WxLoginOutput,
  WxOpenIdOutput,
} from '@/types/shenle'
import { getApiBaseUrl } from '@/utils/shenle'

export const getUserInfo = () =>
  get<LoginUserOutput>('/api/sysAuth/getUserInfo')

export const logout = () =>
  post<void>('/api/sysAuth/logout')

export const getWxOpenId = (jsCode: string) =>
  get<WxOpenIdOutput>('/api/sysWxOpen/wxOpenId', { JsCode: jsCode }, { auth: false })

export const wxOpenIdLogin = (openId: string) =>
  post<WxLoginOutput>('/api/sysWxOpen/wxOpenIdLogin', { openId }, { auth: false })

export const completeProfile = (input: CompleteProfileInput) =>
  post<WxLoginOutput>('/api/sysWxOpen/completeProfile', input as unknown as Record<string, unknown>, { auth: false })

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
