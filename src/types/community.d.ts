import type { BasePageInput } from './common'

/** 楼盘分页查询输入 */
export interface PageSlCommunityInput extends BasePageInput {
  regionId?: number
  name?: string
  type?: number
  status?: number
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  orientation?: string
  decoration?: string
  rentalType?: string
  minArea?: number
  maxArea?: number
  depositRule?: string
  /** 用户当前经度 */
  userLng?: number
  /** 用户当前纬度 */
  userLat?: number
  /** 附近范围（公里） */
  distanceKm?: number
}

/** 楼盘列表查询输入 */
export interface ListSlCommunityInput {
  regionId?: number
  name?: string
  type?: number
}

/** 新增楼盘输入 */
export interface AddSlCommunityInput {
  name: string
  type?: number
  regionId?: number
  address?: string
  lng?: number
  lat?: number
  orderNo?: number
  status?: number
  remark?: string
  coverImageId?: number
  imageIds?: number[]
}

/** 更新楼盘输入 */
export interface UpdateSlCommunityInput extends AddSlCommunityInput {
  id: number
}

/** 楼盘详情/分页输出 */
export interface SlCommunityOutput {
  id: number
  name: string
  type: number
  typeName: string
  regionId: number | null
  regionName: string | null
  address: string | null
  lng: number | null
  lat: number | null
  orderNo: number
  status: number
  remark: string | null
  createTime: string | null
  updateTime: string | null
  buildingCount: number
  coverImageId: number | null
  coverImage: string | null
  /** 房源总数 */
  propertyCount: number
  /** 最低月租金 */
  minRentPrice: number | null
  /** 最高月租金 */
  maxRentPrice: number | null
  /** 户型列表，如 "1室0厅1卫 2室1厅1卫" */
  houseTypes: string | null
  /** 距离用户的距离（公里） */
  distance: number | null
  images?: SlCommunityImageOutput[]
}

/** 楼盘图片输出 */
export interface SlCommunityImageOutput {
  id: number
  fileName: string | null
  url: string | null
}

/** 楼盘下拉选择输出 */
export interface SlCommunitySelectOutput {
  id: number
  name: string
  type: number
  regionId: number | null
  lng: number | null
  lat: number | null
}

/** 楼盘统计输出 */
export interface SlCommunityStatsOutput {
  id: number
  name: string
  buildingCount: number
  propertyCount: number
  availableCount: number
  rentedCount: number
}
