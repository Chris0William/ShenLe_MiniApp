import type { BasePageInput } from './common'

/** 房源状态: 0=空置, 1=预定, 2=已租 */
export enum PropertyStatus {
  Vacant = 0,
  Reserved = 1,
  Rented = 2,
}

/** 房源分页查询输入 (matches backend PageSlPropertyInput) */
export interface PageSlPropertyInput extends BasePageInput {
  title?: string
  communityId?: number
  buildingId?: number
  regionId?: number
  status?: number
  rentalType?: string
  minPrice?: number
  maxPrice?: number
  bedrooms?: number
  orientation?: string
  decoration?: string
  minArea?: number
  maxArea?: number
  depositRule?: string
}

/** 多维度筛选状态 */
export interface PropertyFilterState {
  regionId?: number
  bedrooms?: number
  minPrice?: number
  maxPrice?: number
  orientation?: string
  decoration?: string
  rentalType?: string
  minArea?: number
  maxArea?: number
  communityId?: number
  depositRule?: string
}

/** 按楼栋查询房源列表输入 */
export interface ListSlPropertyInput {
  buildingId: number
}

/** 房源列表输出 - 简化版 (matches backend SlPropertyListOutput) */
export interface SlPropertyListOutput {
  id: number
  title: string
  communityName?: string
  houseType: string
  area?: number
  floorInfo?: string
  rentPrice: number
  coverImageId?: number
  coverImage?: string
  status: number
  statusName: string
  createTime: string
  /** 以下字段当前 backend List 未返回，楼层网格需要后续扩展 */
  floor?: number
  roomNo?: string
}

/** 房源详情输出 (matches backend SlPropertyOutput) */
export interface SlPropertyOutput {
  id: number
  title: string
  communityId: number
  communityName?: string
  buildingId: number
  buildingName?: string
  regionName?: string
  unit?: string
  roomNo?: string
  floor?: number
  totalFloors?: number
  area?: number
  bedrooms: number
  livingRooms: number
  bathrooms: number
  orientation?: string
  decoration?: string
  rentalType?: string
  rentPrice: number
  deposit?: number
  depositRule?: string
  minLease?: number
  status: number
  coverImageId?: number
  coverImage?: string
  description?: string
  landlordName?: string
  landlordPhone?: string
  remark?: string
  createTime: string
  updateTime?: string
  houseType: string
  statusName: string
  tags?: SlTagOutput[]
  facilities?: SlTagOutput[]
  images?: SlPropertyImageOutput[]
}

/** 房源图片输出 */
export interface SlPropertyImageOutput {
  id: number
  fileName?: string
  url?: string
  fileType?: string
}

/** 房源标签输出 (reuse SlTagOutput from tag module) */
export interface SlTagOutput {
  id: number
  name: string
  category: string
  color?: string
  icon?: string
  orderNo: number
  status: number
}

/** 新增房源图片输入 */
export interface AddSlPropertyImageInput {
  fileId: number
  fileType?: string
}

/** 新增房源输入 */
export interface AddSlPropertyInput {
  title: string
  communityId: number
  buildingId: number
  unit?: string
  roomNo?: string
  floor?: number
  totalFloors?: number
  area?: number
  bedrooms?: number
  livingRooms?: number
  bathrooms?: number
  orientation?: string
  decoration?: string
  rentalType?: string
  rentPrice: number
  deposit?: number
  depositRule?: string
  minLease?: number
  status?: number
  coverImageId?: number
  tagIds?: number[]
  facilityIds?: number[]
  description?: string
  landlordName?: string
  landlordPhone?: string
  remark?: string
  images?: AddSlPropertyImageInput[]
}

/** 更新房源输入 */
export interface UpdateSlPropertyInput extends AddSlPropertyInput {
  id: number
}

/** 更新房源状态输入 */
export interface UpdateSlPropertyStatusInput {
  id: number
  status: number
}

/** 房源统计输出 - 按楼栋 (matches backend SlPropertyStatsOutput) */
export interface SlPropertyStatsOutput {
  buildingId: number
  totalCount: number
  vacantCount: number
  reservedCount: number
  rentedCount: number
}

/** 房源全局统计输出 (matches backend SlPropertyGlobalStatsOutput) */
export interface SlPropertyGlobalStatsOutput {
  totalCount: number
  vacantCount: number
  reservedCount: number
  rentedCount: number
  monthlyIncome: number
}

/** 房源状态输出 */
export interface SlPropertyStatusOutput {
  value: number
  label: string
  tagType: string
}
