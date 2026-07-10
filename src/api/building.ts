import { get, post } from './request'
import type { AddSlBuildingInput, BatchAddSlBuildingInput, BatchAddSlBuildingOutput, ListSlBuildingInput, ShenLeId, SlBuildingOutput, SlBuildingStatsOutput, UpdateSlBuildingInput } from '@/types/shenle'

export const getBuildingStats = (communityId?: ShenLeId) =>
  get<SlBuildingStatsOutput[]>('/api/slBuilding/stats', { communityId })

export const getBuildingList = (input: ListSlBuildingInput) =>
  get<SlBuildingOutput[]>('/api/slBuilding/list', input as unknown as Record<string, unknown>)

export const getBuildingDetail = (id: ShenLeId) =>
  get<SlBuildingOutput>('/api/slBuilding/detail', { id })

export const addBuilding = (input: AddSlBuildingInput) =>
  post<ShenLeId>('/api/slBuilding/add', input as unknown as Record<string, unknown>)

export const batchAddBuildings = (input: BatchAddSlBuildingInput) =>
  post<BatchAddSlBuildingOutput>('/api/slBuilding/batchAdd', input as unknown as Record<string, unknown>)

export const updateBuilding = (input: UpdateSlBuildingInput) =>
  post<void>('/api/slBuilding/update', input as unknown as Record<string, unknown>)

export const deleteBuilding = (id: ShenLeId) =>
  post<void>('/api/slBuilding/delete', { id })
