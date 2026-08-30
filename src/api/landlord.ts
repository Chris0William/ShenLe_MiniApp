import type {
  BatchAssignOwnerInput,
  BatchAssignOwnerOutput,
  BatchAssignSlLandlordCommunitiesInput,
  CommunityAssignmentOutput,
  PageCommunityAssignmentInput,
  PagedList,
  PageSlLandlordCandidateInput,
  PageSlLandlordCommunityAssignmentInput,
  PageSlLandlordInput,
  PageSlLandlordProfileInput,
  SetSlLandlordMaintainersInput,
  ShenLeId,
  SlLandlordApplyOutput,
  SlLandlordCandidateOutput,
  SlLandlordCommunityAssignmentOutput,
  SlLandlordOutput,
  SlLandlordProfileOutput,
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

export function getLandlordProfilePage(input: PageSlLandlordProfileInput) {
  return get<PagedList<SlLandlordProfileOutput>>('/api/slLandlordManage/page', input as unknown as Record<string, unknown>)
}

export function getLandlordCandidatePage(input: PageSlLandlordCandidateInput) {
  return get<PagedList<SlLandlordCandidateOutput>>('/api/slLandlordManage/candidatePage', input as unknown as Record<string, unknown>)
}

export function setLandlordProfile(userId: ShenLeId, isLandlord: boolean) {
  return post<void>('/api/slLandlordManage/setLandlord', { userId, isLandlord })
}

export function batchSetLandlordProfiles(userIds: ShenLeId[], isLandlord = true) {
  return post<number>('/api/slLandlordManage/batchSetLandlord', { userIds, isLandlord })
}

export function setLandlordMaintainers(input: SetSlLandlordMaintainersInput) {
  return post<void>('/api/slLandlordManage/setMaintainers', input as unknown as Record<string, unknown>)
}

export function setLandlordContactDisplay(landlordUserId: ShenLeId, contactDisplayMode: 1 | 2) {
  return post<void>('/api/slLandlordManage/setContactDisplay', { landlordUserId, contactDisplayMode })
}

export function getLandlordCommunityAssignmentPage(input: PageSlLandlordCommunityAssignmentInput) {
  return get<PagedList<SlLandlordCommunityAssignmentOutput>>('/api/slLandlordManage/communityAssignmentPage', input as unknown as Record<string, unknown>)
}

export function batchAssignLandlordCommunities(input: BatchAssignSlLandlordCommunitiesInput) {
  return post<BatchAssignOwnerOutput>('/api/slLandlordManage/batchAssignCommunities', input as unknown as Record<string, unknown>)
}
