<script setup lang="ts">
import type {
  AddSlPropertyImageInput,
  ShenLeId,
  SlPropertyBatchRowOutput,
  SlTagOutput,
  UpdateSlPropertyInput,
} from '@/types/shenle'
import type { MediaKind } from '@/utils/media'
import type { MediaMergeMode } from '@/utils/property-batch'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { getBuildingDetail, updateBuilding } from '@/api/building'
import { getCommunityDetail } from '@/api/community'
import {
  cleanupMediaDraft,
  createMediaDraftSession,
  downloadFile,
  uploadFile,
} from '@/api/file'
import {
  batchAddProperties,
  batchDeleteProperties,
  batchUpdateProperties,
  getPropertyBatchList,
} from '@/api/property'
import { getTagList } from '@/api/tag'
import {
  DECORATION_OPTIONS,
  DEPOSIT_RULE_OPTIONS,
  ORIENTATION_OPTIONS,
  PROPERTY_STATUS_OPTIONS,
  RENTAL_TYPE_OPTIONS,
} from '@/constants/shenle'
import { extensionOf, mediaKindOf } from '@/utils/media'
import {
  buildBatchAddInputs,
  buildBatchUpdateInputs,
  buildBuildingFloorUpdate,
  findDuplicateRoomNumbers,
  generateRoomNumbers,
} from '@/utils/property-batch'
import { resolveAssetUrl } from '@/utils/shenle'

type BatchAction = 'added' | 'updated' | 'deleted'
type BatchEditableField = Exclude<keyof UpdateSlPropertyInput,
  'id' | 'title' | 'communityId' | 'buildingId' | 'unit' | 'roomNo' | 'floor' | 'totalFloors' | 'coverImageId'>

interface BatchCompletedEvent {
  action: BatchAction
  ids: ShenLeId[]
  affectedCount: number
  totalFloors?: number | null
}

interface BatchMediaChoice extends AddSlPropertyImageInput {
  name: string
  kind: MediaKind
  url: string
}

interface WechatChooseMediaResult {
  tempFiles?: Array<{ tempFilePath?: string, fileType?: 'image' | 'video' }>
}

type WechatChooseMedia = (options: {
  count: number
  mediaType: ('image' | 'video' | 'mix')[]
  sourceType?: ('album' | 'camera')[]
  sizeType?: ('original' | 'compressed')[]
  maxDuration?: number
  success: (result: WechatChooseMediaResult) => void
  fail?: (error: unknown) => void
}) => void

const props = defineProps<{
  communityId: ShenLeId
  communityName: string
  buildingId: ShenLeId
  buildingName: string
  buildingTotalFloors?: number | null
  selectedIds: ShenLeId[]
}>()

const emit = defineEmits<{
  completed: [event: BatchCompletedEvent]
}>()

const activeSheet = ref<'add' | 'edit' | null>(null)
const submitting = ref(false)
const loadingSnapshots = ref(false)
const allSnapshots = ref<SlPropertyBatchRowOutput[]>([])

const addForm = reactive({
  startFloor: '1',
  floorCount: '1',
  roomsPerFloor: '1',
  unit: '',
})

const generatedRooms = computed(() => {
  try {
    return generateRoomNumbers({
      startFloor: Number(addForm.startFloor),
      floorCount: Number(addForm.floorCount),
      roomsPerFloor: Number(addForm.roomsPerFloor),
    })
  }
  catch {
    return []
  }
})
const addValidationMessage = computed(() => {
  try {
    generateRoomNumbers({
      startFloor: Number(addForm.startFloor),
      floorCount: Number(addForm.floorCount),
      roomsPerFloor: Number(addForm.roomsPerFloor),
    })
    return ''
  }
  catch (error) {
    return error instanceof Error ? error.message : '请输入有效的生成规则'
  }
})
const duplicateRooms = computed(() => findDuplicateRoomNumbers(
  generatedRooms.value.map(item => item.roomNo),
  allSnapshots.value.map(item => item.roomNo || '').filter(Boolean),
))
const addPreview = computed(() => generatedRooms.value.slice(0, 12))
const highestGeneratedFloor = computed(() => generatedRooms.value.at(-1)?.floor || 0)

const EDIT_FIELDS: Array<{ key: BatchEditableField, label: string }> = [
  { key: 'rentPrice', label: '租金' },
  { key: 'area', label: '面积' },
  { key: 'bedrooms', label: '卧室' },
  { key: 'livingRooms', label: '客厅' },
  { key: 'bathrooms', label: '卫生间' },
  { key: 'status', label: '状态' },
  { key: 'orientation', label: '朝向' },
  { key: 'decoration', label: '装修' },
  { key: 'rentalType', label: '出租方式' },
  { key: 'deposit', label: '押金' },
  { key: 'depositRule', label: '押付方式' },
  { key: 'minLease', label: '最短租期' },
  { key: 'description', label: '房源描述' },
  { key: 'remark', label: '内部备注' },
  { key: 'tagIds', label: '房源标签' },
  { key: 'facilityIds', label: '配套设施' },
  { key: 'images', label: '媒体' },
]

const enabled = reactive<Record<BatchEditableField, boolean>>(Object.fromEntries(
  EDIT_FIELDS.map(field => [field.key, false]),
) as Record<BatchEditableField, boolean>)

const editValues = reactive({
  rentPrice: '',
  area: '',
  bedrooms: '',
  livingRooms: '',
  bathrooms: '',
  status: 3,
  orientation: '',
  decoration: '',
  rentalType: '',
  deposit: '',
  depositRule: '',
  minLease: '',
  description: '',
  remark: '',
  tagIds: [] as ShenLeId[],
  facilityIds: [] as ShenLeId[],
})

const selectedSnapshots = ref<SlPropertyBatchRowOutput[]>([])
const houseTags = ref<SlTagOutput[]>([])
const facilityTags = ref<SlTagOutput[]>([])
const mediaMode = ref<MediaMergeMode>('append')
const selectedMedia = ref<BatchMediaChoice[]>([])
const communityMediaPool = ref<BatchMediaChoice[]>([])
const communityMediaSelection = ref<BatchMediaChoice[]>([])
const communityMediaVisible = ref(false)
const mediaSourceVisible = ref(false)
const uploading = ref(false)
const mediaDraftId = ref<ShenLeId | null>(null)
const uploadedDraftIds = ref<ShenLeId[]>([])
let activeUploadPromise: Promise<void> | null = null
const MEDIA_SOURCE_ACTIONS = [
  { name: '从楼盘选择', value: 'community' },
  { name: '上传媒体', value: 'upload' },
]
const MEDIA_MODES: Array<{ value: MediaMergeMode, label: string }> = [
  { value: 'unchanged', label: '不修改' },
  { value: 'append', label: '追加' },
  { value: 'replace', label: '替换' },
  { value: 'clear', label: '清空' },
]

const sheetVisible = computed({
  get: () => activeSheet.value !== null,
  set: (visible: boolean) => {
    if (!visible)
      void closeBatchSheet()
  },
})

function sameId(left: ShenLeId | null | undefined, right: ShenLeId | null | undefined) {
  return String(left ?? '') === String(right ?? '')
}

function resetEnabledFields() {
  EDIT_FIELDS.forEach((field) => { enabled[field.key] = false })
  mediaMode.value = 'append'
  selectedMedia.value = []
}

async function ensureMediaDraftSession() {
  if (mediaDraftId.value != null)
    return mediaDraftId.value
  mediaDraftId.value = await createMediaDraftSession()
  return mediaDraftId.value
}

async function cleanupDraftUploads() {
  const draftId = mediaDraftId.value
  const fileIds = [...uploadedDraftIds.value]
  mediaDraftId.value = null
  uploadedDraftIds.value = []
  if (draftId == null || !fileIds.length)
    return

  try {
    await cleanupMediaDraft({ draftId, fileIds })
  }
  catch (error) {
    console.error('cleanup batch media draft failed', error)
  }
}

async function closeBatchSheet() {
  if (uploading.value) {
    uni.showToast({ title: '请等待媒体上传完成', icon: 'none' })
    return
  }
  activeSheet.value = null
  communityMediaVisible.value = false
  mediaSourceVisible.value = false
  await cleanupDraftUploads()
  resetEnabledFields()
}

function setEditDefaults(snapshot: SlPropertyBatchRowOutput) {
  editValues.rentPrice = String(snapshot.rentPrice ?? '')
  editValues.area = String(snapshot.area ?? '')
  editValues.bedrooms = String(snapshot.bedrooms ?? '')
  editValues.livingRooms = String(snapshot.livingRooms ?? '')
  editValues.bathrooms = String(snapshot.bathrooms ?? '')
  editValues.status = snapshot.status
  editValues.orientation = snapshot.orientation || ''
  editValues.decoration = snapshot.decoration || ''
  editValues.rentalType = snapshot.rentalType || ''
  editValues.deposit = String(snapshot.deposit ?? '')
  editValues.depositRule = snapshot.depositRule || ''
  editValues.minLease = String(snapshot.minLease ?? '')
  editValues.description = snapshot.description || ''
  editValues.remark = snapshot.remark || ''
  editValues.tagIds = [...snapshot.tagIds]
  editValues.facilityIds = [...snapshot.facilityIds]
}

async function fetchAllSnapshots() {
  allSnapshots.value = await getPropertyBatchList(props.buildingId)
  return allSnapshots.value
}

async function openAdd() {
  if (!props.buildingId)
    return
  activeSheet.value = 'add'
  loadingSnapshots.value = true
  try {
    await fetchAllSnapshots()
  }
  catch (error) {
    await cleanupDraftUploads()
    activeSheet.value = null
    uni.showToast({ title: error instanceof Error ? error.message : '房源数据加载失败', icon: 'none' })
  }
  finally {
    loadingSnapshots.value = false
  }
}

async function openEdit() {
  if (!props.selectedIds.length)
    return
  activeSheet.value = 'edit'
  loadingSnapshots.value = true
  resetEnabledFields()
  try {
    const [snapshots, house, facility] = await Promise.all([
      fetchAllSnapshots(),
      getTagList({ category: 'house', status: 0 }).catch(() => []),
      getTagList({ category: 'facility', status: 0 }).catch(() => []),
    ])
    selectedSnapshots.value = snapshots.filter(row => props.selectedIds.some(id => sameId(id, row.id)))
    if (selectedSnapshots.value.length !== props.selectedIds.length)
      throw new Error('部分房源已变化，请刷新后重试')
    houseTags.value = house
    facilityTags.value = facility
    setEditDefaults(selectedSnapshots.value[0])
  }
  catch (error) {
    activeSheet.value = null
    uni.showToast({ title: error instanceof Error ? error.message : '房源快照加载失败', icon: 'none' })
  }
  finally {
    loadingSnapshots.value = false
  }
}

function batchErrorMessage(result: { errors?: Array<{ message: string }> }, fallback: string) {
  return result.errors?.[0]?.message || fallback
}

async function submitBatchAdd() {
  if (submitting.value)
    return
  if (addValidationMessage.value) {
    uni.showToast({ title: addValidationMessage.value, icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await fetchAllSnapshots()
    if (duplicateRooms.value.length) {
      uni.showToast({ title: `房号重复：${duplicateRooms.value.slice(0, 3).join('、')}`, icon: 'none' })
      return
    }

    const detail = await getBuildingDetail(props.buildingId)
    let totalFloors = detail.totalFloors ?? null
    if (!detail.totalFloors || highestGeneratedFloor.value > detail.totalFloors) {
      await updateBuilding(buildBuildingFloorUpdate(detail, highestGeneratedFloor.value))
      totalFloors = highestGeneratedFloor.value
    }

    const result = await batchAddProperties(buildBatchAddInputs(generatedRooms.value, {
      communityId: props.communityId,
      buildingId: props.buildingId,
      unit: addForm.unit,
      totalFloors,
    }))
    if (!result.success) {
      uni.showToast({ title: batchErrorMessage(result, '批量新增失败'), icon: 'none' })
      return
    }

    activeSheet.value = null
    uni.showToast({ title: `已新增 ${result.affectedCount} 套`, icon: 'success' })
    emit('completed', {
      action: 'added',
      ids: result.createdIds,
      affectedCount: result.affectedCount,
      totalFloors,
    })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '批量新增失败', icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}

function enabledFields() {
  return EDIT_FIELDS.filter(field => enabled[field.key]).map(field => field.key)
}

function requiredNumber(value: string, label: string) {
  if (!value.trim())
    throw new Error(`请输入${label}`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0)
    throw new Error(`${label}必须是大于等于 0 的数字`)
  return number
}

function optionalNumber(value: string, label: string) {
  if (!value.trim())
    return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0)
    throw new Error(`${label}必须是大于等于 0 的数字`)
  return number
}

function buildEditValues(): Partial<UpdateSlPropertyInput> {
  const values: Partial<UpdateSlPropertyInput> = {}
  if (enabled.rentPrice)
    values.rentPrice = requiredNumber(editValues.rentPrice, '租金')
  if (enabled.area)
    values.area = optionalNumber(editValues.area, '面积')
  if (enabled.bedrooms)
    values.bedrooms = requiredNumber(editValues.bedrooms, '卧室数')
  if (enabled.livingRooms)
    values.livingRooms = requiredNumber(editValues.livingRooms, '客厅数')
  if (enabled.bathrooms)
    values.bathrooms = requiredNumber(editValues.bathrooms, '卫生间数')
  if (enabled.status)
    values.status = editValues.status
  if (enabled.orientation)
    values.orientation = editValues.orientation
  if (enabled.decoration)
    values.decoration = editValues.decoration
  if (enabled.rentalType)
    values.rentalType = editValues.rentalType
  if (enabled.deposit)
    values.deposit = optionalNumber(editValues.deposit, '押金')
  if (enabled.depositRule)
    values.depositRule = editValues.depositRule
  if (enabled.minLease)
    values.minLease = optionalNumber(editValues.minLease, '最短租期')
  if (enabled.description)
    values.description = editValues.description
  if (enabled.remark)
    values.remark = editValues.remark
  if (enabled.tagIds)
    values.tagIds = [...editValues.tagIds]
  if (enabled.facilityIds)
    values.facilityIds = [...editValues.facilityIds]
  return values
}

async function submitBatchEdit() {
  if (submitting.value)
    return
  if (uploading.value) {
    uni.showToast({ title: '请等待媒体上传完成', icon: 'none' })
    return
  }
  const fields = enabledFields()
  if (!fields.length) {
    uni.showToast({ title: '请至少启用一个修改项', icon: 'none' })
    return
  }
  if (enabled.images && ['append', 'replace'].includes(mediaMode.value) && !selectedMedia.value.length) {
    uni.showToast({ title: '请先选择或上传媒体', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const snapshots = await fetchAllSnapshots()
    const current = snapshots.filter(row => props.selectedIds.some(id => sameId(id, row.id)))
    if (current.length !== props.selectedIds.length)
      throw new Error('部分房源已变化，请刷新后重试')
    const input = buildBatchUpdateInputs(current, {
      enabledFields: fields,
      values: buildEditValues(),
      mediaMode: enabled.images ? mediaMode.value : 'unchanged',
      media: selectedMedia.value.map(media => ({ fileId: media.fileId, fileType: media.fileType })),
    })
    const result = await batchUpdateProperties(input)
    if (!result.success) {
      uni.showToast({ title: batchErrorMessage(result, '批量修改失败'), icon: 'none' })
      return
    }

    await cleanupDraftUploads()
    activeSheet.value = null
    uni.showToast({ title: `已修改 ${result.affectedCount} 套`, icon: 'success' })
    emit('completed', { action: 'updated', ids: [...props.selectedIds], affectedCount: result.affectedCount })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '批量修改失败', icon: 'none' })
  }
  finally {
    submitting.value = false
  }
}

async function requestDelete() {
  if (!props.selectedIds.length || submitting.value)
    return
  try {
    const snapshots = await fetchAllSnapshots()
    const selected = snapshots.filter(row => props.selectedIds.some(id => sameId(id, row.id)))
    const rooms = selected.slice(0, 6).map(row => row.roomNo || row.title).join('、')
    uni.showModal({
      title: `删除 ${props.selectedIds.length} 套房源`,
      content: `${rooms}${selected.length > 6 ? ' 等' : ''}\n删除后无法恢复，确定继续？`,
      confirmText: '删除',
      confirmColor: '#c94832',
      success: async (res) => {
        if (!res.confirm)
          return
        submitting.value = true
        try {
          const result = await batchDeleteProperties({ ids: [...props.selectedIds] })
          if (!result.success) {
            uni.showToast({ title: batchErrorMessage(result, '批量删除失败'), icon: 'none' })
            return
          }
          uni.showToast({ title: `已删除 ${result.affectedCount} 套`, icon: 'success' })
          emit('completed', { action: 'deleted', ids: [...props.selectedIds], affectedCount: result.affectedCount })
        }
        catch (error) {
          uni.showToast({ title: error instanceof Error ? error.message : '批量删除失败', icon: 'none' })
        }
        finally {
          submitting.value = false
        }
      },
    })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '房源数据加载失败', icon: 'none' })
  }
}

function toggleId(list: ShenLeId[], id: ShenLeId) {
  const index = list.findIndex(item => sameId(item, id))
  if (index >= 0)
    list.splice(index, 1)
  else
    list.push(id)
}

function hasId(list: readonly ShenLeId[], id: ShenLeId) {
  return list.some(item => sameId(item, id))
}

function chooseOption(field: 'orientation' | 'decoration' | 'rentalType' | 'depositRule', value: string) {
  editValues[field] = value
}

async function openCommunityMedia() {
  try {
    const detail = await getCommunityDetail(props.communityId)
    communityMediaPool.value = (detail.images || []).map(media => ({
      fileId: media.id,
      fileType: media.fileType || mediaKindOf(media.fileType, media.suffix || media.url),
      name: media.fileName || `文件${media.id}`,
      kind: mediaKindOf(media.fileType, media.suffix || media.url),
      url: resolveAssetUrl(media.url),
    }))
    communityMediaSelection.value = []
    communityMediaVisible.value = true
    communityMediaPool.value.forEach((media) => {
      if (media.kind === 'image')
        downloadFile(media.fileId).then((path) => { media.url = path }).catch(() => {})
    })
  }
  catch {
    uni.showToast({ title: '楼盘媒体加载失败', icon: 'none' })
  }
}

function toggleCommunityMedia(media: BatchMediaChoice) {
  const index = communityMediaSelection.value.findIndex(item => sameId(item.fileId, media.fileId))
  if (index >= 0)
    communityMediaSelection.value.splice(index, 1)
  else
    communityMediaSelection.value.push(media)
}

function confirmCommunityMedia() {
  const known = new Set(selectedMedia.value.map(media => String(media.fileId)))
  selectedMedia.value.push(...communityMediaSelection.value.filter(media => !known.has(String(media.fileId))))
  communityMediaVisible.value = false
}

function removeSelectedMedia(fileId: ShenLeId) {
  selectedMedia.value = selectedMedia.value.filter(media => !sameId(media.fileId, fileId))
}

function wxChooseMedia() {
  return (globalThis as unknown as { wx?: { chooseMedia?: WechatChooseMedia } }).wx?.chooseMedia
    || (uni as unknown as { chooseMedia?: WechatChooseMedia }).chooseMedia
}

async function uploadMediaFiles(files: Array<{ tempFilePath: string, fileType?: 'image' | 'video' }>) {
  if (!files.length)
    return

  uploading.value = true
  let successCount = 0
  let failureCount = 0
  try {
    const draftId = await ensureMediaDraftSession()
    for (const local of files) {
      try {
        const uploaded = await uploadFile(local.tempFilePath, { belongId: draftId })
        uploadedDraftIds.value.push(uploaded.id)
        successCount += 1
        const kind = mediaKindOf(uploaded.fileType || local.fileType, uploaded.suffix || local.tempFilePath)
        if (selectedMedia.value.some(media => sameId(media.fileId, uploaded.id)))
          continue
        selectedMedia.value.push({
          fileId: uploaded.id,
          fileType: uploaded.fileType || kind,
          name: uploaded.fileName || (kind === 'video' ? '视频' : '图片'),
          kind,
          url: local.tempFilePath,
        })
      }
      catch {
        failureCount += 1
      }
    }

    if (failureCount)
      uni.showToast({ title: `上传成功 ${successCount} 个，失败 ${failureCount} 个`, icon: 'none' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '媒体上传准备失败', icon: 'none' })
  }
  finally {
    uploading.value = false
  }
}

function startMediaUpload(files: Array<{ tempFilePath: string, fileType?: 'image' | 'video' }>) {
  if (activeUploadPromise)
    return
  const task = uploadMediaFiles(files)
  activeUploadPromise = task
  void task.finally(() => {
    if (activeUploadPromise === task)
      activeUploadPromise = null
  })
}

onBeforeUnmount(() => {
  const pendingCleanup = activeUploadPromise?.finally(() => cleanupDraftUploads())
  if (!pendingCleanup)
    void cleanupDraftUploads()
})

function chooseUploadMedia() {
  const chooseMedia = wxChooseMedia()
  if (!chooseMedia) {
    uni.chooseImage({
      count: 9,
      sizeType: ['compressed'],
      success: (res) => {
        const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : [res.tempFilePaths]
        startMediaUpload(paths.map(tempFilePath => ({ tempFilePath, fileType: 'image' })))
      },
    })
    return
  }
  chooseMedia({
    count: 9,
    mediaType: ['mix'],
    sourceType: ['album', 'camera'],
    sizeType: ['compressed'],
    maxDuration: 60,
    success: result => startMediaUpload((result.tempFiles || [])
      .filter(item => !!item.tempFilePath)
      .map(item => ({ tempFilePath: item.tempFilePath!, fileType: item.fileType }))),
  })
}

function openMediaSource() {
  if (mediaMode.value === 'clear' || mediaMode.value === 'unchanged')
    mediaMode.value = 'append'
  mediaSourceVisible.value = true
}

function selectMediaSource(event: { item: { value?: string } }) {
  mediaSourceVisible.value = false
  setTimeout(() => {
    if (event.item.value === 'community')
      void openCommunityMedia()
    else if (event.item.value === 'upload')
      chooseUploadMedia()
  }, 220)
}

defineExpose({ openAdd, openEdit, requestDelete })
</script>

<template>
  <wd-popup v-model="sheetVisible" position="bottom" :z-index="2100" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden;" safe-area-inset-bottom>
    <view class="batch-sheet">
      <view class="batch-head">
        <view>
          <text class="batch-head__title">{{ activeSheet === 'add' ? '批量新增房源' : '批量修改房源' }}</text>
          <text class="batch-head__sub">{{ communityName }} · {{ buildingName }}</text>
        </view>
        <wd-icon name="close" size="22px" color="#72817b" @click="closeBatchSheet" />
      </view>

      <scroll-view scroll-y class="batch-scroll">
        <view v-if="loadingSnapshots" class="batch-loading">
          房源数据加载中...
        </view>

        <template v-else-if="activeSheet === 'add'">
          <view class="batch-section">
            <text class="section-title">生成规则</text>
            <view class="input-grid input-grid--three">
              <label class="field"><text>起始楼层</text><input v-model="addForm.startFloor" type="number" placeholder="1"></label>
              <label class="field"><text>楼层数</text><input v-model="addForm.floorCount" type="number" placeholder="1"></label>
              <label class="field"><text>每层房数</text><input v-model="addForm.roomsPerFloor" type="number" placeholder="1"></label>
            </view>
            <label class="field"><text>单元号（可选）</text><input v-model="addForm.unit" :maxlength="20" placeholder="例如 A 单元"></label>
          </view>

          <view class="batch-section preview-section">
            <view class="section-row">
              <text class="section-title">生成预览</text>
              <wd-tag type="success">{{ generatedRooms.length }} 套</wd-tag>
            </view>
            <text v-if="addValidationMessage" class="form-error">{{ addValidationMessage }}</text>
            <text v-else-if="duplicateRooms.length" class="form-error">重复房号：{{ duplicateRooms.slice(0, 6).join('、') }}</text>
            <view v-else class="room-preview">
              <text v-for="room in addPreview" :key="room.roomNo" class="room-chip">{{ room.roomNo }}</text>
              <text v-if="generatedRooms.length > addPreview.length" class="room-more">另有 {{ generatedRooms.length - addPreview.length }} 套</text>
            </view>
            <text class="section-hint">新房源默认租金 0 元、状态为下架，创建后再确认发布。</text>
          </view>
        </template>

        <template v-else-if="activeSheet === 'edit'">
          <view class="batch-notice">
            已选择 {{ selectedSnapshots.length }} 套。仅启用的项目会覆盖，楼盘、楼栋、楼层、房号和标题不会改变。
          </view>

          <view class="batch-section">
            <view class="edit-row">
              <view class="edit-row__head"><text>租金</text><wd-switch v-model="enabled.rentPrice" size="22px" /></view>
              <input v-if="enabled.rentPrice" v-model="editValues.rentPrice" class="edit-input" type="digit" placeholder="0">
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>面积</text><wd-switch v-model="enabled.area" size="22px" /></view>
              <input v-if="enabled.area" v-model="editValues.area" class="edit-input" type="digit" placeholder="留空则清空">
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>卧室</text><wd-switch v-model="enabled.bedrooms" size="22px" /></view>
              <input v-if="enabled.bedrooms" v-model="editValues.bedrooms" class="edit-input" type="number">
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>客厅</text><wd-switch v-model="enabled.livingRooms" size="22px" /></view>
              <input v-if="enabled.livingRooms" v-model="editValues.livingRooms" class="edit-input" type="number">
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>卫生间</text><wd-switch v-model="enabled.bathrooms" size="22px" /></view>
              <input v-if="enabled.bathrooms" v-model="editValues.bathrooms" class="edit-input" type="number">
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>状态</text><wd-switch v-model="enabled.status" size="22px" /></view>
              <view v-if="enabled.status" class="option-chips">
                <text v-for="option in PROPERTY_STATUS_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.status === option.value }" @tap="editValues.status = option.value">{{ option.label }}</text>
              </view>
            </view>
          </view>

          <view class="batch-section">
            <view class="edit-row">
              <view class="edit-row__head"><text>朝向</text><wd-switch v-model="enabled.orientation" size="22px" /></view>
              <view v-if="enabled.orientation" class="option-chips"><text v-for="option in ORIENTATION_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.orientation === option.value }" @tap="chooseOption('orientation', option.value)">{{ option.label }}</text></view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>装修</text><wd-switch v-model="enabled.decoration" size="22px" /></view>
              <view v-if="enabled.decoration" class="option-chips"><text v-for="option in DECORATION_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.decoration === option.value }" @tap="chooseOption('decoration', option.value)">{{ option.label }}</text></view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>出租方式</text><wd-switch v-model="enabled.rentalType" size="22px" /></view>
              <view v-if="enabled.rentalType" class="option-chips"><text v-for="option in RENTAL_TYPE_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.rentalType === option.value }" @tap="chooseOption('rentalType', option.value)">{{ option.label }}</text></view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>押金</text><wd-switch v-model="enabled.deposit" size="22px" /></view>
              <input v-if="enabled.deposit" v-model="editValues.deposit" class="edit-input" type="digit" placeholder="留空则清空">
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>押付方式</text><wd-switch v-model="enabled.depositRule" size="22px" /></view>
              <view v-if="enabled.depositRule" class="option-chips"><text v-for="option in DEPOSIT_RULE_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.depositRule === option.value }" @tap="chooseOption('depositRule', option.value)">{{ option.label }}</text></view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>最短租期（月）</text><wd-switch v-model="enabled.minLease" size="22px" /></view>
              <input v-if="enabled.minLease" v-model="editValues.minLease" class="edit-input" type="number" placeholder="留空则清空">
            </view>
          </view>

          <view class="batch-section">
            <view class="edit-row"><view class="edit-row__head"><text>房源描述</text><wd-switch v-model="enabled.description" size="22px" /></view><textarea v-if="enabled.description" v-model="editValues.description" class="edit-textarea" placeholder="可清空" /></view>
            <view class="edit-row"><view class="edit-row__head"><text>内部备注</text><wd-switch v-model="enabled.remark" size="22px" /></view><textarea v-if="enabled.remark" v-model="editValues.remark" class="edit-textarea" placeholder="可清空" /></view>
          </view>

          <view class="batch-section">
            <view class="edit-row">
              <view class="edit-row__head"><text>房源标签</text><wd-switch v-model="enabled.tagIds" size="22px" /></view>
              <view v-if="enabled.tagIds" class="option-chips"><text v-for="tag in houseTags" :key="String(tag.id)" class="option-chip" :class="{ active: hasId(editValues.tagIds, tag.id) }" @tap="toggleId(editValues.tagIds, tag.id)">{{ tag.name }}</text></view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head"><text>配套设施</text><wd-switch v-model="enabled.facilityIds" size="22px" /></view>
              <view v-if="enabled.facilityIds" class="option-chips"><text v-for="tag in facilityTags" :key="String(tag.id)" class="option-chip" :class="{ active: hasId(editValues.facilityIds, tag.id) }" @tap="toggleId(editValues.facilityIds, tag.id)">{{ tag.name }}</text></view>
            </view>
          </view>

          <view class="batch-section">
            <view class="edit-row__head"><text>媒体</text><wd-switch v-model="enabled.images" size="22px" /></view>
            <template v-if="enabled.images">
              <view class="option-chips media-modes"><text v-for="mode in MEDIA_MODES" :key="mode.value" class="option-chip" :class="{ active: mediaMode === mode.value }" @tap="mediaMode = mode.value">{{ mode.label }}</text></view>
              <view v-if="mediaMode === 'append' || mediaMode === 'replace'" class="media-actions">
                <wd-button size="small" plain icon="add" :loading="uploading" @click="openMediaSource">添加媒体</wd-button>
                <text>{{ selectedMedia.length }} 个已选</text>
              </view>
              <view v-if="selectedMedia.length && (mediaMode === 'append' || mediaMode === 'replace')" class="selected-media">
                <view v-for="media in selectedMedia" :key="String(media.fileId)" class="selected-media__item">
                  <image v-if="media.kind === 'image'" :src="media.url" mode="aspectFill" />
                  <view v-else class="selected-media__video"><wd-icon name="play-circle" size="24px" color="#fff" /></view>
                  <text>{{ media.name }}</text>
                  <view class="selected-media__remove" @tap="removeSelectedMedia(media.fileId)"><wd-icon name="close" size="12px" color="#fff" /></view>
                </view>
              </view>
              <text v-if="mediaMode === 'clear'" class="danger-hint">保存后会清空所选房源的全部媒体。</text>
            </template>
          </view>
        </template>
      </scroll-view>

      <view class="batch-actions">
        <wd-button plain block :disabled="uploading" @click="closeBatchSheet">取消</wd-button>
        <wd-button v-if="activeSheet === 'add'" block type="primary" :loading="submitting" :disabled="!!addValidationMessage || !!duplicateRooms.length" @click="submitBatchAdd">创建 {{ generatedRooms.length }} 套</wd-button>
        <wd-button v-else block type="primary" :loading="submitting" :disabled="uploading" @click="submitBatchEdit">保存批量修改</wd-button>
      </view>
    </view>
  </wd-popup>

  <wd-popup v-model="communityMediaVisible" position="bottom" :z-index="2400" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden;" safe-area-inset-bottom>
    <view class="media-picker">
      <view class="batch-head"><view><text class="batch-head__title">楼盘媒体池</text><text class="batch-head__sub">可多选图片和视频</text></view><wd-icon name="close" size="22px" color="#72817b" @click="communityMediaVisible = false" /></view>
      <scroll-view scroll-y class="media-picker__scroll">
        <view v-if="!communityMediaPool.length" class="batch-loading">当前楼盘暂无媒体</view>
        <view v-else class="media-grid">
          <view v-for="media in communityMediaPool" :key="String(media.fileId)" class="pool-media" :class="{ selected: communityMediaSelection.some(item => sameId(item.fileId, media.fileId)) }" @tap="toggleCommunityMedia(media)">
            <image v-if="media.kind === 'image'" :src="media.url" mode="aspectFill" />
            <view v-else class="pool-media__video"><wd-icon name="play-circle" size="28px" color="#fff" /></view>
            <text>{{ media.name }}</text>
            <view class="pool-media__check"><wd-icon v-if="communityMediaSelection.some(item => sameId(item.fileId, media.fileId))" name="check" size="13px" color="#fff" /></view>
          </view>
        </view>
      </scroll-view>
      <view class="batch-actions"><wd-button plain block @click="communityMediaVisible = false">取消</wd-button><wd-button block type="primary" @click="confirmCommunityMedia">加入 {{ communityMediaSelection.length }} 个</wd-button></view>
    </view>
  </wd-popup>

  <wd-action-sheet v-model="mediaSourceVisible" title="添加媒体" cancel-text="取消" :actions="MEDIA_SOURCE_ACTIONS" :z-index="2600" root-portal @select="selectMediaSource" />
</template>

<style scoped lang="scss">
.batch-sheet,
.media-picker {
  background: #f5f7f3;
}

.batch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 26rpx 28rpx 22rpx;
  background: #fff;
}

.batch-head__title,
.batch-head__sub {
  display: block;
}

.batch-head__title {
  color: var(--sl-ink, #1e2b26);
  font-size: 31rpx;
  font-weight: 850;
}

.batch-head__sub {
  margin-top: 7rpx;
  color: var(--sl-muted, #72817b);
  font-size: 22rpx;
}

.batch-scroll {
  height: min(72vh, 1000rpx);
}

.batch-loading {
  padding: 80rpx 24rpx;
  color: var(--sl-muted, #72817b);
  font-size: 25rpx;
  text-align: center;
}

.batch-section {
  margin: 18rpx 22rpx;
  padding: 24rpx;
  border-radius: 8rpx;
  background: #fff;
}

.section-title {
  color: var(--sl-ink, #1e2b26);
  font-size: 27rpx;
  font-weight: 800;
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.input-grid {
  display: grid;
  gap: 14rpx;
  margin-top: 18rpx;
}

.input-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 10rpx;
  margin-top: 18rpx;
  color: #66736d;
  font-size: 22rpx;
}

.field input,
.edit-input,
.edit-textarea {
  box-sizing: border-box;
  width: 100%;
  border: 1rpx solid rgb(18 107 79 / 15%);
  border-radius: 8rpx;
  background: #f7faf6;
  color: var(--sl-ink, #1e2b26);
  font-size: 26rpx;
}

.field input,
.edit-input {
  height: 70rpx;
  padding: 0 18rpx;
}

.preview-section {
  min-height: 180rpx;
}

.room-preview,
.option-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.room-chip,
.room-more,
.option-chip {
  display: inline-flex;
  min-height: 54rpx;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 20rpx;
  border: 1rpx solid rgb(18 107 79 / 15%);
  border-radius: 6rpx;
  background: #f6faf5;
  color: #53615a;
  font-size: 23rpx;
}

.option-chip.active {
  border-color: #126b4f;
  background: #e8f4ee;
  color: #126b4f;
  font-weight: 750;
}

.room-more,
.section-hint {
  color: var(--sl-muted, #72817b);
}

.section-hint,
.form-error,
.danger-hint {
  display: block;
  margin-top: 18rpx;
  font-size: 22rpx;
  line-height: 1.55;
}

.form-error,
.danger-hint {
  color: #c94832;
}

.batch-notice {
  margin: 18rpx 22rpx 0;
  padding: 20rpx 22rpx;
  border-left: 6rpx solid #126b4f;
  border-radius: 4rpx;
  background: #eaf4ef;
  color: #496159;
  font-size: 23rpx;
  line-height: 1.6;
}

.edit-row + .edit-row {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #edf1ec;
}

.edit-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--sl-ink, #1e2b26);
  font-size: 26rpx;
  font-weight: 750;
}

.edit-input,
.edit-textarea {
  margin-top: 16rpx;
}

.edit-textarea {
  min-height: 150rpx;
  padding: 18rpx;
}

.media-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 18rpx;
  color: var(--sl-muted, #72817b);
  font-size: 22rpx;
}

.selected-media,
.media-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 18rpx;
}

.selected-media__item,
.pool-media {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 2rpx solid transparent;
  border-radius: 7rpx;
  background: #edf2eb;
}

.selected-media__item image,
.selected-media__video,
.pool-media image,
.pool-media__video {
  display: flex;
  width: 100%;
  height: 132rpx;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f6a4c, #173f34);
}

.selected-media__item > text,
.pool-media > text {
  display: block;
  overflow: hidden;
  padding: 10rpx;
  color: #53615a;
  font-size: 20rpx;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-media__remove,
.pool-media__check {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  display: flex;
  width: 34rpx;
  height: 34rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgb(24 46 38 / 72%);
}

.pool-media.selected {
  border-color: #126b4f;
}

.pool-media__check {
  border: 2rpx solid #fff;
  background: #126b4f;
}

.batch-actions {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 16rpx;
  padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #edf1ec;
  background: #fff;
}

.media-picker__scroll {
  height: min(62vh, 850rpx);
  padding: 0 22rpx 22rpx;
  box-sizing: border-box;
}

.media-grid {
  margin-top: 20rpx;
}
</style>
