import { describe, expect, it } from 'vitest'
import {
  deduplicatePropertyDrafts,
  filterPropertyRows,
  findDuplicateRoomNumbers,
  generatePropertyDrafts,
  generateRoomNumbers,
  identicalMedia,
  mediaIdentityKey,
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

describe('property row filters', () => {
  const rows = [
    { title: '502', roomNo: '502', floor: 5, bedrooms: 1, livingRooms: 0, bathrooms: 0, status: 0 },
    { title: '602', roomNo: '602', floor: 6, bedrooms: 1, livingRooms: 1, bathrooms: 0, status: 0 },
    { title: '175003', roomNo: '175003', floor: 17, bedrooms: 2, livingRooms: 1, bathrooms: 1, status: 2 },
    { title: '185003', roomNo: '185003', floor: 18, bedrooms: 2, livingRooms: 1, bathrooms: 1, status: 0 },
  ]

  it('matches room numbers from the end', () => {
    expect(filterPropertyRows(rows, { roomNoSuffix: '02' }).map(row => row.roomNo)).toEqual(['502', '602'])
    expect(filterPropertyRows(rows, { roomNoSuffix: '5003' }).map(row => row.roomNo)).toEqual(['175003', '185003'])
  })

  it('combines floor range, exact layout and status', () => {
    expect(filterPropertyRows(rows, {
      minFloor: 10,
      maxFloor: 18,
      bedrooms: 2,
      livingRooms: 1,
      bathrooms: 1,
      status: 0,
    }).map(row => row.roomNo)).toEqual(['185003'])
  })
})

describe('property draft generation', () => {
  it('uses a fixed suffix and increases rent after each complete floor interval', () => {
    const drafts = generatePropertyDrafts({
      startFloor: 3,
      endFloor: 6,
      roomSuffix: '02',
      bedrooms: 1,
      livingRooms: 0,
      bathrooms: 0,
      area: 28,
      baseRentPrice: 1060,
      incrementEveryFloors: 2,
      incrementAmount: 30,
    })

    expect(drafts.map(draft => [draft.roomNo, draft.rentPrice])).toEqual([
      ['302', 1060],
      ['402', 1060],
      ['502', 1090],
      ['602', 1090],
    ])
    expect(drafts[0]).toMatchObject({ bedrooms: 1, livingRooms: 0, bathrooms: 0, area: 28, status: 0 })
  })

  it('accepts an alphanumeric fixed room suffix without requiring price increments', () => {
    const drafts = generatePropertyDrafts({
      startFloor: 3,
      endFloor: 4,
      roomSuffix: '1A',
      bedrooms: 1,
      livingRooms: 0,
      bathrooms: 0,
      baseRentPrice: 1000,
      incrementEveryFloors: 0,
      incrementAmount: 0,
    })

    expect(drafts.map(draft => [draft.roomNo, draft.rentPrice])).toEqual([
      ['31A', 1000],
      ['41A', 1000],
    ])
  })

  it('removes existing and repeated room numbers instead of rejecting the whole batch', () => {
    const drafts = generatePropertyDrafts({
      startFloor: 3,
      endFloor: 5,
      roomSuffix: '02',
      bedrooms: 1,
      livingRooms: 0,
      bathrooms: 0,
      baseRentPrice: 1000,
    })
    const result = deduplicatePropertyDrafts([...drafts, { ...drafts[0] }], ['402'])

    expect(result.items.map(item => item.roomNo)).toEqual(['302', '502'])
    expect(result.duplicateRoomNumbers).toEqual(['402', '302'])
  })
})

describe('logical media identity', () => {
  it('ignores signed URL query strings when comparing copied media', () => {
    const first = { id: 'a', url: 'https://cos.example/video.mp4?sign=one', fileType: 'video', suffix: '.mp4' }
    const copy = { id: 'b', url: 'https://cos.example/video.mp4?sign=two', fileType: 'video', suffix: '.mp4' }

    expect(mediaIdentityKey(first)).toBe(mediaIdentityKey(copy))
    expect(identicalMedia([{ images: [first] }, { images: [copy] }])).toEqual([first])
  })

  it('returns null when selected properties have different media sets', () => {
    expect(identicalMedia([
      { images: [{ id: 'a', url: '/a.jpg', fileType: 'image' }] },
      { images: [{ id: 'b', url: '/b.jpg', fileType: 'image' }] },
    ])).toBeNull()
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
