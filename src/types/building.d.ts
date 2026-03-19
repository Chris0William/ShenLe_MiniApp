/** 楼栋列表查询输入 */
export interface ListSlBuildingInput {
  communityId: number
}

/** 新增楼栋输入 */
export interface AddSlBuildingInput {
  communityId: number
  name: string
  totalFloors?: number
  orderNo?: number
  status?: number
  remark?: string
  coverImageId?: number
  imageIds?: number[]
}

/** 更新楼栋输入 */
export interface UpdateSlBuildingInput extends AddSlBuildingInput {
  id: number
}

/** 楼栋输出 (matches backend SlBuildingOutput) */
export interface SlBuildingOutput {
  id: number
  communityId: number
  name: string
  totalFloors?: number
  orderNo: number
  status: number
  remark?: string
  createTime?: string
  propertyCount: number
  coverImageId?: number
  coverImage?: string
  images?: SlBuildingImageOutput[]
}

/** 楼栋图片输出 */
export interface SlBuildingImageOutput {
  id: number
  fileName?: string
  url?: string
}

/** 楼栋统计输出 (matches backend SlBuildingStatsOutput) */
export interface SlBuildingStatsOutput {
  id: number
  name: string
  totalFloors?: number
  propertyCount: number
  availableCount: number
  rentedCount: number
}
