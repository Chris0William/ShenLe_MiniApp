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
  fileType?: string | null
  suffix?: string | null
  posterFileId?: ShenLeId | null
  posterUrl?: string | null
}

export interface RenameSlMediaInput extends BaseIdInput {
  name: string
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
  livingRooms?: number
  bathrooms?: number
  minFloor?: number
  maxFloor?: number
  roomNoSuffix?: string
  orientation?: string
  decoration?: string
  minArea?: number
  maxArea?: number
  depositRule?: string
  userLng?: number
  userLat?: number
  distanceKm?: number
  landlordShareToken?: string
}

export interface PropertyFilterState {
  regionId?: ShenLeId
  regionName?: string
  userLng?: number
  userLat?: number
  distanceKm?: number
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
  updatedWithinDays?: 1 | 3 | 7
  ownerUserId?: ShenLeId
  ownerUserName?: string
  updaterUserId?: ShenLeId
  updaterUserName?: string
  onlyManagedByMe?: boolean
  onlyUpdatedByMe?: boolean
  communityTypes?: number[]
  realtimeModes?: Array<'realtime' | 'hot'>
  specialModes?: Array<'monthlyPayment' | 'shortRent' | 'dailyRent'>
  onlyContactedByMe?: boolean
  onlyMaintainedByMe?: boolean
  sortBy?: 'latest' | 'distance'
  landlordShareToken?: string
}

export interface ListSlPropertyInput {
  buildingId: ShenLeId
  landlordShareToken?: string
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
  coverFileType?: string | null
  coverSuffix?: string | null
  coverPosterFileId?: ShenLeId | null
  coverPosterUrl?: string | null
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

export interface SlPropertyBatchRowOutput {
  id: ShenLeId
  title: string
  communityId: ShenLeId
  buildingId: ShenLeId
  unit?: string | null
  roomNo?: string | null
  floor?: number | null
  totalFloors?: number | null
  area?: number | null
  bedrooms: number
  livingRooms: number
  bathrooms: number
  orientation?: string | null
  decoration?: string | null
  rentalType?: string | null
  rentPrice: number
  deposit?: number | null
  depositRule?: string | null
  minLease?: number | null
  status: number
  coverImageId?: ShenLeId | null
  tagIds: ShenLeId[]
  facilityIds: ShenLeId[]
  description?: string | null
  landlordName?: string | null
  landlordPhone?: string | null
  remark?: string | null
  createTime: string
  updateTime?: string | null
  images: SlPropertyImageOutput[]
  operationConfig?: SlPropertyOperationConfigOutput | null
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
  operationConfig?: SlPropertyOperationConfigOutput | null
  supplyContactName?: string | null
  supplyContactPhone?: string | null
  supplyContactRole?: 'landlord' | 'maintainer' | string | null
}

export interface SlPropertyOperationConfigEditInput {
  managementFee?: number | null
  networkFee?: number | null
  waterFee?: number | null
  electricityFee?: number | null
  commissionMode?: SlCommissionMode | null
  commissionValue?: number | null
  halfYearCommissionPercent?: number | null
  oneYearCommissionPercent?: number | null
  managementPackageMode?: 1 | 2 | null
  networkPackageMode?: 1 | 2 | 3 | 4 | null
}

export interface AddSlPropertyImageInput {
  fileId: ShenLeId
  fileType?: string | null
}

export interface AddSlPropertyInput {
  title: string
  communityId: ShenLeId
  buildingId: ShenLeId
  unit?: string | null
  roomNo?: string | null
  floor?: number | null
  totalFloors?: number | null
  area?: number | null
  bedrooms?: number
  livingRooms?: number
  bathrooms?: number
  orientation?: string | null
  decoration?: string | null
  rentalType?: string | null
  rentPrice: number
  deposit?: number | null
  depositRule?: string | null
  minLease?: number | null
  status?: number
  coverImageId?: ShenLeId | null
  tagIds?: ShenLeId[] | null
  facilityIds?: ShenLeId[] | null
  description?: string | null
  landlordName?: string | null
  landlordPhone?: string | null
  remark?: string | null
  images?: AddSlPropertyImageInput[] | null
  operationConfig?: SlPropertyOperationConfigEditInput | null
}

export interface UpdateSlPropertyInput extends AddSlPropertyInput {
  id: ShenLeId
}

export interface UpdateSlPropertyStatusInput {
  id: ShenLeId
  status: number
}

export interface BatchDeleteSlPropertyInput {
  ids: ShenLeId[]
}

export interface BatchUpdateSlPropertyStatusInput {
  ids: ShenLeId[]
  status: number | null
}

export interface BatchSaveSlPropertyInput {
  adds: AddSlPropertyInput[]
  updates: UpdateSlPropertyInput[]
  deleteIds: ShenLeId[]
}

export interface SlPropertyBatchError {
  operation: 'add' | 'update' | 'delete' | 'updateStatus' | 'batchSave'
  scope: 'items' | 'ids' | 'status' | 'adds' | 'updates' | 'deleteIds' | 'request'
  index: number
  field?: string | null
  message: string
}

export interface BatchSlPropertyResult {
  success: boolean
  createdIds: ShenLeId[]
  updatedCount: number
  deletedCount: number
  affectedCount: number
  errors: SlPropertyBatchError[]
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
  types?: number[]
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
  ownerScope?: string
  updatedWithinDays?: 1 | 3 | 7
  ownerUserId?: ShenLeId
  updaterUserId?: ShenLeId
  onlyManagedByMe?: boolean
  onlyUpdatedByMe?: boolean
  realtimeModes?: Array<'realtime' | 'hot'>
  specialModes?: Array<'monthlyPayment' | 'shortRent' | 'dailyRent'>
  onlyContactedByMe?: boolean
  onlyMaintainedByMe?: boolean
  sortBy?: 'latest' | 'distance'
  landlordShareToken?: string
}

export interface ListSlCommunityInput {
  regionId?: ShenLeId
  name?: string
  type?: number
  landlordShareToken?: string
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
  coverImageId?: ShenLeId | null
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
  coverFileType?: string | null
  coverSuffix?: string | null
  coverPosterFileId?: ShenLeId | null
  coverPosterUrl?: string | null
  propertyCount: number
  availableCount?: number
  rentedCount?: number
  minRentPrice?: number | null
  maxRentPrice?: number | null
  houseTypes?: string | null
  distance?: number | null
  images?: ImageOutput[]
  isMine?: boolean
  ownerId?: ShenLeId | null
  ownerName?: string | null
  ownerPhone?: string | null
  lastUpdaterUserId?: ShenLeId | null
  lastUpdaterName?: string | null
  lastUpdaterPhone?: string | null
  supplyUpdateTime?: string | null
  lastSupplyAction?: string | null
  managementFee?: number | null
  networkFee?: number | null
  networkFeeMode?: 1 | 2 | null
  waterFee?: number | null
  electricityFee?: number | null
  lowestHalfYearCommissionPercent?: number | null
  lowestOneYearCommissionPercent?: number | null
  highestHalfYearCommissionPercent?: number | null
  highestOneYearCommissionPercent?: number | null
  highestCommissionPercent?: number | null
  hotLevel?: number
  hotExpireTime?: string | null
  hasLandlord?: boolean
  landlordUserId?: ShenLeId | null
  landlordName?: string | null
  landlordPhone?: string | null
  supplyContactUserId?: ShenLeId | null
  supplyContactName?: string | null
  supplyContactPhone?: string | null
  supplyContactRole?: 'landlord' | 'maintainer' | string | null
}

export interface SlCommunityTickerOutput {
  communityId: ShenLeId
  communityName: string
  supplyUpdateTime?: string | null
  hotLevel: number
  hotExpireTime?: string | null
  latitude?: number | null
  longitude?: number | null
  availableCount?: number
}

export interface SlCommunityTickerSetOutput {
  recent: SlCommunityTickerOutput[]
  hot: SlCommunityTickerOutput[]
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
  totalFloors?: number | null
  hasElevator?: boolean | null
  orderNo?: number
  status?: number
  remark?: string
  coverImageId?: ShenLeId | null
  imageIds?: ShenLeId[]
}

export interface BatchAddSlBuildingInput {
  communityId: ShenLeId
  count: number
  seqMode: 'number' | 'alpha'
  prefix?: string | null
  suffix?: string | null
  startNo?: number
  startLetter?: string | null
  totalFloors?: number | null
  hasElevator?: boolean | null
  orderNo?: number
  status?: number
}

export interface BatchAddSlBuildingOutput {
  created: ShenLeId[]
  skipped: string[]
}

export interface UpdateSlBuildingInput extends AddSlBuildingInput {
  id: ShenLeId
}

export interface SlBuildingOutput {
  id: ShenLeId
  communityId: ShenLeId
  name: string
  totalFloors?: number | null
  hasElevator?: boolean | null
  orderNo: number
  status: number
  remark?: string | null
  createTime?: string | null
  propertyCount: number
  coverImageId?: ShenLeId | null
  coverImage?: string | null
  coverFileType?: string | null
  coverSuffix?: string | null
  coverPosterFileId?: ShenLeId | null
  coverPosterUrl?: string | null
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

export interface CleanupSlMediaDraftInput {
  draftId: ShenLeId
  fileIds: ShenLeId[]
}

export interface BindSlMediaPosterInput {
  videoFileId: ShenLeId
  posterFileId: ShenLeId
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
  nickName?: string
  realName?: string
  phone?: string
  avatar?: string
  accountType?: number
  orgName?: string
  buttons?: string[]
  roleIds?: ShenLeId[]
  tenantId?: ShenLeId
  isLandlord?: boolean
  isSourceContact?: boolean
  isMaintainer?: boolean
  landlordApplyStatus?: number
  hasPhone?: boolean
  canViewRealData?: boolean
  canCreateCommunity?: boolean
  canWriteAssignedSupply?: boolean
  canWriteAllSupply?: boolean
  canBatchWriteSupply?: boolean
  canViewSupplyContactPhone?: boolean
  canViewSupplyActivity?: boolean
  canUseMineFilters?: boolean
  canFilterBySupplyOperator?: boolean
  canAssignCommunityContact?: boolean
  canManageSourceContacts?: boolean
  canManageUsers?: boolean
  canCreateSupply?: boolean
  canEnterLandlordPortal?: boolean
  canEnterRestrictedAdmin?: boolean
  canManageLandlords?: boolean
  canSetCommunityHotLevel?: boolean
  landlordCommunityCount?: number
  maintainedCommunityCount?: number
  communityManageScope?: number
}

export interface SlPublicRegionQueryInput extends BasePageInput {
  regionId?: ShenLeId
  minPrice?: number
  maxPrice?: number
  longitude?: number
  latitude?: number
}

export interface SlPublicRegionPreviewOutput {
  regionId: ShenLeId
  regionName: string
  longitude: number
  latitude: number
  communityCountText: string
  availableCountText: string
  rentRangeText: string
  distanceText?: string | null
}

export interface SetMyNickNameInput {
  nickName: string
}

export interface SetSlUserNickNameInput {
  userId: ShenLeId
  nickName: string
}

export interface WxAuthPrepareOutput {
  loginTicket: string
  needProfile: boolean
  needPhone: boolean
  avatar?: string | null
}

export interface WxLoginOutput {
  avatar?: string
  accessToken: string
  userId: ShenLeId
  nickName?: string
  accountType: number
  hasPhone: boolean
}

export interface CompleteProfileInput {
  loginTicket: string
  nickName: string
  avatar: string
  phoneCode: string
}

export interface UploadAvatarOutput {
  url: string
}

export interface SlUserOutput {
  userId: ShenLeId
  nickName?: string | null
  avatar?: string | null
  accountType: number
  accountTypeName: string
  status: number
  isLandlord?: boolean
  createTime?: string | null
}

export interface PageSlUserInput extends BasePageInput {
  keyword?: string
}

export interface SetSlUserRoleInput {
  userId: ShenLeId
  accountType: number
}

export interface MyAccessOutput {
  accountType: number
  applyStatus: number
  application?: MyAccessApplicationOutput | null
  isLandlord?: boolean
  isSourceContact?: boolean
  isMaintainer?: boolean
  landlordApplyStatus?: number
  hasPhone: boolean
  canViewRealData: boolean
  canCreateCommunity: boolean
  canWriteAssignedSupply: boolean
  canWriteAllSupply: boolean
  canBatchWriteSupply: boolean
  canViewSupplyContactPhone: boolean
  canViewSupplyActivity: boolean
  canUseMineFilters: boolean
  canFilterBySupplyOperator: boolean
  canAssignCommunityContact: boolean
  canManageSourceContacts: boolean
  canManageUsers: boolean
  canCreateSupply: boolean
  canEnterLandlordPortal: boolean
  canEnterRestrictedAdmin: boolean
  canManageLandlords: boolean
  canSetCommunityHotLevel: boolean
  landlordCommunityCount: number
  maintainedCommunityCount: number
  communityManageScope: number
}

export interface SlAccessMaterialOutput {
  fileId: ShenLeId
  fileName?: string | null
  previewUrl?: string | null
  sortNo: number
}

export interface MyAccessApplicationOutput {
  applicationId: ShenLeId
  enterpriseName?: string | null
  realName?: string | null
  applyStatus: number
  applyTime?: string | null
  materials: SlAccessMaterialOutput[]
}

export interface CreateLandlordShareCodeOutput {
  shareToken: string
  qrPngBase64: string
  ownerName: string
  communityCount: number
  expiresAt: string
}

export interface ResolveLandlordShareOutput {
  shareToken: string
  requiresApproval: boolean
  ownerName?: string | null
  communityCount: number
}

export interface SlUserApplicationDetailOutput {
  applicationId: ShenLeId
  userId: ShenLeId
  nickName?: string | null
  avatar?: string | null
  phone?: string | null
  enterpriseName?: string | null
  realName?: string | null
  applyStatus: number
  applyTime?: string | null
  reviewTime?: string | null
  reviewUserName?: string | null
  rejectReason?: string | null
  materials: SlAccessMaterialOutput[]
}

export interface ApplyAccessInput {
  applyType?: number
  applicationId?: ShenLeId
  enterpriseName?: string
  realName?: string
  proofFileIds?: ShenLeId[]
}

export interface SaveSlUserAccessDraftInput {
  enterpriseName: string
  realName: string
}

export interface SlSupplyOperatorOutput {
  userId: ShenLeId
  nickName: string
}

export interface SlSupplyRecentOutput {
  id: ShenLeId
  communityId: ShenLeId
  communityName: string
  operatorUserId: ShenLeId
  operatorNickName: string
  action: string
  actionName: string
  affectedCount: number
  updateTime: string
}

export interface SlSupplyLeaderboardOutput {
  userId: ShenLeId
  nickName: string
  activityCount: number
  affectedCount: number
  communityCount: number
  lastUpdateTime: string
}

export type SlSupplyLeaderboardDimension = 'affectedCount' | 'activityCount' | 'communityCount'

export interface SlSupplyLeaderboardDetailItemOutput {
  id: ShenLeId
  activityId: ShenLeId
  communityId: ShenLeId
  communityName: string
  buildingId?: ShenLeId | null
  buildingName?: string | null
  propertyId?: ShenLeId | null
  propertyName?: string | null
  entityType: 'community' | 'building' | 'property' | string
  entityName: string
  action: string
  actionName: string
  metricValue: number
  updateTime: string
  isLegacyAggregate: boolean
}

export interface SlSupplyLeaderboardDetailPageOutput {
  dimension: SlSupplyLeaderboardDimension
  totalValue: number
  total: number
  page: number
  pageSize: number
  hasMore: boolean
  items: SlSupplyLeaderboardDetailItemOutput[]
}

export interface SlLandlordApplyOutput {
  userId: ShenLeId
  nickName?: string
  applyTime?: string
}

export interface SlPendingUserOutput {
  userId: ShenLeId
  nickName?: string | null
  avatar?: string | null
  applyTime?: string | null
  applicationId: ShenLeId
  enterpriseName?: string | null
  realName?: string | null
  materialCount: number
}

export interface SlUserApplicationActionInput {
  applicationId?: ShenLeId
  userId?: ShenLeId
  rejectReason?: string
}

export interface SlLandlordOutput {
  userId: ShenLeId
  nickName?: string | null
  accountType: number
  communityCount: number
  supportUserId?: ShenLeId | null
  supportUserName?: string | null
  supportUserPhone?: string | null
}

export interface PageSlLandlordInput extends BasePageInput {
  keyword?: string
}

export interface CommunityAssignmentOutput {
  id: ShenLeId
  name: string
  regionName?: string | null
  buildingCount: number
  propertyCount: number
  isAssigned: boolean
}

export interface PageCommunityAssignmentInput extends BasePageInput {
  ownerUserId: ShenLeId
  keyword?: string
  assignmentStatus?: number
}

export interface BatchAssignOwnerInput {
  ownerUserId: ShenLeId
  assignCommunityIds: ShenLeId[]
  unassignCommunityIds: ShenLeId[]
}

export interface BatchAssignOwnerOutput {
  assignedCount: number
  unassignedCount: number
}

export type SlCommissionMode = 1 | 2 | 3

export interface SlLandlordMaintainerOutput {
  userId: ShenLeId
  nickName?: string | null
  phone?: string | null
  isPrimary: boolean
}

export interface SlLandlordProfileOutput {
  userId: ShenLeId
  nickName?: string | null
  phone?: string | null
  accountType: number
  communityCount: number
  contactDisplayMode: 1 | 2
  primaryMaintainerUserId?: ShenLeId | null
  maintainers: SlLandlordMaintainerOutput[]
}

export interface PageSlLandlordProfileInput extends BasePageInput {
  keyword?: string
}

export interface SlLandlordCandidateOutput {
  userId: ShenLeId
  nickName?: string | null
  phone?: string | null
  accountType: number
  isLandlord: boolean
  isMaintainer: boolean
}

export interface PageSlLandlordCandidateInput extends BasePageInput {
  keyword?: string
}

export interface SetSlLandlordMaintainersInput {
  landlordUserId: ShenLeId
  maintainerUserIds: ShenLeId[]
  primaryMaintainerUserId?: ShenLeId | null
}

export interface SlLandlordCommunityAssignmentOutput {
  id: ShenLeId
  name: string
  regionName?: string | null
  buildingCount: number
  propertyCount: number
  isAssigned: boolean
}

export interface PageSlLandlordCommunityAssignmentInput extends BasePageInput {
  landlordUserId: ShenLeId
  keyword?: string
  assignmentStatus?: 0 | 1 | 2
}

export interface BatchAssignSlLandlordCommunitiesInput {
  landlordUserId: ShenLeId
  assignCommunityIds: ShenLeId[]
  unassignCommunityIds: ShenLeId[]
}

export interface SlSourceContactProfileOutput {
  userId: ShenLeId
  nickName?: string | null
  phone?: string | null
  supportUserId?: ShenLeId | null
  supportUserName?: string | null
  supportUserPhone?: string | null
  communityCount: number
  buildingCount: number
  propertyCount: number
  availableCount: number
  rentedCount: number
  promotedCount: number
  isLandlord: boolean
  isMaintainer: boolean
}

export interface SlSourceContactCommunityOutput {
  id: ShenLeId
  name: string
  address?: string | null
  lng?: number | null
  lat?: number | null
  buildingCount: number
  propertyCount: number
  availableCount: number
  rentedCount: number
  promotedCount: number
  minRentPrice?: number | null
  maxRentPrice?: number | null
  coverImageId?: ShenLeId | null
  coverImage?: string | null
  coverFileType?: string | null
  coverSuffix?: string | null
  coverPosterFileId?: ShenLeId | null
  coverPosterUrl?: string | null
  supplyUpdateTime?: string | null
  type: number
  managementFee?: number | null
  networkFee?: number | null
  networkFeeMode?: 1 | 2 | null
  waterFee?: number | null
  electricityFee?: number | null
  lowestHalfYearCommissionPercent?: number | null
  lowestOneYearCommissionPercent?: number | null
  highestHalfYearCommissionPercent?: number | null
  highestOneYearCommissionPercent?: number | null
  highestCommissionPercent?: number | null
  hotLevel: number
  hotExpireTime?: string | null
  contactName?: string | null
  contactPhone?: string | null
}

export interface SlCommunityOperationConfigOutput {
  communityId: ShenLeId
  communityName: string
  managementFee?: number | null
  networkFee?: number | null
  networkFeeMode?: 1 | 2 | null
  waterFee?: number | null
  electricityFee?: number | null
  commissionMode?: SlCommissionMode | null
  commissionValue?: number | null
  halfYearCommissionPercent?: number | null
  oneYearCommissionPercent?: number | null
  managementPackageMode?: 1 | 2 | null
  networkPackageMode?: 1 | 2 | 3 | 4 | null
  remark?: string | null
  hotLevel: number
  hotExpireTime?: string | null
}

export interface SaveSlCommunityOperationConfigInput {
  communityId: ShenLeId
  managementFee?: number | null
  networkFee?: number | null
  networkFeeMode?: 1 | 2 | null
  waterFee?: number | null
  electricityFee?: number | null
  commissionMode?: SlCommissionMode | null
  commissionValue?: number | null
  halfYearCommissionPercent?: number | null
  oneYearCommissionPercent?: number | null
  managementPackageMode?: 1 | 2 | null
  networkPackageMode?: 1 | 2 | 3 | 4 | null
  applyToProperties?: boolean
  remark?: string | null
}

export interface SlPropertyOperationConfigOutput {
  propertyId: ShenLeId
  communityId: ShenLeId
  buildingId: ShenLeId
  title: string
  roomNo?: string | null
  managementFee?: number | null
  networkFee?: number | null
  waterFee?: number | null
  electricityFee?: number | null
  commissionMode?: SlCommissionMode | null
  commissionValue?: number | null
  halfYearCommissionPercent?: number | null
  oneYearCommissionPercent?: number | null
  managementPackageMode?: 1 | 2 | null
  networkPackageMode?: 1 | 2 | 3 | 4 | null
  effectiveManagementFee?: number | null
  effectiveNetworkFee?: number | null
  effectiveWaterFee?: number | null
  effectiveElectricityFee?: number | null
  effectiveCommissionMode?: SlCommissionMode | null
  effectiveCommissionValue?: number | null
  effectiveHalfYearCommissionPercent?: number | null
  effectiveOneYearCommissionPercent?: number | null
  effectiveManagementPackageMode?: 1 | 2 | null
  effectiveNetworkPackageMode?: 1 | 2 | 3 | 4 | null
  supportsMonthlyRent: boolean
  supportsShortRent: boolean
  minimumShortRentMonths?: number | null
  shortRentCanMarkup: boolean
  supportsDailyRent: boolean
  dailyRentCommissionAmount?: number | null
  dailyRentCommissionPercent?: number | null
  dailyRentPrice?: number | null
  supportsMonthlyPayment: boolean
  monthlyPaymentHalfYearCommissionPercent?: number | null
  monthlyPaymentOneYearCommissionPercent?: number | null
  supportsZeroDeposit: boolean
  promotionCommissionMode?: SlCommissionMode | null
  promotionCommissionValue?: number | null
  isPromoted: boolean
}

export interface SaveSlPropertyOperationConfigInput {
  propertyId: ShenLeId
  managementFee?: number | null
  networkFee?: number | null
  waterFee?: number | null
  electricityFee?: number | null
  commissionMode?: SlCommissionMode | null
  commissionValue?: number | null
  halfYearCommissionPercent?: number | null
  oneYearCommissionPercent?: number | null
  managementPackageMode?: 1 | 2 | null
  networkPackageMode?: 1 | 2 | 3 | 4 | null
}

export interface BatchSaveSlPropertyCommissionInput {
  propertyIds: ShenLeId[]
  commissionMode?: SlCommissionMode | null
  commissionValue?: number | null
  halfYearCommissionPercent?: number | null
  oneYearCommissionPercent?: number | null
  managementPackageMode?: 1 | 2 | null
  networkPackageMode?: 1 | 2 | 3 | 4 | null
}

export interface PageSlPromotionInput extends BasePageInput {
  communityId?: ShenLeId
  buildingId?: ShenLeId
  keyword?: string
  promotionOnly?: boolean
}

export interface SlPromotionPropertyOutput extends SlPropertyOperationConfigOutput {
  communityName: string
  buildingName: string
  rentPrice: number
  status: number
  statusName: string
}

export interface SaveSlPromotionInput {
  propertyIds: ShenLeId[]
  supportsMonthlyRent?: boolean | null
  supportsShortRent?: boolean | null
  minimumShortRentMonths?: number | null
  shortRentCanMarkup?: boolean | null
  supportsDailyRent?: boolean | null
  dailyRentCommissionAmount?: number | null
  dailyRentCommissionPercent?: number | null
  dailyRentPrice?: number | null
  supportsMonthlyPayment?: boolean | null
  monthlyPaymentHalfYearCommissionPercent?: number | null
  monthlyPaymentOneYearCommissionPercent?: number | null
  supportsZeroDeposit?: boolean | null
  promotionCommissionMode?: SlCommissionMode | null
  promotionCommissionValue?: number | null
}

export interface SetSlSourceContactSupportInput {
  sourceContactUserId: ShenLeId
  supportUserId?: ShenLeId | null
}
