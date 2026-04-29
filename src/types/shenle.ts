export type ShenLeId = number | string

export interface AdminResult<T = unknown> {
  code: number
  type?: string
  message?: string
  result: T
  extras?: unknown
  time?: string
}

export interface PagedList<T> {
  page: number
  pageSize: number
  items: T[]
  total: number
  totalPages: number
  hasPrevPage: boolean
  hasNextPage: boolean
}

export interface BasePageInput {
  page: number
  pageSize: number
}

export interface BaseIdInput {
  id: ShenLeId
}

export interface ImageOutput {
  id: ShenLeId
  fileName?: string | null
  url?: string | null
}

export enum PropertyStatus {
  Vacant = 0,
  Reserved = 1,
  Rented = 2,
  Offline = 3,
}

export interface PageSlPropertyInput extends BasePageInput {
  title?: string
  communityId?: ShenLeId
  buildingId?: ShenLeId
  regionId?: ShenLeId
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

export interface PropertyFilterState {
  regionId?: ShenLeId
  regionName?: string
  bedrooms?: number
  minPrice?: number
  maxPrice?: number
  orientation?: string
  decoration?: string
  rentalType?: string
  minArea?: number
  maxArea?: number
  communityId?: ShenLeId
  communityName?: string
  depositRule?: string
}

export interface ListSlPropertyInput {
  buildingId: ShenLeId
}

export interface SlPropertyListOutput {
  id: ShenLeId
  title: string
  communityName?: string | null
  houseType: string
  area?: number | null
  floor?: number | null
  roomNo?: string | null
  floorInfo?: string | null
  rentPrice: number
  coverImageId?: ShenLeId | null
  coverImage?: string | null
  status: number
  statusName: string
  createTime: string
}

export interface SlTagOutput {
  id: ShenLeId
  name: string
  category: string
  color?: string | null
  icon?: string | null
  orderNo: number
  status: number
  remark?: string | null
  createTime?: string | null
  updateTime?: string | null
}

export interface SlPropertyImageOutput extends ImageOutput {
  fileType?: string | null
}

export interface SlPropertyOutput extends SlPropertyListOutput {
  communityId: ShenLeId
  buildingId: ShenLeId
  buildingName?: string | null
  regionName?: string | null
  unit?: string | null
  roomNo?: string | null
  floor?: number | null
  totalFloors?: number | null
  bedrooms: number
  livingRooms: number
  bathrooms: number
  orientation?: string | null
  decoration?: string | null
  rentalType?: string | null
  deposit?: number | null
  depositRule?: string | null
  minLease?: number | null
  description?: string | null
  landlordName?: string | null
  landlordPhone?: string | null
  remark?: string | null
  updateTime?: string | null
  tags?: SlTagOutput[] | null
  facilities?: SlTagOutput[] | null
  images?: SlPropertyImageOutput[] | null
}

export interface AddSlPropertyImageInput {
  fileId: ShenLeId
  fileType?: string
}

export interface AddSlPropertyInput {
  title: string
  communityId: ShenLeId
  buildingId: ShenLeId
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
  coverImageId?: ShenLeId
  tagIds?: ShenLeId[]
  facilityIds?: ShenLeId[]
  description?: string
  landlordName?: string
  landlordPhone?: string
  remark?: string
  images?: AddSlPropertyImageInput[]
}

export interface UpdateSlPropertyInput extends AddSlPropertyInput {
  id: ShenLeId
}

export interface UpdateSlPropertyStatusInput {
  id: ShenLeId
  status: number
}

export interface SlPropertyStatsOutput {
  buildingId: ShenLeId
  totalCount: number
  vacantCount: number
  reservedCount: number
  rentedCount: number
}

export interface SlPropertyGlobalStatsOutput {
  totalCount: number
  vacantCount: number
  reservedCount: number
  rentedCount: number
  monthlyIncome: number
}

export interface SlPropertyStatusOutput {
  value: number
  label: string
  tagType: string
}

export interface PageSlCommunityInput extends BasePageInput {
  regionId?: ShenLeId
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
  userLng?: number
  userLat?: number
  distanceKm?: number
}

export interface ListSlCommunityInput {
  regionId?: ShenLeId
  name?: string
  type?: number
}

export interface AddSlCommunityInput {
  name: string
  type?: number
  regionId?: ShenLeId
  address?: string
  lng?: number
  lat?: number
  orderNo?: number
  status?: number
  remark?: string
  coverImageId?: ShenLeId
  imageIds?: ShenLeId[]
}

export interface UpdateSlCommunityInput extends AddSlCommunityInput {
  id: ShenLeId
}

export interface SlCommunityOutput {
  id: ShenLeId
  name: string
  type: number
  typeName?: string | null
  regionId?: ShenLeId | null
  regionName?: string | null
  address?: string | null
  lng?: number | null
  lat?: number | null
  orderNo: number
  status: number
  remark?: string | null
  createTime?: string | null
  updateTime?: string | null
  buildingCount: number
  coverImageId?: ShenLeId | null
  coverImage?: string | null
  propertyCount: number
  minRentPrice?: number | null
  maxRentPrice?: number | null
  houseTypes?: string | null
  distance?: number | null
  images?: ImageOutput[]
}

export interface SlCommunitySelectOutput {
  id: ShenLeId
  name: string
  type: number
  regionId?: ShenLeId | null
  lng?: number | null
  lat?: number | null
}

export interface SlCommunityStatsOutput {
  id: ShenLeId
  name: string
  buildingCount: number
  propertyCount: number
  availableCount: number
  rentedCount: number
}

export interface PageSlRegionInput extends BasePageInput {
  pid?: ShenLeId
  name?: string
  status?: number
}

export interface AddSlRegionInput {
  pid?: ShenLeId
  name: string
  level?: number
  centerLng?: number
  centerLat?: number
  orderNo?: number
  status?: number
  remark?: string
}

export interface UpdateSlRegionInput extends AddSlRegionInput {
  id: ShenLeId
}

export interface SaveSlRegionBoundaryInput {
  id: ShenLeId
  boundary?: string
  centerLng?: number
  centerLat?: number
}

export interface SlRegionTreeOutput {
  id: ShenLeId
  pid: ShenLeId
  name: string
  level: number
  boundary?: string | null
  centerLng?: number | null
  centerLat?: number | null
  children?: SlRegionTreeOutput[]
}

export interface SlRegionOutput extends SlRegionTreeOutput {
  orderNo: number
  status: number
  remark?: string | null
  createTime?: string | null
}

export interface SlRegionStatsOutput {
  id: ShenLeId
  name: string
  communityCount: number
  buildingCount: number
  propertyCount: number
  availableCount: number
  rentedCount: number
  offlineCount?: number
}

export interface ListSlBuildingInput {
  communityId: ShenLeId
}

export interface AddSlBuildingInput {
  communityId: ShenLeId
  name: string
  totalFloors?: number
  orderNo?: number
  status?: number
  remark?: string
  coverImageId?: ShenLeId
  imageIds?: ShenLeId[]
}

export interface UpdateSlBuildingInput extends AddSlBuildingInput {
  id: ShenLeId
}

export interface SlBuildingOutput {
  id: ShenLeId
  communityId: ShenLeId
  name: string
  totalFloors?: number | null
  orderNo: number
  status: number
  remark?: string | null
  createTime?: string | null
  propertyCount: number
  coverImageId?: ShenLeId | null
  coverImage?: string | null
  images?: ImageOutput[]
}

export interface SlBuildingStatsOutput {
  id: ShenLeId
  name: string
  totalFloors?: number | null
  propertyCount: number
  availableCount: number
  rentedCount: number
}

export interface ListSlTagInput {
  category?: string
  status?: number
}

export interface PageSlTagInput extends BasePageInput {
  name?: string
  category?: string
  status?: number
}

export interface AddSlTagInput {
  name: string
  category: string
  color?: string
  icon?: string
  orderNo?: number
  status?: number
  remark?: string
}

export interface UpdateSlTagInput extends AddSlTagInput {
  id: ShenLeId
}

export interface SlTagCategoryOutput {
  value: string
  label: string
}

export interface LoginUserOutput {
  id: ShenLeId
  account: string
  realName?: string
  phone?: string
  avatar?: string
  accountType?: number
  orgName?: string
  buttons?: string[]
  roleIds?: ShenLeId[]
  tenantId?: ShenLeId
}

export interface WxOpenIdOutput {
  openId: string
}

export interface WxLoginOutput {
  avatar?: string
  accessToken: string
  userId: ShenLeId
  nickName?: string
  accountType: number
  needProfile?: boolean
}

export interface CompleteProfileInput {
  openId: string
  nickName: string
  avatar: string
  phone?: string
}

export interface UploadAvatarOutput {
  url: string
}
