import type { PagedList, PageSlUserInput, SetSlUserRoleInput, SlUserOutput } from '@/types/shenle'
import { get, post } from './request'

export function getUserPage(input: PageSlUserInput) {
  return get<PagedList<SlUserOutput>>('/api/slUserManage/page', input as unknown as Record<string, unknown>)
}

export function setUserRole(input: SetSlUserRoleInput) {
  return post<void>('/api/slUserManage/setRole', input as unknown as Record<string, unknown>)
}
