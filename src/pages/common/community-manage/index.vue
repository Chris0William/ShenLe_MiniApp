<script setup lang="ts">
import type { AddSlCommunityInput, ImageOutput, ShenLeId, SlCommunityOutput, SlLandlordOutput, SlRegionTreeOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { addCommunity, deleteCommunity, getCommunityDetail, getCommunityPage, updateCommunity } from '@/api/community'
import { downloadFile, uploadMediaFile } from '@/api/file'
import { assignOwner, getLandlordPage, unassignOwner } from '@/api/landlord'
import { getRegionTree } from '@/api/region'
import { useEntityChangeStore } from '@/store/entity-change'
import { isLocalMediaUrl, MEDIA_SELECTION_BATCH_LIMIT } from '@/utils/media'
import { createMediaLongPressGuard, renameEditableMedia, showMediaEditActionSheet } from '@/utils/media-edit'
import { idToQuery, resolveAssetUrl } from '@/utils/shenle'
import { saveVideoToAlbum, showVideoSaveActionSheet } from '@/utils/video-save'

definePage({
  style: {
    navigationBarTitleText: '楼盘管理',
    enablePullDownRefresh: true,
  },
})

interface RegionOption {
  id: ShenLeId
  name: string
  level: number
}

type MediaKind = 'image' | 'video' | 'file'
type UploadMediaKind = Extract<MediaKind, 'image' | 'video'>

interface CommunityMedia {
  id: ShenLeId
  url: string
  kind: MediaKind
  fileName?: string | null
  fileType?: string | null
  suffix?: string | null
  posterFileId?: ShenLeId | null
  posterUrl?: string | null
}

interface CommunityForm {
  id: string
  name: string
  type: number
  regionId: string
  address: string
  lng: string
  lat: string
  orderNo: string
  status: number
  remark: string
  media: CommunityMedia[]
  coverImageId: string
  ownerId: string
  ownerName: string
}

interface LocalUploadMedia {
  tempPath: string
  kind: UploadMediaKind
  posterPath?: string
}

interface WechatChooseMediaFile {
  tempFilePath?: string
  fileType?: UploadMediaKind
  thumbTempFilePath?: string
}

interface WechatChooseMediaResult {
  tempFiles?: WechatChooseMediaFile[]
}

interface WechatChooseMediaOption {
  count: number
  mediaType: ('image' | 'video')[]
  sourceType: ('album' | 'camera')[]
  sizeType: string[]
  maxDuration: number
  success: (res: WechatChooseMediaResult) => void
  fail?: (error: unknown) => void
}

type WechatChooseMedia = (option: WechatChooseMediaOption) => void

const page = ref(1)
const pageSize = 12
const total = ref(0)
const list = ref<SlCommunityOutput[]>([])
const coverMap = ref<Record<string, string>>({})
const keyword = ref('')
const activeType = ref<number | undefined>()
const regionTree = ref<SlRegionTreeOutput[]>([])
const filterRegionId = ref('')
const loading = ref(false)
const finished = ref(false)
const formVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const changeStore = useEntityChangeStore()
const CHANGE_CONSUMER = 'community-manage'

function publishCommunityChange(action: 'created' | 'updated' | 'deleted' | 'structural', ids: ShenLeId[]) {
  changeStore.publishCommunityChange({ action, ids })
  changeStore.consumeCommunityChange(CHANGE_CONSUMER)
}
const uploading = ref(false)
const picking = ref(false)
const previewVideo = ref<CommunityMedia | null>(null)
const ownerPickerVisible = ref(false)
const ownerKeyword = ref('')
const ownerItems = ref<SlLandlordOutput[]>([])
const ownerLoading = ref(false)
const originalOwnerId = ref('')
const mediaLongPressGuard = createMediaLongPressGuard()

const form = reactive<CommunityForm>({
  id: '',
  name: '',
  type: 1,
  regionId: '',
  address: '',
  lng: '',
  lat: '',
  orderNo: '100',
  status: 0,
  remark: '',
  media: [],
  coverImageId: '',
  ownerId: '',
  ownerName: '',
})

const typeOptions = [
  { value: undefined, label: '全部' },
  { value: 1, label: '小区' },
  { value: 2, label: '公寓' },
] as const

const statusOptions = [
  { value: 0, label: '正常' },
  { value: 1, label: '禁用' },
] as const
const DEFAULT_MAP_CENTER = { lng: 113.936, lat: 22.769 }
const IMAGE_SUFFIXES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic']
const VIDEO_SUFFIXES = ['.mp4', '.mov', '.m4v', '.avi', '.webm']

const regionOptions = computed<RegionOption[]>(() => {
  const result: RegionOption[] = []
  function walk(nodes: SlRegionTreeOutput[], depth = 0) {
    for (const node of nodes) {
      result.push({ id: node.id, name: `${'　'.repeat(depth)}${node.name}`, level: node.level })
      if (node.children?.length)
        walk(node.children, depth + 1)
    }
  }
  walk(regionTree.value)
  return result
})

const regionNames = computed(() => ['全部区域', ...regionOptions.value.map(item => item.name)])
const formRegionNames = computed(() => regionOptions.value.map(item => item.name))
const filterRegionIndex = computed(() => {
  if (!filterRegionId.value)
    return 0
  const idx = regionOptions.value.findIndex(item => sameId(item.id, filterRegionId.value))
  return idx >= 0 ? idx + 1 : 0
})
const formRegionIndex = computed(() => Math.max(0, regionOptions.value.findIndex(item => sameId(item.id, form.regionId))))
const showing = computed(() => list.value.length)
const formCoordinate = computed(() => {
  const lng = Number(form.lng)
  const lat = Number(form.lat)
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng === 0 || lat === 0)
    return null
  return { lng, lat }
})
const formLocationLabel = computed(() => form.address || (formCoordinate.value ? '已选择地图位置' : '还未选择位置'))
const effectiveCoverId = computed(() => String(form.coverImageId || form.media[0]?.id || ''))
const videoPreviewVisible = computed({
  get: () => !!previewVideo.value,
  set: (visible: boolean) => {
    if (!visible)
      previewVideo.value = null
  },
})

function savePreviewVideo() {
  if (!previewVideo.value)
    return
  void saveVideoToAlbum({ fileId: previewVideo.value.id, url: previewVideo.value.url })
}

function openSavePreviewMenu() {
  if (!previewVideo.value)
    return
  void showVideoSaveActionSheet({ fileId: previewVideo.value.id, url: previewVideo.value.url })
}

function sameId(left?: ShenLeId | string | null, right?: ShenLeId | string | null) {
  return left !== undefined && left !== null && right !== undefined && right !== null && String(left) === String(right)
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

function isVideoMedia(media?: Partial<ImageOutput> | null) {
  return mediaKind(media) === 'video'
}

function normalizeMedia(media: ImageOutput, url?: string): CommunityMedia {
  return {
    id: media.id,
    url: url || resolveAssetUrl(media.url),
    kind: mediaKind(media),
    fileName: media.fileName,
    fileType: media.fileType,
    suffix: media.suffix,
    posterFileId: media.posterFileId,
    posterUrl: media.posterUrl ? resolveAssetUrl(media.posterUrl) : '',
  }
}

function coverMedia(item: SlCommunityOutput): Partial<ImageOutput> | null {
  const matched = item.images?.find(image => sameId(image.id, item.coverImageId))
  if (matched)
    return matched
  if (item.coverImageId || item.coverImage) {
    return {
      id: item.coverImageId || 0,
      url: item.coverImage,
      fileType: item.coverFileType,
      suffix: item.coverSuffix || extensionOf(item.coverImage),
      posterFileId: item.coverPosterFileId,
      posterUrl: item.coverPosterUrl,
    }
  }
  return item.images?.[0] || null
}

function coverUrl(item: SlCommunityOutput) {
  const cached = coverMap.value[String(item.id)]
  if (cached)
    return cached
  const media = coverMedia(item)
  if (isVideoMedia(media))
    return media?.posterUrl ? resolveAssetUrl(media.posterUrl) : ''
  const url = media?.url
  return url ? resolveAssetUrl(url) : ''
}

function hasVideoCover(item: SlCommunityOutput) {
  return isVideoMedia(coverMedia(item))
}

function coverPreviewMedia(item: SlCommunityOutput): CommunityMedia | null {
  const media = coverMedia(item)
  if (!media)
    return null

  const kind: MediaKind = isVideoMedia(media) ? 'video' : 'image'
  const url = kind === 'video' ? resolveAssetUrl(media.url) : coverUrl(item)
  if (!url || url.endsWith('/static/images/placeholder.png'))
    return null

  return {
    id: media.id || item.coverImageId || item.id,
    url,
    kind,
    fileName: media.fileName || item.name,
    fileType: media.fileType,
    suffix: media.suffix,
  }
}

async function hydrateCoverImages(items: SlCommunityOutput[]) {
  const next: Record<string, string> = {}
  await Promise.all(items.map(async (item) => {
    const key = String(item.id)
    if (!item.coverImageId || coverMap.value[key])
      return
    if (hasVideoCover(item)) {
      const media = coverMedia(item)
      const posterFileId = media?.posterFileId || item.coverPosterFileId
      if (posterFileId) {
        try {
          next[key] = await downloadFile(posterFileId)
          return
        }
        catch {}
      }
      const posterUrl = media?.posterUrl || item.coverPosterUrl
      if (posterUrl)
        next[key] = resolveAssetUrl(posterUrl)
      return
    }
    try {
      next[key] = await downloadFile(item.coverImageId)
    }
    catch {
      const url = item.coverImage || item.images?.[0]?.url
      if (url)
        next[key] = resolveAssetUrl(url)
    }
  }))
  if (Object.keys(next).length)
    coverMap.value = { ...coverMap.value, ...next }
}

function toNumber(value: string, fallback?: number) {
  if (value === '')
    return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function regionName(id?: ShenLeId | null) {
  return regionOptions.value.find(item => sameId(item.id, id))?.name.trim() || '未分区'
}

function typeLabel(type?: number) {
  return type === 2 ? '公寓' : '小区'
}

function statusLabel(status?: number) {
  return status === 1 ? '禁用' : '正常'
}

async function loadRegions() {
  regionTree.value = await getRegionTree()
}

async function loadData(reset = false) {
  if (loading.value)
    return
  if (reset) {
    page.value = 1
    list.value = []
    coverMap.value = {}
    finished.value = false
  }
  if (finished.value)
    return

  loading.value = true
  try {
    const res = await getCommunityPage({
      page: page.value,
      pageSize,
      name: keyword.value.trim() || undefined,
      type: activeType.value,
      regionId: filterRegionId.value || undefined,
    })
    list.value = reset ? res.items : [...list.value, ...res.items]
    total.value = res.total
    finished.value = list.value.length >= res.total || res.items.length < pageSize
    page.value += 1
    void hydrateCoverImages(res.items)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function onFilterRegionChange(event: any) {
  const idx = Number(event.detail.value)
  filterRegionId.value = idx <= 0 ? '' : String(regionOptions.value[idx - 1]?.id || '')
  loadData(true)
}

function onFormRegionChange(event: any) {
  const idx = Number(event.detail.value)
  form.regionId = String(regionOptions.value[idx]?.id || '')
}

function resetForm(item?: SlCommunityOutput) {
  isEdit.value = !!item
  form.id = item ? String(item.id) : ''
  form.name = item?.name || ''
  form.type = item?.type || 1
  form.regionId = item?.regionId ? String(item.regionId) : ''
  form.address = item?.address || ''
  form.lng = item?.lng === null || item?.lng === undefined ? '' : String(item.lng)
  form.lat = item?.lat === null || item?.lat === undefined ? '' : String(item.lat)
  form.orderNo = String(item?.orderNo ?? 100)
  form.status = item?.status ?? 0
  form.remark = item?.remark || ''
  form.media = item?.images?.map(image => normalizeMedia(image)) || []
  if (!form.media.length && item?.coverImageId && item.coverImage) {
    form.media = [normalizeMedia({
      id: item.coverImageId,
      url: item.coverImage,
      suffix: extensionOf(item.coverImage),
    })]
  }
  form.coverImageId = item?.coverImageId ? String(item.coverImageId) : String(form.media[0]?.id || '')
  form.ownerId = item?.ownerId ? String(item.ownerId) : ''
  form.ownerName = item?.ownerName || ''
  originalOwnerId.value = form.ownerId
}

async function loadFormImages(item: SlCommunityOutput) {
  const images = item.images || []
  form.media = await Promise.all(images.map(async (image) => {
    const media = normalizeMedia(image)
    if (media.kind === 'video' && media.posterFileId) {
      try {
        media.posterUrl = await downloadFile(media.posterFileId)
      }
      catch {}
    }
    return media
  }))

  if (!form.media.length && item.coverImageId && item.coverImage) {
    const cover = {
      id: item.coverImageId,
      url: item.coverImage,
      suffix: extensionOf(item.coverImage),
    }
    form.media = [normalizeMedia(cover)]
  }
  form.coverImageId = item.coverImageId ? String(item.coverImageId) : String(form.media[0]?.id || '')
}

function openAdd() {
  resetForm()
  formVisible.value = true
}

async function openEdit(item: SlCommunityOutput) {
  resetForm(item)
  formVisible.value = true
  try {
    const detail = await getCommunityDetail(item.id)
    resetForm(detail)
    await loadFormImages(detail)
  }
  catch {
    formVisible.value = false
    uni.showToast({ title: '楼盘详情加载失败', icon: 'none' })
  }
}

async function loadOwnerOptions() {
  if (ownerLoading.value)
    return
  ownerLoading.value = true
  try {
    const result = await getLandlordPage({
      page: 1,
      pageSize: 100,
      keyword: ownerKeyword.value.trim() || undefined,
    })
    ownerItems.value = result.items
  }
  finally {
    ownerLoading.value = false
  }
}

function openOwnerPicker() {
  ownerKeyword.value = ''
  ownerPickerVisible.value = true
  void loadOwnerOptions()
}

function selectOwner(owner: SlLandlordOutput) {
  form.ownerId = String(owner.userId)
  form.ownerName = owner.nickName || '未设置昵称'
  ownerPickerVisible.value = false
}

async function saveOwnerAssignment(communityId: ShenLeId) {
  if (sameId(originalOwnerId.value, form.ownerId))
    return

  if (!form.ownerId)
    throw new Error('请选择盘源对接人')
  if (!originalOwnerId.value) {
    await assignOwner(communityId, form.ownerId)
    originalOwnerId.value = form.ownerId
    return
  }

  const previousOwnerId = originalOwnerId.value
  await unassignOwner(communityId)
  try {
    await assignOwner(communityId, form.ownerId)
    originalOwnerId.value = form.ownerId
  }
  catch (error) {
    await assignOwner(communityId, previousOwnerId).catch(() => {})
    throw error
  }
}

function wxChooseMedia() {
  const wxApi = (globalThis as unknown as { wx?: { chooseMedia?: WechatChooseMedia } }).wx
  if (wxApi?.chooseMedia)
    return wxApi.chooseMedia.bind(wxApi)

  const uniApi = uni as unknown as { chooseMedia?: WechatChooseMedia }
  return uniApi.chooseMedia?.bind(uniApi)
}

function localMediaKind(tempPath: string, fileType?: UploadMediaKind, posterPath?: string): UploadMediaKind {
  if (fileType === 'video')
    return 'video'
  if (fileType === 'image')
    return 'image'
  if (posterPath)
    return 'video'
  return VIDEO_SUFFIXES.includes(extensionOf(tempPath)) ? 'video' : 'image'
}

async function uploadSelectedMedia(files: LocalUploadMedia[]) {
  if (!files.length)
    return

  uploading.value = true
  try {
    for (const item of files) {
      const file = await uploadMediaFile(item.tempPath, { kind: item.kind, posterPath: item.posterPath })
      form.media.push(normalizeMedia(
        { ...file, fileType: file.fileType || item.kind, suffix: file.suffix || extensionOf(item.tempPath) },
        item.tempPath,
      ))
      if (file.posterLocalPath)
        form.media[form.media.length - 1].posterUrl = file.posterLocalPath
      if (!form.coverImageId)
        form.coverImageId = String(file.id)
    }
  }
  catch (error) {
    console.error('upload community media failed', error)
  }
  finally {
    uploading.value = false
  }
}

function chooseImageFallback() {
  uni.chooseImage({
    count: MEDIA_SELECTION_BATCH_LIMIT,
    sizeType: ['compressed'],
    success: (res) => {
      const paths = Array.isArray(res.tempFilePaths) ? res.tempFilePaths : [res.tempFilePaths].filter(Boolean)
      void uploadSelectedMedia(paths.map(tempPath => ({ tempPath, kind: 'image' })))
    },
  })
}

function handleChooseMediaFailure(error: unknown) {
  const message = String((error as { errMsg?: string } | undefined)?.errMsg || '')
  if (message.includes('cancel'))
    return

  console.error('choose community media failed', error)
  uni.showToast({ title: '媒体选择失败，请重试', icon: 'none' })
}

function chooseMedia() {
  if (uploading.value)
    return

  const chooseMediaApi = wxChooseMedia()
  if (!chooseMediaApi) {
    chooseImageFallback()
    return
  }

  chooseMediaApi({
    count: MEDIA_SELECTION_BATCH_LIMIT,
    mediaType: ['image', 'video'],
    sourceType: ['album', 'camera'],
    sizeType: ['compressed'],
    maxDuration: 60,
    success: (res) => {
      const files = (res.tempFiles || [])
        .filter(item => !!item.tempFilePath)
        .map(item => ({
          tempPath: item.tempFilePath!,
          kind: localMediaKind(item.tempFilePath!, item.fileType, item.thumbTempFilePath),
          posterPath: item.thumbTempFilePath,
        }))
      void uploadSelectedMedia(files)
    },
    fail: handleChooseMediaFailure,
  })
}

function removeMedia(index: number) {
  const removed = form.media[index]?.id
  form.media.splice(index, 1)
  if (sameId(form.coverImageId, removed))
    form.coverImageId = String(form.media[0]?.id || '')
}

function setCover(index: number) {
  form.coverImageId = String(form.media[index]?.id || '')
}

function isCoverMedia(media: CommunityMedia) {
  return sameId(effectiveCoverId.value, media.id)
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

function handleMediaTap(index: number) {
  if (mediaLongPressGuard.consumeTap())
    return
  previewMedia(index)
}

async function openMediaActionMenu(index: number) {
  const media = form.media[index]
  if (!media)
    return

  mediaLongPressGuard.mark()
  const action = await showMediaEditActionSheet()
  if (action === 'view') {
    previewMedia(index)
    return
  }
  if (action === 'rename') {
    await renameEditableMedia({
      id: media.id,
      fileName: media.fileName,
      suffix: media.suffix,
      onRenamed: fileName => media.fileName = fileName,
    })
    return
  }
  if (action === 'cover') {
    if (isCoverMedia(media)) {
      uni.showToast({ title: '当前已是封面', icon: 'none' })
      return
    }
    setCover(index)
  }
}

function previewCommunityCover(item: SlCommunityOutput) {
  const media = coverPreviewMedia(item)
  if (!media)
    return

  if (media.kind === 'video') {
    previewVideo.value = media
    return
  }

  uni.previewImage({
    current: media.url,
    urls: [media.url],
  })
}

function chooseLocation() {
  // 重入保护：同一次点击可能从按钮(@click)和父容器(@tap)各触发一次，避免地图选点弹两遍
  if (picking.value)
    return
  picking.value = true
  const latitude = toNumber(form.lat, DEFAULT_MAP_CENTER.lat)
  const longitude = toNumber(form.lng, DEFAULT_MAP_CENTER.lng)
  uni.chooseLocation({
    latitude,
    longitude,
    success(res) {
      setCoordinate(res.longitude, res.latitude)
      const labels = [res.name, res.address].filter(Boolean)
      form.address = labels.length ? Array.from(new Set(labels)).join(' - ') : form.address
    },
    fail() {},
    complete() {
      picking.value = false
    },
  })
}

function setCoordinate(longitude?: number, latitude?: number) {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude))
    return
  form.lng = Number(longitude).toFixed(6)
  form.lat = Number(latitude).toFixed(6)
}

function buildPayload(): AddSlCommunityInput {
  const mediaIds = form.media.map(item => item.id)
  return {
    name: form.name.trim(),
    type: form.type,
    regionId: form.regionId || undefined,
    address: form.address.trim() || undefined,
    lng: toNumber(form.lng),
    lat: toNumber(form.lat),
    orderNo: toNumber(form.orderNo, 100),
    status: form.status,
    remark: form.remark.trim() || undefined,
    coverImageId: effectiveCoverId.value || null,
    imageIds: mediaIds,
  }
}

function patchCommunityListItem(payload: AddSlCommunityInput & { id: ShenLeId }) {
  const index = list.value.findIndex(item => sameId(item.id, payload.id))
  if (index < 0)
    return

  const current = list.value[index]
  const cover = form.media.find(item => sameId(item.id, effectiveCoverId.value))
  const coverUrlValue = cover?.url || ''
  const coverKey = String(payload.id)
  const coverDisplayUrl = cover?.kind === 'video' ? cover.posterUrl : coverUrlValue
  if (coverDisplayUrl) {
    coverMap.value = { ...coverMap.value, [coverKey]: coverDisplayUrl }
  }
  else if (coverMap.value[coverKey]) {
    const { [coverKey]: _removed, ...nextCoverMap } = coverMap.value
    coverMap.value = nextCoverMap
  }

  list.value.splice(index, 1, {
    ...current,
    ...payload,
    id: payload.id,
    name: payload.name,
    type: payload.type ?? current.type,
    typeName: typeLabel(payload.type),
    regionId: payload.regionId ?? null,
    regionName: payload.regionId ? regionName(payload.regionId) : null,
    address: payload.address ?? null,
    lng: payload.lng ?? null,
    lat: payload.lat ?? null,
    orderNo: payload.orderNo ?? current.orderNo,
    status: payload.status ?? current.status,
    remark: payload.remark ?? null,
    coverImageId: payload.coverImageId ?? null,
    coverImage: coverUrlValue || null,
    coverFileType: cover?.fileType || cover?.kind || null,
    coverSuffix: cover?.suffix || null,
    coverPosterFileId: cover?.posterFileId || null,
    coverPosterUrl: cover?.posterUrl || null,
    ownerId: form.ownerId || null,
    ownerName: form.ownerName || null,
    images: form.media.map(item => ({
      id: item.id,
      fileName: item.fileName,
      fileType: item.fileType,
      suffix: item.suffix,
      url: item.url || null,
      posterFileId: item.posterFileId,
      posterUrl: item.posterUrl,
    })),
  })
}

async function submitForm() {
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入楼盘名称', icon: 'none' })
    return
  }
  if (!form.regionId) {
    uni.showToast({ title: '请选择所属区域', icon: 'none' })
    return
  }
  if (!form.ownerId) {
    uni.showToast({ title: '请选择盘源对接人', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value) {
      const updatePayload = { ...payload, id: form.id }
      await updateCommunity(updatePayload)
      await saveOwnerAssignment(form.id)
      patchCommunityListItem(updatePayload)
      publishCommunityChange('updated', [form.id])
    }
    else {
      const createdId = await addCommunity(payload)
      await saveOwnerAssignment(createdId)
      publishCommunityChange('created', [createdId])
      await loadData(true)
    }
    uni.showToast({ title: isEdit.value ? '更新成功' : '新增成功', icon: 'success' })
    formVisible.value = false
  }
  finally {
    submitting.value = false
  }
}

function confirmDelete(item: SlCommunityOutput) {
  const buildingCount = Math.max(0, Number(item.buildingCount) || 0)
  const propertyCount = Math.max(0, Number(item.propertyCount) || 0)
  const hasDescendants = buildingCount > 0 || propertyCount > 0
  uni.showModal({
    title: hasDescendants ? '删除楼盘及全部数据' : '删除楼盘',
    content: hasDescendants
      ? `「${item.name}」下有 ${buildingCount} 栋楼栋、${propertyCount} 套房源，将随楼盘一起删除。请确认已核对数据。`
      : `确定删除「${item.name}」？删除后将无法在列表中查看。`,
    confirmText: hasDescendants ? '全部删除' : '删除',
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      await deleteCommunity(item.id, true)
      publishCommunityChange('deleted', [item.id])
      uni.showToast({ title: '删除成功', icon: 'success' })
      await loadData(true)
    },
  })
}

function goBuildings(item: SlCommunityOutput) {
  uni.navigateTo({ url: `/pages/common/building-manage/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}` })
}

onLoad(async (query) => {
  await loadRegions()
  await loadData(true)
  // 支持从地图楼盘卡片深链直达编辑表单
  const editId = typeof query?.editId === 'string' ? query.editId : ''
  if (editId)
    openEdit({ id: editId } as SlCommunityOutput)
})
onShow(() => {
  const changes = [
    changeStore.consumeCommunityChange(CHANGE_CONSUMER),
    changeStore.consumeBuildingChange(CHANGE_CONSUMER),
    changeStore.consumePropertyChange(CHANGE_CONSUMER),
  ]
  if (changes.some(Boolean))
    void loadData(true)
})
onPullDownRefresh(() => loadData(true))
onReachBottom(() => loadData())
</script>

<template>
  <view class="sl-page manage-page">
    <view class="toolbar sl-card">
      <view class="search-row">
        <input v-model="keyword" class="search-input" placeholder="搜索楼盘名称" confirm-type="search" @confirm="loadData(true)">
        <wd-button size="small" type="primary" @click="loadData(true)">
          搜索
        </wd-button>
      </view>
      <view class="chip-row">
        <view
          v-for="item in typeOptions"
          :key="String(item.value)"
          class="chip"
          :class="{ active: activeType === item.value }"
          @tap="activeType = item.value; loadData(true)"
        >
          {{ item.label }}
        </view>
        <picker mode="selector" :value="filterRegionIndex" :range="regionNames" @change="onFilterRegionChange">
          <view class="chip chip--picker">
            {{ regionNames[filterRegionIndex] || '全部区域' }}
          </view>
        </picker>
      </view>
    </view>

    <view class="sl-section-head">
      <text class="sl-section-title">楼盘列表</text>
      <text class="sl-section-extra">{{ showing }}/{{ total }}</text>
    </view>

    <view v-if="!list.length && !loading" class="empty sl-card">
      <wd-icon name="home" size="38px" color="#8ea099" />
      <text>暂无楼盘数据</text>
    </view>

    <view class="community-list">
      <view v-for="item in list" :key="String(item.id)" class="community-card sl-card">
        <view class="community-card__main">
          <view v-if="hasVideoCover(item)" class="card-cover card-cover--video card-cover--tap" @tap.stop="previewCommunityCover(item)">
            <image v-if="coverUrl(item)" class="card-cover__poster" :src="coverUrl(item)" mode="aspectFill" />
            <view class="card-cover__overlay">
              <wd-icon name="play-circle" size="26px" color="#fff" />
              <text>视频</text>
            </view>
          </view>
          <image v-else-if="coverUrl(item)" class="card-cover card-cover--tap" :src="coverUrl(item)" mode="aspectFill" @tap.stop="previewCommunityCover(item)" />
          <view class="card-content">
            <view class="card-head">
              <view>
                <view class="title-line">
                  <text class="card-title">{{ item.name }}</text>
                  <wd-tag :type="item.status === 0 ? 'success' : 'default'" plain>
                    {{ statusLabel(item.status) }}
                  </wd-tag>
                </view>
                <text class="card-sub">{{ regionName(item.regionId) }} · {{ typeLabel(item.type) }}</text>
              </view>
              <view class="metric">
                <text>{{ item.propertyCount || 0 }}</text>
                <text>房源</text>
              </view>
            </view>
            <text class="address">{{ item.address || '未维护详细地址' }}</text>
            <view class="meta-row">
              <text>{{ item.buildingCount || 0 }} 栋</text>
              <text>排序 {{ item.orderNo }}</text>
              <text v-if="item.lng && item.lat">坐标已维护</text>
              <text v-else>缺少坐标</text>
            </view>
            <view class="actions">
              <wd-button size="small" plain @click="goBuildings(item)">
                楼栋
              </wd-button>
              <wd-button size="small" type="primary" plain @click="openEdit(item)">
                编辑
              </wd-button>
              <wd-button size="small" type="danger" plain @click="confirmDelete(item)">
                删除
              </wd-button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="loading" class="load-tip">
      加载中...
    </view>
    <view v-else-if="finished && list.length" class="load-tip">
      已经到底了
    </view>

    <view class="fab" @tap="openAdd">
      <wd-icon name="add" size="26px" color="#fff" />
    </view>

    <wd-popup v-model="formVisible" position="bottom" custom-style="border-radius: 30rpx 30rpx 0 0; overflow: hidden;" safe-area-inset-bottom @touchmove.stop.prevent>
      <view class="form-sheet" @touchmove.stop.prevent>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ isEdit ? '编辑楼盘' : '新增楼盘' }}</text>
            <text class="sheet-sub">坐标会用于地图展示和附近排序</text>
          </view>
          <wd-icon name="close" size="22px" color="#72817b" @click="formVisible = false" />
        </view>

        <scroll-view scroll-y class="form-body" :show-scrollbar="false">
          <view class="form-row">
            <text>楼盘名称</text>
            <input v-model="form.name" placeholder="如：西田八巷8">
          </view>
          <view class="form-row">
            <text>楼盘类型</text>
            <view class="segmented">
              <view :class="{ active: form.type === 1 }" @tap="form.type = 1">
                小区
              </view>
              <view :class="{ active: form.type === 2 }" @tap="form.type = 2">
                公寓
              </view>
            </view>
          </view>
          <picker mode="selector" :value="formRegionIndex" :range="formRegionNames" @change="onFormRegionChange">
            <view class="form-row form-row--picker">
              <text>所属区域</text>
              <text>{{ form.regionId ? regionName(form.regionId) : '请选择' }}</text>
            </view>
          </picker>
          <view class="owner-assignment" @tap="openOwnerPicker">
            <view class="owner-assignment__icon">
              <wd-icon name="user" size="22px" color="#126b4f" />
            </view>
            <view class="owner-assignment__content">
              <view class="owner-assignment__label">
                <text>盘源对接人</text><text class="required-mark">*</text>
              </view>
              <text class="owner-assignment__value" :class="{ 'owner-assignment__value--empty': !form.ownerId }">{{ form.ownerName || '请选择' }}</text>
            </view>
            <wd-icon name="arrow-right" size="18px" color="#72817b" />
          </view>
          <view class="form-row">
            <text>详细地址</text>
            <input v-model="form.address" placeholder="街道门牌、楼盘位置">
          </view>
          <view class="location-picker">
            <view class="location-picker__info" @tap="chooseLocation">
              <wd-icon name="location" size="22px" color="#126b4f" />
              <view>
                <text>地图位置</text>
                <text>{{ formLocationLabel }}</text>
              </view>
            </view>
            <wd-button size="small" type="primary" plain @click="chooseLocation">
              定位选点
            </wd-button>
          </view>
          <view class="form-row form-row--images">
            <view class="image-head">
              <text>楼盘媒体</text>
              <text>{{ form.media.length }} 个</text>
            </view>
            <view class="image-grid">
              <view v-for="(media, index) in form.media" :key="`${media.id}-${index}`" class="image-item" :class="{ 'image-item--video': media.kind === 'video' }">
                <view
                  class="media-preview-hit"
                  :class="{ 'media-preview-hit--with-action': !isCoverMedia(media) }"
                  @tap.stop="handleMediaTap(index)"
                  @longpress.stop="openMediaActionMenu(index)"
                >
                  <image v-if="media.kind === 'image'" :src="media.url" mode="aspectFill" />
                  <view v-else class="video-tile">
                    <image v-if="media.posterUrl" class="video-tile__poster" :src="media.posterUrl" mode="aspectFill" />
                    <video
                      v-else-if="isLocalMediaUrl(media.url)"
                      class="video-tile__poster video-tile__local-preview"
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
                    <view class="video-tile__overlay">
                      <wd-icon name="play-circle" size="32px" color="#fff" />
                      <text>{{ media.fileName || '视频' }}</text>
                    </view>
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
              <view class="image-add" @tap="chooseMedia">
                <wd-icon name="add" size="24px" color="#126b4f" />
                <text>{{ uploading ? '上传中' : '上传媒体' }}</text>
              </view>
            </view>
          </view>
          <view class="coord-grid">
            <view class="form-row">
              <text>排序</text>
              <input v-model="form.orderNo" type="number">
            </view>
            <view class="form-row">
              <text>状态</text>
              <view class="segmented">
                <view
                  v-for="item in statusOptions"
                  :key="item.value"
                  :class="{ active: form.status === item.value }"
                  @tap="form.status = item.value"
                >
                  {{ item.label }}
                </view>
              </view>
            </view>
          </view>
          <view class="form-row form-row--textarea">
            <text>备注</text>
            <textarea v-model="form.remark" placeholder="内部管理备注" />
          </view>
        </scroll-view>

        <view class="sheet-actions">
          <wd-button plain block type="default" @click="formVisible = false">
            取消
          </wd-button>
          <wd-button block type="primary" :loading="submitting" @click="submitForm">
            保存
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <wd-popup v-model="ownerPickerVisible" position="bottom" :z-index="2400" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden;" safe-area-inset-bottom @touchmove.stop.prevent>
      <view class="owner-picker" @touchmove.stop.prevent>
        <view class="sheet-head">
          <view><text class="sheet-title">分配盘源对接人</text><text class="sheet-sub">一个楼盘同时只归属一位对接人</text></view>
          <wd-icon name="close" size="22px" color="#72817b" @click="ownerPickerVisible = false" />
        </view>
        <view class="owner-picker__search">
          <input v-model="ownerKeyword" placeholder="搜索昵称" confirm-type="search" @confirm="loadOwnerOptions">
          <wd-button size="small" type="primary" :loading="ownerLoading" @click="loadOwnerOptions">
            搜索
          </wd-button>
        </view>
        <scroll-view scroll-y class="owner-picker__list">
          <view v-for="owner in ownerItems" :key="String(owner.userId)" class="owner-option" :class="{ selected: sameId(form.ownerId, owner.userId) }" @tap="selectOwner(owner)">
            <view class="owner-option__avatar">
              <wd-icon name="user" size="22px" color="#126b4f" />
            </view>
            <view class="owner-option__body">
              <text>{{ owner.nickName || '未设置昵称' }}</text><text>名下 {{ owner.communityCount }} 个楼盘</text>
            </view>
            <wd-icon v-if="sameId(form.ownerId, owner.userId)" name="check" size="20px" color="#126b4f" />
          </view>
          <view v-if="!ownerItems.length && !ownerLoading" class="owner-picker__empty">
            暂无匹配的盘源对接人
          </view>
        </scroll-view>
      </view>
    </wd-popup>

    <wd-popup v-model="videoPreviewVisible" custom-style="border-radius: 24rpx; overflow: hidden; width: 680rpx;" @touchmove.stop.prevent>
      <view class="video-preview" @touchmove.stop.prevent>
        <view class="video-preview__head">
          <text class="video-preview__title">{{ previewVideo?.fileName || '视频预览' }}</text>
          <view class="video-preview__actions">
            <wd-button size="small" plain icon="download" @click.stop="savePreviewVideo">
              保存
            </wd-button>
            <wd-icon name="close" size="20px" color="#72817b" @click.stop="previewVideo = null" />
          </view>
        </view>
        <video v-if="previewVideo" class="video-preview__player" :src="previewVideo.url" controls autoplay @longpress.stop="openSavePreviewMenu" />
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.manage-page {
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}

.toolbar {
  margin-top: 22rpx;
  padding: 22rpx;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.search-input {
  flex: 1;
  height: 72rpx;
  box-sizing: border-box;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #f2f6f0;
  font-size: 26rpx;
}

.chip-row,
.meta-row,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip-row {
  margin-top: 18rpx;
}

.chip {
  padding: 12rpx 22rpx;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 999rpx;
  background: #f7faf4;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.chip.active,
.chip--picker {
  background: var(--sl-brand);
  color: #fff;
}

.community-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.community-card {
  padding: 24rpx;
}

.community-card__main {
  display: flex;
  gap: 18rpx;
}

.card-cover {
  width: 154rpx;
  height: 154rpx;
  flex: 0 0 154rpx;
  border-radius: 20rpx;
  background: #eef4ed;
}

.card-cover--tap:active {
  opacity: 0.86;
  transform: scale(0.98);
}

.card-cover--video {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: linear-gradient(135deg, #0f6a4c, #163b32);
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
}

.card-cover__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background: transparent;
}

.card-cover__poster,
.video-tile__poster {
  width: 100%;
  height: 100%;
}

.video-tile__local-preview {
  pointer-events: none;
}

.card-content {
  min-width: 0;
  flex: 1;
}

.card-head,
.title-line,
.image-head,
.sheet-head,
.sheet-actions {
  display: flex;
  align-items: center;
}

.card-head,
.image-head,
.sheet-head {
  justify-content: space-between;
  gap: 18rpx;
}

.title-line {
  gap: 10rpx;
}

.card-title,
.sheet-title {
  font-size: 32rpx;
  font-weight: 850;
}

.card-sub,
.address,
.sheet-sub,
.load-tip {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.card-sub,
.address {
  display: block;
  margin-top: 10rpx;
}

.metric {
  min-width: 92rpx;
  text-align: right;
}

.metric text:first-child {
  display: block;
  color: var(--sl-brand);
  font-size: 36rpx;
  font-weight: 900;
}

.metric text:last-child {
  color: var(--sl-muted);
  font-size: 22rpx;
}

.meta-row {
  margin-top: 16rpx;
}

.meta-row text {
  padding: 7rpx 14rpx;
  border-radius: 999rpx;
  background: #f2f6f0;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.actions {
  margin-top: 20rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  padding: 70rpx 20rpx;
  color: var(--sl-muted);
}

.load-tip {
  padding: 26rpx 0;
  text-align: center;
}

.fab {
  position: fixed;
  right: 34rpx;
  bottom: calc(92rpx + env(safe-area-inset-bottom));
  z-index: 8;
  display: flex;
  width: 96rpx;
  height: 96rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: linear-gradient(135deg, var(--sl-brand), #24815f);
  box-shadow: 0 18rpx 38rpx rgb(18 107 79 / 28%);
}

.form-sheet {
  display: flex;
  height: 86vh;
  max-height: 86vh;
  box-sizing: border-box;
  flex-direction: column;
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.sheet-sub {
  display: block;
  margin-top: 8rpx;
}

.form-body {
  height: 0;
  min-height: 0;
  flex: 1;
  margin-top: 22rpx;
}

.form-row {
  margin-bottom: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: #f6f9f4;
}

.form-row text:first-child {
  display: block;
  margin-bottom: 10rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.form-row input,
.form-row textarea {
  width: 100%;
  color: var(--sl-ink);
  font-size: 28rpx;
}

.form-row textarea {
  min-height: 120rpx;
}

.owner-assignment {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 18rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid rgb(18 107 79 / 14%);
  border-radius: 8rpx;
  background: #f4faf6;
}

.owner-assignment__icon,
.owner-option__avatar {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e4f1e9;
}

.owner-assignment__content {
  min-width: 0;
}

.owner-assignment__label {
  display: flex;
  align-items: center;
  gap: 6rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.required-mark {
  color: var(--sl-danger, #c94832);
  font-weight: 800;
}

.owner-assignment__value {
  display: block;
  margin-top: 5rpx;
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 27rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.owner-assignment__value--empty {
  color: var(--sl-danger, #c94832);
}

.owner-picker {
  padding: 26rpx 28rpx calc(26rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.owner-picker__search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12rpx;
  margin-top: 20rpx;
}

.owner-picker__search input {
  height: 68rpx;
  box-sizing: border-box;
  padding: 0 18rpx;
  border: 1rpx solid rgb(18 107 79 / 14%);
  border-radius: 8rpx;
  background: #f6f9f4;
  font-size: 25rpx;
}

.owner-picker__list {
  height: min(58vh, 760rpx);
  margin-top: 18rpx;
}

.owner-option {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  padding: 18rpx 14rpx;
  border-bottom: 1rpx solid #edf1ec;
}

.owner-option.selected {
  background: #f0f8f3;
}

.owner-option__body text {
  display: block;
}

.owner-option__body text:first-child {
  color: var(--sl-ink);
  font-size: 26rpx;
  font-weight: 800;
}

.owner-option__body text:last-child {
  margin-top: 5rpx;
  color: var(--sl-muted);
  font-size: 21rpx;
}

.owner-picker__empty {
  padding: 70rpx 20rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}

.form-row--images {
  background: #fffaf0;
}

.image-head {
  margin-bottom: 14rpx;
}

.image-head text:first-child {
  margin-bottom: 0;
}

.image-head text:last-child {
  color: var(--sl-muted);
  font-size: 22rpx;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
}

.image-item,
.image-add {
  position: relative;
  height: 178rpx;
  overflow: hidden;
  border-radius: 18rpx;
  background: #f3f7f1;
}

.image-item image {
  width: 100%;
  height: 100%;
}

.media-preview-hit {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
}

.media-preview-hit--with-action {
  bottom: 56rpx;
}

.image-item--video {
  background: linear-gradient(135deg, #173f34, #0f6a4c);
}

.video-tile {
  position: relative;
  display: flex;
  height: 100%;
  box-sizing: border-box;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 10rpx;
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
  -webkit-line-clamp: 1;
}

.cover-badge {
  position: absolute;
  z-index: 6;
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
  z-index: 7;
  top: 2rpx;
  right: 2rpx;
  display: flex;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(15 35 28 / 66%);
}

.image-cover-action {
  position: absolute;
  z-index: 5;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  height: 56rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
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

.video-preview {
  background: #fff;
}

.video-preview__head {
  position: relative;
  display: flex;
  min-height: 88rpx;
  box-sizing: border-box;
  align-items: center;
  padding: 20rpx 224rpx 20rpx 24rpx;
  color: var(--sl-ink);
  font-size: 28rpx;
  font-weight: 900;
}

.video-preview__title {
  display: block;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-preview__actions {
  position: absolute;
  z-index: 2;
  top: 50%;
  right: 20rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
  transform: translateY(-50%);
}

.video-preview__player {
  display: block;
  width: 680rpx;
  height: 420rpx;
  background: #10261f;
}

.form-row--picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-row--picker text:first-child {
  margin-bottom: 0;
}

.form-row--picker text:last-child {
  max-width: 440rpx;
  overflow: hidden;
  color: var(--sl-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.coord-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.location-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 18rpx;
  padding: 18rpx 20rpx;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 20rpx;
  background: #f6fbf7;
}

.location-picker__info {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 14rpx;
}

.location-picker__info text {
  display: block;
}

.location-picker__info text:first-child {
  color: var(--sl-muted);
  font-size: 23rpx;
}

.location-picker__info text:last-child {
  max-width: 420rpx;
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 27rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.segmented {
  display: inline-flex;
  overflow: hidden;
  border-radius: 999rpx;
  background: #eaf2e8;
}

.segmented view {
  padding: 12rpx 24rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.segmented .active {
  background: var(--sl-brand);
  color: #fff;
}

.sheet-actions {
  flex: 0 0 auto;
  gap: 16rpx;
  margin-top: 24rpx;
}
</style>
