<script setup lang="ts">
import type { PageSlCommunityInput, PropertyFilterState, SlCommunityOutput, SlPublicRegionPreviewOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { getPublicRegionMap } from '@/api/public-preview'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { ensureCanUse } from '@/utils/auth-guard'
import { getLocationOnceCached, setCachedLocation } from '@/utils/location-cache'
import { buildCommunityFilterQuery, countCommunityFilters, getCommunityFilterLabels } from '@/utils/property-filter'
import { useSafeTopStyle } from '@/utils/safe-area'
import { idToQuery } from '@/utils/shenle'

definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '地图',
    enablePullDownRefresh: true,
  },
})

const DEFAULT_CENTER = { latitude: 22.5431, longitude: 114.0579 }
const mapId = 'property-map'
const safeTop = useSafeTopStyle()
const auth = useShenleAuthStore()
const canManage = computed(() => auth.isAdmin && modeStore.mode === 'admin')
const isPreviewMode = computed(() => !auth.canViewRealData)

const keyword = ref('')
const filters = ref<PropertyFilterState>({
  userLng: DEFAULT_CENTER.longitude,
  userLat: DEFAULT_CENTER.latitude,
})
const mapLat = ref(DEFAULT_CENTER.latitude)
const mapLng = ref(DEFAULT_CENTER.longitude)
const mapScale = ref(13)
const communities = ref<SlCommunityOutput[]>([])
const previewRegions = ref<SlPublicRegionPreviewOutput[]>([])
const loading = ref(false)
const locating = ref(false)
const choosingReferencePoint = ref(false)
const locationLabel = ref('点击选择位置')
let mapContext: UniApp.MapContext | null = null
let referencePointVersion = 0

const filterCount = computed(() => countCommunityFilters(filters.value))
const activeCount = computed(() => filterCount.value + (keyword.value.trim() ? 1 : 0))
const filterLabels = computed(() => getCommunityFilterLabels(filters.value))
const mapBadgeText = computed(() => {
  if (loading.value)
    return '加载中'
  return isPreviewMode.value ? `${previewRegions.value.length} 个片区` : `${communities.value.length} 个楼盘`
})

// ===== marker 体系 =====
type MarkerMeta = { type: 'single', community: SlCommunityOutput } | { type: 'preview', region: SlPublicRegionPreviewOutput }
const markers = ref<any[]>([])
const selected = ref<SlCommunityOutput | null>(null)
const selectedPreview = ref<SlPublicRegionPreviewOutput | null>(null)
let markerMeta: MarkerMeta[] = []
let regionTimer: ReturnType<typeof setTimeout> | null = null

function rentText(item: SlCommunityOutput) {
  const min = Number(item.minRentPrice)
  const max = Number(item.maxRentPrice)
  if (min > 0 && max > 0 && max !== min)
    return `¥${min}-${max}`
  if (min > 0)
    return `¥${min}起`
  return ''
}

const CALLOUT_BASE = { display: 'ALWAYS', fontSize: 11, borderRadius: 8, padding: 6, color: '#ffffff', textAlign: 'center' } as const

function rebuildMarkers() {
  if (isPreviewMode.value) {
    markerMeta = []
    markers.value = previewRegions.value
      .filter(item => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
      .map((item) => {
        markerMeta.push({ type: 'preview', region: item })
        return {
          id: markerMeta.length,
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          iconPath: '/static/images/pin-green.png',
          width: 30,
          height: 36,
          anchor: { x: 0.5, y: 1 },
          callout: { ...CALLOUT_BASE, content: `${item.regionName}\n${item.availableCountText}`, bgColor: '#126b4f' },
        }
      })
    return
  }
  const list: any[] = []
  markerMeta = []
  for (const item of communities.value.filter(hasCoordinate)) {
    markerMeta.push({ type: 'single', community: item })
    const rent = rentText(item)
    list.push({
      id: markerMeta.length,
      latitude: Number(item.lat),
      longitude: Number(item.lng),
      iconPath: '/static/images/pin-green.png',
      width: 28,
      height: 34,
      anchor: { x: 0.5, y: 1 },
      callout: { ...CALLOUT_BASE, content: rent ? `${item.name}\n${rent}` : item.name, bgColor: '#126b4f' },
    })
  }
  markers.value = list
}

function refreshRegionAndMarkers() {
  rebuildMarkers()
}

const regionDebug = { fired: 0, accepted: 0, lastEvent: null as any }
let lastRebuildAt = 0

function onRegionChange(event: any) {
  regionDebug.fired += 1
  regionDebug.lastEvent = { type: event?.type, detailType: event?.detail?.type, causedBy: event?.causedBy }
  // mp-weixin 事件形态不统一：type 或 detail.type 任一为 end 都算手势结束
  const isEnd = event?.type === 'end' || event?.detail?.type === 'end'
  if (isEnd) {
    regionDebug.accepted += 1
    if (regionTimer) {
      clearTimeout(regionTimer)
      regionTimer = null
    }
    refreshRegionAndMarkers()
    return
  }
  // 缩放/拖动过程中按 200ms 节流重算，让合并拆分跟手而不是等手势结束
  const now = Date.now()
  if (now - lastRebuildAt > 200) {
    lastRebuildAt = now
    refreshRegionAndMarkers()
  }
}

function buildQuery(pageNumber = 1, size = 200): PageSlCommunityInput {
  return {
    page: pageNumber,
    pageSize: size,
    name: keyword.value.trim() || undefined,
    status: 0,
    ...buildCommunityFilterQuery(filters.value),
  }
}

function buildPreviewQuery(pageNumber = 1, size = 200) {
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

function hasCoordinate(item: SlCommunityOutput) {
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
}

async function loadPreviewRegions(fitToResult = false) {
  loading.value = true
  try {
    const rows = await getPublicRegionMap(buildPreviewQuery())
    previewRegions.value = rows
    communities.value = []
    selected.value = null
    selectedPreview.value = null
    refreshRegionAndMarkers()
    if (fitToResult)
      fitMapToPreviewRegions()
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function loadCommunities(fitToResult = false) {
  if (isPreviewMode.value) {
    await loadPreviewRegions(fitToResult)
    return
  }
  loading.value = true
  try {
    const candidates: SlCommunityOutput[] = []
    let currentPage = 1
    let totalCount = Number.POSITIVE_INFINITY
    while (candidates.length < totalCount) {
      const result = await getCommunityPage(buildQuery(currentPage))
      candidates.push(...result.items)
      totalCount = result.total
      if (!result.items.length)
        break
      currentPage += 1
    }
    communities.value = candidates.filter(hasCoordinate)
    selected.value = null
    // 筛选后把地图视野移到结果范围，否则结果在屏幕外看着像"没变化"
    if (fitToResult)
      fitMapToCommunities()
    refreshRegionAndMarkers()
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function fitMapToCommunities() {
  const points = communities.value.map(item => ({ latitude: Number(item.lat), longitude: Number(item.lng) }))
  if (!points.length || !mapContext)
    return
  if (points.length === 1) {
    mapLat.value = points[0].latitude
    mapLng.value = points[0].longitude
    mapScale.value = 15
    mapContext.moveToLocation({ latitude: points[0].latitude, longitude: points[0].longitude, fail: () => {} })
    return
  }
  mapContext.includePoints({ points, padding: [80, 80, 80, 80] })
}

function fitMapToPreviewRegions() {
  const points = previewRegions.value.map(item => ({ latitude: Number(item.latitude), longitude: Number(item.longitude) }))
  if (!points.length || !mapContext)
    return
  if (points.length === 1) {
    mapLat.value = points[0].latitude
    mapLng.value = points[0].longitude
    mapScale.value = 14
    mapContext.moveToLocation({ latitude: points[0].latitude, longitude: points[0].longitude, fail: () => {} })
    return
  }
  mapContext.includePoints({ points, padding: [80, 80, 80, 80] })
}

function applyReferencePoint(longitude: number, latitude: number, label: string, moveMap = true) {
  filters.value = {
    ...filters.value,
    userLng: longitude,
    userLat: latitude,
  }
  locationLabel.value = label
  if (!moveMap)
    return
  mapLat.value = latitude
  mapLng.value = longitude
  mapScale.value = 15
  mapContext?.moveToLocation({ latitude, longitude, fail: () => {} })
}

async function getLocation(showTip = false) {
  if (locating.value)
    return
  const requestVersion = referencePointVersion
  locating.value = true
  try {
    const res = await getLocationOnceCached()
    if (requestVersion !== referencePointVersion)
      return
    applyReferencePoint(res.longitude, res.latitude, res.label)
    if (showTip)
      uni.showToast({ title: '已更新当前位置', icon: 'success' })
    await loadCommunities()
  }
  catch {
    if (requestVersion !== referencePointVersion)
      return
    if (showTip)
      uni.showToast({ title: '定位失败，请手动选点', icon: 'none' })
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
    applyReferencePoint(res.longitude, res.latitude, label)
    await loadCommunities(filters.value.distanceKm !== undefined)
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
    userLng: filters.value.userLng,
    userLat: filters.value.userLat,
  }
  if (nextKeyword !== undefined)
    keyword.value = isPreviewMode.value ? '' : nextKeyword
  loadCommunities(true)
}

function resetFilters() {
  const userLng = filters.value.userLng
  const userLat = filters.value.userLat
  filters.value = { userLng, userLat }
  keyword.value = ''
  loadCommunities(true)
}

function onFilterGuarded(tip?: string) {
  ensureCanUse(tip || '登录并通过审核后可使用筛选')
}

function onMarkerTap(event: any) {
  const meta = markerMeta[Number(event.detail?.markerId) - 1]
  if (!meta)
    return
  if (meta.type === 'preview') {
    selectedPreview.value = meta.region
    selected.value = null
    return
  }
  if (meta.type === 'single') {
    selected.value = meta.community
    selectedPreview.value = null
  }
}

function editSelected() {
  if (!selected.value)
    return
  uni.navigateTo({ url: `/pages/common/community-manage/index?editId=${idToQuery(selected.value.id)}` })
}

function goProperties(item: SlCommunityOutput | null) {
  if (!item)
    return
  if (!canManage.value && !ensureCanUse('登录并通过审核后可查看具体楼盘与房源'))
    return
  uni.navigateTo({
    url: `/pages/common/community-properties/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}`,
  })
}

onLoad(() => {
  // 微信合规：打开即可匿名浏览地图/楼盘，不强制登录；搜索/详情/联系等动作再触发登录
  mapContext = uni.createMapContext(mapId)
  loadCommunities()
  getLocation(false)

  // 仅开发者工具：暴露调试桥，供自动化测试驱动 marker 点击链路（真机不生效）
  try {
    if (uni.getSystemInfoSync().platform === 'devtools') {
      ;(getApp() as any).__mapDebug = {
        tapMarker: (markerId: number) => onMarkerTap({ detail: { markerId } }),
        state: () => ({
          communities: communities.value.length,
          previewRegions: previewRegions.value.length,
          markers: markers.value.length,
          selectedName: selected.value?.name || null,
          markerKinds: markers.value.map((m, i) => markerMeta[i]?.type),
          regionDebug: { ...regionDebug },
        }),
      }
    }
  }
  catch {}
})
onPullDownRefresh(loadCommunities)
</script>

<template>
  <view class="map-page" :style="safeTop">
    <view class="map-head">
      <text class="map-head__title">楼盘地图</text>
    </view>

    <sl-location-card :locating="locating" :label="locationLabel" @choose="chooseReferencePoint" />

    <sl-property-filter-bar
      :filters="filters"
      :keyword="keyword"
      :guarded="isPreviewMode"
      guard-tip="登录并通过审核后可使用筛选"
      mount-key="admin-map-filter"
      @confirm="onFilterConfirm"
      @reset="resetFilters"
      @guarded="onFilterGuarded"
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
      <text class="active-summary__clear" @tap="resetFilters">清空</text>
    </view>

    <view class="map-shell sl-card">
      <map
        :id="mapId"
        class="map"
        :latitude="mapLat"
        :longitude="mapLng"
        :scale="mapScale"
        :markers="markers"
        show-location
        @markertap="onMarkerTap"
        @callouttap="onMarkerTap"
        @regionchange="onRegionChange"
      >
        <cover-view class="map-badge">
          <cover-view class="map-badge__text">{{ mapBadgeText }}</cover-view>
        </cover-view>
      </map>

      <view v-if="selectedPreview" class="map-card">
        <view class="map-card__close" @tap="selectedPreview = null">
          <wd-icon name="close" size="16px" color="#9aa3af" />
        </view>
        <view class="map-card__main" @tap="previewCardAction">
          <text class="map-card__name">{{ selectedPreview.regionName }}</text>
          <view class="map-card__meta">
            <wd-tag plain type="success">
              {{ selectedPreview.availableCountText }}
            </wd-tag>
            <text>{{ selectedPreview.communityCountText }}</text>
            <text>{{ selectedPreview.rentRangeText }}</text>
            <text v-if="selectedPreview.distanceText">{{ selectedPreview.distanceText }}</text>
          </view>
        </view>
        <view class="map-card__actions">
          <wd-button size="small" type="primary" @click="previewCardAction">
            申请后查看具体房源
          </wd-button>
        </view>
      </view>

      <view v-if="selected" class="map-card">
        <view class="map-card__close" @tap="selected = null">
          <wd-icon name="close" size="16px" color="#9aa3af" />
        </view>
        <view class="map-card__main" @tap="goProperties(selected)">
          <text class="map-card__name">{{ selected.name }}</text>
          <view class="map-card__meta">
            <wd-tag v-if="selected.regionName" plain type="success">
              {{ selected.regionName }}
            </wd-tag>
            <text v-if="selected.propertyCount">{{ selected.propertyCount }} 套房源</text>
            <text v-if="rentText(selected)">{{ rentText(selected) }}</text>
            <text v-if="selected.distance !== null && selected.distance !== undefined">距 {{ selected.distance }}km</text>
          </view>
        </view>
        <view class="map-card__actions">
          <wd-button v-if="canManage" size="small" plain @click="editSelected">
            编辑楼盘
          </wd-button>
          <wd-button size="small" type="primary" @click="goProperties(selected)">
            查看房源
          </wd-button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.map-page {
  display: flex;
  width: 100%;
  height: 100vh;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  padding: 28rpx 24rpx calc(132rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 12% -2%, rgb(228 161 27 / 18%), transparent 260rpx),
    linear-gradient(180deg, #f8fbf4 0%, #eef5ef 100%);
}

.map-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 18rpx;
}

.map-head__title {
  display: block;
  font-size: 34rpx;
  font-weight: 850;
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

.map-shell {
  position: relative;
  flex: 1;
  min-height: 480rpx;
  overflow: hidden;
  margin-top: 20rpx;
}

.map {
  display: block;
  width: 100%;
  height: 100%;
}

.map-card {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  left: 16rpx;
  z-index: 10;
  padding: 22rpx 24rpx;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10rpx 36rpx rgb(31 51 41 / 16%);
}

.map-card__close {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  display: flex;
  width: 48rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
}

.map-card__name {
  display: block;
  padding-right: 48rpx;
  font-size: 30rpx;
  font-weight: 850;
}

.map-card__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14rpx;
  margin-top: 12rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.map-card__actions {
  display: flex;
  justify-content: flex-end;
  gap: 14rpx;
  margin-top: 18rpx;
}

.map-badge {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  display: flex;
  gap: 10rpx;
  pointer-events: none;
}

.map-badge__text {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 8rpx 20rpx rgb(31 60 45 / 10%);
  color: var(--sl-brand);
  font-size: 22rpx;
  font-weight: 800;
}
</style>
