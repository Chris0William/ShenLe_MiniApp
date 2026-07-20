import type {
  AddSlPropertyImageInput,
  AddSlPropertyInput,
  ShenLeId,
  SlBuildingOutput,
  SlPropertyBatchRowOutput,
  UpdateSlBuildingInput,
  UpdateSlPropertyInput,
} from '@/types/shenle'

export const MAX_PROPERTY_BATCH_SIZE = 200

export interface GenerateRoomNumbersInput {
  startFloor: number
  floorCount: number
  roomsPerFloor: number
}

export interface GeneratedRoomNumber {
  floor: number
  roomNo: string
}

export interface PropertyRowFilter {
  keyword?: string
  status?: number
  minFloor?: number
  maxFloor?: number
  roomNoSuffix?: string
  bedrooms?: number
  livingRooms?: number
  bathrooms?: number
}

export interface FilterablePropertyRow {
  title: string
  roomNo?: string | null
  floor?: number | null
  bedrooms?: number
  livingRooms?: number
  bathrooms?: number
  status: number
}

export interface GeneratePropertyDraftsInput {
  startFloor: number
  endFloor: number
  roomSuffix: string
  bedrooms: number
  livingRooms: number
  bathrooms: number
  area?: number | null
  baseRentPrice: number
  incrementEveryFloors?: number
  incrementAmount?: number
}

export interface GeneratedPropertyDraft extends GeneratedRoomNumber {
  bedrooms: number
  livingRooms: number
  bathrooms: number
  area?: number | null
  rentPrice: number
  status: number
  images: AddSlPropertyImageInput[]
  coverImageId?: ShenLeId | null
}

export interface DeduplicatedPropertyDrafts<T extends GeneratedPropertyDraft = GeneratedPropertyDraft> {
  items: T[]
  duplicateRoomNumbers: string[]
}

export interface ComparableMedia {
  id?: ShenLeId | null
  fileId?: ShenLeId | null
  url?: string | null
  fileType?: string | null
  suffix?: string | null
  fileName?: string | null
}

export type MediaMergeMode = 'append' | 'replace' | 'clear' | 'unchanged'

export interface BatchMediaItem {
  fileId: number | string
}

export interface BatchAddContext {
  communityId: ShenLeId
  buildingId: ShenLeId
  unit?: string | null
  totalFloors?: number | null
}

export interface BatchUpdateOptions {
  enabledFields: readonly (keyof UpdateSlPropertyInput)[]
  values: Partial<UpdateSlPropertyInput>
  mediaMode: MediaMergeMode
  media: readonly AddSlPropertyImageInput[]
  coverSelection?: {
    mediaKey?: string
    sourceFileId?: ShenLeId
  } | null
}

const BATCH_EDITABLE_FIELDS = new Set<keyof UpdateSlPropertyInput>([
  'rentPrice',
  'area',
  'bedrooms',
  'livingRooms',
  'bathrooms',
  'status',
  'orientation',
  'decoration',
  'rentalType',
  'deposit',
  'depositRule',
  'minLease',
  'description',
  'remark',
  'tagIds',
  'facilityIds',
  'images',
])

export function generateRoomNumbers(input: GenerateRoomNumbersInput): GeneratedRoomNumber[] {
  const fields = Object.entries(input) as [keyof GenerateRoomNumbersInput, number][]
  fields.forEach(([field, value]) => {
    if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0)
      throw new Error(`${field} 必须是大于 0 的有限整数`)
  })

  const total = input.floorCount * input.roomsPerFloor
  if (total > MAX_PROPERTY_BATCH_SIZE)
    throw new Error(`单次最多生成 ${MAX_PROPERTY_BATCH_SIZE} 套房源`)

  const rooms: GeneratedRoomNumber[] = []
  for (let floorOffset = 0; floorOffset < input.floorCount; floorOffset++) {
    const floor = input.startFloor + floorOffset
    for (let roomIndex = 1; roomIndex <= input.roomsPerFloor; roomIndex++) {
      rooms.push({
        floor,
        roomNo: `${floor}${String(roomIndex).padStart(2, '0')}`,
      })
    }
  }
  return rooms
}

function assertNonNegativeInteger(value: number, label: string) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0)
    throw new Error(`${label}必须是大于等于 0 的整数`)
}

export function generatePropertyDrafts(input: GeneratePropertyDraftsInput): GeneratedPropertyDraft[] {
  if (!Number.isInteger(input.startFloor) || input.startFloor <= 0)
    throw new Error('起始楼层必须是大于 0 的整数')
  if (!Number.isInteger(input.endFloor) || input.endFloor < input.startFloor)
    throw new Error('结束楼层不能小于起始楼层')

  const roomSuffix = input.roomSuffix.trim()
  if (!roomSuffix)
    throw new Error('请输入固定房号')
  if (`${input.endFloor}${roomSuffix}`.length > 20)
    throw new Error('生成后的房号不能超过 20 个字符')

  assertNonNegativeInteger(input.bedrooms, '室数')
  assertNonNegativeInteger(input.livingRooms, '厅数')
  assertNonNegativeInteger(input.bathrooms, '卫数')

  if (input.area != null && (!Number.isFinite(input.area) || input.area <= 0))
    throw new Error('面积必须是大于 0 的数字')
  if (!Number.isFinite(input.baseRentPrice) || input.baseRentPrice < 0)
    throw new Error('基础价格必须是大于等于 0 的数字')

  const incrementEveryFloors = input.incrementEveryFloors ?? 0
  const incrementAmount = input.incrementAmount ?? 0
  if (!Number.isFinite(incrementAmount) || incrementAmount < 0)
    throw new Error('递增价格必须是大于等于 0 的数字')
  if (incrementAmount > 0 && (!Number.isInteger(incrementEveryFloors) || incrementEveryFloors <= 0))
    throw new Error('请输入大于 0 的递增楼层数')

  const count = input.endFloor - input.startFloor + 1
  if (count > MAX_PROPERTY_BATCH_SIZE)
    throw new Error(`单次最多生成 ${MAX_PROPERTY_BATCH_SIZE} 套房源`)

  return Array.from({ length: count }, (_, index) => {
    const floor = input.startFloor + index
    const step = incrementAmount > 0 ? Math.floor(index / incrementEveryFloors) : 0
    return {
      floor,
      roomNo: `${floor}${roomSuffix}`,
      bedrooms: input.bedrooms,
      livingRooms: input.livingRooms,
      bathrooms: input.bathrooms,
      area: input.area ?? null,
      rentPrice: input.baseRentPrice + step * incrementAmount,
      status: 0, // 空置
      images: [],
      coverImageId: null,
    }
  })
}

export function deduplicatePropertyDrafts<T extends GeneratedPropertyDraft>(
  drafts: readonly T[],
  existingRoomNumbers: readonly string[] = [],
): DeduplicatedPropertyDrafts<T> {
  const seen = new Set(existingRoomNumbers.map(roomNo => roomNo.trim()).filter(Boolean))
  const duplicateRoomNumbers: string[] = []
  const items: T[] = []

  drafts.forEach((draft) => {
    const roomNo = draft.roomNo.trim()
    if (!roomNo || seen.has(roomNo)) {
      if (roomNo && !duplicateRoomNumbers.includes(roomNo))
        duplicateRoomNumbers.push(roomNo)
      return
    }
    seen.add(roomNo)
    items.push({ ...draft, roomNo })
  })

  return { items, duplicateRoomNumbers }
}

export function filterPropertyRows<T extends FilterablePropertyRow>(
  rows: readonly T[],
  filter: PropertyRowFilter,
): T[] {
  const keyword = filter.keyword?.trim().toLowerCase() || ''
  const suffix = filter.roomNoSuffix?.trim().toLowerCase() || ''

  return rows.filter((row) => {
    const title = row.title.trim().toLowerCase()
    const roomNo = String(row.roomNo || row.title).trim().toLowerCase()
    if (keyword && !title.includes(keyword) && !roomNo.includes(keyword))
      return false
    if (filter.status != null && row.status !== filter.status)
      return false
    if (filter.minFloor != null && (row.floor == null || row.floor < filter.minFloor))
      return false
    if (filter.maxFloor != null && (row.floor == null || row.floor > filter.maxFloor))
      return false
    if (suffix && !roomNo.endsWith(suffix))
      return false
    if (filter.bedrooms != null && row.bedrooms !== filter.bedrooms)
      return false
    if (filter.livingRooms != null && row.livingRooms !== filter.livingRooms)
      return false
    if (filter.bathrooms != null && row.bathrooms !== filter.bathrooms)
      return false
    return true
  })
}

export function mediaIdentityKey(media: ComparableMedia): string {
  const url = String(media.url || '').split('#')[0].split('?')[0]
  const suffix = String(media.suffix || '').trim().toLowerCase()
  const fileType = String(media.fileType || '').trim().toLowerCase()
  if (url)
    return `${fileType}|${suffix}|${url}`
  return `${fileType}|${suffix}|${String(media.fileName || '')}`
}

export function identicalMedia<T extends ComparableMedia>(rows: readonly { images: readonly T[] }[]): T[] | null {
  if (!rows.length)
    return []
  const first = rows[0].images
  const firstKeys = first.map(mediaIdentityKey).sort()
  const identical = rows.every((row) => {
    const keys = row.images.map(mediaIdentityKey).sort()
    return keys.length === firstKeys.length && keys.every((key, index) => key === firstKeys[index])
  })
  return identical ? [...first] : null
}

export function findDuplicateRoomNumbers(
  roomNumbers: readonly string[],
  existingRoomNumbers: readonly string[] = [],
): string[] {
  const normalized = roomNumbers.map(roomNo => roomNo.trim())
  const counts = new Map<string, number>()
  const existing = new Set(existingRoomNumbers.map(roomNo => roomNo.trim()))

  normalized.forEach(roomNo => counts.set(roomNo, (counts.get(roomNo) || 0) + 1))
  return normalized.filter((roomNo, index) =>
    normalized.indexOf(roomNo) === index
    && ((counts.get(roomNo) || 0) > 1 || existing.has(roomNo)),
  )
}

export function mergeEnabledSnapshotFields<T extends object>(
  snapshot: T,
  values: Partial<T>,
  enabledFields: readonly (keyof T)[],
): T {
  const result = { ...snapshot }
  enabledFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(values, field))
      result[field] = values[field] as T[keyof T]
  })
  return result
}

export function mergeMediaByMode<T extends BatchMediaItem>(
  current: readonly T[],
  selected: readonly T[],
  mode: MediaMergeMode,
): T[] {
  if (mode === 'unchanged')
    return [...current]
  if (mode === 'clear')
    return []
  if (mode === 'replace')
    return [...selected]

  const fileIds = new Set(current.map(media => String(media.fileId)))
  return [
    ...current,
    ...selected.filter((media) => {
      const fileId = String(media.fileId)
      if (fileIds.has(fileId))
        return false
      fileIds.add(fileId)
      return true
    }),
  ]
}

export function buildBatchAddInputs(
  rooms: readonly (GeneratedRoomNumber & Partial<GeneratedPropertyDraft>)[],
  context: BatchAddContext,
): AddSlPropertyInput[] {
  return rooms.map((room) => {
    const images = room.images?.map(media => ({ ...media })) || []
    return {
      title: room.roomNo,
      communityId: context.communityId,
      buildingId: context.buildingId,
      unit: context.unit?.trim() || null,
      roomNo: room.roomNo,
      floor: room.floor,
      totalFloors: context.totalFloors ?? null,
      area: room.area ?? null,
      bedrooms: room.bedrooms ?? 1,
      livingRooms: room.livingRooms ?? 0,
      bathrooms: room.bathrooms ?? 0,
      rentPrice: room.rentPrice ?? 0,
      status: room.status ?? 0, // 空置
      coverImageId: room.coverImageId ?? images[0]?.fileId ?? null,
      tagIds: [],
      facilityIds: [],
      images,
    }
  })
}

function snapshotToUpdateInput(snapshot: SlPropertyBatchRowOutput): UpdateSlPropertyInput {
  return {
    id: snapshot.id,
    title: snapshot.title,
    communityId: snapshot.communityId,
    buildingId: snapshot.buildingId,
    unit: snapshot.unit ?? null,
    roomNo: snapshot.roomNo ?? null,
    floor: snapshot.floor ?? null,
    totalFloors: snapshot.totalFloors ?? null,
    area: snapshot.area ?? null,
    bedrooms: snapshot.bedrooms,
    livingRooms: snapshot.livingRooms,
    bathrooms: snapshot.bathrooms,
    orientation: snapshot.orientation ?? null,
    decoration: snapshot.decoration ?? null,
    rentalType: snapshot.rentalType ?? null,
    rentPrice: snapshot.rentPrice,
    deposit: snapshot.deposit ?? null,
    depositRule: snapshot.depositRule ?? null,
    minLease: snapshot.minLease ?? null,
    status: snapshot.status,
    coverImageId: snapshot.coverImageId ?? null,
    tagIds: [...snapshot.tagIds],
    facilityIds: [...snapshot.facilityIds],
    description: snapshot.description ?? null,
    remark: snapshot.remark ?? null,
    images: snapshot.images.map(media => ({ fileId: media.id, fileType: media.fileType ?? null })),
  }
}

export function buildBatchUpdateInputs(
  snapshots: readonly SlPropertyBatchRowOutput[],
  options: BatchUpdateOptions,
): UpdateSlPropertyInput[] {
  const enabledFields = options.enabledFields.filter(field => BATCH_EDITABLE_FIELDS.has(field))

  return snapshots.map((snapshot) => {
    const current = snapshotToUpdateInput(snapshot)
    const updated = mergeEnabledSnapshotFields(current, options.values, enabledFields)
    const images = enabledFields.includes('images')
      ? mergeMediaByMode(current.images || [], options.media, options.mediaMode)
      : (current.images || [])
    const selectedCoverId = options.coverSelection?.sourceFileId
      ?? (options.coverSelection?.mediaKey
        ? snapshot.images.find(media => mediaIdentityKey(media) === options.coverSelection?.mediaKey)?.id
        : undefined)
    const requestedCoverId = selectedCoverId ?? current.coverImageId
    const coverExists = images.some(media => String(media.fileId) === String(requestedCoverId ?? ''))
    return {
      ...updated,
      images,
      coverImageId: coverExists ? requestedCoverId : (images[0]?.fileId ?? null),
    }
  })
}

export function buildBuildingFloorUpdate(
  detail: SlBuildingOutput,
  totalFloors: number,
): UpdateSlBuildingInput {
  return {
    id: detail.id,
    communityId: detail.communityId,
    name: detail.name,
    totalFloors,
    hasElevator: detail.hasElevator ?? null,
    orderNo: detail.orderNo,
    status: detail.status,
    remark: detail.remark ?? undefined,
    coverImageId: detail.coverImageId ?? null,
    imageIds: (detail.images || []).map(media => media.id),
  }
}
