import type {
  BatchAssignOwnerInput,
  BatchAssignOwnerOutput,
  CommunityAssignmentOutput,
  PagedList,
  PageCommunityAssignmentInput,
  PageSlLandlordInput,
  ShenLeId,
  SlLandlordApplyOutput,
  SlLandlordOutput,
} from '@/types/shenle'
import { get, post } from './request'

export function getLandlordPage(input: PageSlLandlordInput) {
  return get<PagedList<SlLandlordOutput>>('/api/slLandlord/page', input as unknown as Record<string, unknown>)
}

export function setLandlord(userId: ShenLeId, isLandlord: boolean) {
  return post<void>('/api/slLandlord/setLandlord', { userId, isLandlord })
}

export function batchSetLandlords(userIds: ShenLeId[]) {
  return post<number>('/api/slLandlord/batchSetLandlord', { userIds })
}

export function getCommunityAssignmentPage(input: PageCommunityAssignmentInput) {
  return get<PagedList<CommunityAssignmentOutput>>('/api/slCommunity/assignmentPage', input as unknown as Record<string, unknown>)
}

export function batchAssignOwner(input: BatchAssignOwnerInput) {
  return post<BatchAssignOwnerOutput>('/api/slCommunity/batchAssignOwner', input as unknown as Record<string, unknown>)
}

export function assignOwner(communityId: ShenLeId, ownerUserId: ShenLeId) {
  return post<void>('/api/slCommunity/assignOwner', { communityId, ownerUserId })
}

export function unassignOwner(communityId: ShenLeId) {
  return post<void>('/api/slCommunity/unassignOwner', { communityId })
}

export function getLandlordPending() {
  return get<SlLandlordApplyOutput[]>('/api/slLandlord/pendingApplications')
}

export function approveLandlord(userId: ShenLeId) {
  return post<void>('/api/slLandlord/approveLandlord', { userId })
}

export function rejectLandlord(userId: ShenLeId) {
  return post<void>('/api/slLandlord/rejectLandlord', { userId })
}
