<script setup lang="ts">
import type { PageSlCommunityInput, PropertyFilterState, SlCommunityOutput, SlPublicRegionPreviewOutput, SlSupplyLeaderboardOutput, SlSupplyRecentOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { getPublicRegionMap } from '@/api/public-preview'
import { getRecentSupplyActivity, getSupplyActivityDetails, getSupplyLeaderboard } from '@/api/supply-activity'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { ensureCanUse } from '@/utils/auth-guard'
import { getLocationOnceCached, setCachedLocation } from '@/utils/location-cache'
import { buildCommunityFilterQuery, countCommunityFilters, getCommunityFilterLabels } from '@/utils/property-filter'
import { useSafeTopStyle } from '@/utils/safe-area'
import { idToQuery } from '@/utils/shenle'
import { formatRecentSupplyActivity, formatSupplyTime } from '@/utils/supply-activity'

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
const showMineFilters = computed(() => modeStore.mode !== 'user')
const isPreviewMode = computed(() => !auth.canViewRealData)

const keyword = ref('')
const filters = ref<PropertyFilterState>({})
const mapLat = ref(DEFAULT_CENTER.latitude)
const mapLng = ref(DEFAULT_CENTER.longitude)
const mapScale = ref(13)
const communities = ref<SlCommunityOutput[]>([])
const previewRegions = ref<SlPublicRegionPreviewOutput[]>([])
const loading = ref(false)
const locating = ref(false)
const choosingReferencePoint = ref(false)
const locationLabel = ref('点击选择位置')
const recentActivities = ref<SlSupplyRecentOutput[]>([])
const leaderboard = ref<SlSupplyLeaderboardOutput[]>([])
const leaderboardVisible = ref(false)
const leaderboardLoading = ref(false)
const leaderboardDays = ref(7)
const leaderboardSort = ref<'affectedCount' | 'activityCount' | 'communityCount'>('affectedCount')
const leaderboardDetail = ref<SlSupplyLeaderboardOutput | null>(null)
const leaderboardDetails = ref<SlSupplyRecentOutput[]>([])
const leaderboardDetailLoading = ref(false)
let mapContext: UniApp.MapContext | null = null
let referencePointVersion = 0

const leaderboardDayOptions = [1, 3, 7, 30]
const leaderboardSortOptions = [
  { value: 'affectedCount' as const, label: '更新数量' },
  { value: 'activityCount' as const, label: '操作次数' },
  { value: 'communityCount' as const, label: '覆盖楼盘' },
]

const filterCount = computed(() => countCommunityFilters(filters.value))
const activeCount = computed(() => filterCount.value + (keyword.value.trim() ? 1 : 0))
const filterLabels = computed(() => getCommunityFilterLabels(filters.value))
const showSupplyTicker = computed(() => auth.canViewSupplyActivity && recentActivities.value.length > 0)
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
    const calloutContent = rent ? `${item.name}\n${rent}` : item.name
    list.push({
      id: markerMeta.length,
      latitude: Number(item.lat),
      longitude: Number(item.lng),
      iconPath: '/static/images/pin-green.png',
      width: 28,
      height: 34,
      anchor: { x: 0.5, y: 1 },
      callout: { ...CALLOUT_BASE, content: calloutContent, bgColor: '#126b4f' },
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
    userLng: nextFilters.userLng ?? filters.value.userLng,
    userLat: nextFilters.userLat ?? filters.value.userLat,
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

async function loadSupplyActivity() {
  if (!auth.canViewSupplyActivity) {
    recentActivities.value = []
    return
  }
  try {
    recentActivities.value = await getRecentSupplyActivity(7, 20)
  }
  catch {
    recentActivities.value = []
  }
}

async function loadLeaderboard() {
  if (!auth.canViewSupplyActivity || leaderboardLoading.value)
    return
  leaderboardLoading.value = true
  try {
    leaderboard.value = await getSupplyLeaderboard(leaderboardDays.value, 50, leaderboardSort.value)
  }
  catch {
    leaderboard.value = []
    uni.showToast({ title: '更新榜单加载失败', icon: 'none' })
  }
  finally {
    leaderboardLoading.value = false
  }
}

function openLeaderboard() {
  leaderboardDetail.value = null
  leaderboardDetails.value = []
  leaderboardVisible.value = true
  void loadLeaderboard()
}

function closeLeaderboard() {
  leaderboardVisible.value = false
}

async function loadLeaderboardDetails(item: SlSupplyLeaderboardOutput) {
  leaderboardDetailLoading.value = true
  try {
    leaderboardDetails.value = await getSupplyActivityDetails(item.userId, leaderboardDays.value, 50)
  }
  catch {
    leaderboardDetails.value = []
    uni.showToast({ title: '更新明细加载失败', icon: 'none' })
  }
  finally {
    leaderboardDetailLoading.value = false
  }
}

function openLeaderboardDetail(item: SlSupplyLeaderboardOutput) {
  leaderboardDetail.value = item
  leaderboardDetails.value = []
  void loadLeaderboardDetails(item)
}

function backToLeaderboard() {
  leaderboardDetail.value = null
  leaderboardDetails.value = []
}

async function openRecentActivityDetail(activity: SlSupplyRecentOutput) {
  leaderboardDays.value = 7
  leaderboardSort.value = 'affectedCount'
  leaderboardVisible.value = true
  const fallback: SlSupplyLeaderboardOutput = {
    userId: activity.operatorUserId,
    nickName: activity.operatorNickName,
    activityCount: 0,
    affectedCount: 0,
    communityCount: 0,
    lastUpdateTime: activity.updateTime,
  }
  leaderboardDetail.value = fallback
  leaderboardDetails.value = []
  await Promise.all([loadLeaderboard(), loadLeaderboardDetails(fallback)])
  const summary = leaderboard.value.find(item => String(item.userId) === String(activity.operatorUserId))
  if (summary)
    leaderboardDetail.value = summary
}

function selectLeaderboardDays(days: number) {
  if (leaderboardDays.value === days)
    return
  leaderboardDays.value = days
  void loadLeaderboard()
}

function selectLeaderboardSort(sort: 'affectedCount' | 'activityCount' | 'communityCount') {
  if (leaderboardSort.value === sort)
    return
  leaderboardSort.value = sort
  void loadLeaderboard()
}

function leaderboardValue(item: SlSupplyLeaderboardOutput) {
  if (leaderboardSort.value === 'activityCount')
    return `${item.activityCount} 次`
  if (leaderboardSort.value === 'communityCount')
    return `${item.communityCount} 个`
  return `${item.affectedCount} 项`
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
onShow(() => {
  void loadSupplyActivity()
})
onPullDownRefresh(() => Promise.all([loadCommunities(), loadSupplyActivity()]))
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
      :show-mine-filters="showMineFilters"
      :show-operator-filters="auth.canFilterBySupplyOperator"
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

      <view v-if="showSupplyTicker" class="supply-ticker">
        <view class="supply-ticker__signal">
          <wd-icon name="edit" size="16px" color="#fff" />
        </view>
        <swiper class="supply-ticker__swiper" vertical autoplay circular :interval="4000" :duration="350">
          <swiper-item v-for="activity in recentActivities" :key="String(activity.id)">
            <view class="supply-ticker__item" @tap.stop="openRecentActivityDetail(activity)">
              <text>{{ formatRecentSupplyActivity(activity) }}</text>
            </view>
          </swiper-item>
        </swiper>
        <view class="supply-ticker__rank" @tap.stop="openLeaderboard">
          <wd-icon name="chart-bar" size="19px" color="#126b4f" />
        </view>
      </view>

      <view v-if="selectedPreview" class="map-card" :class="{ 'map-card--with-ticker': showSupplyTicker }">
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

      <view v-if="selected" class="map-card" :class="{ 'map-card--with-ticker': showSupplyTicker }">
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

    <wd-popup
      v-model="leaderboardVisible"
      position="bottom"
      :z-index="3000"
      custom-style="border-radius: 24rpx 24rpx 0 0; overflow: hidden;"
      safe-area-inset-bottom
      @touchmove.stop
    >
      <view class="leaderboard-sheet" @tap.stop @touchmove.stop>
        <view class="leaderboard-sheet__head">
          <view v-if="leaderboardDetail" class="leaderboard-detail__heading">
            <view class="leaderboard-detail__back" @tap="backToLeaderboard">
              <wd-icon name="arrow-left" size="20px" color="#126b4f" />
            </view>
            <view class="leaderboard-detail__heading-text">
              <text class="leaderboard-sheet__title">{{ leaderboardDetail.nickName }}的更新明细</text>
              <text class="leaderboard-sheet__sub">近 {{ leaderboardDays }} 天的业务操作记录</text>
            </view>
          </view>
          <view v-else>
            <text class="leaderboard-sheet__title">盘源更新榜</text>
            <text class="leaderboard-sheet__sub">按实际业务更新记录统计，点击人员查看明细</text>
          </view>
          <view class="leaderboard-sheet__close" @tap="closeLeaderboard">
            <wd-icon name="close" size="21px" color="#72817b" />
          </view>
        </view>

        <template v-if="!leaderboardDetail">
          <view class="leaderboard-filter">
            <text class="leaderboard-filter__label">时间范围</text>
            <view class="leaderboard-options leaderboard-options--days">
              <view
                v-for="days in leaderboardDayOptions"
                :key="days"
                class="leaderboard-option"
                :class="{ active: leaderboardDays === days }"
                @tap="selectLeaderboardDays(days)"
              >
                {{ days === 1 ? '今天' : `近 ${days} 天` }}
              </view>
            </view>
          </view>

          <view class="leaderboard-filter">
            <text class="leaderboard-filter__label">排序方式</text>
            <view class="leaderboard-options leaderboard-options--sort">
              <view
                v-for="option in leaderboardSortOptions"
                :key="option.value"
                class="leaderboard-option"
                :class="{ active: leaderboardSort === option.value }"
                @tap="selectLeaderboardSort(option.value)"
              >
                {{ option.label }}
              </view>
            </view>
          </view>

          <scroll-view scroll-y class="leaderboard-list">
            <view v-if="leaderboardLoading" class="leaderboard-empty">
              榜单加载中...
            </view>
            <view v-else-if="!leaderboard.length" class="leaderboard-empty">
              所选时间范围内暂无更新记录
            </view>
            <view v-for="(item, index) in leaderboard" v-else :key="String(item.userId)" class="leaderboard-row" @tap="openLeaderboardDetail(item)">
              <text class="leaderboard-row__rank" :class="`rank-${index + 1}`">{{ index + 1 }}</text>
              <view class="leaderboard-row__body">
                <text class="leaderboard-row__name">{{ item.nickName }}</text>
                <text class="leaderboard-row__meta">
                  {{ item.activityCount }} 次操作 · {{ item.communityCount }} 个楼盘 · {{ formatSupplyTime(item.lastUpdateTime) }}
                </text>
              </view>
              <view class="leaderboard-row__tail">
                <text class="leaderboard-row__value">{{ leaderboardValue(item) }}</text>
                <wd-icon name="arrow-right" size="15px" color="#8a978f" />
              </view>
            </view>
          </scroll-view>
        </template>

        <view v-else class="leaderboard-detail">
          <view class="leaderboard-detail__summary">
            <view><text>{{ leaderboardDetail.affectedCount }}</text><text>更新数量</text></view>
            <view><text>{{ leaderboardDetail.activityCount }}</text><text>操作次数</text></view>
            <view><text>{{ leaderboardDetail.communityCount }}</text><text>覆盖楼盘</text></view>
          </view>
          <scroll-view scroll-y class="leaderboard-detail__list">
            <view v-if="leaderboardDetailLoading" class="leaderboard-empty">
              明细加载中...
            </view>
            <view v-else-if="!leaderboardDetails.length" class="leaderboard-empty">
              所选时间范围内暂无更新明细
            </view>
            <view v-for="activity in leaderboardDetails" v-else :key="String(activity.id)" class="leaderboard-detail__row">
              <view class="leaderboard-detail__body">
                <text class="leaderboard-detail__action">{{ activity.actionName }} · {{ activity.communityName }}</text>
                <text class="leaderboard-detail__time">{{ formatSupplyTime(activity.updateTime) }}</text>
              </view>
              <text class="leaderboard-detail__count">{{ activity.affectedCount }} 项</text>
            </view>
          </scroll-view>
        </view>
      </view>
    </wd-popup>
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
  justify-content: space-between;
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

.map-card--with-ticker {
  bottom: 104rpx;
}

.supply-ticker {
  position: absolute;
  right: 16rpx;
  bottom: 16rpx;
  left: 16rpx;
  z-index: 11;
  display: grid;
  height: 72rpx;
  grid-template-columns: 52rpx minmax(0, 1fr) 64rpx;
  align-items: center;
  overflow: hidden;
  border: 1rpx solid rgb(18 107 79 / 14%);
  border-radius: 8rpx;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 8rpx 28rpx rgb(31 51 41 / 16%);
}

.supply-ticker__signal {
  display: flex;
  width: 38rpx;
  height: 38rpx;
  align-items: center;
  justify-content: center;
  justify-self: center;
  border-radius: 50%;
  background: #126b4f;
}

.supply-ticker__swiper,
.supply-ticker__item {
  width: 100%;
  height: 72rpx;
}

.supply-ticker__item {
  display: flex;
  min-width: 0;
  align-items: center;
}

.supply-ticker__item text {
  width: 100%;
  overflow: hidden;
  color: #33443c;
  font-size: 22rpx;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supply-ticker__rank {
  display: flex;
  width: 64rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-left: 1rpx solid #e6ece7;
  background: #f4f9f5;
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

.leaderboard-sheet {
  padding: 26rpx 24rpx 0;
  background: #f7faf7;
}

.leaderboard-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.leaderboard-sheet__title,
.leaderboard-sheet__sub {
  display: block;
}

.leaderboard-sheet__title {
  color: var(--sl-ink);
  font-size: 32rpx;
  font-weight: 900;
}

.leaderboard-sheet__sub {
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 21rpx;
}

.leaderboard-sheet__close {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
}

.leaderboard-detail__heading {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 14rpx;
}

.leaderboard-detail__back {
  display: flex;
  width: 54rpx;
  height: 54rpx;
  flex: 0 0 54rpx;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #eaf4ed;
}

.leaderboard-detail__heading-text {
  min-width: 0;
}

.leaderboard-filter {
  margin-top: 22rpx;
}

.leaderboard-filter__label {
  display: block;
  margin-bottom: 10rpx;
  color: #53615a;
  font-size: 22rpx;
  font-weight: 800;
}

.leaderboard-options {
  display: grid;
  gap: 8rpx;
  padding: 6rpx;
  border-radius: 8rpx;
  background: #eaf0eb;
}

.leaderboard-options--days {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.leaderboard-options--sort {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.leaderboard-option {
  display: flex;
  min-width: 0;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 6rpx;
  color: #617068;
  font-size: 22rpx;
  font-weight: 750;
}

.leaderboard-option.active {
  background: #fff;
  box-shadow: 0 3rpx 12rpx rgb(31 60 45 / 10%);
  color: #126b4f;
}

.leaderboard-list {
  height: 560rpx;
  margin-top: 24rpx;
}

.leaderboard-row {
  display: grid;
  grid-template-columns: 52rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  padding: 22rpx 4rpx;
  border-bottom: 1rpx solid #e3eae5;
}

.leaderboard-row__rank {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e7ece8;
  color: #68766f;
  font-size: 22rpx;
  font-weight: 900;
}

.leaderboard-row__rank.rank-1 {
  background: #e2b23a;
  color: #fff;
}

.leaderboard-row__rank.rank-2 {
  background: #84979b;
  color: #fff;
}

.leaderboard-row__rank.rank-3 {
  background: #b77b4c;
  color: #fff;
}

.leaderboard-row__body {
  min-width: 0;
}

.leaderboard-row__name,
.leaderboard-row__meta {
  display: block;
}

.leaderboard-row__name {
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 26rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leaderboard-row__meta {
  margin-top: 5rpx;
  color: var(--sl-muted);
  font-size: 19rpx;
}

.leaderboard-row__value {
  color: #126b4f;
  font-size: 25rpx;
  font-weight: 900;
}

.leaderboard-row__tail {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.leaderboard-detail {
  margin-top: 22rpx;
}

.leaderboard-detail__summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1rpx solid #dfe9e2;
  border-radius: 8rpx;
  background: #edf6ef;
}

.leaderboard-detail__summary view {
  display: flex;
  min-width: 0;
  height: 104rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-right: 1rpx solid #dfe9e2;
}

.leaderboard-detail__summary view:last-child {
  border-right: 0;
}

.leaderboard-detail__summary text:first-child {
  color: #126b4f;
  font-size: 32rpx;
  font-weight: 900;
}

.leaderboard-detail__summary text:last-child {
  margin-top: 4rpx;
  color: #68766f;
  font-size: 20rpx;
}

.leaderboard-detail__list {
  height: 610rpx;
  margin-top: 18rpx;
}

.leaderboard-detail__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 4rpx;
  border-bottom: 1rpx solid #e3eae5;
}

.leaderboard-detail__body {
  min-width: 0;
}

.leaderboard-detail__action,
.leaderboard-detail__time {
  display: block;
}

.leaderboard-detail__action {
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 24rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leaderboard-detail__time {
  margin-top: 7rpx;
  color: var(--sl-muted);
  font-size: 20rpx;
}

.leaderboard-detail__count {
  padding: 8rpx 12rpx;
  border-radius: 6rpx;
  background: #eaf4ed;
  color: #126b4f;
  font-size: 21rpx;
  font-weight: 850;
}

.leaderboard-empty {
  padding: 90rpx 20rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
