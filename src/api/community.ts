import { get, post } from './request'
import type { AddSlCommunityInput, ListSlCommunityInput, PageSlCommunityInput, PagedList, ShenLeId, SlCommunityOutput, SlCommunitySelectOutput, SlCommunityStatsOutput, UpdateSlCommunityInput } from '@/types/shenle'

export const getCommunityPage = (input: PageSlCommunityInput) =>
  get<PagedList<SlCommunityOutput>>('/api/slCommunity/page', input as unknown as Record<string, unknown>)

export const getCommunityList = (input: ListSlCommunityInput = {}) =>
  get<SlCommunitySelectOutput[]>('/api/slCommunity/list', input as unknown as Record<string, unknown>)

export const getCommunityStats = () =>
  get<SlCommunityStatsOutput[]>('/api/slCommunity/stats')

export const getCommunityDetail = (id: ShenLeId) =>
  get<SlCommunityOutput>('/api/slCommunity/detail', { id })

export const addCommunity = (input: AddSlCommunityInput) =>
  post<ShenLeId>('/api/slCommunity/add', input as unknown as Record<string, unknown>)

export const updateCommunity = (input: UpdateSlCommunityInput) =>
  post<void>('/api/slCommunity/update', input as unknown as Record<string, unknown>)

export const deleteCommunity = (id: ShenLeId) =>
  post<void>('/api/slCommunity/delete', { id })
