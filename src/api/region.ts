import { get, post } from './http'
import type { PagedList, BaseIdInput } from '@/types/common'
import type {
  PageSlRegionInput,
  AddSlRegionInput,
  UpdateSlRegionInput,
  SaveSlRegionBoundaryInput,
  SlRegionOutput,
  SlRegionTreeOutput,
  SlRegionStatsOutput,
} from '@/types/region'

/** 获取区域树 */
export const getRegionTree = () =>
  get<SlRegionTreeOutput[]>('/api/slRegion/tree')

/** 获取区域分页列表 */
export const getRegionPage = (input: PageSlRegionInput) =>
  get<PagedList<SlRegionOutput>>('/api/slRegion/page', input)

/** 获取区域统计（单个区域） */
export const getRegionStats = (id: string) =>
  get<SlRegionStatsOutput>('/api/slRegion/stats', { id })

/** 获取区域详情 */
export const getRegionDetail = (id: string) =>
  get<SlRegionOutput>('/api/slRegion/detail', { id })

/** 获取子区域 */
export const getRegionChildren = (id: string) =>
  get<SlRegionOutput[]>('/api/slRegion/children', { id })

/** 新增区域 */
export const addRegion = (input: AddSlRegionInput) =>
  post<string>('/api/slRegion/add', input)

/** 更新区域 */
export const updateRegion = (input: UpdateSlRegionInput) =>
  post<void>('/api/slRegion/update', input)

/** 删除区域 */
export const deleteRegion = (input: BaseIdInput) =>
  post<void>('/api/slRegion/delete', input)

/** 保存区域边界 */
export const saveBoundary = (input: SaveSlRegionBoundaryInput) =>
  post<void>('/api/slRegion/saveBoundary', input)
