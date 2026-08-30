<script setup lang="ts">
import type { PageSlCommunityInput, PropertyFilterState, SlCommunityOutput, SlPublicRegionPreviewOutput } from '@/types/shenle'
import { onLoad, onPageScroll, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { getPublicRegionPage } from '@/api/public-preview'
import { useShenleAuthStore } from '@/store/auth'
import { useEntityChangeStore } from '@/store/entity-change'
import { useLandlordShareStore } from '@/store/landlord-share'
import { modeStore } from '@/store/mode'
import { ensureCanUse } from '@/utils/auth-guard'
import { getLocationOnceCached, setCachedLocation } from '@/utils/location-cache'
import { buildCommunityFilterQuery, countCommunityFilters, getCommunityFilterLabels } from '@/utils/property-filter'
import { useSafeTopStyle } from '@/utils/safe-area'
import { idToQuery, resolveAssetUrl } from '@/utils/shenle'
import { saveVideoToAlbum, showVideoSaveActionSheet } from '@/utils/video-save'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '房源',
    enablePullDownRefresh: true,
  },
})

const safeTop = useSafeTopStyle()
const auth = useShenleAuthStore()
const landlordShare = useLandlordShareStore()
const hasLandlordShare = landlordShare.active
const shareOwnerName = landlordShare.ownerName
const shareCommunityCount = landlordShare.communityCount
const canManage = computed(() => auth.canEnterAdmin && modeStore.mode === 'admin')
const isPreviewMode = computed(() => !auth.canViewRealData)

const DEFAULT_LOCATION = { longitude: 114.0579, latitude: 22.5431 }

const keyword = ref('')
const filters = ref<PropertyFilterState>({})
const page = ref(1)
const pageSize = 200
const total = ref(0)
const items = ref<SlCommunityOutput[]>([])
const previewItems = ref<SlPublicRegionPreviewOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const locating = ref(false)
const choosingReferencePoint = ref(false)
const locationLabel = ref('点击选择位置')
const currentScrollTop = ref(0)
const changeStore = useEntityChangeStore()
let referencePointVersion = 0

const currentCount = computed(() => isPreviewMode.value ? previewItems.value.length : items.value.length)
const finished = computed(() => total.value > 0 && currentCount.value >= total.value)
const filterCount = computed(() => countCommunityFilters(filters.value))
const activeCount = computed(() => filterCount.value + (keyword.value.trim() ? 1 : 0))
const filterLabels = computed(() => getCommunityFilterLabels(filters.value))

function buildQuery(pageNumber = page.value, size = pageSize): PageSlCommunityInput {
  return {
    page: pageNumber,
    pageSize: size,
    name: keyword.value.trim() || undefined,
    status: 0,
    ...buildCommunityFilterQuery(filters.value),
    landlordShareToken: landlordShare.active.value ? landlordShare.shareToken.value : undefined,
  }
}

function clearLandlordShare() {
  landlordShare.clear()
  void load(true)
}

function buildPreviewQuery(pageNumber = page.value, size = pageSize) {
  return {
    page: pageNumber,
    pageSize: size,
    regionId: filters.value.regionId,
    minPrice: filters.value.minPrice,
    maxPrice: filters.value.maxPrice,
    longitude: filters.value.userLng,
    latitude: filters.value.userLat,
  }
}

function previewCardAction() {
  ensureCanUse('登录并通过审核后可查看具体楼盘与房源')
}

function previewRegionDesc(item: SlPublicRegionPreviewOutput) {
  return `${item.availableCountText} · ${item.rentRangeText}`
}

function previewRegionMeta(item: SlPublicRegionPreviewOutput) {
  return item.distanceText ? `${item.communityCountText} · ${item.distanceText}` : item.communityCountText
}

// 距离排序与 DistanceKm 过滤均由服务端在分页前完成，前端只做标准分页
async function load(reset = false) {
  if (loading.value)
    return
  if (reset) {
    page.value = 1
    items.value = []
    previewItems.value = []
    total.value = 0
  }
  loading.value = true
  try {
    if (isPreviewMode.value) {
      const result = await getPublicRegionPage(buildPreviewQuery())
      total.value = result.total
      previewItems.value = reset ? result.items : [...previewItems.value, ...result.items]
    }
    else {
      const result = await getCommunityPage(buildQuery())
      total.value = result.total
      items.value = reset ? result.items : [...items.value, ...result.items]
    }
    hasLoaded.value = true
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function setReferencePoint(longitude: number, latitude: number, label: string) {
  filters.value = {
    ...filters.value,
    userLng: longitude,
    userLat: latitude,
  }
  locationLabel.value = label
}

async function autoLocate() {
  if (locating.value)
    return
  const requestVersion = referencePointVersion
  locating.value = true
  try {
    const res = await getLocationOnceCached()
    if (requestVersion !== referencePointVersion)
      return
    setReferencePoint(res.longitude, res.latitude, res.label)
    await load(true)
  }
  catch {
    if (requestVersion !== referencePointVersion)
      return
    locationLabel.value = '点击选择位置'
  }
  finally {
    if (requestVersion === referencePointVersion)
      locating.value = false
  }
}

async function chooseReferencePoint() {
  if (isPreviewMode.value) {
    ensureCanUse('登录并通过审核后可选择位置')
    return
  }
  if (choosingReferencePoint.value)
    return
  const requestVersion = ++referencePointVersion
  choosingReferencePoint.value = true
  locating.value = true
  try {
    const res = await new Promise<UniApp.ChooseLocationSuccess>((resolve, reject) => {
      uni.chooseLocation({ success: resolve, fail: reject })
    })
    const label = res.name || res.address || '选定位置'
    setCachedLocation(res.longitude, res.latitude, label)
    setReferencePoint(res.longitude, res.latitude, label)
    await load(true)
  }
  catch {
    uni.showToast({ title: '未选择位置', icon: 'none' })
  }
  finally {
    if (requestVersion === referencePointVersion)
      locating.value = false
    choosingReferencePoint.value = false
  }
}

function onFilterConfirm(nextFilters: PropertyFilterState, nextKeyword?: string) {
  if (isPreviewMode.value && nextKeyword?.trim()) {
    uni.showToast({ title: '登录并通过审核后可搜索具体楼盘', icon: 'none' })
    return
  }
  filters.value = {
    ...nextFilters,
    userLng: nextFilters.userLng ?? filters.value.userLng,
    userLat: nextFilters.userLat ?? filters.value.userLat,
  }
  if (nextKeyword !== undefined)
    keyword.value = isPreviewMode.value ? '' : nextKeyword
  load(true)
}

function resetFilters() {
  const userLng = filters.value.userLng
  const userLat = filters.value.userLat
  filters.value = { userLng, userLat }
  keyword.value = ''
  load(true)
}

function onFilterGuarded(tip?: string) {
  ensureCanUse(tip || '登录并通过审核后可使用筛选')
}

function clearAllFilters() {
  resetFilters()
}

const previewVideoItem = ref<SlCommunityOutput | null>(null)
const videoPreviewVisible = computed({
  get: () => !!previewVideoItem.value,
  set: (visible: boolean) => {
    if (!visible)
      previewVideoItem.value = null
  },
})
const previewVideoUrl = computed(() => previewVideoItem.value ? resolveAssetUrl(previewVideoItem.value.coverImage) : '')

function openVideoPreview(item: SlCommunityOutput) {
  previewVideoItem.value = item
}

function savePreviewVideo() {
  if (!previewVideoItem.value)
    return
  void saveVideoToAlbum({ fileId: previewVideoItem.value.coverImageId, url: previewVideoUrl.value })
}

function openSavePreviewMenu() {
  if (!previewVideoItem.value)
    return
  void showVideoSaveActionSheet({ fileId: previewVideoItem.value.coverImageId, url: previewVideoUrl.value })
}

function goProperties(item: SlCommunityOutput) {
  if (!canManage.value && !ensureCanUse('登录并通过审核后可查看具体楼盘与房源'))
    return
  const target = canManage.value
    ? `/pages/common/building-manage/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}`
    : `/pages/common/community-properties/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}`
  uni.navigateTo({
    url: target,
  })
}

async function reloadLoadedRangePreservingScroll() {
  if (loading.value || isPreviewMode.value)
    return
  const loadedPages = Math.max(1, page.value)
  const restoreTop = currentScrollTop.value
  loading.value = true
  try {
    const responses = []
    for (let pageNo = 1; pageNo <= loadedPages; pageNo++)
      responses.push(await getCommunityPage(buildQuery(pageNo)))
    items.value = responses.flatMap(result => result.items)
    total.value = responses[0]?.total || 0
    page.value = loadedPages
    await nextTick()
    uni.pageScrollTo({ scrollTop: restoreTop, duration: 0 })
  }
  finally {
    loading.value = false
  }
}

function openNavigation(item: SlCommunityOutput) {
  if (!item.lat || !item.lng) {
    uni.showToast({ title: '暂无坐标', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: Number(item.lat),
    longitude: Number(item.lng),
    name: item.name,
    address: item.address || item.name,
  })
}

onLoad(() => {
  void (async () => {
    if (landlordShare.hasContext.value)
      await landlordShare.resolvePending()
    await load(true)
    void autoLocate()
  })()
})
onShow(() => {
  if (landlordShare.hasContext.value)
    void landlordShare.resolvePending()
  const changes = [
    changeStore.consumePropertyChange('property-list'),
    changeStore.consumeCommunityChange('property-list'),
    changeStore.consumeBuildingChange('property-list'),
  ]
  if (changes.some(Boolean))
    void reloadLoadedRangePreservingScroll()
})
onPageScroll((event) => {
  currentScrollTop.value = event.scrollTop
})
onPullDownRefresh(() => load(true))
onReachBottom(() => {
  if (!finished.value) {
    page.value += 1
    load()
  }
})
</script>

<template>
  <view class="sl-page property-page" :style="safeTop">
    <view class="admin-head">
      <view>
        <text class="admin-head__title">{{ canManage ? '房源管理' : '找房' }}</text>
        <text v-if="canManage" class="admin-head__desc">先筛选楼盘，再进入楼盘管理房源</text>
      </view>
    </view>

    <sl-location-card :locating="locating" :label="locationLabel" @choose="chooseReferencePoint" />

    <sl-property-filter-bar
      :filters="filters"
      :keyword="keyword"
      :guarded="isPreviewMode"
      :show-operator-filters="auth.canFilterBySupplyOperator"
      guard-tip="登录并通过审核后可使用筛选"
      mount-key="admin-community-filter"
      @confirm="onFilterConfirm"
      @reset="resetFilters"
      @guarded="onFilterGuarded"
    />

    <sl-landlord-share-scope
      v-if="hasLandlordShare"
      :owner-name="shareOwnerName"
      :community-count="shareCommunityCount"
      @clear="clearLandlordShare"
    />

    <view v-if="activeCount" class="active-summary sl-card">
      <view class="active-summary__body">
        <wd-tag v-if="keyword" plain type="primary">
          楼盘：{{ keyword }}
        </wd-tag>
        <wd-tag v-for="label in filterLabels" :key="label" plain type="success">
          {{ label }}
        </wd-tag>
      </view>
      <text class="active-summary__clear" @tap="clearAllFilters">清空</text>
    </view>

    <view class="result-head">
      <view>
        <text class="result-head__title">匹配楼盘</text>
        <text class="result-head__desc">{{ canManage ? '点击楼盘进入楼栋管理' : '点击楼盘进入房源列表' }}</text>
      </view>
      <text class="result-head__total">{{ total }} 个</text>
    </view>

    <view class="list">
      <view v-if="isPreviewMode" class="preview-list">
        <view v-for="item in previewItems" :key="String(item.regionId)" class="preview-card sl-card" @tap="previewCardAction">
          <view class="preview-card__main">
            <text class="preview-card__name">{{ item.regionName }}</text>
            <text class="preview-card__desc">{{ previewRegionDesc(item) }}</text>
            <text class="preview-card__meta">{{ previewRegionMeta(item) }}</text>
          </view>
          <view class="preview-card__action" @tap.stop>
            <wd-button size="small" type="primary" @click="previewCardAction">
              申请后查看
            </wd-button>
          </view>
        </view>
      </view>
      <template v-else>
        <view v-for="item in items" :key="String(item.id)" class="community-wrap">
          <sl-community-card
            :item="item"
            show-navigate
            @select="goProperties"
            @navigate="openNavigation"
            @preview-video="openVideoPreview"
          />
        </view>
      </template>
    </view>

    <wd-popup v-model="videoPreviewVisible" :z-index="2000" custom-style="border-radius: 24rpx; overflow: hidden; width: 680rpx;" @touchmove.stop.prevent>
      <view class="video-preview" @touchmove.stop.prevent>
        <view class="video-preview__head">
          <text class="video-preview__title">{{ previewVideoItem?.name || '视频预览' }}</text>
          <view class="video-preview__actions">
            <wd-button size="small" plain icon="download" @click.stop="savePreviewVideo">
              保存
            </wd-button>
            <wd-icon name="close" size="20px" color="#72817b" @click.stop="previewVideoItem = null" />
          </view>
        </view>
        <video v-if="previewVideoItem" class="video-preview__player" :src="previewVideoUrl" controls autoplay @longpress.stop="openSavePreviewMenu" />
      </view>
    </wd-popup>

    <view v-if="loading" class="loading sl-card">
      <wd-icon name="loading" size="18px" color="#126b4f" />
      <text>加载中...</text>
    </view>
    <view v-else-if="hasLoaded && !currentCount" class="empty sl-card">
      <wd-icon name="home" size="42px" color="#8ea099" />
      <text class="empty__title">暂无匹配楼盘</text>
      <text class="empty__desc">调整楼盘名称、区域、租金或距离后再试</text>
      <wd-button size="small" type="primary" @click="resetFilters">
        重置筛选
      </wd-button>
    </view>
    <view v-else-if="finished" class="loading">
      已加载全部
    </view>
  </view>
</template>

<style scoped lang="scss">
.property-page {
  padding-bottom: calc(148rpx + env(safe-area-inset-bottom));
}

.admin-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.admin-head__title,
.admin-head__desc {
  display: block;
}

.admin-head__title {
  font-size: 34rpx;
  font-weight: 850;
}

.admin-head__desc {
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.active-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
}

.active-summary__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  gap: 10rpx;
}

.active-summary__clear {
  color: var(--sl-danger);
  font-size: 24rpx;
  font-weight: 800;
}

.result-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  margin: 30rpx 2rpx 18rpx;
}

.result-head__title,
.result-head__desc,
.result-head__total {
  display: block;
}

.result-head__title {
  font-size: 32rpx;
  font-weight: 850;
}

.result-head__desc {
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.result-head__total {
  color: var(--sl-brand);
  font-size: 26rpx;
  font-weight: 850;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.loading,
.empty {
  margin-top: 22rpx;
  padding: 28rpx 0;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  padding: 66rpx 24rpx;
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

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 24rpx;
}

.preview-card__main {
  min-width: 0;
  flex: 1;
}

.preview-card__name,
.preview-card__desc,
.preview-card__meta {
  display: block;
}

.preview-card__name {
  font-size: 31rpx;
  font-weight: 850;
}

.preview-card__desc {
  margin-top: 8rpx;
  color: #126b4f;
  font-size: 25rpx;
  font-weight: 700;
}

.preview-card__meta {
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.community-wrap {
  position: relative;
}
</style>
