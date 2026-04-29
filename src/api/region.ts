import { get, post } from './request'
import type { AddSlRegionInput, PageSlRegionInput, PagedList, SaveSlRegionBoundaryInput, ShenLeId, SlRegionOutput, SlRegionStatsOutput, SlRegionTreeOutput, UpdateSlRegionInput } from '@/types/shenle'

export const getRegionTree = () =>
  get<SlRegionTreeOutput[]>('/api/slRegion/tree')

export const getRegionPage = (input: PageSlRegionInput) =>
  get<PagedList<SlRegionOutput>>('/api/slRegion/page', input as unknown as Record<string, unknown>)

export const getRegionStats = (id: ShenLeId) =>
  get<SlRegionStatsOutput>('/api/slRegion/stats', { id })

export const getRegionDetail = (id: ShenLeId) =>
  get<SlRegionOutput>('/api/slRegion/detail', { id })

export const getRegionChildren = (id: ShenLeId) =>
  get<SlRegionOutput[]>('/api/slRegion/getChildren', { id })

export const addRegion = (input: AddSlRegionInput) =>
  post<ShenLeId>('/api/slRegion/add', input as unknown as Record<string, unknown>)

export const updateRegion = (input: UpdateSlRegionInput) =>
  post<void>('/api/slRegion/update', input as unknown as Record<string, unknown>)

export const saveRegionBoundary = (input: SaveSlRegionBoundaryInput) =>
  post<void>('/api/slRegion/saveBoundary', input as unknown as Record<string, unknown>)

export const deleteRegion = (id: ShenLeId) =>
  post<void>('/api/slRegion/delete', { id })
