<script setup lang="ts">
import type { AddSlPropertyInput, ImageOutput, ShenLeId, SlPropertyImageOutput, SlPropertyOutput, SlTagOutput } from '@/types/shenle'
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { getBuildingDetail } from '@/api/building'
import { getCommunityDetail } from '@/api/community'
import { downloadFile, uploadFile } from '@/api/file'
import { addProperty, getPropertyDetail, updateProperty } from '@/api/property'
import { getTagList } from '@/api/tag'
import {
  DECORATION_OPTIONS,
  DEPOSIT_RULE_OPTIONS,
  ORIENTATION_OPTIONS,
  PROPERTY_STATUS_OPTIONS,
  RENTAL_TYPE_OPTIONS,
} from '@/constants/shenle'
import { useEntityChangeStore } from '@/store/entity-change'
import { PROPERTY_MEDIA_SOURCE_ACTIONS, resolvePropertyMediaSource, toOptionalNumber } from '@/utils/property-management'
import { resolveAssetUrl } from '@/utils/shenle'

definePage({
  style: {
    navigationBarTitleText: '新增/编辑房源',
  },
})

interface FormState {
  communityId: string
  buildingId: string
  floor: string
  totalFloors: string
  roomNo: string
  title: string
  bedrooms: number
  livingRooms: number
  bathrooms: number
  area: string
  orientationIdx: number
  decorationIdx: number
  rentalTypeIdx: number
  rentPrice: string
  deposit: string
  depositRuleIdx: number
  minLease: string
  description: string
  remark: string
  status: number
  tagIds: ShenLeId[]
  facilityIds: ShenLeId[]
  media: PropertyMedia[]
  coverImageId: string
}

type MediaKind = 'image' | 'video' | 'file'
type UploadMediaKind = Extract<MediaKind, 'image' | 'video'>
type MediaSource = 'property' | 'community' | 'upload'

interface PropertyMedia {
  id: ShenLeId
  url: string
  remoteUrl?: string | null
  kind: MediaKind
  fileName?: string | null
  fileType?: string | null
  suffix?: string | null
  source?: MediaSource
  originId?: ShenLeId
}

interface LocalUploadMedia {
  tempPath: string
  kind: UploadMediaKind
}

interface WechatChooseMediaFile {
  tempFilePath?: string
  fileType?: UploadMediaKind
}

interface WechatChooseMediaResult {
  tempFiles?: WechatChooseMediaFile[]
}

interface WechatChooseMediaOption {
  count: number
  mediaType: ('image' | 'video' | 'mix')[]
  sourceType: ('album' | 'camera')[]
  sizeType: string[]
  maxDuration: number
  success: (res: WechatChooseMediaResult) => void
  fail?: (error: unknown) => void
}

type WechatChooseMedia = (option: WechatChooseMediaOption) => void

const isEdit = ref(false)
const editId = ref('')
const submitting = ref(false)
const loading = ref(false)
const invalidEntry = ref(false)
const uploading = ref(false)
const mediaSourceVisible = ref(false)
const communityMediaLoading = ref(false)
const communityMediaVisible = ref(false)
const communityMediaPool = ref<PropertyMedia[]>([])
const selectedCommunityMediaIds = ref<string[]>([])
const previewVideo = ref<PropertyMedia | null>(null)
const houseTags = ref<SlTagOutput[]>([])
const facilityTags = ref<SlTagOutput[]>([])
const contextCommunityName = ref('')
const contextBuildingName = ref('')
const changeStore = useEntityChangeStore()

const mediaSourceActions = PROPERTY_MEDIA_SOURCE_ACTIONS

const form = reactive<FormState>({
  communityId: '',
  buildingId: '',
  floor: '',
  totalFloors: '',
  roomNo: '',
  title: '',
  bedrooms: 1,
  livingRooms: 0,
  bathrooms: 1,
  area: '',
  orientationIdx: -1,
  decorationIdx: -1,
  rentalTypeIdx: -1,
  rentPrice: '',
  deposit: '',
  depositRuleIdx: -1,
  minLease: '',
  description: '',
  remark: '',
  status: 0,
  tagIds: [],
  facilityIds: [],
  media: [],
  coverImageId: '',
})

const contextTotalFloorsLabel = computed(() => form.totalFloors ? `${form.totalFloors} 层` : '未设置')
const effectiveCoverId = computed(() => String(form.coverImageId || form.media[0]?.id || ''))
const videoPreviewVisible = computed({
  get: () => !!previewVideo.value,
  set: (visible: boolean) => {
    if (!visible)
      previewVideo.value = null
  },
})

const IMAGE_SUFFIXES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic']
const VIDEO_SUFFIXES = ['.mp4', '.mov', '.m4v', '.avi', '.webm']

function toNumber(value: string, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function idEquals(left?: ShenLeId | string, right?: ShenLeId | string) {
  return left !== undefined && right !== undefined && String(left) === String(right)
}

function extensionOf(value?: string | null) {
  const clean = String(value || '').split('?')[0].toLowerCase()
  const index = clean.lastIndexOf('.')
  return index >= 0 ? clean.slice(index) : ''
}

function mediaKind(media?: Partial<ImageOutput> | null): MediaKind {
  const fileType = String(media?.fileType || '').toLowerCase()
  const suffix = extensionOf(media?.suffix || media?.url)
  if (fileType.startsWith('video') || VIDEO_SUFFIXES.includes(suffix))
    return 'video'
  if (fileType.startsWith('image') || IMAGE_SUFFIXES.includes(suffix))
    return 'image'
  return 'file'
}

function normalizeMedia(media: ImageOutput | SlPropertyImageOutput, url?: string, source: MediaSource = 'property'): PropertyMedia {
  const remoteUrl = resolveAssetUrl(media.url)
  return {
    id: media.id,
    url: url || remoteUrl,
    remoteUrl,
    kind: mediaKind(media),
    fileName: media.fileName,
    fileType: media.fileType,
    suffix: media.suffix,
    source,
  }
}

function sameMediaUrl(left?: string | null, right?: string | null) {
  const normalize = (value?: string | null) => resolveAssetUrl(value).split('?')[0]
  return !!left && !!right && normalize(left) === normalize(right)
}

function sameMediaAsset(left: PropertyMedia, right: PropertyMedia) {
  const leftUrls = [left.remoteUrl, left.url].filter(Boolean)
  const rightUrls = [right.remoteUrl, right.url].filter(Boolean)
  return leftUrls.some(leftUrl => rightUrls.some(rightUrl => sameMediaUrl(leftUrl, rightUrl)))
}

function wxChooseMedia() {
  return (globalThis as unknown as { wx?: { chooseMedia?: WechatChooseMedia } }).wx?.chooseMedia
    || (uni as unknown as { chooseMedia?: WechatChooseMedia }).chooseMedia
}

function localMediaKind(tempPath: string, fileType?: UploadMediaKind): UploadMediaKind {
  if (fileType === 'video')
    return 'video'
  if (fileType === 'image')
    return 'image'
  return VIDEO_SUFFIXES.includes(extensionOf(tempPath)) ? 'video' : 'image'
}

function optionIndex(options: readonly { value: string, label: string }[], value?: string | null) {
  if (!value)
    return -1
  return options.findIndex(item => item.value === value || item.label === value)
}

async function loadTags() {
  const [house, facility] = await Promise.allSettled([
    getTagList({ category: 'house', status: 0 }),
    getTagList({ category: 'facility', status: 0 }),
  ])
  if (house.status === 'fulfilled')
    houseTags.value = house.value
  if (facility.status === 'fulfilled')
    facilityTags.value = facility.value
}

function toggleId(list: ShenLeId[], id: ShenLeId) {
  const index = list.findIndex(item => idEquals(item, id))
  if (index >= 0)
    list.splice(index, 1)
  else
    list.push(id)
}

function hasId(list: ShenLeId[], id: ShenLeId) {
  return list.some(item => idEquals(item, id))
}

async function uploadSelectedMedia(files: LocalUploadMedia[]) {
  if (!files.length)
    return

  uploading.value = true
  try {
    for (const item of files) {
      const file = await uploadFile(item.tempPath)
      form.media.push(normalizeMedia({ ...file, fileType: file.fileType || item.kind, suffix: file.suffix || extensionOf(item.tempPath) }, item.tempPath, 'upload'))
      if (!form.coverImageId)
        form.coverImageId = String(file.id)
    }
  }
  finally {
    uploading.value = false
  }
}

function chooseImageFallback(remain: number) {
  uni.chooseImage({
    count: remain,
    sizeType: ['compressed'],
    success: (res) => {
      const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : []
      void uploadSelectedMedia(paths.map(tempPath => ({ tempPath, kind: 'image' })))
    },
  })
}

function chooseMedia() {
  const remain = 9 - form.media.length
  if (remain <= 0) {
    uni.showToast({ title: 'Media limit is 9', icon: 'none' })
    return
  }

  const chooseMediaApi = wxChooseMedia()
  if (!chooseMediaApi) {
    chooseImageFallback(remain)
    return
  }

  chooseMediaApi({
    count: remain,
    mediaType: ['mix'],
    sourceType: ['album', 'camera'],
    sizeType: ['compressed'],
    maxDuration: 60,
    success: (res) => {
      const files = (res.tempFiles || [])
        .filter(item => !!item.tempFilePath)
        .map(item => ({
          tempPath: item.tempFilePath!,
          kind: localMediaKind(item.tempFilePath!, item.fileType),
        }))
      void uploadSelectedMedia(files)
    },
    fail: (error) => {
      const message = String((error as { errMsg?: string } | undefined)?.errMsg || '')
      if (!message.includes('cancel'))
        chooseImageFallback(remain)
    },
  })
}

function openMediaSourceSheet() {
  if (!uploading.value)
    mediaSourceVisible.value = true
}

function selectMediaSource(event: { item: { value?: unknown } }) {
  const source = resolvePropertyMediaSource(event.item.value)
  if (!source)
    return
  mediaSourceVisible.value = false
  setTimeout(() => {
    if (source === 'community')
      void openCommunityMediaPicker()
    else if (source === 'upload')
      chooseMedia()
  }, 220)
}

function removeMedia(index: number) {
  const removed = form.media[index]?.id
  form.media.splice(index, 1)
  if (idEquals(form.coverImageId, removed))
    form.coverImageId = String(form.media[0]?.id || '')
}

function setCover(index: number) {
  form.coverImageId = String(form.media[index]?.id || '')
}

function isCoverMedia(media: PropertyMedia) {
  return idEquals(effectiveCoverId.value, media.id)
}

function previewMedia(index: number) {
  const media = form.media[index]
  if (!media)
    return

  if (media.kind === 'video') {
    previewVideo.value = media
    return
  }

  const imageUrls = form.media.filter(item => item.kind === 'image').map(item => item.url)
  uni.previewImage({
    current: media.url,
    urls: imageUrls,
  })
}

async function openCommunityMediaPicker() {
  if (!form.communityId) {
    uni.showToast({ title: 'Select community first', icon: 'none' })
    return
  }
  communityMediaVisible.value = true
  selectedCommunityMediaIds.value = []
  await loadCommunityMediaPool()
}

async function loadCommunityMediaPool() {
  if (!form.communityId)
    return

  communityMediaLoading.value = true
  try {
    const community = await getCommunityDetail(form.communityId)
    const medias = (community.images || []).map(item => normalizeMedia(item, resolveAssetUrl(item.url), 'community'))
    if (community.coverImageId && community.coverImage) {
      const cover = normalizeMedia({
        id: community.coverImageId,
        url: community.coverImage,
        fileType: community.coverFileType,
        suffix: community.coverSuffix || extensionOf(community.coverImage),
      }, resolveAssetUrl(community.coverImage), 'community')

      if (!medias.some(media => idEquals(media.id, cover.id) || sameMediaAsset(media, cover)))
        medias.unshift(cover)
    }
    communityMediaPool.value = medias
  }
  finally {
    communityMediaLoading.value = false
  }
}

function isCommunityMediaAdded(media: PropertyMedia) {
  return form.media.some(item =>
    idEquals(item.id, media.id)
    || idEquals(item.originId, media.id)
    || sameMediaAsset(item, media),
  )
}

function isCommunityMediaSelected(media: PropertyMedia) {
  return selectedCommunityMediaIds.value.some(id => idEquals(id, media.id))
}

function toggleCommunityMedia(media: PropertyMedia) {
  if (isCommunityMediaAdded(media))
    return
  const id = String(media.id)
  const index = selectedCommunityMediaIds.value.findIndex(item => idEquals(item, id))
  if (index >= 0)
    selectedCommunityMediaIds.value.splice(index, 1)
  else
    selectedCommunityMediaIds.value.push(id)
}

function confirmCommunityMedia() {
  const remain = 9 - form.media.length
  if (remain <= 0) {
    uni.showToast({ title: 'Media limit is 9', icon: 'none' })
    return
  }

  const selected = communityMediaPool.value
    .filter(item => selectedCommunityMediaIds.value.some(id => idEquals(id, item.id)))
    .slice(0, remain)

  for (const media of selected) {
    form.media.push({ ...media, source: 'community', originId: media.id })
    if (!form.coverImageId)
      form.coverImageId = String(media.id)
  }

  communityMediaVisible.value = false
  selectedCommunityMediaIds.value = []
}

function validateForm() {
  if (!form.communityId) {
    uni.showToast({ title: '请选择楼盘', icon: 'none' })
    return false
  }
  if (!form.buildingId) {
    uni.showToast({ title: '请选择楼栋', icon: 'none' })
    return false
  }
  if (!form.floor) {
    uni.showToast({ title: '请输入楼层', icon: 'none' })
    return false
  }
  if (!form.title.trim()) {
    uni.showToast({ title: '请输入房源标题', icon: 'none' })
    return false
  }
  if (!form.rentPrice) {
    uni.showToast({ title: '请输入月租金', icon: 'none' })
    return false
  }
  return true
}

function cancel() {
  uni.navigateBack()
}

function leaveInvalidEntry() {
  const pages = getCurrentPages()
  if (pages.length > 1)
    uni.navigateBack()
  else
    uni.switchTab({ url: '/pages/admin/property-list/index' })
}

function buildSubmitData(): AddSlPropertyInput {
  const mediaIds = form.media.map(item => item.id)
  return {
    title: form.title.trim(),
    communityId: form.communityId,
    buildingId: form.buildingId,
    roomNo: form.roomNo || undefined,
    floor: toNumber(form.floor),
    totalFloors: toOptionalNumber(form.totalFloors),
    area: toNumber(form.area),
    bedrooms: form.bedrooms,
    livingRooms: form.livingRooms,
    bathrooms: form.bathrooms,
    orientation: ORIENTATION_OPTIONS[form.orientationIdx]?.value,
    decoration: DECORATION_OPTIONS[form.decorationIdx]?.value,
    rentalType: RENTAL_TYPE_OPTIONS[form.rentalTypeIdx]?.value,
    rentPrice: toNumber(form.rentPrice),
    deposit: form.deposit ? toNumber(form.deposit) : undefined,
    depositRule: DEPOSIT_RULE_OPTIONS[form.depositRuleIdx]?.value,
    minLease: form.minLease ? toNumber(form.minLease) : undefined,
    description: form.description || undefined,
    remark: form.remark || undefined,
    status: form.status,
    coverImageId: effectiveCoverId.value || undefined,
    tagIds: form.tagIds,
    facilityIds: form.facilityIds,
    images: mediaIds.map((id) => {
      const media = form.media.find(item => idEquals(item.id, id))
      return { fileId: id, fileType: media?.fileType || media?.kind || 'image' }
    }),
  }
}

async function submit() {
  if (!validateForm() || submitting.value)
    return
  submitting.value = true
  try {
    const data = buildSubmitData()
    if (isEdit.value) {
      await updateProperty({ ...data, id: editId.value })
      changeStore.publishPropertyChange({
        action: 'updated',
        ids: [editId.value],
        communityId: form.communityId,
        buildingId: form.buildingId,
      })
      uni.showToast({ title: '更新成功', icon: 'success' })
    }
    else {
      const createdId = await addProperty(data)
      changeStore.publishPropertyChange({
        action: 'created',
        ids: [createdId],
        communityId: form.communityId,
        buildingId: form.buildingId,
      })
      uni.showToast({ title: '新增成功', icon: 'success' })
    }
    setTimeout(() => uni.navigateBack(), 700)
  }
  finally {
    submitting.value = false
  }
}

async function fillDetail(detail: SlPropertyOutput) {
  form.communityId = String(detail.communityId || '')
  form.buildingId = String(detail.buildingId || '')
  contextCommunityName.value = detail.communityName || `楼盘 ${detail.communityId}`
  contextBuildingName.value = detail.buildingName || `楼栋 ${detail.buildingId}`
  form.floor = detail.floor === null || detail.floor === undefined ? '' : String(detail.floor)
  form.totalFloors = detail.totalFloors === null || detail.totalFloors === undefined ? '' : String(detail.totalFloors)
  form.roomNo = detail.roomNo || ''
  form.title = detail.title || ''
  form.bedrooms = detail.bedrooms || 1
  form.livingRooms = detail.livingRooms || 0
  form.bathrooms = detail.bathrooms || 1
  form.area = detail.area === null || detail.area === undefined ? '' : String(detail.area)
  form.orientationIdx = optionIndex(ORIENTATION_OPTIONS, detail.orientation)
  form.decorationIdx = optionIndex(DECORATION_OPTIONS, detail.decoration)
  form.rentalTypeIdx = optionIndex(RENTAL_TYPE_OPTIONS, detail.rentalType)
  form.rentPrice = detail.rentPrice === null || detail.rentPrice === undefined ? '' : String(detail.rentPrice)
  form.deposit = detail.deposit ? String(detail.deposit) : ''
  form.depositRuleIdx = optionIndex(DEPOSIT_RULE_OPTIONS, detail.depositRule)
  form.minLease = detail.minLease ? String(detail.minLease) : ''
  form.description = detail.description || ''
  form.remark = detail.remark || ''
  form.status = detail.status ?? 0
  form.tagIds = detail.tags?.map(item => item.id) || []
  form.facilityIds = detail.facilities?.map(item => item.id) || []
  form.media = await Promise.all((detail.images || []).map(async (image) => {
    const kind = mediaKind(image)
    if (kind === 'image') {
      try {
        return normalizeMedia(image, await downloadFile(image.id))
      }
      catch {}
    }
    return normalizeMedia(image)
  }))
  if (!form.media.length && detail.coverImageId && detail.coverImage) {
    const cover = {
      id: detail.coverImageId,
      url: detail.coverImage,
      fileType: detail.coverFileType,
      suffix: detail.coverSuffix || extensionOf(detail.coverImage),
    }
    form.media = [normalizeMedia(cover)]
  }
  form.coverImageId = detail.coverImageId ? String(detail.coverImageId) : String(form.media[0]?.id || '')
}

onLoad(async (query) => {
  loading.value = true
  try {
    await loadTags()
    if (query?.id) {
      isEdit.value = true
      editId.value = String(query.id)
      const detail = await getPropertyDetail(editId.value)
      await fillDetail(detail)
      try {
        const building = await getBuildingDetail(detail.buildingId)
        contextBuildingName.value = building.name || contextBuildingName.value
        form.totalFloors = building.totalFloors === null || building.totalFloors === undefined ? '' : String(building.totalFloors)
      }
      catch {}
      uni.setNavigationBarTitle({ title: '编辑房源' })
      return
    }

    if (!query?.communityId || !query?.buildingId) {
      invalidEntry.value = true
      uni.showToast({ title: '请从具体楼栋进入新增房源', icon: 'none' })
      setTimeout(leaveInvalidEntry, 700)
      return
    }

    form.buildingId = String(query.buildingId)
    contextCommunityName.value = decodeURIComponent(String(query.communityName || '当前楼盘'))
    try {
      const building = await getBuildingDetail(form.buildingId)
      if (String(building.communityId) !== String(query.communityId))
        throw new Error('楼栋不属于当前楼盘')
      form.communityId = String(building.communityId)
      contextBuildingName.value = building.name
      form.totalFloors = building.totalFloors === null || building.totalFloors === undefined ? '' : String(building.totalFloors)
    }
    catch {
      invalidEntry.value = true
      uni.showToast({ title: '楼栋信息加载失败，请重新进入', icon: 'none' })
      setTimeout(leaveInvalidEntry, 700)
      return
    }
    uni.setNavigationBarTitle({ title: '新增房源' })
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="sl-page form-page">
    <view v-if="loading" class="loading sl-card">
      房源加载中...
    </view>

    <view v-else-if="invalidEntry" class="loading sl-card">
      正在返回楼栋管理...
    </view>

    <view v-else class="form-content">
      <view class="form-card sl-card">
        <text class="form-card__title">位置归属</text>
        <view class="ownership-grid">
          <view class="ownership-item">
            <text class="form-label">所属楼盘</text>
            <text class="ownership-value">{{ contextCommunityName }}</text>
          </view>
          <view class="ownership-item">
            <text class="form-label">所属楼栋</text>
            <text class="ownership-value">{{ contextBuildingName }}</text>
          </view>
          <view class="ownership-item">
            <text class="form-label">楼栋总层数</text>
            <text class="ownership-value">{{ contextTotalFloorsLabel }}</text>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">楼层 *</text>
          <input v-model="form.floor" class="form-input" type="number" placeholder="如 6">
        </view>
        <view class="form-item">
          <text class="form-label">房间号</text>
          <input v-model="form.roomNo" class="form-input" placeholder="如 605 / A302">
        </view>
      </view>

      <view class="form-card sl-card">
        <text class="form-card__title">基础信息</text>
        <view class="form-item">
          <text class="form-label">标题 *</text>
          <input v-model="form.title" class="form-input" placeholder="如 精装一房 采光好">
        </view>
        <view class="counter-row">
          <view class="counter">
            <text>室</text>
            <view><text @tap="form.bedrooms = Math.max(0, form.bedrooms - 1)">-</text><text>{{ form.bedrooms }}</text><text @tap="form.bedrooms += 1">+</text></view>
          </view>
          <view class="counter">
            <text>厅</text>
            <view><text @tap="form.livingRooms = Math.max(0, form.livingRooms - 1)">-</text><text>{{ form.livingRooms }}</text><text @tap="form.livingRooms += 1">+</text></view>
          </view>
          <view class="counter">
            <text>卫</text>
            <view><text @tap="form.bathrooms = Math.max(0, form.bathrooms - 1)">-</text><text>{{ form.bathrooms }}</text><text @tap="form.bathrooms += 1">+</text></view>
          </view>
        </view>
        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">面积(㎡)</text>
            <input v-model="form.area" class="form-input" type="digit" placeholder="如 45">
          </view>
          <view class="form-item">
            <text class="form-label">月租金 *</text>
            <input v-model="form.rentPrice" class="form-input" type="digit" placeholder="如 1800">
          </view>
        </view>
        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">押金</text>
            <input v-model="form.deposit" class="form-input" type="digit" placeholder="如 1800">
          </view>
          <view class="form-item">
            <text class="form-label">最短租期(月)</text>
            <input v-model="form.minLease" class="form-input" type="number" placeholder="如 3">
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">朝向</text>
          <picker :range="ORIENTATION_OPTIONS.map(item => item.label)" :value="form.orientationIdx" @change="(event: any) => form.orientationIdx = Number(event.detail.value)">
            <view class="picker-value">
              {{ form.orientationIdx >= 0 ? ORIENTATION_OPTIONS[form.orientationIdx].label : '请选择' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">装修</text>
          <picker :range="DECORATION_OPTIONS.map(item => item.label)" :value="form.decorationIdx" @change="(event: any) => form.decorationIdx = Number(event.detail.value)">
            <view class="picker-value">
              {{ form.decorationIdx >= 0 ? DECORATION_OPTIONS[form.decorationIdx].label : '请选择' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">出租方式</text>
          <picker :range="RENTAL_TYPE_OPTIONS.map(item => item.label)" :value="form.rentalTypeIdx" @change="(event: any) => form.rentalTypeIdx = Number(event.detail.value)">
            <view class="picker-value">
              {{ form.rentalTypeIdx >= 0 ? RENTAL_TYPE_OPTIONS[form.rentalTypeIdx].label : '请选择' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">押付方式</text>
          <picker :range="DEPOSIT_RULE_OPTIONS.map(item => item.label)" :value="form.depositRuleIdx" @change="(event: any) => form.depositRuleIdx = Number(event.detail.value)">
            <view class="picker-value">
              {{ form.depositRuleIdx >= 0 ? DEPOSIT_RULE_OPTIONS[form.depositRuleIdx].label : '请选择' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">状态</text>
          <view class="status-row">
            <wd-tag v-for="item in PROPERTY_STATUS_OPTIONS" :key="item.value" :type="form.status === item.value ? item.tone as any : 'default'" @click="form.status = item.value">
              {{ item.label }}
            </wd-tag>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">描述</text>
          <textarea v-model="form.description" class="form-textarea" placeholder="填写采光、交通、家具等亮点" />
        </view>
      </view>

      <view class="form-card sl-card">
        <view class="media-head">
          <text class="form-card__title">媒体与标签</text>
          <text class="media-count">{{ form.media.length }}/9</text>
        </view>
        <view class="image-grid">
          <view v-for="(media, index) in form.media" :key="`${media.id}-${index}`" class="image-item" :class="{ 'image-item--video': media.kind === 'video' }">
            <image v-if="media.kind === 'image'" :src="media.url" mode="aspectFill" @tap="previewMedia(index)" />
            <view v-else class="video-tile" @tap="previewMedia(index)">
              <view class="video-tile__overlay">
                <wd-icon name="play-circle" size="32px" color="#fff" />
                <text>{{ media.fileName || '视频' }}</text>
              </view>
            </view>
            <text v-if="isCoverMedia(media)" class="cover-badge">封面</text>
            <view class="image-remove" @tap.stop="removeMedia(index)">
              <wd-icon name="close" size="14px" color="#fff" />
            </view>
            <view v-if="!isCoverMedia(media)" class="image-cover-action" @tap.stop="setCover(index)">
              设为封面
            </view>
          </view>
          <view class="image-add" @tap="openMediaSourceSheet">
            <wd-icon name="add" size="24px" color="#126b4f" />
            <text>添加媒体</text>
          </view>
        </view>
        <view v-if="houseTags.length" class="tag-section">
          <text class="form-label">房源标签</text>
          <view class="tag-list">
            <wd-tag v-for="tag in houseTags" :key="String(tag.id)" :type="hasId(form.tagIds, tag.id) ? 'success' : 'default'" @click="toggleId(form.tagIds, tag.id)">
              {{ tag.name }}
            </wd-tag>
          </view>
        </view>
        <view v-if="facilityTags.length" class="tag-section">
          <text class="form-label">配套设施</text>
          <view class="tag-list">
            <wd-tag v-for="tag in facilityTags" :key="String(tag.id)" :type="hasId(form.facilityIds, tag.id) ? 'success' : 'default'" @click="toggleId(form.facilityIds, tag.id)">
              {{ tag.name }}
            </wd-tag>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">内部备注</text>
          <textarea v-model="form.remark" class="form-textarea" placeholder="仅管理端可见" />
        </view>
      </view>
    </view>

    <wd-popup v-model="communityMediaVisible" position="bottom" custom-style="border-radius: 30rpx 30rpx 0 0; overflow: hidden;" safe-area-inset-bottom>
      <view class="media-picker">
        <view class="media-picker__head">
          <view>
            <text class="media-picker__title">楼盘媒体池</text>
            <text class="media-picker__sub">选择图片或视频加入当前房源</text>
          </view>
          <wd-icon name="close" size="22px" color="#72817b" @click="communityMediaVisible = false" />
        </view>
        <view v-if="communityMediaLoading" class="media-picker__empty">
          媒体加载中...
        </view>
        <view v-else-if="!communityMediaPool.length" class="media-picker__empty">
          当前楼盘暂无媒体
        </view>
        <view v-else class="media-picker__grid">
          <view
            v-for="media in communityMediaPool"
            :key="String(media.id)"
            class="pool-media"
            :class="{ selected: isCommunityMediaSelected(media), disabled: isCommunityMediaAdded(media) }"
            @tap="toggleCommunityMedia(media)"
          >
            <image v-if="media.kind === 'image'" :src="media.url" mode="aspectFill" />
            <view v-else class="pool-media__video">
              <view class="pool-media__overlay">
                <wd-icon name="play-circle" size="30px" color="#fff" />
              </view>
            </view>
            <text class="pool-media__name">{{ media.fileName || (media.kind === 'video' ? '视频' : '图片') }}</text>
            <text v-if="isCommunityMediaAdded(media)" class="pool-media__badge">已加入</text>
            <text v-else-if="isCommunityMediaSelected(media)" class="pool-media__badge">已选</text>
          </view>
        </view>
        <view class="media-picker__actions">
          <wd-button plain block @click="communityMediaVisible = false">
            取消
          </wd-button>
          <wd-button block type="primary" @click="confirmCommunityMedia">
            加入房源
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <wd-action-sheet
      v-model="mediaSourceVisible"
      title="添加媒体"
      cancel-text="取消"
      :actions="mediaSourceActions"
      root-portal
      @select="selectMediaSource"
    />

    <wd-popup v-model="videoPreviewVisible" custom-style="border-radius: 24rpx; overflow: hidden; width: 680rpx;">
      <view class="video-preview" @tap.stop>
        <view class="video-preview__head">
          <text>{{ previewVideo?.fileName || '视频预览' }}</text>
          <wd-icon name="close" size="20px" color="#72817b" @click="previewVideo = null" />
        </view>
        <video v-if="previewVideo" class="video-preview__player" :src="previewVideo.url" controls autoplay />
      </view>
    </wd-popup>

    <view class="bottom-bar sl-safe-bottom">
      <wd-button plain type="default" @click="cancel">
        取消
      </wd-button>
      <wd-button block type="primary" :loading="submitting" @click="submit">
        {{ isEdit ? '保存修改' : '发布房源' }}
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.form-page {
  padding-bottom: calc(130rpx + env(safe-area-inset-bottom));
}

.form-card,
.loading {
  padding: 26rpx;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 20rpx;
}

.form-card__title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 31rpx;
  font-weight: 850;
}

.form-item {
  margin-top: 20rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: #4d5e56;
  font-size: 25rpx;
  font-weight: 800;
}

.ownership-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.ownership-item {
  min-width: 0;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: #f3f7f1;
}

.ownership-item:last-child {
  grid-column: 1 / -1;
}

.ownership-value {
  display: block;
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 27rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-input,
.picker-value,
.form-textarea {
  width: 100%;
  box-sizing: border-box;
  border-radius: 18rpx;
  background: #f3f7f1;
  color: var(--sl-ink);
  font-size: 27rpx;
}

.form-input,
.picker-value {
  height: 76rpx;
  padding: 0 20rpx;
  line-height: 76rpx;
}

.picker-value.disabled {
  color: var(--sl-muted);
}

.form-textarea {
  min-height: 160rpx;
  padding: 18rpx 20rpx;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.counter-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 20rpx;
}

.counter {
  padding: 18rpx 12rpx;
  border-radius: 18rpx;
  background: #f3f7f1;
  text-align: center;
}

.counter > text {
  color: var(--sl-muted);
  font-size: 23rpx;
}

.counter view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 30rpx;
  font-weight: 850;
}

.counter view text:first-child,
.counter view text:last-child {
  width: 42rpx;
  height: 42rpx;
  border-radius: 999rpx;
  background: #fff;
  color: var(--sl-brand);
  line-height: 42rpx;
}

.status-row,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.media-head,
.media-picker__head,
.media-picker__actions {
  display: flex;
  align-items: center;
}

.media-head,
.media-picker__head {
  justify-content: space-between;
}

.media-count,
.media-picker__sub,
.media-picker__empty {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
}

.image-item,
.image-add {
  position: relative;
  height: 180rpx;
  overflow: hidden;
  border-radius: 18rpx;
  background: #f3f7f1;
}

.image-item image {
  width: 100%;
  height: 100%;
}

.image-item--video {
  background: linear-gradient(135deg, #173f34, #0f6a4c);
}

.video-tile,
.pool-media__video {
  display: flex;
  height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 16rpx;
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
  text-align: center;
}

.video-tile__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: rgb(16 38 31 / 22%);
}

.video-tile text {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.cover-badge {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: #2f7ef7;
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
}

.image-remove {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  display: flex;
  width: 34rpx;
  height: 34rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(15 35 28 / 66%);
}

.image-cover-action {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10rpx 0;
  background: rgb(0 0 0 / 48%);
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
}

.image-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  color: var(--sl-brand);
  font-size: 24rpx;
  font-weight: 800;
}

.tag-section {
  margin-top: 24rpx;
}

.media-picker {
  max-height: 82vh;
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.media-picker__title {
  display: block;
  color: var(--sl-ink);
  font-size: 32rpx;
  font-weight: 900;
}

.media-picker__sub {
  display: block;
  margin-top: 8rpx;
}

.media-picker__empty {
  padding: 64rpx 20rpx;
  text-align: center;
}

.media-picker__grid {
  display: grid;
  max-height: 52vh;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 24rpx;
  overflow-y: auto;
}

.pool-media {
  position: relative;
  height: 176rpx;
  overflow: hidden;
  border: 3rpx solid transparent;
  border-radius: 18rpx;
  background: #f3f7f1;
}

.pool-media image {
  width: 100%;
  height: 100%;
}

.pool-media.selected {
  border-color: var(--sl-brand);
}

.pool-media.disabled {
  opacity: 0.52;
}

.pool-media__video {
  position: relative;
  height: 100%;
  background: linear-gradient(135deg, #173f34, #0f6a4c);
}

.pool-media__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(16 38 31 / 20%);
}

.pool-media__name {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2;
  overflow: hidden;
  padding: 6rpx 10rpx;
  background: rgb(13 28 22 / 55%);
  color: #fff;
  font-size: 20rpx;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pool-media__badge {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: var(--sl-brand);
  color: #fff;
  font-size: 20rpx;
}

.media-picker__actions {
  gap: 16rpx;
  margin-top: 24rpx;
}

.video-preview {
  background: #fff;
}

.video-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  color: var(--sl-ink);
  font-size: 28rpx;
  font-weight: 900;
}

.video-preview__player {
  display: block;
  width: 680rpx;
  height: 420rpx;
  background: #10261f;
}

.loading {
  margin-top: 20rpx;
  color: var(--sl-muted);
  text-align: center;
}

.bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  gap: 16rpx;
  padding: 18rpx 28rpx 24rpx;
  border-top: 1rpx solid rgb(18 107 79 / 10%);
  background: rgb(255 255 255 / 96%);
}
</style>
