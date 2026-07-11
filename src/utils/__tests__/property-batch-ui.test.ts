import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SlBuildingOutput, SlPropertyBatchRowOutput } from '@/types/shenle'
import {
  buildBatchAddInputs,
  buildBatchUpdateInputs,
  buildBuildingFloorUpdate,
  generateRoomNumbers,
} from '../property-batch'

const snapshot: SlPropertyBatchRowOutput = {
  id: 'property-1',
  title: '101',
  communityId: 'community-1',
  buildingId: 'building-1',
  unit: 'A',
  roomNo: '101',
  floor: 1,
  totalFloors: 8,
  area: 42,
  bedrooms: 1,
  livingRooms: 1,
  bathrooms: 1,
  orientation: '南',
  decoration: '精装',
  rentalType: '整租',
  rentPrice: 1800,
  deposit: 1800,
  depositRule: '押一付一',
  minLease: 6,
  status: 0,
  coverImageId: 'image-1',
  tagIds: ['tag-1'],
  facilityIds: ['facility-1'],
  description: '保留描述',
  landlordName: '张三',
  landlordPhone: '13800000000',
  remark: '保留备注',
  createTime: '2026-07-11 00:00:00',
  updateTime: null,
  images: [
    { id: 'image-1', fileType: 'image', fileName: '1.jpg', url: '/1.jpg' },
  ],
}

describe('batch add inputs', () => {
  it('uses fixed building ownership and offline defaults for every generated room', () => {
    const rooms = generateRoomNumbers({ startFloor: 1, floorCount: 2, roomsPerFloor: 2 })

    expect(buildBatchAddInputs(rooms, {
      communityId: 'community-1',
      buildingId: 'building-1',
      unit: 'A',
      totalFloors: 8,
    })).toEqual([
      expect.objectContaining({ title: '101', roomNo: '101', floor: 1 }),
      expect.objectContaining({ title: '102', roomNo: '102', floor: 1 }),
      expect.objectContaining({ title: '201', roomNo: '201', floor: 2 }),
      expect.objectContaining({ title: '202', roomNo: '202', floor: 2 }),
    ])

    const first = buildBatchAddInputs(rooms, {
      communityId: 'community-1',
      buildingId: 'building-1',
      unit: 'A',
      totalFloors: 8,
    })[0]
    expect(first).toMatchObject({
      communityId: 'community-1',
      buildingId: 'building-1',
      unit: 'A',
      rentPrice: 0,
      status: 3,
      bedrooms: 1,
      livingRooms: 0,
      bathrooms: 1,
      tagIds: [],
      facilityIds: [],
      images: [],
    })
  })
})

describe('batch update inputs', () => {
  it('changes only enabled fields and preserves ownership, floor, room and title', () => {
    const [updated] = buildBatchUpdateInputs([snapshot], {
      enabledFields: ['rentPrice', 'area'],
      values: { rentPrice: 0, area: null },
      mediaMode: 'unchanged',
      media: [],
    })

    expect(updated).toMatchObject({
      id: 'property-1',
      title: '101',
      communityId: 'community-1',
      buildingId: 'building-1',
      roomNo: '101',
      floor: 1,
      rentPrice: 0,
      area: null,
      remark: '保留备注',
      coverImageId: 'image-1',
    })
  })

  it('appends media without changing an existing cover', () => {
    const [updated] = buildBatchUpdateInputs([snapshot], {
      enabledFields: ['images'],
      values: {},
      mediaMode: 'append',
      media: [{ fileId: 'video-1', fileType: 'video' }],
    })

    expect(updated.images).toEqual([
      { fileId: 'image-1', fileType: 'image' },
      { fileId: 'video-1', fileType: 'video' },
    ])
    expect(updated.coverImageId).toBe('image-1')
  })

  it('replaces or clears media and keeps the cover valid', () => {
    const [replaced] = buildBatchUpdateInputs([snapshot], {
      enabledFields: ['images'],
      values: {},
      mediaMode: 'replace',
      media: [{ fileId: 'video-1', fileType: 'video' }],
    })
    const [cleared] = buildBatchUpdateInputs([snapshot], {
      enabledFields: ['images'],
      values: {},
      mediaMode: 'clear',
      media: [],
    })

    expect(replaced.coverImageId).toBe('video-1')
    expect(cleared.images).toEqual([])
    expect(cleared.coverImageId).toBeNull()
  })
})

describe('building total-floor update', () => {
  it('preserves all writable fields and media while changing only total floors', () => {
    const detail: SlBuildingOutput = {
      id: 'building-1',
      communityId: 'community-1',
      name: '马山头公寓',
      totalFloors: 8,
      hasElevator: true,
      orderNo: 20,
      status: 0,
      remark: '保留楼栋备注',
      propertyCount: 10,
      coverImageId: 'cover-1',
      images: [{ id: 'cover-1' }, { id: 'video-1', fileType: 'video' }],
    }

    expect(buildBuildingFloorUpdate(detail, 12)).toEqual({
      id: 'building-1',
      communityId: 'community-1',
      name: '马山头公寓',
      totalFloors: 12,
      hasElevator: true,
      orderNo: 20,
      status: 0,
      remark: '保留楼栋备注',
      coverImageId: 'cover-1',
      imageIds: ['cover-1', 'video-1'],
    })
  })
})

describe('batch property management UI contract', () => {
  const page = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/common/community-properties/index.vue'), 'utf8')
  const componentPath = path.resolve(process.cwd(), 'src/components/sl-property-batch/sl-property-batch.vue')
  const fileApi = fs.readFileSync(path.resolve(process.cwd(), 'src/api/file.ts'), 'utf8')

  it('renders stable selection controls and a fixed toolbar with disabled zero-selection actions', () => {
    expect(page).toContain('selectionMode')
    expect(page).toContain('selection-checkbox')
    expect(page).toContain('batch-toolbar')
    expect(page).toContain(':disabled="!selectedIds.length"')
    expect(page).toContain('批量新增')
    expect(page).toContain('<sl-property-batch')
  })

  it('keeps landlord single-property actions while exposing admin-only batch endpoints only to admins', () => {
    expect(page).toContain('const canBatchManage = computed')
    expect(page).toContain("auth.isAdmin && modeStore.mode === 'admin'")
    expect(page).toContain('v-if="canBatchManage"')
    expect(page).toContain('canManageBuildingScope')
  })

  it('provides add, edit, media and delete workflows in the batch component', () => {
    expect(fs.existsSync(componentPath)).toBe(true)
    const component = fs.readFileSync(componentPath, 'utf8')
    expect(component).toContain('批量新增房源')
    expect(component).toContain('批量修改房源')
    expect(component).toContain('从楼盘选择')
    expect(component).toContain('上传媒体')
    expect(component).toContain('batchAddProperties')
    expect(component).toContain('batchUpdateProperties')
    expect(component).toContain('batchDeleteProperties')
    expect(component).toContain("emit('completed'")
  })

  it('keeps bedroom, living-room and bathroom switches independent', () => {
    const component = fs.readFileSync(componentPath, 'utf8')

    expect(component).toContain('<text>卧室</text><wd-switch v-model="enabled.bedrooms"')
    expect(component).toContain('<text>客厅</text><wd-switch v-model="enabled.livingRooms"')
    expect(component).toContain('<text>卫生间</text><wd-switch v-model="enabled.bathrooms"')
    expect(component).not.toContain('class="sub-switches"')
    expect(component).not.toContain('@focus="enabled.livingRooms = true"')
  })

  it('patches batch edits and reloads the loaded range without losing scroll', () => {
    const start = page.indexOf('async function handleBatchCompleted')
    const end = page.indexOf('\n}\n\nasync function changeStatus', start)
    const handler = page.slice(start, end)

    expect(page).toContain('patchBatchUpdatedItems')
    expect(page).toContain('reloadLoadedRangePreservingScroll')
    expect(page).toContain('onPageScroll')
    expect(page).toContain('uni.pageScrollTo')
    expect(handler).not.toContain('await load(true)')
  })

  it('uses admin batch permission for batch-specific copy', () => {
    expect(page).toContain("canBatchManage ? `${buildingName} · 支持编辑与批量管理`")
    expect(page).toContain("canBatchManage ? '这个楼栋还没有房源，可以新增或批量创建。'")
  })

  it('re-reads full building detail before deciding whether total floors must expand', () => {
    const component = fs.readFileSync(componentPath, 'utf8')
    const submit = component.match(/async function submitBatchAdd\(\)[\s\S]*?\n\}/)?.[0] || ''

    expect(submit).toContain('const detail = await getBuildingDetail(props.buildingId)')
    expect(submit).toContain('highestGeneratedFloor.value > detail.totalFloors')
    expect(submit).not.toContain('props.buildingTotalFloors')
  })

  it('uploads batch media into a draft session without changing existing upload callers', () => {
    const component = fs.readFileSync(componentPath, 'utf8')

    expect(fileApi).toContain('export interface UploadFileOptions')
    expect(fileApi).toContain('formData: buildUploadFormData(options)')
    expect(component).toContain('createMediaDraftSession')
    expect(component).toContain('const draftId = await ensureMediaDraftSession()')
    expect(component).toContain('uploadFile(local.tempFilePath, { belongId: draftId })')
  })

  it('reports partial upload failures and cleans abandoned draft files on close', () => {
    const component = fs.readFileSync(componentPath, 'utf8')

    expect(component).toContain('uploadedDraftIds')
    expect(component).toContain('cleanupMediaDraft')
    expect(component).toContain('async function closeBatchSheet')
    expect(component).toContain('上传成功 ${successCount} 个，失败 ${failureCount} 个')
    expect(component).toContain('@click="closeBatchSheet"')
    expect(component).toContain('onBeforeUnmount')
  })

  it('does not close or submit while media uploads are still settling', () => {
    const component = fs.readFileSync(componentPath, 'utf8')

    expect(component).toContain('activeUploadPromise')
    expect(component).toContain('function startMediaUpload')
    expect(component).toContain('请等待媒体上传完成')
    expect(component).toContain(':disabled="uploading"')
    expect(component).toContain('activeUploadPromise?.finally')
  })
})
