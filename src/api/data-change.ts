import type { PagedList, ShenLeId } from '@/types/shenle'
import { get, post } from './request'

export interface DataChangeRecord {
  id: ShenLeId
  batchId: string
  entityType: string
  entityId: ShenLeId
  entityName?: string | null
  communityId?: ShenLeId | null
  action: string
  reason?: string | null
  changedFields?: string | null
  beforeSnapshot?: string | null
  afterSnapshot?: string | null
  operatorUserId: ShenLeId
  operatorNickName: string
  occurredTime: string
  restoredFromId?: ShenLeId | null
}

export interface PageDataChangeInput {
  page: number
  pageSize: number
  entityType?: string
  action?: string
}

export function getDataChangePage(input: PageDataChangeInput) {
  return get<PagedList<DataChangeRecord>>('/api/slDataChange/page', input as unknown as Record<string, unknown>)
}

export function restoreDataChange(id: ShenLeId, reason: string) {
  return post<void>('/api/slDataChange/restore', { id, reason })
}
