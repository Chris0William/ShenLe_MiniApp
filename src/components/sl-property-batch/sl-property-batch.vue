<script setup lang="ts">
import type {
  AddSlPropertyImageInput,
  ShenLeId,
  SlPropertyBatchRowOutput,
  SlTagOutput,
  UpdateSlPropertyInput,
} from '@/types/shenle'
import type { MediaKind } from '@/utils/media'
import type { GeneratedPropertyDraft, MediaMergeMode } from '@/utils/property-batch'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { getBuildingDetail, updateBuilding } from '@/api/building'
import { getCommunityDetail } from '@/api/community'
import {
  cleanupMediaDraft,
  createMediaDraftSession,
  downloadFile,
  uploadMediaFile,
} from '@/api/file'
import {
  batchAddProperties,
  batchDeleteProperties,
  batchUpdateProperties,
  getPropertyBatchList,
} from '@/api/property'
import { getTagList } from '@/api/tag'
import SlMediaSourceSheet from '@/components/sl-media-source-sheet/sl-media-source-sheet.vue'
import {
  DECORATION_OPTIONS,
  DEPOSIT_RULE_OPTIONS,
  ORIENTATION_OPTIONS,
  PROPERTY_STATUS_OPTIONS,
  RENTAL_TYPE_OPTIONS,
} from '@/constants/shenle'
import { isLocalMediaUrl, mediaKindOf } from '@/utils/media'
import {
  buildBatchAddInputs,
  buildBatchUpdateInputs,
  buildBuildingFloorUpdate,
  deduplicatePropertyDrafts,
  generatePropertyDrafts,
  identicalMedia,
  mediaIdentityKey,
} from '@/utils/property-batch'
import { resolveAssetUrl } from '@/utils/shenle'

type BatchAction = 'added' | 'updated' | 'deleted'
type BatchEditableField = Exclude<keyof UpdateSlPropertyInput, 'id' | 'title' | 'communityId' | 'buildingId' | 'unit' | 'roomNo' | 'floor' | 'totalFloors' | 'coverImageId'>

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
  mediaKey?: string
  posterFileId?: ShenLeId | null
  posterUrl?: string | null
}

interface AddDraftRow extends Omit<GeneratedPropertyDraft, 'images'> {
  images: BatchMediaChoice[]
}

type MediaTarget
  = | { type: 'edit' }
    | { type: 'add-row', index: number }
    | { type: 'add-all' }

interface BatchCoverChoice {
  key: string
  name: string
  kind: MediaKind
  url: string
  mediaKey?: string
  sourceFileId?: ShenLeId
}

interface WechatChooseMediaResult {
  tempFiles?: Array<{ tempFilePath?: string, fileType?: 'image' | 'video', thumbTempFilePath?: string }>
}

type WechatChooseMedia = (options: {
  count: number
  mediaType: ('image' | 'video')[]
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
  visibilityChange: [visible: boolean]
}>()

const activeSheet = ref<'add' | 'edit' | null>(null)
const addStep = ref<'rules' | 'preview'>('rules')
const submitting = ref(false)
const loadingSnapshots = ref(false)
const allSnapshots = ref<SlPropertyBatchRowOutput[]>([])

const addForm = reactive({
  startFloor: '1',
  endFloor: '1',
  bedrooms: '1',
  livingRooms: '0',
  bathrooms: '0',
  area: '',
  roomSuffix: '01',
  baseRentPrice: '0',
  incrementEveryFloors: '0',
  incrementAmount: '',
})
const addRows = ref<AddDraftRow[]>([])
const excludedRoomNumbers = ref<string[]>([])
const generatedRuleSignature = ref('')
const addValidationMessage = computed(() => {
  try {
    generatePropertyDrafts({
      startFloor: Number(addForm.startFloor),
      endFloor: Number(addForm.endFloor),
      roomSuffix: addForm.roomSuffix,
      bedrooms: Number(addForm.bedrooms),
      livingRooms: Number(addForm.livingRooms),
      bathrooms: Number(addForm.bathrooms),
      area: addForm.area.trim() ? Number(addForm.area) : null,
      baseRentPrice: Number(addForm.baseRentPrice),
      incrementEveryFloors: addForm.incrementEveryFloors.trim() ? Number(addForm.incrementEveryFloors) : 0,
      incrementAmount: addForm.incrementAmount.trim() ? Number(addForm.incrementAmount) : 0,
    })
    return ''
  }
  catch (error) {
    return error instanceof Error ? error.message : '请输入有效的生成规则'
  }
})
const currentRuleSignature = computed(() => JSON.stringify(generatedDraftInput()))
const addRulesChanged = computed(() => !!generatedRuleSignature.value && generatedRuleSignature.value !== currentRuleSignature.value)
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
const commonPropertyMedia = ref<BatchMediaChoice[] | null>([])
const coverEnabled = ref(false)
const batchCoverChoice = ref<BatchCoverChoice | null>(null)
const communityMediaPool = ref<BatchMediaChoice[]>([])
const communityMediaSelection = ref<BatchMediaChoice[]>([])
const communityMediaVisible = ref(false)
const mediaSourceVisible = ref(false)
const mediaTarget = ref<MediaTarget>({ type: 'edit' })
const addMediaEditorIndex = ref<number | null>(null)
const addMediaVisible = ref(false)
const uploading = ref(false)
const mediaDraftId = ref<ShenLeId | null>(null)
const uploadedDraftIds = ref<ShenLeId[]>([])
let activeUploadPromise: Promise<void> | null = null
const MEDIA_MODES: Array<{ value: MediaMergeMode, label: string }> = [
  { value: 'unchanged', label: '不修改' },
  { value: 'append', label: '追加' },
  { value: 'replace', label: '替换' },
  { value: 'clear', label: '清空' },
]
const propertyStatusNames = PROPERTY_STATUS_OPTIONS.map(option => option.label)
const batchCoverChoices = computed<BatchCoverChoice[]>(() => {
  if (mediaMode.value === 'clear')
    return []
  const choices: BatchCoverChoice[] = []
  if (commonPropertyMedia.value && !(enabled.images && mediaMode.value === 'replace')) {
    commonPropertyMedia.value.forEach(media => choices.push({
      key: `existing:${media.mediaKey}`,
      name: media.name,
      kind: media.kind,
      url: media.kind === 'video' ? media.posterUrl || '' : media.url,
      mediaKey: media.mediaKey,
    }))
  }
  if (enabled.images && (mediaMode.value === 'append' || mediaMode.value === 'replace')) {
    selectedMedia.value.forEach(media => choices.push({
      key: `source:${String(media.fileId)}`,
      name: media.name,
      kind: media.kind,
      url: media.kind === 'video' ? media.posterUrl || '' : media.url,
      sourceFileId: media.fileId,
    }))
  }
  return choices.filter((choice, index) => choices.findIndex(item => item.key === choice.key) === index)
})
const activeAddMediaRow = computed(() => addMediaEditorIndex.value == null ? null : addRows.value[addMediaEditorIndex.value] || null)

const sheetOpen = ref(false)
const sheetVisible = computed({
  get: () => sheetOpen.value,
  set: (visible: boolean) => {
    if (!visible)
      void closeBatchSheet()
  },
})
const batchSecondaryLabel = computed(() => activeSheet.value === 'add' && addStep.value === 'preview' ? '返回修改' : '取消')
const batchSecondaryDisabled = computed(() => !(activeSheet.value === 'add' && addStep.value === 'rules') && uploading.value)
const batchPrimaryLabel = computed(() => {
  if (activeSheet.value === 'add')
    return addStep.value === 'rules' ? '生成预览' : `创建 ${addRows.value.length} 套`
  return '保存批量修改'
})
const batchPrimaryLoading = computed(() => !(activeSheet.value === 'add' && addStep.value === 'rules') && submitting.value)
const batchPrimaryDisabled = computed(() => {
  if (activeSheet.value === 'add' && addStep.value === 'rules')
    return !!addValidationMessage.value
  if (activeSheet.value === 'add')
    return uploading.value || addRulesChanged.value || !addRows.value.length
  return uploading.value
})

function handleBatchSecondaryAction() {
  if (activeSheet.value === 'add' && addStep.value === 'preview') {
    backToAddRules()
    return
  }
  void closeBatchSheet()
}

function handleBatchPrimaryAction() {
  if (activeSheet.value === 'add' && addStep.value === 'rules') {
    generateAddPreview()
    return
  }
  if (activeSheet.value === 'add') {
    void submitBatchAdd()
    return
  }
  void submitBatchEdit()
}

function sameId(left: ShenLeId | null | undefined, right: ShenLeId | null | undefined) {
  return String(left ?? '') === String(right ?? '')
}

function resetEnabledFields() {
  EDIT_FIELDS.forEach((field) => {
    enabled[field.key] = false
  })
  mediaMode.value = 'append'
  selectedMedia.value = []
  commonPropertyMedia.value = []
  coverEnabled.value = false
  batchCoverChoice.value = null
}

function resetAddDraft() {
  addStep.value = 'rules'
  addForm.startFloor = '1'
  addForm.endFloor = '1'
  addForm.bedrooms = '1'
  addForm.livingRooms = '0'
  addForm.bathrooms = '0'
  addForm.area = ''
  addForm.roomSuffix = '01'
  addForm.baseRentPrice = '0'
  addForm.incrementEveryFloors = '0'
  addForm.incrementAmount = ''
  addRows.value = []
  excludedRoomNumbers.value = []
  generatedRuleSignature.value = ''
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
  hideBatchSheet()
  await cleanupDraftUploads()
}

function showBatchSheet(sheet: 'add' | 'edit') {
  activeSheet.value = sheet
  sheetOpen.value = true
  emit('visibilityChange', true)
}

function hideBatchSheet() {
  sheetOpen.value = false
  communityMediaVisible.value = false
  mediaSourceVisible.value = false
  addMediaVisible.value = false
}

function handleBatchSheetAfterLeave() {
  activeSheet.value = null
  addMediaEditorIndex.value = null
  resetEnabledFields()
  emit('visibilityChange', false)
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

function generatedDraftInput() {
  return {
    startFloor: Number(addForm.startFloor),
    endFloor: Number(addForm.endFloor),
    roomSuffix: addForm.roomSuffix,
    bedrooms: Number(addForm.bedrooms),
    livingRooms: Number(addForm.livingRooms),
    bathrooms: Number(addForm.bathrooms),
    area: addForm.area.trim() ? Number(addForm.area) : null,
    baseRentPrice: Number(addForm.baseRentPrice),
    incrementEveryFloors: addForm.incrementEveryFloors.trim() ? Number(addForm.incrementEveryFloors) : 0,
    incrementAmount: addForm.incrementAmount.trim() ? Number(addForm.incrementAmount) : 0,
  }
}

function generateAddPreview() {
  try {
    const generated = generatePropertyDrafts(generatedDraftInput())
    const result = deduplicatePropertyDrafts(
      generated,
      allSnapshots.value.map(item => item.roomNo || '').filter(Boolean),
    )
    addRows.value = result.items.map(item => ({ ...item, images: [] }))
    excludedRoomNumbers.value = result.duplicateRoomNumbers
    generatedRuleSignature.value = currentRuleSignature.value
    if (!addRows.value.length) {
      uni.showToast({ title: '生成房号均已存在，请调整规则', icon: 'none' })
      return
    }
    addStep.value = 'preview'
  }
  catch (error) {
    addRows.value = []
    excludedRoomNumbers.value = []
    generatedRuleSignature.value = ''
    uni.showToast({ title: error instanceof Error ? error.message : '生成规则无效', icon: 'none' })
  }
}

function backToAddRules() {
  addStep.value = 'rules'
  addMediaVisible.value = false
  addMediaEditorIndex.value = null
}

function toBatchMediaChoice(media: SlPropertyBatchRowOutput['images'][number]): BatchMediaChoice {
  return {
    fileId: media.id,
    fileType: media.fileType || mediaKindOf(media.fileType, media.suffix || media.url),
    name: media.fileName || `文件${media.id}`,
    kind: mediaKindOf(media.fileType, media.suffix || media.url),
    url: resolveAssetUrl(media.url),
    mediaKey: mediaIdentityKey(media),
    posterFileId: media.posterFileId,
    posterUrl: media.posterUrl ? resolveAssetUrl(media.posterUrl) : '',
  }
}

async function loadCommonPropertyMedia(snapshots: SlPropertyBatchRowOutput[]) {
  const common = identicalMedia(snapshots)
  commonPropertyMedia.value = common == null ? null : common.map(toBatchMediaChoice)
  if (!commonPropertyMedia.value)
    return
  commonPropertyMedia.value.forEach((media) => {
    const previewId = media.kind === 'video' ? media.posterFileId : media.fileId
    if (previewId) {
      downloadFile(previewId).then((path) => {
        if (media.kind === 'video')
          media.posterUrl = path
        else
          media.url = path
      }).catch(() => {})
    }
  })
}

async function openAdd() {
  if (!props.buildingId)
    return
  resetAddDraft()
  showBatchSheet('add')
  loadingSnapshots.value = true
  try {
    await fetchAllSnapshots()
  }
  catch (error) {
    await cleanupDraftUploads()
    hideBatchSheet()
    uni.showToast({ title: error instanceof Error ? error.message : '房源数据加载失败', icon: 'none' })
  }
  finally {
    loadingSnapshots.value = false
  }
}

async function openEdit() {
  if (!props.selectedIds.length)
    return
  showBatchSheet('edit')
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
    await loadCommonPropertyMedia(selectedSnapshots.value)
  }
  catch (error) {
    hideBatchSheet()
    uni.showToast({ title: error instanceof Error ? error.message : '房源快照加载失败', icon: 'none' })
  }
  finally {
    loadingSnapshots.value = false
  }
}

function batchErrorMessage(result: { errors?: Array<{ message: string }> }, fallback: string) {
  return result.errors?.[0]?.message || fallback
}

function normalizeAddRows(existingRoomNumbers: string[]) {
  const normalized = addRows.value.map((row, index) => {
    const floor = Number(row.floor)
    const bedrooms = Number(row.bedrooms)
    const livingRooms = Number(row.livingRooms)
    const bathrooms = Number(row.bathrooms)
    const area = row.area == null || String(row.area).trim() === '' ? null : Number(row.area)
    const rentPrice = Number(row.rentPrice)
    const status = Number(row.status)
    const roomNo = String(row.roomNo || '').trim()
    if (!roomNo)
      throw new Error(`第 ${index + 1} 行房号不能为空`)
    if (!Number.isInteger(floor) || floor <= 0)
      throw new Error(`房号 ${roomNo} 的楼层无效`)
    if (![bedrooms, livingRooms, bathrooms].every(value => Number.isInteger(value) && value >= 0))
      throw new Error(`房号 ${roomNo} 的户型无效`)
    if (area != null && (!Number.isFinite(area) || area <= 0))
      throw new Error(`房号 ${roomNo} 的面积无效`)
    if (!Number.isFinite(rentPrice) || rentPrice < 0)
      throw new Error(`房号 ${roomNo} 的价格无效`)
    if (!PROPERTY_STATUS_OPTIONS.some(option => option.value === status))
      throw new Error(`房号 ${roomNo} 的状态无效`)

    const images = row.images.map(media => ({ ...media }))
    const coverExists = images.some(media => sameId(media.fileId, row.coverImageId))
    return {
      ...row,
      floor,
      roomNo,
      bedrooms,
      livingRooms,
      bathrooms,
      area,
      rentPrice,
      status,
      images,
      coverImageId: coverExists ? row.coverImageId : (images[0]?.fileId ?? null),
    }
  })
  return deduplicatePropertyDrafts(normalized, existingRoomNumbers)
}

function draftStatusIndex(status: number) {
  return Math.max(0, PROPERTY_STATUS_OPTIONS.findIndex(option => option.value === Number(status)))
}

function changeDraftStatus(index: number, event: { detail: { value: string | number } }) {
  const selected = PROPERTY_STATUS_OPTIONS[Number(event.detail.value)]
  if (addRows.value[index] && selected)
    addRows.value[index].status = selected.value
}

async function submitBatchAdd() {
  if (submitting.value)
    return
  if (addValidationMessage.value) {
    uni.showToast({ title: addValidationMessage.value, icon: 'none' })
    return
  }
  if (addRulesChanged.value) {
    uni.showToast({ title: '请先重新生成预览', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await fetchAllSnapshots()
    const deduplicated = normalizeAddRows(allSnapshots.value.map(item => item.roomNo || '').filter(Boolean))
    addRows.value = deduplicated.items
    excludedRoomNumbers.value = [...new Set([...excludedRoomNumbers.value, ...deduplicated.duplicateRoomNumbers])]
    if (!addRows.value.length) {
      uni.showToast({ title: '没有可创建的房源', icon: 'none' })
      return
    }

    const detail = await getBuildingDetail(props.buildingId)
    const highestFloor = Math.max(...addRows.value.map(row => Number(row.floor)))
    let totalFloors = detail.totalFloors ?? null
    if (!detail.totalFloors || highestFloor > detail.totalFloors) {
      await updateBuilding(buildBuildingFloorUpdate(detail, highestFloor))
      totalFloors = highestFloor
    }

    const result = await batchAddProperties(buildBatchAddInputs(addRows.value, {
      communityId: props.communityId,
      buildingId: props.buildingId,
      totalFloors,
    }))
    if (!result.success) {
      uni.showToast({ title: batchErrorMessage(result, '批量新增失败'), icon: 'none' })
      return
    }

    await cleanupDraftUploads()
    hideBatchSheet()
    const skipped = excludedRoomNumbers.value.length
    uni.showToast({ title: skipped ? `新增 ${result.affectedCount} 套，剔除 ${skipped} 套重复` : `已新增 ${result.affectedCount} 套`, icon: 'success' })
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
  if (!fields.length && !coverEnabled.value) {
    uni.showToast({ title: '请至少启用一个修改项', icon: 'none' })
    return
  }
  if (enabled.images && ['append', 'replace'].includes(mediaMode.value) && !selectedMedia.value.length) {
    uni.showToast({ title: '请先选择或上传媒体', icon: 'none' })
    return
  }
  if (coverEnabled.value && (!batchCoverChoice.value || !batchCoverChoices.value.some(choice => choice.key === batchCoverChoice.value?.key))) {
    uni.showToast({ title: '请选择要设为封面的媒体', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const snapshots = await fetchAllSnapshots()
    const current = snapshots.filter(row => props.selectedIds.some(id => sameId(id, row.id)))
    if (current.length !== props.selectedIds.length)
      throw new Error('部分房源已变化，请刷新后重试')
    if (coverEnabled.value && batchCoverChoice.value?.mediaKey
      && current.some(row => !row.images.some(media => mediaIdentityKey(media) === batchCoverChoice.value?.mediaKey))) {
      throw new Error('所选房源媒体已变化，请重新选择封面')
    }
    const input = buildBatchUpdateInputs(current, {
      enabledFields: fields,
      values: buildEditValues(),
      mediaMode: enabled.images ? mediaMode.value : 'unchanged',
      media: selectedMedia.value.map(media => ({ fileId: media.fileId, fileType: media.fileType })),
      coverSelection: coverEnabled.value && batchCoverChoice.value
        ? {
            mediaKey: batchCoverChoice.value.mediaKey,
            sourceFileId: batchCoverChoice.value.sourceFileId,
          }
        : null,
    })
    const result = await batchUpdateProperties(input)
    if (!result.success) {
      uni.showToast({ title: batchErrorMessage(result, '批量修改失败'), icon: 'none' })
      return
    }

    await cleanupDraftUploads()
    hideBatchSheet()
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
      mediaKey: mediaIdentityKey(media),
      posterFileId: media.posterFileId,
      posterUrl: media.posterUrl ? resolveAssetUrl(media.posterUrl) : '',
    }))
    communityMediaSelection.value = []
    communityMediaVisible.value = true
    communityMediaPool.value.forEach((media) => {
      const previewId = media.kind === 'video' ? media.posterFileId : media.fileId
      if (previewId) {
        downloadFile(previewId).then((path) => {
          if (media.kind === 'video')
            media.posterUrl = path
          else
            media.url = path
        }).catch(() => {})
      }
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

function mergeMediaChoices(current: BatchMediaChoice[], incoming: readonly BatchMediaChoice[]) {
  const known = new Set(current.map(media => String(media.fileId)))
  return [
    ...current,
    ...incoming.filter((media) => {
      const key = String(media.fileId)
      if (known.has(key))
        return false
      known.add(key)
      return true
    }).map(media => ({ ...media })),
  ]
}

function applyMediaChoices(media: readonly BatchMediaChoice[]) {
  if (!media.length)
    return
  const target = mediaTarget.value
  if (target.type === 'edit') {
    selectedMedia.value = mergeMediaChoices(selectedMedia.value, media)
    return
  }
  if (target.type === 'add-row') {
    const row = addRows.value[target.index]
    if (!row)
      return
    row.images = mergeMediaChoices(row.images, media)
    if (!row.coverImageId)
      row.coverImageId = row.images[0]?.fileId ?? null
    return
  }
  addRows.value.forEach((row) => {
    row.images = mergeMediaChoices(row.images, media)
    if (!row.coverImageId)
      row.coverImageId = row.images[0]?.fileId ?? null
  })
}

function confirmCommunityMedia() {
  applyMediaChoices(communityMediaSelection.value)
  communityMediaVisible.value = false
}

function removeSelectedMedia(fileId: ShenLeId) {
  selectedMedia.value = selectedMedia.value.filter(media => !sameId(media.fileId, fileId))
  if (batchCoverChoice.value?.sourceFileId != null && sameId(batchCoverChoice.value.sourceFileId, fileId))
    batchCoverChoice.value = null
}

function removeAddRow(index: number) {
  addRows.value.splice(index, 1)
  if (addMediaEditorIndex.value === index) {
    addMediaVisible.value = false
    addMediaEditorIndex.value = null
  }
}

function openAddRowMedia(index: number) {
  addMediaEditorIndex.value = index
  addMediaVisible.value = true
}

function removeAddRowMedia(fileId: ShenLeId) {
  const row = activeAddMediaRow.value
  if (!row)
    return
  row.images = row.images.filter(media => !sameId(media.fileId, fileId))
  if (!row.images.some(media => sameId(media.fileId, row.coverImageId)))
    row.coverImageId = row.images[0]?.fileId ?? null
}

function setAddRowCover(fileId: ShenLeId) {
  if (activeAddMediaRow.value?.images.some(media => sameId(media.fileId, fileId)))
    activeAddMediaRow.value.coverImageId = fileId
}

function clearAllAddMedia() {
  addRows.value.forEach((row) => {
    row.images = []
    row.coverImageId = null
  })
}

function wxChooseMedia() {
  const wxApi = (globalThis as unknown as { wx?: { chooseMedia?: WechatChooseMedia } }).wx
  if (wxApi?.chooseMedia)
    return wxApi.chooseMedia.bind(wxApi)

  const uniApi = uni as unknown as { chooseMedia?: WechatChooseMedia }
  return uniApi.chooseMedia?.bind(uniApi)
}

function localMediaKind(file: { tempFilePath: string, fileType?: 'image' | 'video', thumbTempFilePath?: string }) {
  if (file.fileType)
    return file.fileType
  if (file.thumbTempFilePath)
    return 'video'
  return mediaKindOf(undefined, file.tempFilePath)
}

async function uploadMediaFiles(files: Array<{ tempFilePath: string, fileType?: 'image' | 'video', thumbTempFilePath?: string }>) {
  if (!files.length)
    return

  uploading.value = true
  let successCount = 0
  let failureCount = 0
  const uploadedMedia: BatchMediaChoice[] = []
  try {
    const draftId = await ensureMediaDraftSession()
    for (const local of files) {
      try {
        const kind = localMediaKind(local)
        const uploaded = await uploadMediaFile(local.tempFilePath, {
          belongId: draftId,
          kind: kind === 'video' ? 'video' : 'image',
          posterPath: local.thumbTempFilePath,
          onUploaded: file => uploadedDraftIds.value.push(file.id),
        })
        successCount += 1
        uploadedMedia.push({
          fileId: uploaded.id,
          fileType: uploaded.fileType || kind,
          name: uploaded.fileName || (kind === 'video' ? '视频' : '图片'),
          kind,
          url: local.tempFilePath,
          posterFileId: uploaded.posterFileId,
          posterUrl: uploaded.posterLocalPath || uploaded.posterUrl,
        })
      }
      catch {
        failureCount += 1
      }
    }

    applyMediaChoices(uploadedMedia)
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

function startMediaUpload(files: Array<{ tempFilePath: string, fileType?: 'image' | 'video', thumbTempFilePath?: string }>) {
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
  emit('visibilityChange', false)
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
    mediaType: ['image', 'video'],
    sourceType: ['album', 'camera'],
    sizeType: ['compressed'],
    maxDuration: 60,
    success: result => startMediaUpload((result.tempFiles || [])
      .filter(item => !!item.tempFilePath)
      .map(item => ({ tempFilePath: item.tempFilePath!, fileType: item.fileType, thumbTempFilePath: item.thumbTempFilePath }))),
  })
}

function openMediaSource(target: MediaTarget = { type: 'edit' }) {
  mediaTarget.value = target
  if (target.type === 'edit' && (mediaMode.value === 'clear' || mediaMode.value === 'unchanged'))
    mediaMode.value = 'append'
  mediaSourceVisible.value = true
}

function openAddAllMedia() {
  if (!addRows.value.length) {
    uni.showToast({ title: '请先生成房源预览', icon: 'none' })
    return
  }
  openMediaSource({ type: 'add-all' })
}

function openActiveRowMediaSource() {
  if (addMediaEditorIndex.value == null)
    return
  openMediaSource({ type: 'add-row', index: addMediaEditorIndex.value })
}

function selectMediaSource(source: 'community' | 'upload') {
  mediaSourceVisible.value = false
  setTimeout(() => {
    if (source === 'community')
      void openCommunityMedia()
    else if (source === 'upload')
      chooseUploadMedia()
  }, 220)
}

defineExpose({ openAdd, openEdit, requestDelete })
</script>

<template>
  <wd-popup v-model="sheetVisible" position="bottom" :z-index="2100" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden;" safe-area-inset-bottom @after-leave="handleBatchSheetAfterLeave" @touchmove.stop.prevent>
    <view class="batch-sheet" @touchmove.stop.prevent>
      <view class="batch-head">
        <view>
          <text class="batch-head__title">{{ activeSheet === 'edit' ? '批量修改房源' : (addStep === 'preview' ? '房源生成预览' : '批量新增房源') }}</text>
          <text class="batch-head__sub">{{ communityName }} · {{ buildingName }}</text>
        </view>
        <wd-icon name="close" size="22px" color="#72817b" @click="closeBatchSheet" />
      </view>

      <scroll-view
        scroll-y
        class="batch-scroll"
        :class="{ 'batch-scroll--rules': activeSheet === 'add' && addStep === 'rules' && !loadingSnapshots }"
      >
        <view v-if="loadingSnapshots" class="batch-loading">
          房源数据加载中...
        </view>

        <template v-else-if="activeSheet === 'add' && addStep === 'rules'">
          <view class="batch-section">
            <text class="section-title">生成规则</text>
            <view class="input-grid input-grid--two">
              <label class="field"><text>起始楼层</text><input v-model="addForm.startFloor" class="field-input" type="number" placeholder="1"></label>
              <label class="field"><text>结束楼层</text><input v-model="addForm.endFloor" class="field-input" type="number" placeholder="10"></label>
            </view>
            <view class="input-grid input-grid--three">
              <label class="field"><text>室</text><input v-model="addForm.bedrooms" class="field-input" type="number" placeholder="1"></label>
              <label class="field"><text>厅</text><input v-model="addForm.livingRooms" class="field-input" type="number" placeholder="0"></label>
              <label class="field"><text>卫</text><input v-model="addForm.bathrooms" class="field-input" type="number" placeholder="0"></label>
            </view>
            <view class="input-grid input-grid--two">
              <label class="field"><text>面积</text><view class="field-with-unit"><input v-model="addForm.area" class="field-input field-with-unit__input" type="digit" placeholder="可选"><text class="field-with-unit__suffix">㎡</text></view></label>
              <label class="field"><text>固定房号</text><input v-model="addForm.roomSuffix" class="field-input" type="text" placeholder="例如 02 / 1A"></label>
            </view>
            <view class="input-grid input-grid--three">
              <label class="field"><text>基础价格</text><input v-model="addForm.baseRentPrice" class="field-input" type="digit" placeholder="0"></label>
              <label class="field"><text>每几层递增</text><input v-model="addForm.incrementEveryFloors" class="field-input" type="number" placeholder="不递增"></label>
              <label class="field"><text>递增价格</text><input v-model="addForm.incrementAmount" class="field-input" type="digit" placeholder="0"></label>
            </view>
            <text v-if="addValidationMessage" class="form-error">{{ addValidationMessage }}</text>
          </view>
        </template>

        <template v-else-if="activeSheet === 'add' && addStep === 'preview'">
          <view class="batch-section preview-section">
            <view class="section-row">
              <text class="section-title">房源预览</text>
              <wd-tag type="success">
                {{ addRows.length }} 套
              </wd-tag>
            </view>
            <text v-if="excludedRoomNumbers.length" class="duplicate-hint">已剔除 {{ excludedRoomNumbers.length }} 个重复房号：{{ excludedRoomNumbers.slice(0, 5).join('、') }}</text>
            <view class="preview-tools">
              <wd-button size="small" plain icon="image" @click="openAddAllMedia">
                统一分配媒体
              </wd-button>
              <wd-button v-if="addRows.some(row => row.images.length)" size="small" plain type="danger" @click="clearAllAddMedia">
                清空全部媒体
              </wd-button>
            </view>
            <scroll-view scroll-x class="draft-table-scroll">
              <view class="draft-table">
                <view class="draft-table__row draft-table__head">
                  <text class="draft-cell">房号</text><text class="draft-cell">户型（室/厅/卫）</text><text class="draft-cell">面积</text><text class="draft-cell">价格</text><text class="draft-cell">状态</text><text class="draft-cell">媒体</text><text class="draft-cell draft-cell--last">操作</text>
                </view>
                <view v-for="(row, index) in addRows" :key="`${row.floor}-${row.roomNo}-${index}`" class="draft-table__row">
                  <input v-model="row.roomNo" class="draft-cell draft-input draft-input--room" type="text">
                  <view class="draft-cell draft-layout">
                    <input v-model="row.bedrooms" class="draft-layout__input" type="number"><text>/</text><input v-model="row.livingRooms" class="draft-layout__input" type="number"><text>/</text><input v-model="row.bathrooms" class="draft-layout__input" type="number">
                  </view>
                  <view class="draft-cell draft-value">
                    <input v-model="row.area" class="draft-value__input" type="digit" placeholder="--"><text>㎡</text>
                  </view>
                  <view class="draft-cell draft-value">
                    <input v-model="row.rentPrice" class="draft-value__input" type="digit"><text>元</text>
                  </view>
                  <picker class="draft-cell" :value="draftStatusIndex(row.status)" :range="propertyStatusNames" @change="changeDraftStatus(index, $event)">
                    <view class="draft-status">
                      {{ PROPERTY_STATUS_OPTIONS[draftStatusIndex(row.status)]?.label || '空置' }}
                    </view>
                  </picker>
                  <view class="draft-cell draft-media" @tap="openAddRowMedia(index)">
                    <wd-icon name="image" size="16px" /><text>{{ row.images.length ? `${row.images.length} 个` : '分配' }}</text>
                  </view>
                  <view class="draft-cell draft-cell--last draft-remove" @tap="removeAddRow(index)">
                    <wd-icon name="delete" size="18px" color="#c94832" />
                  </view>
                </view>
              </view>
            </scroll-view>
            <text class="section-hint">房源默认状态为空置；预览中的房号、户型、面积、价格、状态和媒体都可以继续调整。</text>
          </view>
        </template>

        <template v-else-if="activeSheet === 'edit'">
          <view class="batch-notice">
            已选择 {{ selectedSnapshots.length }} 套。仅启用的项目会覆盖，楼盘、楼栋、楼层、房号和标题不会改变。
          </view>

          <view class="batch-section">
            <view class="edit-row">
              <view class="edit-row__head">
                <text>租金</text><wd-switch v-model="enabled.rentPrice" size="22px" />
              </view>
              <input v-if="enabled.rentPrice" v-model="editValues.rentPrice" class="edit-input" type="digit" placeholder="0">
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>面积</text><wd-switch v-model="enabled.area" size="22px" />
              </view>
              <input v-if="enabled.area" v-model="editValues.area" class="edit-input" type="digit" placeholder="留空则清空">
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>卧室</text><wd-switch v-model="enabled.bedrooms" size="22px" />
              </view>
              <input v-if="enabled.bedrooms" v-model="editValues.bedrooms" class="edit-input" type="number">
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>客厅</text><wd-switch v-model="enabled.livingRooms" size="22px" />
              </view>
              <input v-if="enabled.livingRooms" v-model="editValues.livingRooms" class="edit-input" type="number">
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>卫生间</text><wd-switch v-model="enabled.bathrooms" size="22px" />
              </view>
              <input v-if="enabled.bathrooms" v-model="editValues.bathrooms" class="edit-input" type="number">
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>状态</text><wd-switch v-model="enabled.status" size="22px" />
              </view>
              <view v-if="enabled.status" class="option-chips">
                <text v-for="option in PROPERTY_STATUS_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.status === option.value }" @tap="editValues.status = option.value">{{ option.label }}</text>
              </view>
            </view>
          </view>

          <view class="batch-section">
            <view class="edit-row">
              <view class="edit-row__head">
                <text>朝向</text><wd-switch v-model="enabled.orientation" size="22px" />
              </view>
              <view v-if="enabled.orientation" class="option-chips">
                <text v-for="option in ORIENTATION_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.orientation === option.value }" @tap="chooseOption('orientation', option.value)">{{ option.label }}</text>
              </view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>装修</text><wd-switch v-model="enabled.decoration" size="22px" />
              </view>
              <view v-if="enabled.decoration" class="option-chips">
                <text v-for="option in DECORATION_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.decoration === option.value }" @tap="chooseOption('decoration', option.value)">{{ option.label }}</text>
              </view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>出租方式</text><wd-switch v-model="enabled.rentalType" size="22px" />
              </view>
              <view v-if="enabled.rentalType" class="option-chips">
                <text v-for="option in RENTAL_TYPE_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.rentalType === option.value }" @tap="chooseOption('rentalType', option.value)">{{ option.label }}</text>
              </view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>押金</text><wd-switch v-model="enabled.deposit" size="22px" />
              </view>
              <input v-if="enabled.deposit" v-model="editValues.deposit" class="edit-input" type="digit" placeholder="留空则清空">
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>押付方式</text><wd-switch v-model="enabled.depositRule" size="22px" />
              </view>
              <view v-if="enabled.depositRule" class="option-chips">
                <text v-for="option in DEPOSIT_RULE_OPTIONS" :key="option.value" class="option-chip" :class="{ active: editValues.depositRule === option.value }" @tap="chooseOption('depositRule', option.value)">{{ option.label }}</text>
              </view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>最短租期（月）</text><wd-switch v-model="enabled.minLease" size="22px" />
              </view>
              <input v-if="enabled.minLease" v-model="editValues.minLease" class="edit-input" type="number" placeholder="留空则清空">
            </view>
          </view>

          <view class="batch-section">
            <view class="edit-row">
              <view class="edit-row__head">
                <text>房源描述</text><wd-switch v-model="enabled.description" size="22px" />
              </view><textarea v-if="enabled.description" v-model="editValues.description" class="edit-textarea" placeholder="可清空" />
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>内部备注</text><wd-switch v-model="enabled.remark" size="22px" />
              </view><textarea v-if="enabled.remark" v-model="editValues.remark" class="edit-textarea" placeholder="可清空" />
            </view>
          </view>

          <view class="batch-section">
            <view class="edit-row">
              <view class="edit-row__head">
                <text>房源标签</text><wd-switch v-model="enabled.tagIds" size="22px" />
              </view>
              <view v-if="enabled.tagIds" class="option-chips">
                <text v-for="tag in houseTags" :key="String(tag.id)" class="option-chip" :class="{ active: hasId(editValues.tagIds, tag.id) }" @tap="toggleId(editValues.tagIds, tag.id)">{{ tag.name }}</text>
              </view>
            </view>
            <view class="edit-row">
              <view class="edit-row__head">
                <text>配套设施</text><wd-switch v-model="enabled.facilityIds" size="22px" />
              </view>
              <view v-if="enabled.facilityIds" class="option-chips">
                <text v-for="tag in facilityTags" :key="String(tag.id)" class="option-chip" :class="{ active: hasId(editValues.facilityIds, tag.id) }" @tap="toggleId(editValues.facilityIds, tag.id)">{{ tag.name }}</text>
              </view>
            </view>
          </view>

          <view class="batch-section">
            <view class="edit-row__head">
              <text>媒体</text><wd-switch v-model="enabled.images" size="22px" />
            </view>
            <template v-if="enabled.images">
              <view class="option-chips media-modes">
                <text v-for="mode in MEDIA_MODES" :key="mode.value" class="option-chip" :class="{ active: mediaMode === mode.value }" @tap="mediaMode = mode.value">{{ mode.label }}</text>
              </view>
              <view v-if="mediaMode === 'append' || mediaMode === 'replace'" class="media-actions">
                <wd-button size="small" plain icon="add" :loading="uploading" @click="openMediaSource()">
                  添加媒体
                </wd-button>
                <text>{{ selectedMedia.length }} 个已选</text>
              </view>
              <view v-if="selectedMedia.length && (mediaMode === 'append' || mediaMode === 'replace')" class="selected-media">
                <view v-for="media in selectedMedia" :key="String(media.fileId)" class="selected-media__item">
                  <image v-if="media.kind === 'image'" class="media-thumb" :src="media.url" mode="aspectFill" />
                  <view v-else class="selected-media__video">
                    <image v-if="media.posterUrl" class="media-poster" :src="media.posterUrl" mode="aspectFill" />
                    <video
                      v-else-if="isLocalMediaUrl(media.url)"
                      class="media-poster media-poster--local"
                      :src="media.url"
                      :controls="false"
                      :show-center-play-btn="false"
                      :show-play-btn="false"
                      :show-fullscreen-btn="false"
                      :enable-progress-gesture="false"
                      :initial-time="0.1"
                      muted
                      object-fit="cover"
                    />
                    <view class="media-play">
                      <wd-icon name="play-circle" size="24px" color="#fff" />
                    </view>
                  </view>
                  <text class="media-name">{{ media.name }}</text>
                  <view class="selected-media__remove" @tap.stop="removeSelectedMedia(media.fileId)">
                    <wd-icon name="close" size="12px" color="#fff" />
                  </view>
                </view>
              </view>
              <text v-if="mediaMode === 'clear'" class="danger-hint">保存后会清空所选房源的全部媒体。</text>
            </template>
            <view class="cover-editor">
              <view class="edit-row__head">
                <text>统一设置媒体封面</text><wd-switch v-model="coverEnabled" size="22px" />
              </view>
              <template v-if="coverEnabled">
                <text v-if="commonPropertyMedia === null" class="section-hint">所选房源媒体不一致。可以先追加或替换同一媒体，再将新增媒体设为封面。</text>
                <text v-else-if="!commonPropertyMedia.length" class="section-hint">所选房源当前均无媒体。</text>
                <text v-else class="section-hint">所选房源媒体一致，共 {{ commonPropertyMedia.length }} 个，可统一选择封面。</text>
                <view v-if="batchCoverChoices.length" class="cover-choice-grid">
                  <view v-for="choice in batchCoverChoices" :key="choice.key" class="cover-choice" :class="{ selected: batchCoverChoice?.key === choice.key }" @tap="batchCoverChoice = choice">
                    <image v-if="choice.kind === 'image'" class="cover-choice__media" :src="choice.url" mode="aspectFill" />
                    <view v-else class="cover-choice__video">
                      <image v-if="choice.url" class="media-poster" :src="choice.url" mode="aspectFill" />
                      <view class="media-play">
                        <wd-icon name="play-circle" size="24px" color="#fff" />
                      </view>
                    </view>
                    <text class="cover-choice__name">{{ choice.name }}</text>
                    <text v-if="batchCoverChoice?.key === choice.key" class="cover-choice__badge">封面</text>
                  </view>
                </view>
                <text v-else class="danger-hint">暂无可设为封面的共同媒体。</text>
              </template>
            </view>
          </view>
        </template>
      </scroll-view>

      <view class="batch-actions">
        <wd-button plain block :disabled="batchSecondaryDisabled" @click="handleBatchSecondaryAction">
          {{ batchSecondaryLabel }}
        </wd-button>
        <wd-button block type="primary" :loading="batchPrimaryLoading" :disabled="batchPrimaryDisabled" @click="handleBatchPrimaryAction">
          {{ batchPrimaryLabel }}
        </wd-button>
      </view>
    </view>
  </wd-popup>

  <wd-popup v-model="addMediaVisible" position="bottom" :z-index="2300" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden;" safe-area-inset-bottom @touchmove.stop.prevent>
    <view class="media-picker" @touchmove.stop.prevent>
      <view class="batch-head">
        <view><text class="batch-head__title">房号 {{ activeAddMediaRow?.roomNo }} 的媒体</text><text class="batch-head__sub">点击非封面媒体可设为封面</text></view>
        <wd-icon name="close" size="22px" color="#72817b" @click="addMediaVisible = false" />
      </view>
      <scroll-view scroll-y class="media-picker__scroll">
        <view v-if="!activeAddMediaRow?.images.length" class="batch-loading">
          暂未分配媒体
        </view>
        <view v-else class="media-grid">
          <view v-for="media in activeAddMediaRow.images" :key="String(media.fileId)" class="pool-media add-row-media" @tap="setAddRowCover(media.fileId)">
            <image v-if="media.kind === 'image'" class="media-thumb" :src="media.url" mode="aspectFill" />
            <view v-else class="pool-media__video">
              <image v-if="media.posterUrl" class="media-poster" :src="media.posterUrl" mode="aspectFill" />
              <video
                v-else-if="isLocalMediaUrl(media.url)"
                class="media-poster media-poster--local"
                :src="media.url"
                :controls="false"
                :show-center-play-btn="false"
                :show-play-btn="false"
                :show-fullscreen-btn="false"
                :enable-progress-gesture="false"
                :initial-time="0.1"
                muted
                object-fit="cover"
                @tap.stop="setAddRowCover(media.fileId)"
              />
              <view class="media-play">
                <wd-icon name="play-circle" size="28px" color="#fff" />
              </view>
            </view>
            <text class="media-name">{{ media.name }}</text>
            <text v-if="sameId(activeAddMediaRow.coverImageId, media.fileId)" class="cover-choice__badge">封面</text>
            <view class="selected-media__remove" @tap.stop="removeAddRowMedia(media.fileId)">
              <wd-icon name="close" size="12px" color="#fff" />
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="batch-actions">
        <wd-button plain block @click="addMediaVisible = false">
          完成
        </wd-button><wd-button block type="primary" icon="add" @click="openActiveRowMediaSource">
          添加媒体
        </wd-button>
      </view>
    </view>
  </wd-popup>

  <wd-popup v-model="communityMediaVisible" position="bottom" :z-index="2400" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden;" safe-area-inset-bottom @touchmove.stop.prevent>
    <view class="media-picker" @touchmove.stop.prevent>
      <view class="batch-head">
        <view><text class="batch-head__title">楼盘媒体池</text><text class="batch-head__sub">可多选图片和视频</text></view><wd-icon name="close" size="22px" color="#72817b" @click="communityMediaVisible = false" />
      </view>
      <scroll-view scroll-y class="media-picker__scroll">
        <view v-if="!communityMediaPool.length" class="batch-loading">
          当前楼盘暂无媒体
        </view>
        <view v-else class="media-grid">
          <view v-for="media in communityMediaPool" :key="String(media.fileId)" class="pool-media" :class="{ selected: communityMediaSelection.some(item => sameId(item.fileId, media.fileId)) }" @tap="toggleCommunityMedia(media)">
            <image v-if="media.kind === 'image'" class="media-thumb" :src="media.url" mode="aspectFill" />
            <view v-else class="pool-media__video">
              <image v-if="media.posterUrl" class="media-poster" :src="media.posterUrl" mode="aspectFill" />
              <view class="media-play">
                <wd-icon name="play-circle" size="28px" color="#fff" />
              </view>
            </view>
            <text class="media-name">{{ media.name }}</text>
            <view class="pool-media__check">
              <wd-icon v-if="communityMediaSelection.some(item => sameId(item.fileId, media.fileId))" name="check" size="13px" color="#fff" />
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="batch-actions">
        <wd-button plain block @click="communityMediaVisible = false">
          取消
        </wd-button><wd-button block type="primary" @click="confirmCommunityMedia">
          加入 {{ communityMediaSelection.length }} 个
        </wd-button>
      </view>
    </view>
  </wd-popup>

  <sl-media-source-sheet v-model="mediaSourceVisible" :z-index="2600" @select="selectMediaSource" />
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

.batch-scroll--rules {
  height: auto;
  max-height: min(72vh, 1000rpx);
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

.input-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
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

.field-input,
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

.field-with-unit,
.draft-value {
  display: flex;
  align-items: center;
}

.field-with-unit {
  border: 1rpx solid rgb(18 107 79 / 15%);
  border-radius: 8rpx;
  background: #f7faf6;
}

.field-with-unit__input {
  min-width: 0;
  flex: 1;
  border: 0;
  background: transparent;
}

.field-with-unit__suffix {
  padding-right: 16rpx;
  color: var(--sl-muted, #72817b);
}

.field-input,
.edit-input {
  height: 70rpx;
  padding: 0 18rpx;
}

.preview-section {
  min-height: 180rpx;
}

.duplicate-hint,
.draft-empty {
  display: block;
  margin-top: 16rpx;
  font-size: 22rpx;
}

.duplicate-hint {
  color: #a5681e;
}

.draft-empty {
  padding: 46rpx 20rpx;
  color: var(--sl-muted, #72817b);
  text-align: center;
}

.preview-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.draft-table-scroll {
  width: 100%;
  margin-top: 18rpx;
  white-space: nowrap;
}

.draft-table {
  width: 1220rpx;
  border: 1rpx solid #e4ebe5;
  border-radius: 8rpx;
  background: #fff;
}

.draft-table__row {
  display: grid;
  grid-template-columns: 180rpx 250rpx 160rpx 180rpx 100rpx 150rpx 80rpx;
  min-height: 76rpx;
  align-items: center;
  border-bottom: 1rpx solid #edf1ec;
}

.draft-table__row:last-child {
  border-bottom: 0;
}

.draft-cell {
  min-width: 0;
  box-sizing: border-box;
  padding: 0 12rpx;
  border-right: 1rpx solid #edf1ec;
}

.draft-cell--last {
  border-right: 0;
}

.draft-table__head {
  min-height: 64rpx;
  background: #eef5ef;
  color: #4d5d55;
  font-size: 21rpx;
  font-weight: 800;
  text-align: center;
}

.draft-input,
.draft-layout__input,
.draft-value__input {
  height: 56rpx;
  border: 1rpx solid #dfe8e1;
  border-radius: 6rpx;
  background: #fbfdfb;
  color: var(--sl-ink, #1e2b26);
  font-size: 23rpx;
  text-align: center;
}

.draft-input {
  margin: 0 10rpx;
}

.draft-layout {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 5rpx;
}

.draft-layout__input {
  width: 54rpx;
}

.draft-value {
  gap: 5rpx;
  color: var(--sl-muted, #72817b);
  font-size: 20rpx;
}

.draft-value__input {
  min-width: 0;
  flex: 1;
}

.draft-status {
  display: flex;
  height: 76rpx;
  align-items: center;
  justify-content: center;
  color: #126b4f;
  font-size: 22rpx;
  font-weight: 800;
  text-align: center;
}

.draft-media,
.draft-remove {
  display: flex;
  height: 76rpx;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  color: #126b4f;
  font-size: 21rpx;
  font-weight: 750;
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

.cover-editor {
  margin-top: 24rpx;
  padding-top: 24rpx;
  border-top: 1rpx solid #edf1ec;
}

.cover-choice-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 18rpx;
}

.cover-choice {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 2rpx solid transparent;
  border-radius: 7rpx;
  background: #edf2eb;
}

.cover-choice.selected {
  border-color: #2f7ef7;
}

.cover-choice__media,
.cover-choice__video {
  position: relative;
  display: flex;
  width: 100%;
  height: 132rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #0f6a4c, #173f34);
}

.cover-choice__name {
  display: block;
  overflow: hidden;
  padding: 10rpx;
  color: #53615a;
  font-size: 20rpx;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cover-choice__badge {
  position: absolute;
  z-index: 2;
  top: 8rpx;
  left: 8rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: #2f7ef7;
  color: #fff;
  font-size: 18rpx;
  font-weight: 800;
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

.media-thumb,
.selected-media__video,
.pool-media__video {
  position: relative;
  display: flex;
  width: 100%;
  height: 132rpx;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, #0f6a4c, #173f34);
}

.media-poster {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.media-poster--local {
  pointer-events: none;
}

.media-play {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(16 38 31 / 20%);
}

.media-name {
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
  z-index: 3;
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
