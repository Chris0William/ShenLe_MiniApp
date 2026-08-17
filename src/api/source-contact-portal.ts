import type {
  BatchSaveSlPropertyCommissionInput,
  PagedList,
  PageSlPromotionInput,
  SaveSlCommunityOperationConfigInput,
  SaveSlPromotionInput,
  SaveSlPropertyOperationConfigInput,
  SetSlSourceContactSupportInput,
  ShenLeId,
  SlCommunityOperationConfigOutput,
  SlPromotionPropertyOutput,
  SlPropertyOperationConfigOutput,
  SlSourceContactCommunityOutput,
  SlSourceContactProfileOutput,
} from '@/types/shenle'
import { get, post } from './request'

export function getSourceContactProfile() {
  return get<SlSourceContactProfileOutput>('/api/slSourceContactPortal/profile')
}

export function getSourceContactCommunityList() {
  return get<SlSourceContactCommunityOutput[]>('/api/slSourceContactPortal/communityList')
}

export function getCommunityOperationConfig(communityId: ShenLeId) {
  return get<SlCommunityOperationConfigOutput>('/api/slSourceContactPortal/communityConfig', { communityId })
}

export function getPropertyOperationConfigList(buildingId: ShenLeId) {
  return get<SlPropertyOperationConfigOutput[]>('/api/slSourceContactPortal/propertyConfigList', { buildingId })
}

export function getPromotionPropertyPage(input: PageSlPromotionInput) {
  return get<PagedList<SlPromotionPropertyOutput>>('/api/slSourceContactPortal/promotionPage', input as unknown as Record<string, unknown>)
}

export function saveCommunityOperationConfig(input: SaveSlCommunityOperationConfigInput) {
  return post<void>('/api/slSourceContactPortal/saveCommunityConfig', input as unknown as Record<string, unknown>)
}

export function savePropertyOperationConfig(input: SaveSlPropertyOperationConfigInput) {
  return post<void>('/api/slSourceContactPortal/savePropertyConfig', input as unknown as Record<string, unknown>)
}

export function batchSavePropertyCommission(input: BatchSaveSlPropertyCommissionInput) {
  return post<number>('/api/slSourceContactPortal/batchSaveCommission', input as unknown as Record<string, unknown>)
}

export function savePromotion(input: SaveSlPromotionInput) {
  return post<number>('/api/slSourceContactPortal/savePromotion', input as unknown as Record<string, unknown>)
}

export function setSourceContactSupportUser(input: SetSlSourceContactSupportInput) {
  return post<void>('/api/slSourceContactPortal/setSupportUser', input as unknown as Record<string, unknown>)
}
