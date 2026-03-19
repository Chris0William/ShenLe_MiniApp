import type { BasePageInput } from './common'

/** 区域分页查询输入 */
export interface PageSlRegionInput extends BasePageInput {
  pid?: number
  name?: string
  status?: number
}

/** 新增区域输入 */
export interface AddSlRegionInput {
  pid?: number
  name: string
  level?: number
  centerLng?: number
  centerLat?: number
  orderNo?: number
  status?: number
  remark?: string
}

/** 更新区域输入 */
export interface UpdateSlRegionInput extends AddSlRegionInput {
  id: number
}

/** 保存区域边界输入 */
export interface SaveSlRegionBoundaryInput {
  id: number
  boundary: string
  centerLng?: number
  centerLat?: number
}

/** 区域输出 (matches backend SlRegionOutput) */
export interface SlRegionOutput {
  id: number
  pid: number
  name: string
  level: number
  boundary?: string
  centerLng?: number
  centerLat?: number
  orderNo: number
  status: number
  remark?: string
  createTime: string
  children?: SlRegionOutput[]
}

/** 区域树输出 (matches backend SlRegionTreeOutput) */
export interface SlRegionTreeOutput {
  id: number
  pid: number
  name: string
  level: number
  boundary?: string
  centerLng?: number
  centerLat?: number
  children?: SlRegionTreeOutput[]
}

/** 区域统计输出 (matches backend SlRegionStatsOutput) */
export interface SlRegionStatsOutput {
  id: number
  name: string
  communityCount: number
  buildingCount: number
  propertyCount: number
  availableCount: number
  rentedCount: number
  offlineCount: number
}
