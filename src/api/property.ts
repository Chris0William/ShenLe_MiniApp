import type {
  AddSlPropertyInput,
  BaseIdInput,
  BatchDeleteSlPropertyInput,
  BatchSaveSlPropertyInput,
  BatchSlPropertyResult,
  BatchUpdateSlPropertyStatusInput,
  ListSlPropertyInput,
  PagedList,
  PageSlPropertyInput,
  ShenLeId,
  SlPropertyBatchRowOutput,
  SlPropertyGlobalStatsOutput,
  SlPropertyListOutput,
  SlPropertyOutput,
  SlPropertyStatsOutput,
  SlPropertyStatusOutput,
  UpdateSlPropertyInput,
  UpdateSlPropertyStatusInput,
} from '@/types/shenle'
import { get, post } from './request'

export function getPropertyGlobalStats() {
  return get<SlPropertyGlobalStatsOutput>('/api/slProperty/globalStats')
}

export function getPropertyStats(input: ListSlPropertyInput) {
  return get<SlPropertyStatsOutput>('/api/slProperty/stats', input as unknown as Record<string, unknown>)
}

export function getPropertyPage(input: PageSlPropertyInput) {
  return get<PagedList<SlPropertyListOutput>>('/api/slProperty/page', input as unknown as Record<string, unknown>)
}

export function getPropertyList(input: ListSlPropertyInput) {
  return get<SlPropertyListOutput[]>('/api/slProperty/list', input as unknown as Record<string, unknown>)
}

export function getPropertyBatchList(buildingId: ShenLeId) {
  return get<SlPropertyBatchRowOutput[]>('/api/slProperty/batchList', { buildingId })
}

export function getPropertyDetail(id: string | number, businessView = false) {
  return get<SlPropertyOutput>('/api/slProperty/detail', { id, businessView: businessView || undefined })
}

export function getPropertyStatusList() {
  return get<SlPropertyStatusOutput[]>('/api/slProperty/getStatusList')
}

export function addProperty(input: AddSlPropertyInput) {
  return post<string | number>('/api/slProperty/add', input as unknown as Record<string, unknown>)
}

export function updateProperty(input: UpdateSlPropertyInput) {
  return post<void>('/api/slProperty/update', input as unknown as Record<string, unknown>)
}

export function deleteProperty(input: BaseIdInput) {
  return post<void>('/api/slProperty/delete', input as unknown as Record<string, unknown>)
}

export function updatePropertyStatus(input: UpdateSlPropertyStatusInput) {
  return post<void>('/api/slProperty/updateStatus', input as unknown as Record<string, unknown>)
}

export function batchAddProperties(input: AddSlPropertyInput[]) {
  return post<BatchSlPropertyResult>('/api/slProperty/batchAdd', input as unknown as Record<string, unknown>)
}

export function batchUpdateProperties(input: UpdateSlPropertyInput[]) {
  return post<BatchSlPropertyResult>('/api/slProperty/batchUpdate', input as unknown as Record<string, unknown>)
}

export function batchDeleteProperties(input: BatchDeleteSlPropertyInput) {
  return post<BatchSlPropertyResult>('/api/slProperty/batchDelete', input as unknown as Record<string, unknown>)
}

export function batchUpdatePropertyStatus(input: BatchUpdateSlPropertyStatusInput) {
  return post<BatchSlPropertyResult>('/api/slProperty/batchUpdateStatus', input as unknown as Record<string, unknown>)
}

export function batchSaveProperties(input: BatchSaveSlPropertyInput) {
  return post<BatchSlPropertyResult>('/api/slProperty/batchSave', input as unknown as Record<string, unknown>)
}
