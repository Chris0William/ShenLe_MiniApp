import { describe, expect, it } from 'vitest'
import {
  findDuplicateRoomNumbers,
  generateRoomNumbers,
  mergeEnabledSnapshotFields,
  mergeMediaByMode,
} from '../property-batch'

describe('generateRoomNumbers', () => {
  it('generates two-digit room sequences for each floor', () => {
    expect(generateRoomNumbers({ startFloor: 1, floorCount: 2, roomsPerFloor: 2 })).toEqual([
      { floor: 1, roomNo: '101' },
      { floor: 1, roomNo: '102' },
      { floor: 2, roomNo: '201' },
      { floor: 2, roomNo: '202' },
    ])
  })

  it('keeps the floor intact for rooms above the ninth floor', () => {
    expect(generateRoomNumbers({ startFloor: 10, floorCount: 1, roomsPerFloor: 1 })).toEqual([
      { floor: 10, roomNo: '1001' },
    ])
  })

  it('allows exactly 200 rooms', () => {
    expect(generateRoomNumbers({ startFloor: 1, floorCount: 20, roomsPerFloor: 10 })).toHaveLength(200)
  })

  it('rejects batches larger than 200 rooms', () => {
    expect(() => generateRoomNumbers({ startFloor: 1, floorCount: 201, roomsPerFloor: 1 }))
      .toThrow('单次最多生成 200 套房源')
  })

  it.each([
    ['startFloor', 0],
    ['startFloor', -1],
    ['startFloor', 1.5],
    ['startFloor', Number.NaN],
    ['startFloor', Number.POSITIVE_INFINITY],
    ['floorCount', 0],
    ['floorCount', -1],
    ['floorCount', 1.5],
    ['floorCount', Number.NaN],
    ['floorCount', Number.POSITIVE_INFINITY],
    ['roomsPerFloor', 0],
    ['roomsPerFloor', -1],
    ['roomsPerFloor', 1.5],
    ['roomsPerFloor', Number.NaN],
    ['roomsPerFloor', Number.POSITIVE_INFINITY],
  ] as const)('rejects invalid %s value %s', (field, value) => {
    const input = { startFloor: 1, floorCount: 1, roomsPerFloor: 1, [field]: value }

    expect(() => generateRoomNumbers(input))
      .toThrow(`${field} 必须是大于 0 的有限整数`)
  })

  it('rejects fractional counts before they can bypass the 200-room limit', () => {
    expect(() => generateRoomNumbers({ startFloor: 1, floorCount: 100.4, roomsPerFloor: 1.99 }))
      .toThrow('floorCount 必须是大于 0 的有限整数')
  })
})

describe('findDuplicateRoomNumbers', () => {
  it('reports duplicates inside the generated batch and against existing rooms once', () => {
    expect(findDuplicateRoomNumbers(['101', '102', '101', '201'], ['102', '301']))
      .toEqual(['101', '102'])
  })
})

describe('mergeEnabledSnapshotFields', () => {
  it('preserves fields whose switches are not enabled', () => {
    const snapshot = { rentPrice: 1800, area: 42, remark: '朝南' }

    expect(mergeEnabledSnapshotFields(snapshot, { rentPrice: 2200, area: 60 }, ['rentPrice']))
      .toEqual({ rentPrice: 2200, area: 42, remark: '朝南' })
    expect(snapshot).toEqual({ rentPrice: 1800, area: 42, remark: '朝南' })
  })

  it('applies enabled zero and empty-string values instead of treating them as absent', () => {
    const snapshot = { rentPrice: 1800, remark: '待整理', description: '保留' }

    expect(mergeEnabledSnapshotFields(snapshot, { rentPrice: 0, remark: '' }, ['rentPrice', 'remark']))
      .toEqual({ rentPrice: 0, remark: '', description: '保留' })
  })
})

describe('mergeMediaByMode', () => {
  const current = [
    { fileId: 'image-1', fileType: 'image' },
    { fileId: 'video-1', fileType: 'video' },
  ]
  const selected = [
    { fileId: 'video-1', fileType: 'video' },
    { fileId: 'image-2', fileType: 'image' },
  ]

  it('keeps current media when the mode is unchanged', () => {
    expect(mergeMediaByMode(current, selected, 'unchanged')).toEqual(current)
  })

  it('appends only media that is not already present', () => {
    expect(mergeMediaByMode(current, selected, 'append')).toEqual([
      ...current,
      { fileId: 'image-2', fileType: 'image' },
    ])
  })

  it('replaces current media with the selected media', () => {
    expect(mergeMediaByMode(current, selected, 'replace')).toEqual(selected)
  })

  it('clears all media only in clear mode', () => {
    expect(mergeMediaByMode(current, selected, 'clear')).toEqual([])
  })
})
