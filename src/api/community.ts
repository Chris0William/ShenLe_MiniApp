import { get, post } from './http'
import type { PagedList, BaseIdInput } from '@/types/common'
import type {
  PageSlCommunityInput,
  ListSlCommunityInput,
  AddSlCommunityInput,
  UpdateSlCommunityInput,
  SlCommunityOutput,
  SlCommunitySelectOutput,
  SlCommunityStatsOutput,
} from '@/types/community'

/** 获取楼盘分页列表 */
export const getCommunityPage = (input: PageSlCommunityInput) =>
  get<PagedList<SlCommunityOutput>>('/api/slCommunity/page', input)

/** 获取楼盘下拉列表 */
export const getCommunityList = (input: ListSlCommunityInput) =>
  get<SlCommunitySelectOutput[]>('/api/slCommunity/list', input)

/** 获取楼盘统计 */
export const getCommunityStats = () =>
  post<SlCommunityStatsOutput[]>('/api/slCommunity/stats')

/** 获取楼盘详情 */
export const getCommunityDetail = (id: string) =>
  get<SlCommunityOutput>('/api/slCommunity/detail', { id })

/** 新增楼盘 */
export const addCommunity = (input: AddSlCommunityInput) =>
  post<string>('/api/slCommunity/add', input)

/** 更新楼盘 */
export const updateCommunity = (input: UpdateSlCommunityInput) =>
  post<void>('/api/slCommunity/update', input)

/** 删除楼盘 */
export const deleteCommunity = (input: BaseIdInput) =>
  post<void>('/api/slCommunity/delete', input)
