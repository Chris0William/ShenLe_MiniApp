import type { PagedList, PageSlLandlordInput, ShenLeId, SlLandlordOutput } from '@/types/shenle'
import { get, post } from './request'

export function getLandlordPage(input: PageSlLandlordInput) {
  return get<PagedList<SlLandlordOutput>>('/api/slLandlord/page', input as unknown as Record<string, unknown>)
}

export function setLandlord(userId: ShenLeId, isLandlord: boolean) {
  return post<void>('/api/slLandlord/setLandlord', { userId, isLandlord })
}

export function assignOwner(communityId: ShenLeId, ownerUserId: ShenLeId) {
  return post<void>('/api/slCommunity/assignOwner', { communityId, ownerUserId })
}

export function unassignOwner(communityId: ShenLeId) {
  return post<void>('/api/slCommunity/unassignOwner', { communityId })
}
