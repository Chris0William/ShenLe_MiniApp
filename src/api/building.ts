import { get, post } from './http'
import type { BaseIdInput } from '@/types/common'
import type {
  ListSlBuildingInput,
  AddSlBuildingInput,
  UpdateSlBuildingInput,
  SlBuildingOutput,
  SlBuildingStatsOutput,
} from '@/types/building'

/** 获取楼栋列表 */
export const getBuildingList = (input: ListSlBuildingInput) =>
  get<SlBuildingOutput[]>('/api/slBuilding/list', input)

/** 获取楼栋统计 */
export const getBuildingStats = (communityId?: string) =>
  get<SlBuildingStatsOutput[]>('/api/slBuilding/stats', { communityId })

/** 获取楼栋详情 */
export const getBuildingDetail = (id: string) =>
  get<SlBuildingOutput>('/api/slBuilding/detail', { id })

/** 新增楼栋 */
export const addBuilding = (input: AddSlBuildingInput) =>
  post<string>('/api/slBuilding/add', input)

/** 更新楼栋 */
export const updateBuilding = (input: UpdateSlBuildingInput) =>
  post<void>('/api/slBuilding/update', input)

/** 删除楼栋 */
export const deleteBuilding = (input: BaseIdInput) =>
  post<void>('/api/slBuilding/delete', input)
