import type {
  AddSlPropertyImageInput,
  AddSlPropertyInput,
  BatchAddSlBuildingInput,
  BatchAddSlBuildingOutput,
  BatchDeleteSlPropertyInput,
  BatchSaveSlPropertyInput,
  BatchSlPropertyResult,
  BatchUpdateSlPropertyStatusInput,
  BindSlMediaPosterInput,
  CleanupSlMediaDraftInput,
  ShenLeId,
  SlPropertyBatchError,
  SlPropertyBatchRowOutput,
  SlPropertyImageOutput,
  UpdateSlPropertyInput,
} from '@/types/shenle'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, expectTypeOf, it } from 'vitest'

interface ExpectedAddSlPropertyImageInput {
  fileId: ShenLeId
  fileType?: string | null
}

interface ExpectedAddSlPropertyInput {
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
}

interface ExpectedUpdateSlPropertyInput extends ExpectedAddSlPropertyInput {
  id: ShenLeId
}

interface ExpectedBatchAddSlBuildingInput {
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

interface ExpectedBatchAddSlBuildingOutput {
  created: ShenLeId[]
  skipped: string[]
}

interface ExpectedCleanupSlMediaDraftInput {
  draftId: ShenLeId
  fileIds: ShenLeId[]
}

interface ExpectedBindSlMediaPosterInput {
  videoFileId: ShenLeId
  posterFileId: ShenLeId
}

interface ExpectedBatchDeleteSlPropertyInput {
  ids: ShenLeId[]
}

interface ExpectedBatchUpdateSlPropertyStatusInput {
  ids: ShenLeId[]
  status: number | null
}

interface ExpectedBatchSaveSlPropertyInput {
  adds: AddSlPropertyInput[]
  updates: UpdateSlPropertyInput[]
  deleteIds: ShenLeId[]
}

interface ExpectedSlPropertyBatchError {
  operation: 'add' | 'update' | 'delete' | 'updateStatus' | 'batchSave'
  scope: 'items' | 'ids' | 'status' | 'adds' | 'updates' | 'deleteIds' | 'request'
  index: number
  field?: string | null
  message: string
}

interface ExpectedBatchSlPropertyResult {
  success: boolean
  createdIds: ShenLeId[]
  updatedCount: number
  deletedCount: number
  affectedCount: number
  errors: SlPropertyBatchError[]
}

interface ExpectedSlPropertyBatchRowOutput {
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
}

const nullableWriteSnapshot: UpdateSlPropertyInput = {
  id: 'property-1',
  title: '101',
  communityId: 'community-1',
  buildingId: 'building-1',
  unit: null,
  roomNo: null,
  floor: null,
  totalFloors: null,
  area: null,
  orientation: null,
  decoration: null,
  rentalType: null,
  rentPrice: 0,
  deposit: null,
  depositRule: null,
  minLease: null,
  coverImageId: null,
  tagIds: null,
  facilityIds: null,
  description: null,
  landlordName: null,
  landlordPhone: null,
  remark: null,
  images: null,
}

const nullableMediaTypeSnapshot: UpdateSlPropertyInput = {
  id: 'property-2',
  title: '102',
  communityId: 'community-1',
  buildingId: 'building-1',
  rentPrice: 0,
  images: [{ fileId: 'media-1', fileType: null }],
}

function source(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

function interfaceBlock(contents: string, name: string) {
  return contents.match(new RegExp(`export interface ${name}[^{]*\\{[\\s\\S]*?\\n\\}`))?.[0] || ''
}

describe('property batch API contract', () => {
  const types = source('src/types/shenle.ts')
  const api = source('src/api/property.ts')

  it('exposes every committed property batch route without replacing single-write routes', () => {
    expect(api).toContain('getPropertyBatchList = (buildingId: ShenLeId)')
    expect(api).toContain('get<SlPropertyBatchRowOutput[]>(\'/api/slProperty/batchList\'')
    expect(api).toContain('post<BatchSlPropertyResult>(\'/api/slProperty/batchAdd\'')
    expect(api).toContain('post<BatchSlPropertyResult>(\'/api/slProperty/batchUpdate\'')
    expect(api).toContain('post<BatchSlPropertyResult>(\'/api/slProperty/batchDelete\'')
    expect(api).toContain('post<BatchSlPropertyResult>(\'/api/slProperty/batchUpdateStatus\'')
    expect(api).toContain('post<BatchSlPropertyResult>(\'/api/slProperty/batchSave\'')
    expect(api).toContain('post<string | number>(\'/api/slProperty/add\'')
    expect(api).toContain('post<void>(\'/api/slProperty/update\'')
    expect(api).toContain('post<void>(\'/api/slProperty/delete\'')
  })

  it('models the complete editable property snapshot with ShenLeId identifiers', () => {
    const row = interfaceBlock(types, 'SlPropertyBatchRowOutput')

    expect(row).toContain('id: ShenLeId')
    expect(row).toContain('communityId: ShenLeId')
    expect(row).toContain('buildingId: ShenLeId')
    expect(row).toContain('title: string')
    expect(row).toContain('unit?: string | null')
    expect(row).toContain('roomNo?: string | null')
    expect(row).toContain('floor?: number | null')
    expect(row).toContain('totalFloors?: number | null')
    expect(row).toContain('rentPrice: number')
    expect(row).toContain('coverImageId?: ShenLeId | null')
    expect(row).toContain('tagIds: ShenLeId[]')
    expect(row).toContain('facilityIds: ShenLeId[]')
    expect(row).toContain('createTime: string')
    expect(row).toContain('updateTime?: string | null')
    expect(row).toContain('images: SlPropertyImageOutput[]')
  })

  it('models structured results and all batch request bodies', () => {
    const result = interfaceBlock(types, 'BatchSlPropertyResult')
    const error = interfaceBlock(types, 'SlPropertyBatchError')
    const deletion = interfaceBlock(types, 'BatchDeleteSlPropertyInput')
    const status = interfaceBlock(types, 'BatchUpdateSlPropertyStatusInput')
    const save = interfaceBlock(types, 'BatchSaveSlPropertyInput')

    expect(result).toContain('success: boolean')
    expect(result).toContain('createdIds: ShenLeId[]')
    expect(result).toContain('updatedCount: number')
    expect(result).toContain('deletedCount: number')
    expect(result).toContain('affectedCount: number')
    expect(result).toContain('errors: SlPropertyBatchError[]')
    expect(error).toContain('operation: \'add\' | \'update\' | \'delete\' | \'updateStatus\' | \'batchSave\'')
    expect(error).toContain('scope: \'items\' | \'ids\' | \'status\' | \'adds\' | \'updates\' | \'deleteIds\' | \'request\'')
    expect(error).toContain('index: number')
    expect(error).toContain('field?: string | null')
    expect(error).toContain('message: string')
    expect(deletion).toContain('ids: ShenLeId[]')
    expect(status).toContain('ids: ShenLeId[]')
    expect(status).toContain('status: number | null')
    expect(save).toContain('adds: AddSlPropertyInput[]')
    expect(save).toContain('updates: UpdateSlPropertyInput[]')
    expect(save).toContain('deleteIds: ShenLeId[]')
  })

  it('accepts nullable backend fields in a complete write snapshot', () => {
    const input = interfaceBlock(types, 'AddSlPropertyInput')
    const image = interfaceBlock(types, 'AddSlPropertyImageInput')

    for (const field of [
      'unit?: string | null',
      'roomNo?: string | null',
      'floor?: number | null',
      'totalFloors?: number | null',
      'area?: number | null',
      'orientation?: string | null',
      'decoration?: string | null',
      'rentalType?: string | null',
      'deposit?: number | null',
      'depositRule?: string | null',
      'minLease?: number | null',
      'coverImageId?: ShenLeId | null',
      'tagIds?: ShenLeId[] | null',
      'facilityIds?: ShenLeId[] | null',
      'description?: string | null',
      'landlordName?: string | null',
      'landlordPhone?: string | null',
      'remark?: string | null',
      'images?: AddSlPropertyImageInput[] | null',
    ]) {
      expect(input).toContain(field)
    }
    expect(image).toContain('fileType?: string | null')
    expect(nullableWriteSnapshot.images).toBeNull()
    expect(nullableMediaTypeSnapshot.images?.[0].fileType).toBeNull()
  })

  it('uses the exact backend operation and scope string unions', () => {
    expectTypeOf<SlPropertyBatchError['operation']>()
      .toEqualTypeOf<'add' | 'update' | 'delete' | 'updateStatus' | 'batchSave'>()
    expectTypeOf<SlPropertyBatchError['scope']>()
      .toEqualTypeOf<'items' | 'ids' | 'status' | 'adds' | 'updates' | 'deleteIds' | 'request'>()
  })

  it('matches the complete batch row and write DTOs exactly', () => {
    expectTypeOf<AddSlPropertyImageInput>().toEqualTypeOf<ExpectedAddSlPropertyImageInput>()
    expectTypeOf<AddSlPropertyInput>().toEqualTypeOf<ExpectedAddSlPropertyInput>()
    expectTypeOf<UpdateSlPropertyInput>().toEqualTypeOf<ExpectedUpdateSlPropertyInput>()
    expectTypeOf<SlPropertyBatchRowOutput>().toEqualTypeOf<ExpectedSlPropertyBatchRowOutput>()
  })

  it('matches every structured property batch request and result exactly', () => {
    expectTypeOf<BatchDeleteSlPropertyInput>().toEqualTypeOf<ExpectedBatchDeleteSlPropertyInput>()
    expectTypeOf<BatchUpdateSlPropertyStatusInput>()
      .toEqualTypeOf<ExpectedBatchUpdateSlPropertyStatusInput>()
    expectTypeOf<BatchSaveSlPropertyInput>().toEqualTypeOf<ExpectedBatchSaveSlPropertyInput>()
    expectTypeOf<SlPropertyBatchError>().toEqualTypeOf<ExpectedSlPropertyBatchError>()
    expectTypeOf<BatchSlPropertyResult>().toEqualTypeOf<ExpectedBatchSlPropertyResult>()
  })
})

describe('building and media draft API contracts', () => {
  const types = source('src/types/shenle.ts')
  const buildingApi = source('src/api/building.ts')
  const fileApi = source('src/api/file.ts')

  it('exposes the committed building batch-add request and result', () => {
    const input = interfaceBlock(types, 'BatchAddSlBuildingInput')
    const output = interfaceBlock(types, 'BatchAddSlBuildingOutput')

    expect(buildingApi).toContain('post<BatchAddSlBuildingOutput>(\'/api/slBuilding/batchAdd\'')
    expect(input).toContain('communityId: ShenLeId')
    expect(input).toContain('seqMode: \'number\' | \'alpha\'')
    expect(input).toContain('count: number')
    expect(input).toContain('startNo?: number')
    expect(input).toContain('startLetter?: string')
    expect(input).toContain('totalFloors?: number | null')
    expect(input).toContain('hasElevator?: boolean | null')
    expect(output).toContain('created: ShenLeId[]')
    expect(output).toContain('skipped: string[]')
  })

  it('exposes the implemented media draft and video poster routes', () => {
    const cleanup = interfaceBlock(types, 'CleanupSlMediaDraftInput')
    const bindPoster = interfaceBlock(types, 'BindSlMediaPosterInput')

    expect(fileApi).toContain('post<ShenLeId>(\'/api/slMediaDraft/createSession\'')
    expect(fileApi).toContain('post<number>(\'/api/slMediaDraft/cleanup\'')
    expect(fileApi).toContain('post<void>(\'/api/slMediaDraft/bindPoster\'')
    expect(cleanup).toContain('draftId: ShenLeId')
    expect(cleanup).toContain('fileIds: ShenLeId[]')
    expect(bindPoster).toContain('videoFileId: ShenLeId')
    expect(bindPoster).toContain('posterFileId: ShenLeId')
  })

  it('matches building batch and media draft DTOs exactly', () => {
    expectTypeOf<BatchAddSlBuildingInput>().toEqualTypeOf<ExpectedBatchAddSlBuildingInput>()
    expectTypeOf<BatchAddSlBuildingOutput>().toEqualTypeOf<ExpectedBatchAddSlBuildingOutput>()
    expectTypeOf<CleanupSlMediaDraftInput>().toEqualTypeOf<ExpectedCleanupSlMediaDraftInput>()
    expectTypeOf<BindSlMediaPosterInput>().toEqualTypeOf<ExpectedBindSlMediaPosterInput>()
  })
})
