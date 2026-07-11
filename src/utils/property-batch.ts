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
  'landlordName',
  'landlordPhone',
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
  rooms: readonly GeneratedRoomNumber[],
  context: BatchAddContext,
): AddSlPropertyInput[] {
  return rooms.map(room => ({
    title: room.roomNo,
    communityId: context.communityId,
    buildingId: context.buildingId,
    unit: context.unit?.trim() || null,
    roomNo: room.roomNo,
    floor: room.floor,
    totalFloors: context.totalFloors ?? null,
    bedrooms: 1,
    livingRooms: 0,
    bathrooms: 1,
    rentPrice: 0,
    status: 3, // 下架，批量创建后由管理人员确认再发布
    tagIds: [],
    facilityIds: [],
    images: [],
  }))
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
    landlordName: snapshot.landlordName ?? null,
    landlordPhone: snapshot.landlordPhone ?? null,
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
    if (!enabledFields.includes('images'))
      return updated

    const currentMedia = current.images || []
    const images = mergeMediaByMode(currentMedia, options.media, options.mediaMode)
    const coverExists = images.some(media => String(media.fileId) === String(current.coverImageId ?? ''))
    return {
      ...updated,
      images,
      coverImageId: coverExists ? current.coverImageId : (images[0]?.fileId ?? null),
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
