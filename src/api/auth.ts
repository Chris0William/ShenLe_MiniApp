import { post, get, BASE_URL } from './http'
import type { AdminResult } from '@/types/common'

export interface LoginInput {
  account: string
  password: string
  tenantId?: string
  codeId?: number
  code?: string
}

export interface LoginOutput {
  accessToken: string
  refreshToken: string
}

export interface LoginUserOutput {
  id: string
  account: string
  realName: string
  phone: string
  avatar: string
  accountType: number
  orgName: string
  buttons: string[]
  roleIds: string[]
  tenantId: string
}

/** 微信 OpenId 输出 */
export interface WxOpenIdOutput {
  openId: string
}

/** 微信登录输出 */
export interface WxLoginOutput {
  avatar: string
  accessToken: string
  userId: number
  nickName: string
  accountType: number
  needProfile: boolean
}

/** 账号密码登录 */
export function login(data: LoginInput) {
  return post<LoginOutput>('/api/sysAuth/login', data, false)
}

/** 获取当前登录用户信息 */
export function getUserInfo() {
  return get<LoginUserOutput>('/api/sysAuth/getUserInfo')
}

/** 退出登录 */
export function logout() {
  return post<void>('/api/sysAuth/logout')
}

/** 微信 code 换 openId */
export function getWxOpenId(jsCode: string) {
  return get<WxOpenIdOutput>(`/api/sysWxOpen/wxOpenId?JsCode=${encodeURIComponent(jsCode)}`, undefined, false)
}

/** openId 登录 */
export function wxOpenIdLogin(openId: string) {
  return post<WxLoginOutput>('/api/sysWxOpen/wxOpenIdLogin', { openId }, false)
}

/** 新用户完善资料 */
export function completeProfile(data: { openId: string; nickName: string; avatar: string; phone?: string }) {
  return post<WxLoginOutput>('/api/sysWxOpen/completeProfile', data, false)
}

/** 上传微信头像（multipart/form-data，[AllowAnonymous]） */
export function uploadAvatar(openId: string, tempFilePath: string): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    uni.uploadFile({
      url: `${BASE_URL}/api/sysWxOpen/uploadAvatar`,
      filePath: tempFilePath,
      name: 'file',
      formData: { openId },
      success(res) {
        const body = JSON.parse(res.data) as AdminResult<{ url: string }>
        if (body.code === 200) {
          resolve(body.result)
        } else {
          reject(new Error(body.message || '头像上传失败'))
        }
      },
      fail(err) {
        reject(err)
      },
    })
  })
}
