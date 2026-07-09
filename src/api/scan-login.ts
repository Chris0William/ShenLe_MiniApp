import { post } from './request'

/** 确认后台登录（需已登录的小程序用户，token 自动附带） */
export function scanLoginConfirm(ticket: string) {
  return post<void>('/api/slScanLogin/confirm', { ticket })
}

/** 拒绝/取消后台登录 */
export function scanLoginReject(ticket: string) {
  return post<void>('/api/slScanLogin/reject', { ticket })
}
