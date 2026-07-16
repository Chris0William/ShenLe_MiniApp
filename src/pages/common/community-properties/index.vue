<script setup lang="ts">
import type { PageSlPropertyInput, ShenLeId, SlCommunityOutput, SlPropertyListOutput } from '@/types/shenle'
import type { MediaKind } from '@/utils/media'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { getCommunityDetail } from '@/api/community'
import { downloadFile } from '@/api/file'
import { deleteProperty, getPropertyBatchList, getPropertyDetail, getPropertyPage, updatePropertyStatus } from '@/api/property'
import SlPropertyBatch from '@/components/sl-property-batch/sl-property-batch.vue'
import SlSupplyContacts from '@/components/sl-supply-contacts/sl-supply-contacts.vue'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { useShenleAuthStore } from '@/store/auth'
import { useEntityChangeStore } from '@/store/entity-change'
import { modeStore } from '@/store/mode'
import { ensureCanUse } from '@/utils/auth-guard'
import { mediaKindOf } from '@/utils/media'
import { filterPropertyRows } from '@/utils/property-batch'
import { canManagePropertyWrites } from '@/utils/property-management'
import { idToQuery, resolveAssetUrl } from '@/utils/shenle'
import { saveVideoToAlbum, showVideoSaveActionSheet } from '@/utils/video-save'

definePage({
  style: {
    navigationBarTitleText: '楼盘房源',
    disableScroll: true,
  },
})

const communityId = ref<ShenLeId>('')
const communityName = ref('')
const buildingId = ref<ShenLeId>('')
const buildingName = ref('')
const buildingTotalFloors = ref<number | null>(null)
const keyword = ref('')
const status = ref<number | undefined>()
const minFloor = ref<number | undefined>()
const maxFloor = ref<number | undefined>()
const roomNoSuffix = ref('')
const bedrooms = ref<number | undefined>()
const livingRooms = ref<number | undefined>()
const bathrooms = ref<number | undefined>()
const activeFilter = ref<'floor' | 'room' | 'layout' | null>(null)
const floorDraft = reactive({ min: '', max: '' })
const roomDraft = ref('')
const layoutDraft = reactive<{ bedrooms?: number, livingRooms?: number, bathrooms?: number }>({})
const layoutNumbers = [undefined, 0, 1, 2, 3, 4, 5] as const
const layoutFields = [
  { key: 'bedrooms', label: '室' },
  { key: 'livingRooms', label: '厅' },
  { key: 'bathrooms', label: '卫' },
] as const
const page = ref(1)
const pageSize = 10
const total = ref(0)
const items = ref<SlPropertyListOutput[]>([])
const communityDetail = ref<SlCommunityOutput | null>(null)
const loading = ref(false)
const hasLoaded = ref(false)
const refresherTriggered = ref(false)
const batchOverlayVisible = ref(false)
const auth = useShenleAuthStore()
const changeStore = useEntityChangeStore()
const selectionMode = ref(false)
const selectedIds = ref<ShenLeId[]>([])
const selectingAll = ref(false)
const allFilteredSelected = ref(false)
const batchRef = ref<{
  openAdd: () => void
  openEdit: () => void
  requestDelete: () => void
} | null>(null)
const finished = computed(() => total.value > 0 && items.value.length >= total.value)
const canManage = computed(() => canManagePropertyWrites({
  isAdmin: auth.isAdmin,
  isLandlord: auth.isLandlord,
  mode: modeStore.mode,
}))
const canManageBuildingScope = computed(() => canManage.value && !!buildingId.value)
const canBatchManage = computed(() => auth.isAdmin && modeStore.mode === 'admin' && !!buildingId.value)
const CHANGE_CONSUMER = 'community-properties'
const floorFilterLabel = computed(() => {
  if (minFloor.value == null && maxFloor.value == null)
    return '楼层'
  return `${minFloor.value ?? '不限'}-${maxFloor.value ?? '不限'}层`
})
const roomFilterLabel = computed(() => roomNoSuffix.value ? `房号 · ${roomNoSuffix.value}` : '房号')
const layoutFilterLabel = computed(() => {
  if (bedrooms.value == null && livingRooms.value == null && bathrooms.value == null)
    return '户型'
  return `${bedrooms.value ?? '-'},${livingRooms.value ?? '-'},${bathrooms.value ?? '-'}`
})
const hasActiveListFilter = computed(() => !!keyword.value.trim()
  || status.value != null
  || minFloor.value != null
  || maxFloor.value != null
  || !!roomNoSuffix.value
  || bedrooms.value != null
  || livingRooms.value != null
  || bathrooms.value != null)

function buildQuery(): PageSlPropertyInput {
  return {
    page: page.value,
    pageSize,
    communityId: communityId.value || undefined,
    buildingId: buildingId.value || undefined,
    title: keyword.value.trim() || undefined,
    status: status.value,
    minFloor: minFloor.value,
    maxFloor: maxFloor.value,
    roomNoSuffix: roomNoSuffix.value.trim() || undefined,
    bedrooms: bedrooms.value,
    livingRooms: livingRooms.value,
    bathrooms: bathrooms.value,
  }
}

function currentRowFilter() {
  return {
    keyword: keyword.value,
    status: status.value,
    minFloor: minFloor.value,
    maxFloor: maxFloor.value,
    roomNoSuffix: roomNoSuffix.value,
    bedrooms: bedrooms.value,
    livingRooms: livingRooms.value,
    bathrooms: bathrooms.value,
  }
}

function resetSelectionForFilterChange() {
  selectedIds.value = []
  allFilteredSelected.value = false
}

function toggleFilter(name: 'floor' | 'room' | 'layout') {
  activeFilter.value = activeFilter.value === name ? null : name
  if (name === 'floor') {
    floorDraft.min = minFloor.value == null ? '' : String(minFloor.value)
    floorDraft.max = maxFloor.value == null ? '' : String(maxFloor.value)
  }
  else if (name === 'room') {
    roomDraft.value = roomNoSuffix.value
  }
  else {
    layoutDraft.bedrooms = bedrooms.value
    layoutDraft.livingRooms = livingRooms.value
    layoutDraft.bathrooms = bathrooms.value
  }
}

function optionalFloor(value: string) {
  if (!value.trim())
    return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error('楼层必须是大于 0 的整数')
  return parsed
}

function applyFloorFilter() {
  try {
    const min = optionalFloor(floorDraft.min)
    const max = optionalFloor(floorDraft.max)
    if (min != null && max != null && min > max)
      throw new Error('起始楼层不能大于结束楼层')
    minFloor.value = min
    maxFloor.value = max
    activeFilter.value = null
    resetSelectionForFilterChange()
    void load(true)
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '楼层范围无效', icon: 'none' })
  }
}

function applyRoomFilter() {
  roomNoSuffix.value = roomDraft.value.trim()
  activeFilter.value = null
  resetSelectionForFilterChange()
  void load(true)
}

function applyLayoutFilter() {
  bedrooms.value = layoutDraft.bedrooms
  livingRooms.value = layoutDraft.livingRooms
  bathrooms.value = layoutDraft.bathrooms
  activeFilter.value = null
  resetSelectionForFilterChange()
  void load(true)
}

function clearFloorFilter() {
  floorDraft.min = ''
  floorDraft.max = ''
}

function clearLayoutFilter() {
  layoutDraft.bedrooms = undefined
  layoutDraft.livingRooms = undefined
  layoutDraft.bathrooms = undefined
}

async function load(reset = false) {
  if (!communityId.value || loading.value)
    return
  // 用户模式：仅展示可租房源（status 0 空置 / 1 预定）。
  // 后端 status 是单值无法一次传 0+1，循环拉全量后客户端过滤、扁平只读、不分页。
  if (!canManage.value)
    return loadAvailableForUser()
  if (reset) {
    page.value = 1
    items.value = []
    total.value = 0
  }
  loading.value = true
  try {
    const result = await getPropertyPage(buildQuery())
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
    hasLoaded.value = true
  }
  finally {
    loading.value = false
  }
}

async function loadAvailableForUser() {
  if (loading.value)
    return
  loading.value = true
  try {
    const all: SlPropertyListOutput[] = []
    let pageNo = 1
    let totalCount = Number.POSITIVE_INFINITY
    while (all.length < totalCount) {
      const result = await getPropertyPage({
        page: pageNo,
        pageSize: 100,
        communityId: communityId.value || undefined,
        buildingId: buildingId.value || undefined,
        title: keyword.value.trim() || undefined,
      })
      all.push(...result.items)
      totalCount = result.total
      if (!result.items.length)
        break
      pageNo += 1
    }
    items.value = all.filter(item => item.status === 0 || item.status === 1) // 0=空置 1=预定
    total.value = items.value.length
    hasLoaded.value = true
  }
  finally {
    loading.value = false
  }
}

async function reloadLoadedRangePreservingScroll() {
  if (!communityId.value || loading.value)
    return
  const loadedPages = Math.max(1, page.value)
  loading.value = true
  try {
    const responses = []
    for (let pageNo = 1; pageNo <= loadedPages; pageNo++) {
      responses.push(await getPropertyPage({
        ...buildQuery(),
        page: pageNo,
      }))
    }
    items.value = responses.flatMap(result => result.items)
    total.value = responses[0]?.total || 0
    page.value = loadedPages
    hasLoaded.value = true
  }
  finally {
    loading.value = false
  }
}

async function patchBatchUpdatedItems(ids: readonly ShenLeId[]) {
  const details = await Promise.all(ids.map(id => getPropertyDetail(id)))
  const detailById = new Map(details.map(detail => [String(detail.id), detail]))
  items.value = items.value.map(item => detailById.get(String(item.id)) || item)
}

function selectStatus(value?: number) {
  status.value = value
  resetSelectionForFilterChange()
  load(true)
}

function onSearch() {
  // 搜索需登录（管理端不拦）
  if (!canManage.value && !ensureCanUse('登录后即可搜索房源'))
    return
  resetSelectionForFilterChange()
  load(true)
}

// ===== 楼盘媒体横滑栏 =====
interface CommunityMediaItem {
  id: ShenLeId
  name: string
  kind: MediaKind
  url: string
}

const mediaList = ref<CommunityMediaItem[]>([])
const previewVideoMedia = ref<CommunityMediaItem | null>(null)
const videoPreviewVisible = computed({
  get: () => !!previewVideoMedia.value,
  set: (visible: boolean) => {
    if (!visible)
      previewVideoMedia.value = null
  },
})
const refreshEnabled = computed(() => !batchOverlayVisible.value && !videoPreviewVisible.value)

async function handleRefresh() {
  if (!refreshEnabled.value || refresherTriggered.value)
    return
  refresherTriggered.value = true
  try {
    await Promise.all([load(true), loadMedia()])
  }
  catch {
    uni.showToast({ title: '刷新失败，请重试', icon: 'none' })
  }
  finally {
    refresherTriggered.value = false
  }
}

function handleScrollToLower() {
  // 用户模式一次性全量加载，不分页。
  if (!canManage.value || loading.value || finished.value)
    return
  page.value += 1
  void load()
}

function handleBatchVisibilityChange(visible: boolean) {
  batchOverlayVisible.value = visible
  if (visible)
    refresherTriggered.value = false
}

async function loadMedia() {
  if (!communityId.value)
    return
  try {
    const detail = await getCommunityDetail(communityId.value)
    communityDetail.value = detail
    const list: CommunityMediaItem[] = (detail.images || []).map(media => ({
      id: media.id,
      name: media.fileName || `文件${media.id}`,
      kind: mediaKindOf(media.fileType, media.suffix || media.url),
      url: resolveAssetUrl(media.url),
    }))
    // 部分导入批次媒体池绑定缺失：媒体池为空但有封面时至少展示封面
    if (!list.length && detail.coverImageId && detail.coverImage) {
      list.push({
        id: detail.coverImageId,
        name: detail.name || '封面',
        kind: mediaKindOf(detail.coverFileType, detail.coverSuffix || detail.coverImage),
        url: resolveAssetUrl(detail.coverImage),
      })
    }
    mediaList.value = list
    // 私有图需鉴权下载后才能显示缩略图，逐个替换为本地路径
    for (const item of list) {
      if (item.kind === 'image')
        downloadFile(item.id).then((path) => { item.url = path }).catch(() => {})
    }
  }
  catch {
    communityDetail.value = null
    mediaList.value = []
  }
}

function openMedia(media: CommunityMediaItem) {
  if (media.kind === 'video') {
    previewVideoMedia.value = media
    return
  }
  const images = mediaList.value.filter(item => item.kind === 'image')
  uni.previewImage({
    current: media.url,
    urls: images.map(item => item.url),
  })
}

function savePreviewVideo() {
  if (!previewVideoMedia.value)
    return
  void saveVideoToAlbum({ fileId: previewVideoMedia.value.id, url: previewVideoMedia.value.url })
}

function openSavePreviewMenu() {
  if (!previewVideoMedia.value)
    return
  void showVideoSaveActionSheet({ fileId: previewVideoMedia.value.id, url: previewVideoMedia.value.url })
}

function openDetail(item: SlPropertyListOutput) {
  // 详情需登录（管理端不拦）
  if (!canManage.value && !ensureCanUse('登录后即可查看房源详情'))
    return
  uni.navigateTo({ url: `/pages/common/property-detail/index?id=${idToQuery(item.id)}` })
}

function isSelected(id: ShenLeId) {
  return selectedIds.value.some(item => String(item) === String(id))
}

function toggleSelected(item: SlPropertyListOutput) {
  allFilteredSelected.value = false
  const index = selectedIds.value.findIndex(id => String(id) === String(item.id))
  if (index >= 0)
    selectedIds.value.splice(index, 1)
  else
    selectedIds.value.push(item.id)
}

async function toggleSelectAllFiltered() {
  if (selectingAll.value)
    return
  if (allFilteredSelected.value) {
    selectedIds.value = []
    allFilteredSelected.value = false
    return
  }

  selectingAll.value = true
  try {
    const snapshots = await getPropertyBatchList(buildingId.value)
    const matched = filterPropertyRows(snapshots, currentRowFilter())
    selectedIds.value = matched.map(item => item.id)
    allFilteredSelected.value = matched.length > 0
    if (!matched.length)
      uni.showToast({ title: '当前筛选没有可选房源', icon: 'none' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '全选失败，请重试', icon: 'none' })
  }
  finally {
    selectingAll.value = false
  }
}

function handlePropertySelect(item: SlPropertyListOutput) {
  if (selectionMode.value) {
    toggleSelected(item)
    return
  }
  openDetail(item)
}

function openForm(item?: SlPropertyListOutput) {
  if (item) {
    uni.navigateTo({ url: `/pages/common/property-form/index?id=${idToQuery(item.id)}` })
    return
  }
  if (!canManageBuildingScope.value) {
    uni.showToast({ title: '请先进入具体楼栋', icon: 'none' })
    return
  }
  const query = [
    `communityId=${idToQuery(communityId.value)}`,
    `communityName=${encodeURIComponent(communityName.value)}`,
    `buildingId=${idToQuery(buildingId.value)}`,
    `buildingName=${encodeURIComponent(buildingName.value)}`,
    `buildingTotalFloors=${encodeURIComponent(String(buildingTotalFloors.value ?? ''))}`,
  ].join('&')
  uni.navigateTo({ url: `/pages/common/property-form/index?${query}` })
}

function openBatchManager() {
  if (!canBatchManage.value) {
    uni.showToast({ title: '请先进入具体楼栋', icon: 'none' })
    return
  }
  selectionMode.value = true
  selectedIds.value = []
  allFilteredSelected.value = false
}

function exitBatchManager() {
  selectionMode.value = false
  selectedIds.value = []
  allFilteredSelected.value = false
}

function openBatchAdd() {
  if (!canBatchManage.value)
    return
  batchRef.value?.openAdd()
}

function openBatchEdit() {
  if (!selectedIds.value.length)
    return
  batchRef.value?.openEdit()
}

function openBatchDelete() {
  if (!selectedIds.value.length)
    return
  batchRef.value?.requestDelete()
}

interface BatchCompletedEvent {
  action: 'added' | 'updated' | 'deleted'
  ids: ShenLeId[]
  affectedCount: number
  totalFloors?: number | null
}

async function handleBatchCompleted(event: BatchCompletedEvent) {
  if (event.totalFloors !== undefined)
    buildingTotalFloors.value = event.totalFloors

  changeStore.publishPropertyChange({
    action: event.action === 'updated' ? 'updated' : 'structural',
    ids: event.ids,
    communityId: communityId.value,
    buildingId: buildingId.value,
  })
  changeStore.consumePropertyChange(CHANGE_CONSUMER)

  if (event.action === 'deleted') {
    const deleted = new Set(event.ids.map(id => String(id)))
    items.value = items.value.filter(item => !deleted.has(String(item.id)))
    total.value = Math.max(0, total.value - event.affectedCount)
  }
  else if (event.action === 'updated') {
    await reloadLoadedRangePreservingScroll()
  }
  else {
    await reloadLoadedRangePreservingScroll()
  }
  exitBatchManager()
}

async function changeStatus(item: SlPropertyListOutput, nextStatus: number) {
  if (item.status === nextStatus)
    return
  await updatePropertyStatus({ id: item.id, status: nextStatus })
  item.status = nextStatus
  changeStore.publishPropertyChange({
    action: 'status-changed',
    ids: [item.id],
    communityId: communityId.value,
    buildingId: buildingId.value,
  })
  changeStore.consumePropertyChange(CHANGE_CONSUMER)
  uni.showToast({ title: '状态已更新', icon: 'success' })
}

function removeItem(item: SlPropertyListOutput) {
  uni.showModal({
    title: '删除房源',
    content: `确定删除「${item.title}」？`,
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      await deleteProperty({ id: item.id })
      items.value = items.value.filter(current => String(current.id) !== String(item.id))
      total.value = Math.max(0, total.value - 1)
      changeStore.publishPropertyChange({
        action: 'deleted',
        ids: [item.id],
        communityId: communityId.value,
        buildingId: buildingId.value,
      })
      changeStore.consumePropertyChange(CHANGE_CONSUMER)
      uni.showToast({ title: '删除成功', icon: 'success' })
    },
  })
}

function backToMap() {
  const pages = getCurrentPages()
  if (pages.length > 1)
    uni.navigateBack()
  else
    uni.switchTab({ url: '/pages/user/map/index' })
}

onLoad((query) => {
  if (!canManage.value && !auth.canViewRealData) {
    ensureCanUse('登录并通过审核后可查看具体楼盘与房源')
    setTimeout(() => uni.switchTab({ url: '/pages/user/map/index' }), 300)
    return
  }
  communityId.value = String(query?.communityId || '')
  communityName.value = decodeURIComponent(String(query?.communityName || ''))
  buildingId.value = String(query?.buildingId || '')
  buildingName.value = decodeURIComponent(String(query?.buildingName || ''))
  const totalFloors = Number(query?.buildingTotalFloors)
  buildingTotalFloors.value = Number.isFinite(totalFloors) && totalFloors > 0 ? totalFloors : null
  if (communityName.value || buildingName.value)
    uni.setNavigationBarTitle({ title: buildingName.value || communityName.value })
  load(true)
  loadMedia()
})
onShow(async () => {
  const change = changeStore.consumePropertyChange(CHANGE_CONSUMER)
  if (!change || !hasLoaded.value)
    return
  const sameCommunity = !change.payload.communityId || String(change.payload.communityId) === String(communityId.value)
  const sameBuilding = !buildingId.value || !change.payload.buildingId || String(change.payload.buildingId) === String(buildingId.value)
  if (!sameCommunity || !sameBuilding)
    return
  try {
    if (!hasActiveListFilter.value && !change.requiresReload && (change.payload.action === 'updated' || change.payload.action === 'status-changed'))
      await patchBatchUpdatedItems(change.payload.ids)
    else
      await reloadLoadedRangePreservingScroll()
    await loadMedia()
  }
  catch {
    uni.showToast({ title: '房源刷新失败，请下拉重试', icon: 'none' })
  }
})
</script>

<template>
  <view class="community-page-shell">
    <scroll-view
      scroll-y
      class="community-scroll"
      :refresher-enabled="refreshEnabled"
      :refresher-triggered="refresherTriggered"
      refresher-background="#f4f7f2"
      :lower-threshold="120"
      @refresherrefresh="handleRefresh"
      @scrolltolower="handleScrollToLower"
    >
      <view class="sl-page community-page">
        <scroll-view v-if="mediaList.length" scroll-x class="media-strip">
          <view class="media-strip__inner">
            <view v-for="media in mediaList" :key="String(media.id)" class="media-item" @tap="openMedia(media)">
              <image v-if="media.kind === 'image'" class="media-item__thumb" :src="media.url" mode="aspectFill" />
              <view v-else class="media-item__thumb media-item__thumb--video">
                <view class="media-item__play">
                  <wd-icon name="play-circle" size="26px" color="#fff" />
                </view>
              </view>
              <text class="media-item__name">{{ media.name }}</text>
            </view>
          </view>
        </scroll-view>

        <view v-if="communityDetail && (communityDetail.lastUpdaterName || communityDetail.ownerName)" class="supply-contacts-card">
          <sl-supply-contacts :community="communityDetail" />
        </view>

        <view class="search sl-card">
          <wd-icon name="search" size="20px" color="#7a8780" />
          <input v-model="keyword" class="search__input" placeholder="搜索房源 / 房号" confirm-type="search" @confirm="onSearch">
          <wd-button size="small" type="primary" @click="onSearch">
            搜索
          </wd-button>
        </view>

        <view v-if="canManageBuildingScope" class="property-filters sl-card">
          <view class="property-filters__tabs">
            <view class="filter-trigger" :class="{ active: activeFilter === 'floor' || minFloor != null || maxFloor != null }" @tap="toggleFilter('floor')">
              <text>{{ floorFilterLabel }}</text>
              <wd-icon name="arrow-down" size="14px" />
            </view>
            <view class="filter-trigger" :class="{ active: activeFilter === 'room' || !!roomNoSuffix }" @tap="toggleFilter('room')">
              <text>{{ roomFilterLabel }}</text>
              <wd-icon name="arrow-down" size="14px" />
            </view>
            <view class="filter-trigger" :class="{ active: activeFilter === 'layout' || bedrooms != null || livingRooms != null || bathrooms != null }" @tap="toggleFilter('layout')">
              <text>{{ layoutFilterLabel }}</text>
              <wd-icon name="arrow-down" size="14px" />
            </view>
          </view>

          <view v-if="activeFilter === 'floor'" class="filter-panel">
            <text class="filter-panel__title">楼层范围</text>
            <view class="range-inputs">
              <label><input v-model="floorDraft.min" type="number" placeholder="起始"><text>层</text></label>
              <text>至</text>
              <label><input v-model="floorDraft.max" type="number" placeholder="结束"><text>层</text></label>
            </view>
            <view class="filter-panel__actions">
              <wd-button size="small" plain @click="clearFloorFilter">
                重置
              </wd-button>
              <wd-button size="small" type="primary" @click="applyFloorFilter">
                确定
              </wd-button>
            </view>
          </view>

          <view v-else-if="activeFilter === 'room'" class="filter-panel">
            <text class="filter-panel__title">按房号结尾匹配</text>
            <view class="suffix-input">
              <input v-model="roomDraft" type="text" placeholder="例如 02 或 5003" confirm-type="search" @confirm="applyRoomFilter">
            </view>
            <text class="filter-panel__hint">输入 02 可匹配 502、602；输入 5003 可匹配 175003。</text>
            <view class="filter-panel__actions">
              <wd-button size="small" plain @click="roomDraft = ''">
                重置
              </wd-button>
              <wd-button size="small" type="primary" @click="applyRoomFilter">
                确定
              </wd-button>
            </view>
          </view>

          <view v-else-if="activeFilter === 'layout'" class="filter-panel">
            <text class="filter-panel__title">户型（室、厅、卫）</text>
            <view v-for="field in layoutFields" :key="field.key" class="layout-filter-row">
              <text>{{ field.label }}</text>
              <view class="layout-options">
                <view
                  v-for="number in layoutNumbers"
                  :key="`${field.key}-${String(number)}`"
                  class="layout-option"
                  :class="{ active: layoutDraft[field.key] === number }"
                  @tap="layoutDraft[field.key] = number"
                >
                  {{ number == null ? '不限' : number }}
                </view>
              </view>
            </view>
            <view class="filter-panel__actions">
              <wd-button size="small" plain @click="clearLayoutFilter">
                重置
              </wd-button>
              <wd-button size="small" type="primary" @click="applyLayoutFilter">
                确定
              </wd-button>
            </view>
          </view>
        </view>

        <scroll-view v-if="canManageBuildingScope" scroll-x class="chips">
          <view class="chips__inner">
            <view class="status-chip" :class="{ 'status-chip--active': status === undefined }" @tap="selectStatus(undefined)">
              全部
            </view>
            <view
              v-for="item in PROPERTY_STATUS_OPTIONS"
              :key="item.value"
              class="status-chip"
              :class="{ 'status-chip--active': status === item.value }"
              @tap="selectStatus(item.value)"
            >
              {{ item.label }}
            </view>
          </view>
        </scroll-view>

        <view class="result-head">
          <text class="result-head__title">{{ total }} 套{{ canManage ? '房源' : '可租房源' }}</text>
          <text class="result-head__desc">{{ canBatchManage ? `${buildingName} · 支持编辑与批量管理` : (canManageBuildingScope ? `${buildingName} · 支持编辑和状态管理` : '点击房源查看详情。') }}</text>
        </view>

        <view v-if="canManageBuildingScope" class="scope-actions">
          <wd-button v-if="canBatchManage" plain type="default" icon="add" @click="openBatchAdd">
            批量新增
          </wd-button>
          <wd-button v-if="canBatchManage" plain type="default" @click="openBatchManager">
            批量管理
          </wd-button>
          <wd-button type="primary" icon="add" @click="openForm()">
            新增房源
          </wd-button>
        </view>

        <view v-if="selectionMode" class="select-all-control batch-select-all-row" @tap="toggleSelectAllFiltered">
          <view class="selection-checkbox selection-checkbox--all" :class="{ selected: allFilteredSelected }">
            <wd-icon v-if="allFilteredSelected" name="check" size="14px" color="#fff" />
          </view>
          <text>{{ selectingAll ? '处理中...' : (allFilteredSelected ? '已全选筛选结果' : '全选筛选结果') }}</text>
        </view>

        <view class="list">
          <view v-for="item in items" :key="String(item.id)" class="property-wrap sl-card" :class="{ 'property-wrap--selected': isSelected(item.id) }">
            <view class="property-select-row">
              <view v-if="selectionMode" class="selection-checkbox" :class="{ selected: isSelected(item.id) }" @tap.stop="toggleSelected(item)">
                <wd-icon v-if="isSelected(item.id)" name="check" size="14px" color="#fff" />
              </view>
              <view class="property-card-main">
                <sl-property-card :item="item" compact @select="handlePropertySelect" />
              </view>
            </view>
            <view v-if="canManageBuildingScope && !selectionMode" class="row-actions">
              <wd-button size="small" type="default" plain @click="openForm(item)">
                编辑
              </wd-button>
              <wd-button
                v-for="option in PROPERTY_STATUS_OPTIONS"
                :key="option.value"
                size="small"
                :type="item.status === option.value ? 'primary' : 'default'"
                plain
                @click="changeStatus(item, option.value)"
              >
                {{ option.label }}
              </wd-button>
              <wd-button size="small" type="danger" plain @click="removeItem(item)">
                删除
              </wd-button>
            </view>
          </view>
        </view>

        <view v-if="loading" class="loading">
          加载中...
        </view>
        <view v-else-if="hasLoaded && !items.length" class="empty sl-card">
          <wd-icon name="home" size="42px" color="#8ea099" />
          <text class="empty__title">暂无房源数据</text>
          <text class="empty__desc">{{ canBatchManage ? '这个楼栋还没有房源，可以新增或批量创建。' : (canManageBuildingScope ? '这个楼栋还没有房源，可以新增一套。' : '这个楼盘暂时没有可展示房源。') }}</text>
          <wd-button v-if="!canManage" size="small" plain @click="backToMap">
            返回地图
          </wd-button>
        </view>
        <view v-else-if="finished" class="loading">
          已经到底了
        </view>
      </view>
    </scroll-view>

    <wd-popup v-model="videoPreviewVisible" custom-style="border-radius: 24rpx; overflow: hidden; width: 680rpx;" @touchmove.stop.prevent>
      <view class="video-preview" @touchmove.stop.prevent>
        <view class="video-preview__head">
          <text>{{ previewVideoMedia?.name || '视频预览' }}</text>
          <view class="video-preview__actions">
            <wd-button size="small" plain icon="download" @click="savePreviewVideo">
              保存
            </wd-button>
            <wd-icon name="close" size="20px" color="#72817b" @click="previewVideoMedia = null" />
          </view>
        </view>
        <video v-if="previewVideoMedia" class="video-preview__player" :src="previewVideoMedia.url" controls autoplay @longpress="openSavePreviewMenu" />
      </view>
    </wd-popup>

    <sl-property-batch
      v-if="canBatchManage"
      ref="batchRef"
      :community-id="communityId"
      :community-name="communityName"
      :building-id="buildingId"
      :building-name="buildingName"
      :building-total-floors="buildingTotalFloors"
      :selected-ids="selectedIds"
      @completed="handleBatchCompleted"
      @visibility-change="handleBatchVisibilityChange"
    />

    <view v-if="canBatchManage && selectionMode" class="batch-toolbar sl-safe-bottom">
      <view class="batch-toolbar__count">
        <text>已选 {{ selectedIds.length }} 套</text>
      </view>
      <wd-button size="small" type="primary" :disabled="!selectedIds.length" @click="openBatchEdit">
        修改
      </wd-button>
      <wd-button size="small" type="danger" :disabled="!selectedIds.length" @click="openBatchDelete">
        删除
      </wd-button>
      <wd-button size="small" plain @click="exitBatchManager">
        退出
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.community-page-shell {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.community-scroll {
  width: 100%;
  height: 100%;
}

.community-page {
  min-height: 100%;
  padding-bottom: calc(180rpx + env(safe-area-inset-bottom));
}

.media-strip {
  margin-top: 6rpx;
  white-space: nowrap;
}

.media-strip__inner {
  display: inline-flex;
  gap: 16rpx;
  padding: 4rpx 4rpx 8rpx;
}

.media-item {
  display: inline-flex;
  width: 180rpx;
  flex-direction: column;
  gap: 8rpx;
}

.media-item__thumb {
  width: 180rpx;
  height: 132rpx;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 18rpx;
  background: #edf2eb;
}

.media-item__thumb--video {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0f6a4c, #173f34);
}

.media-item__play {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(16 38 31 / 20%);
}

.media-item__name {
  overflow: hidden;
  padding: 0 4rpx;
  color: var(--sl-muted);
  font-size: 21rpx;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  margin-top: 20rpx;
  padding: 18rpx;
}

.search__input {
  min-width: 0;
  font-size: 27rpx;
}

.property-filters {
  margin-top: 16rpx;
  overflow: hidden;
  padding: 0;
}

.supply-contacts-card {
  margin-top: 12rpx;
}

.property-filters__tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.filter-trigger {
  display: flex;
  min-width: 0;
  height: 76rpx;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  border-right: 1rpx solid #edf1ec;
  color: #53615a;
  font-size: 24rpx;
  font-weight: 750;
}

.filter-trigger:last-child {
  border-right: 0;
}

.filter-trigger text {
  max-width: 168rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-trigger.active {
  background: #edf7f1;
  color: #126b4f;
}

.filter-panel {
  padding: 22rpx;
  border-top: 1rpx solid #e8eee9;
  background: #fbfdfb;
}

.filter-panel__title,
.filter-panel__hint {
  display: block;
}

.filter-panel__title {
  color: var(--sl-ink);
  font-size: 25rpx;
  font-weight: 800;
}

.filter-panel__hint {
  margin-top: 12rpx;
  color: var(--sl-muted);
  font-size: 21rpx;
  line-height: 1.5;
}

.range-inputs {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 14rpx;
  margin-top: 16rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.range-inputs label,
.suffix-input {
  display: flex;
  min-width: 0;
  height: 68rpx;
  align-items: center;
  box-sizing: border-box;
  padding: 0 16rpx;
  border: 1rpx solid rgb(18 107 79 / 16%);
  border-radius: 8rpx;
  background: #fff;
}

.range-inputs input,
.suffix-input input {
  min-width: 0;
  flex: 1;
  font-size: 25rpx;
}

.suffix-input {
  margin-top: 16rpx;
}

.layout-filter-row {
  display: grid;
  grid-template-columns: 42rpx minmax(0, 1fr);
  align-items: center;
  gap: 10rpx;
  margin-top: 16rpx;
  color: #53615a;
  font-size: 24rpx;
  font-weight: 750;
}

.layout-options {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 7rpx;
}

.layout-option {
  display: flex;
  height: 48rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #dfe8e1;
  border-radius: 6rpx;
  background: #fff;
  color: #66736d;
  font-size: 20rpx;
}

.layout-option.active {
  border-color: #126b4f;
  background: #126b4f;
  color: #fff;
}

.filter-panel__actions {
  display: flex;
  justify-content: flex-end;
  gap: 12rpx;
  margin-top: 20rpx;
}

.chips {
  margin-top: 20rpx;
  white-space: nowrap;
}

.chips__inner {
  display: inline-flex;
  gap: 14rpx;
  padding: 4rpx 28rpx 8rpx 4rpx;
}

.status-chip {
  display: inline-flex;
  height: 60rpx;
  align-items: center;
  padding: 0 30rpx;
  border: 1rpx solid rgb(18 107 79 / 16%);
  border-radius: 999rpx;
  background: #fff;
  color: #5e6c65;
  font-size: 25rpx;
  font-weight: 700;
  transition: all 0.15s ease;
}

.status-chip--active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--sl-brand, #126b4f), #24815f);
  box-shadow: 0 8rpx 20rpx rgb(18 107 79 / 22%);
  color: #fff;
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 30rpx 2rpx 18rpx;
}

.result-head__title {
  font-size: 31rpx;
  font-weight: 850;
}

.result-head__desc {
  color: var(--sl-muted);
  font-size: 23rpx;
}

.select-all-control {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10rpx;
  color: #126b4f;
  font-size: 23rpx;
  font-weight: 800;
}

.batch-select-all-row {
  width: fit-content;
  min-height: 52rpx;
  box-sizing: border-box;
  margin: -6rpx 0 10rpx;
  padding-left: 18rpx;
}

.scope-actions {
  display: flex;
  justify-content: flex-end;
  gap: 14rpx;
  margin-bottom: 18rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.property-wrap {
  overflow: hidden;
  border: 2rpx solid transparent;
  transition:
    border-color 0.15s ease,
    background 0.15s ease;
}

.property-wrap--selected {
  border-color: #126b4f;
  background: #f3faf6;
}

.property-select-row {
  display: flex;
  align-items: stretch;
}

.property-card-main {
  min-width: 0;
  flex: 1;
}

.selection-checkbox {
  display: flex;
  width: 42rpx;
  height: 42rpx;
  flex: 0 0 42rpx;
  align-items: center;
  justify-content: center;
  align-self: center;
  margin-left: 18rpx;
  border: 2rpx solid #9aaba3;
  border-radius: 6rpx;
  background: #fff;
}

.selection-checkbox.selected {
  border-color: #126b4f;
  background: #126b4f;
}

.selection-checkbox--all {
  margin-left: 0;
}

.property-wrap :deep(.property) {
  border: 0;
  box-shadow: none;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  padding: 0 18rpx 18rpx;
}

.loading,
.empty {
  margin-top: 22rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}

.loading {
  padding: 28rpx 0;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  padding: 70rpx 24rpx;
}

.empty__title {
  color: var(--sl-ink);
  font-size: 30rpx;
  font-weight: 850;
}

.empty__desc {
  color: var(--sl-muted);
  font-size: 24rpx;
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

.video-preview__actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.video-preview__player {
  display: block;
  width: 680rpx;
  height: 420rpx;
  background: #10261f;
}

.batch-toolbar {
  position: fixed;
  z-index: 1200;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 12rpx;
  padding: 16rpx 22rpx calc(16rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid rgb(18 107 79 / 12%);
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 -12rpx 34rpx rgb(29 54 45 / 10%);
}

.batch-toolbar__count {
  min-width: 0;
  color: #33443d;
  font-size: 25rpx;
  font-weight: 750;
}

.batch-toolbar__count > text {
  display: block;
}
</style>
