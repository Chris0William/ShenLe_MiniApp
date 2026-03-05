import { get, post } from './http'
import type { PagedList, BaseIdInput } from '@/types/common'
import type {
  PageSlPropertyInput,
  ListSlPropertyInput,
  AddSlPropertyInput,
  UpdateSlPropertyInput,
  UpdateSlPropertyStatusInput,
  SlPropertyOutput,
  SlPropertyListOutput,
  SlPropertyStatsOutput,
  SlPropertyGlobalStatsOutput,
  SlPropertyStatusOutput,
} from '@/types/property'

/** 获取房源全局统计 */
export const getPropertyGlobalStats = () =>
  get<SlPropertyGlobalStatsOutput>('/api/slProperty/globalStats')

/** 获取房源统计（按区域/楼盘） */
export const getPropertyStats = (regionId?: string, communityId?: string) =>
  get<SlPropertyStatsOutput>('/api/slProperty/stats', { regionId, communityId })

/** 获取房源分页列表 */
export const getPropertyPage = (input: PageSlPropertyInput) =>
  get<PagedList<SlPropertyListOutput>>('/api/slProperty/page', input)

/** 获取房源列表（不分页，按楼栋） */
export const getPropertyList = (input: ListSlPropertyInput) =>
  get<SlPropertyListOutput[]>('/api/slProperty/list', input)

/** 获取房源详情 */
export const getPropertyDetail = (id: string) =>
  get<SlPropertyOutput>('/api/slProperty/detail', { id })

/** 新增房源 */
export const addProperty = (input: AddSlPropertyInput) =>
  post<string>('/api/slProperty/add', input)

/** 更新房源 */
export const updateProperty = (input: UpdateSlPropertyInput) =>
  post<void>('/api/slProperty/update', input)

/** 删除房源 */
export const deleteProperty = (input: BaseIdInput) =>
  post<void>('/api/slProperty/delete', input)

/** 更新房源状态 */
export const updatePropertyStatus = (input: UpdateSlPropertyStatusInput) =>
  post<void>('/api/slProperty/updateStatus', input)

/** 获取房源状态列表 */
export const getPropertyStatusList = () =>
  get<SlPropertyStatusOutput[]>('/api/slProperty/statusList')
