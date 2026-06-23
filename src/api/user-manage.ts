import type { MyAccessOutput, PagedList, PageSlUserInput, SetSlUserNickNameInput, SetSlUserRoleInput, ShenLeId, SlPendingUserOutput, SlUserOutput } from '@/types/shenle'
import { get, post } from './request'

export function getUserPage(input: PageSlUserInput) {
  return get<PagedList<SlUserOutput>>('/api/slUserManage/page', input as unknown as Record<string, unknown>)
}

export function setUserRole(input: SetSlUserRoleInput) {
  return post<void>('/api/slUserManage/setRole', input as unknown as Record<string, unknown>)
}

export function getMyAccess() {
  return get<MyAccessOutput>('/api/slAccess/myStatus')
}

export function applyAccess(applyType = 0) {
  return post<void>('/api/slAccess/apply', { applyType })
}

export function getPendingUsers() {
  return get<SlPendingUserOutput[]>('/api/slUserManage/pending')
}

export function approveUser(userId: ShenLeId) {
  return post<void>('/api/slUserManage/approve', { userId })
}

export function rejectUser(userId: ShenLeId) {
  return post<void>('/api/slUserManage/reject', { userId })
}

export function setUserNickName(input: SetSlUserNickNameInput) {
  return post<void>('/api/slUserManage/setNickName', input as unknown as Record<string, unknown>)
}
