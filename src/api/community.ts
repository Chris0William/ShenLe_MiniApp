import type { AddSlCommunityInput, ListSlCommunityInput, PagedList, PageSlCommunityInput, ShenLeId, SlCommunityOutput, SlCommunitySelectOutput, SlCommunityStatsOutput, UpdateSlCommunityInput } from '@/types/shenle'
import { get, post } from './request'

export function getCommunityPage(input: PageSlCommunityInput) {
  return get<PagedList<SlCommunityOutput>>('/api/slCommunity/page', input as unknown as Record<string, unknown>)
}

export function getCommunityList(input: ListSlCommunityInput = {}) {
  return get<SlCommunitySelectOutput[]>('/api/slCommunity/list', input as unknown as Record<string, unknown>)
}

export function getCommunityStats() {
  return get<SlCommunityStatsOutput[]>('/api/slCommunity/stats')
}

export function getCommunityDetail(id: ShenLeId) {
  return get<SlCommunityOutput>('/api/slCommunity/detail', { id })
}

export function addCommunity(input: AddSlCommunityInput) {
  return post<ShenLeId>('/api/slCommunity/add', input as unknown as Record<string, unknown>)
}

export function updateCommunity(input: UpdateSlCommunityInput) {
  return post<void>('/api/slCommunity/update', input as unknown as Record<string, unknown>)
}

export function deleteCommunity(id: ShenLeId) {
  return post<void>('/api/slCommunity/delete', { id })
}
