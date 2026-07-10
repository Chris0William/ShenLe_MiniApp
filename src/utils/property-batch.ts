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
  [key: string]: unknown
}

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
