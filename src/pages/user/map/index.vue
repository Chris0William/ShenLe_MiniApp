<script setup lang="ts">
import type { PageSlCommunityInput, PropertyFilterState, SlCommunityOutput, SlCommunityTickerOutput, SlPublicRegionPreviewOutput, SlSourceContactCommunityOutput, SlSupplyLeaderboardDetailItemOutput, SlSupplyLeaderboardDimension, SlSupplyLeaderboardOutput, SlSupplyRecentOutput } from '@/types/shenle'
import { onLoad, onShow, onUnload } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import { getCommunityDetail, getCommunityPage, getCommunityTickers, setCommunityHotLevel } from '@/api/community'
import { getPublicRegionMap } from '@/api/public-preview'
import { getRecentSupplyActivity, getSupplyLeaderboard, getSupplyLeaderboardDetails } from '@/api/supply-activity'
import SlPetPolicyText from '@/components/sl-pet-policy-text/sl-pet-policy-text.vue'
import { useShenleAuthStore } from '@/store/auth'
import { useLandlordShareStore } from '@/store/landlord-share'
import { modeStore } from '@/store/mode'
import { useSourceContactStore } from '@/store/source-contact'
import { ensureCanUse } from '@/utils/auth-guard'
import { formatCommissionRange } from '@/utils/commission'
import { managementFeeText, networkFeeText } from '@/utils/community-business'
import { getLocationOnceCached, setCachedLocation } from '@/utils/location-cache'
import { requestLogin } from '@/utils/login-flow'
import { buildCommunityFilterQuery, countCommunityFilters, getCommunityFilterLabels } from '@/utils/property-filter'
import { useSafeTopStyle } from '@/utils/safe-area'
import { idToQuery } from '@/utils/shenle'
import { formatRecentSupplyActivity, formatSupplyDateTime } from '@/utils/supply-activity'

definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '地图',
    disableScroll: true,
  },
})

const DEFAULT_CENTER = { latitude: 22.5431, longitude: 114.0579 }
const mapId = 'property-map'
const safeTop = useSafeTopStyle()
const auth = useShenleAuthStore()
const landlordShare = useLandlordShareStore()
const shareOwnerName = landlordShare.ownerName
const shareCommunityCount = landlordShare.communityCount
const sourceContact = useSourceContactStore()
const isLandlordView = computed(() => modeStore.mode === 'landlord')
const isAdminMode = computed(() => modeStore.mode === 'admin')
const isBusinessMode = computed(() => modeStore.mode === 'user')
const canManage = computed(() => auth.canEnterAdmin && isAdminMode.value)
const canViewSupplyLeaderboard = computed(() => auth.isAdmin && isAdminMode.value)
const canViewSupplyActivityDetails = computed(() => auth.isSuperAdmin && isAdminMode.value)
const canSetHotLevel = computed(() => auth.canSetCommunityHotLevel && isAdminMode.value)
// “仅看我管理/我更新”只属于管理端地图；业务员端地图不展示管理筛选。
const showMineFilters = computed(() => isAdminMode.value && auth.canEnterAdmin)
const isPreviewMode = computed(() => !auth.canViewRealData)
const hasLandlordShare = computed(() => landlordShare.active.value)

const keyword = ref('')
const filters = ref<PropertyFilterState>({})
const mapLat = ref(DEFAULT_CENTER.latitude)
const mapLng = ref(DEFAULT_CENTER.longitude)
const mapScale = ref(13)
const communities = ref<SlCommunityOutput[]>([])
const previewRegions = ref<SlPublicRegionPreviewOutput[]>([])
const loading = ref(false)
const pageRefreshing = ref(false)
const locating = ref(false)
const choosingReferencePoint = ref(false)
const locationLabel = ref('点击选择位置')
const recentCommunityTickers = ref<SlCommunityTickerOutput[]>([])
const hotCommunityTickers = ref<SlCommunityTickerOutput[]>([])
const hotLevelSavingId = ref('')
const hotTickerVisible = ref(false)
const recentActivities = ref<SlSupplyRecentOutput[]>([])
const leaderboard = ref<SlSupplyLeaderboardOutput[]>([])
const leaderboardVisible = ref(false)
const leaderboardLoading = ref(false)
const leaderboardDays = ref(7)
const leaderboardSort = ref<SlSupplyLeaderboardDimension>('affectedCount')
const leaderboardDetail = ref<SlSupplyLeaderboardOutput | null>(null)
const leaderboardDetails = ref<SlSupplyLeaderboardDetailItemOutput[]>([])
const leaderboardDetailLoading = ref(false)
const leaderboardDetailPage = ref(1)
const leaderboardDetailTotalValue = ref(0)
const leaderboardDetailHasMore = ref(false)
const selectedActivity = ref<SlSupplyLeaderboardDetailItemOutput | null>(null)
const activityTargets = ref<SlSupplyLeaderboardDetailItemOutput[]>([])
const activityTargetLoading = ref(false)
const activityTargetPage = ref(1)
const activityTargetTotalValue = ref(0)
const activityTargetHasMore = ref(false)
let mapContext: UniApp.MapContext | null = null
let referencePointVersion = 0
let leaderboardRequestVersion = 0
let communityLoadVersion = 0
let landlordFitTimer: ReturnType<typeof setTimeout> | null = null
let shareActivationPromise: Promise<boolean> | null = null
let shareApplyRedirected = false

const leaderboardDayOptions = [1, 3, 7, 30]
const allLeaderboardSortOptions = [
  { value: 'affectedCount' as const, label: '更新数据' },
  { value: 'activityCount' as const, label: '操作记录' },
  { value: 'communityCount' as const, label: '覆盖楼盘' },
]
const leaderboardSortOptions = computed(() => auth.isSuperAdmin
  ? allLeaderboardSortOptions
  : allLeaderboardSortOptions.filter(option => option.value === 'communityCount'))

const filterCount = computed(() => countCommunityFilters(filters.value))
const activeCount = computed(() => filterCount.value + (keyword.value.trim() ? 1 : 0))
const filterLabels = computed(() => getCommunityFilterLabels(filters.value))
const showSupplyTicker = computed(() => canViewSupplyLeaderboard.value)
const showRecentCommunityTicker = computed(() => isBusinessMode.value && auth.canViewRealData && recentCommunityTickers.value.length > 0)
const showHotCommunityTicker = computed(() => isBusinessMode.value && auth.canViewRealData && hotCommunityTickers.value.length > 0)
const showBottomTicker = computed(() => showSupplyTicker.value || showRecentCommunityTicker.value)
const leaderboardEntryText = computed(() => canViewSupplyActivityDetails.value ? '查看盘源更新榜' : '查看覆盖楼盘榜')
const leaderboardDimensionLabel = computed(() => leaderboardSortOptions.value.find(option => option.value === leaderboardSort.value)?.label || '更新数据')
const leaderboardDimensionUnit = computed(() => {
  if (leaderboardSort.value === 'activityCount')
    return '次'
  if (leaderboardSort.value === 'communityCount')
    return '个'
  return '条'
})
const leaderboardDetailTitle = computed(() => {
  if (selectedActivity.value)
    return `${selectedActivity.value.actionName}的具体对象`
  return `${leaderboardDetail.value?.nickName || '用户'}的${leaderboardDimensionLabel.value}明细`
})
const visibleDetailItems = computed(() => selectedActivity.value ? activityTargets.value : leaderboardDetails.value)
const visibleDetailLoading = computed(() => selectedActivity.value ? activityTargetLoading.value : leaderboardDetailLoading.value)
const visibleDetailHasMore = computed(() => selectedActivity.value ? activityTargetHasMore.value : leaderboardDetailHasMore.value)
const visibleDetailTotalValue = computed(() => selectedActivity.value ? activityTargetTotalValue.value : leaderboardDetailTotalValue.value)
const visibleDetailDimension = computed<SlSupplyLeaderboardDimension>(() => selectedActivity.value ? 'affectedCount' : leaderboardSort.value)
const mapBadgeText = computed(() => {
  if (loading.value)
    return '加载中'
  return isPreviewMode.value ? `${previewRegions.value.length} 个片区` : `${communities.value.length} 个楼盘`
})

const landlordCoordinateCommunities = computed(() => sourceContact.communities.filter(hasLandlordCoordinate))
const landlordProfileStats = computed(() => [
  { label: '楼盘', value: sourceContact.profile?.communityCount || 0 },
  { label: '空置', value: sourceContact.profile?.availableCount || 0 },
  { label: '已租', value: sourceContact.profile?.rentedCount || 0 },
  { label: '推广', value: sourceContact.profile?.promotedCount || 0 },
])
const landlordMarkers = computed(() => landlordCoordinateCommunities.value.map((item, index) => ({
  id: index + 1,
  latitude: Number(item.lat),
  longitude: Number(item.lng),
  iconPath: '/static/images/pin-green.png',
  width: 28,
  height: 34,
  anchor: { x: 0.5, y: 1 },
  callout: {
    display: 'ALWAYS' as const,
    content: `${item.name}\n${item.availableCount} 套可用`,
    padding: 7,
    borderRadius: 7,
    borderWidth: 0,
    borderColor: '#126b4f',
    fontSize: 11,
    color: '#ffffff',
    bgColor: '#126b4f',
    textAlign: 'center' as const,
  },
})))

// ===== marker 体系 =====
type MarkerMeta = { type: 'single', community: SlCommunityOutput } | { type: 'preview', region: SlPublicRegionPreviewOutput }
const markers = ref<any[]>([])
const activeMarkers = computed(() => isLandlordView.value ? landlordMarkers.value : markers.value)
const selected = ref<SlCommunityOutput | null>(null)
const selectedPreview = ref<SlPublicRegionPreviewOutput | null>(null)
const landlordSelected = ref<SlSourceContactCommunityOutput | null>(null)
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

function landlordRentText(item: SlSourceContactCommunityOutput) {
  const min = Number(item.minRentPrice || 0)
  const max = Number(item.maxRentPrice || 0)
  if (min > 0 && max > 0 && max !== min)
    return `¥${min}-${max}/月`
  if (min > 0)
    return `¥${min}/月起`
  return '租金待完善'
}

function landlordCoverUrl(item: SlSourceContactCommunityOutput) {
  const isVideo = item.coverFileType?.startsWith('video')
    || ['.mp4', '.mov', '.m4v', '.avi', '.webm'].includes((item.coverSuffix || '').toLowerCase())
  return isVideo ? item.coverPosterUrl : item.coverImage
}

function hasLandlordCoordinate(item: SlSourceContactCommunityOutput) {
  if (item.lat === null || item.lat === undefined || item.lng === null || item.lng === undefined)
    return false
  const latitude = Number(item.lat)
  const longitude = Number(item.lng)
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && (latitude !== 0 || longitude !== 0)
}

function moneyText(value?: number | null, unit = '元') {
  return value === null || value === undefined ? '未设置' : `${value}${unit}`
}

function showCommunityAnnouncement(item: SlCommunityOutput) {
  const announcement = item.announcement?.trim()
  if (!announcement)
    return
  uni.showModal({
    title: `${item.name}公告`,
    content: announcement,
    showCancel: false,
    confirmText: '知道了',
  })
}

function commissionText(item: { lowestHalfYearCommissionPercent?: number | null, highestHalfYearCommissionPercent?: number | null, lowestOneYearCommissionPercent?: number | null, highestOneYearCommissionPercent?: number | null }) {
  return `半年 ${formatCommissionRange(item.lowestHalfYearCommissionPercent, item.highestHalfYearCommissionPercent)} · 一年 ${formatCommissionRange(item.lowestOneYearCommissionPercent, item.highestOneYearCommissionPercent)}`
}

function hotLevelCount(level?: number | null, expireTime?: string | null) {
  if (expireTime && new Date(expireTime).getTime() <= Date.now())
    return 0
  return Math.max(0, Math.min(5, Number(level) || 0))
}

function hotExpireText(expireTime?: string | null) {
  if (!expireTime)
    return '长期有效'
  const date = new Date(expireTime)
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    return '已到期'
  return `到期 ${date.getMonth() + 1}月${date.getDate()}日`
}

function formatCommunityUpdateTime(value?: string | null) {
  return value ? formatSupplyDateTime(value) : '暂无更新记录'
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
  if (isLandlordView.value)
    return
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
    landlordShareToken: hasLandlordShare.value ? landlordShare.shareToken.value : undefined,
    availableOnly: isBusinessMode.value || undefined,
  }
}

async function activateLandlordShare() {
  if (!landlordShare.hasContext.value)
    return false
  if (shareActivationPromise)
    return shareActivationPromise

  shareActivationPromise = (async () => {
    if (!auth.isLogin) {
      requestLogin({ reason: '登录后查看房东分享的房源', redirect: '/pages/user/map/index' })
      return true
    }
    const result = await landlordShare.resolvePending()
    if (!result) {
      uni.showToast({ title: '房东分享二维码已失效', icon: 'none' })
      landlordShare.clear()
      return false
    }
    if (result.requiresApproval) {
      if (!shareApplyRedirected) {
        shareApplyRedirected = true
        uni.navigateTo({ url: '/pages/common/apply/index' })
      }
      return true
    }
    shareApplyRedirected = false
    await loadCommunities(true)
    await loadCommunityTickerData()
    return true
  })().finally(() => {
    shareActivationPromise = null
  })
  return shareActivationPromise
}

function clearLandlordShare() {
  landlordShare.clear()
  selected.value = null
  selectedPreview.value = null
  void loadCommunities(true)
  void loadCommunityTickerData()
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

function openNavigation(item: SlCommunityOutput) {
  if (!hasCoordinate(item)) {
    uni.showToast({ title: '该楼盘未设置有效位置', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: Number(item.lat),
    longitude: Number(item.lng),
    name: item.name,
    address: item.address || item.name,
    scale: 16,
  })
}

function openLandlordNavigation(item: SlSourceContactCommunityOutput) {
  if (!hasLandlordCoordinate(item)) {
    uni.showToast({ title: '该楼盘未设置有效位置', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: Number(item.lat),
    longitude: Number(item.lng),
    name: item.name,
    address: item.address || item.name,
    scale: 16,
  })
}

async function saveCommunityHotLevel(item: SlCommunityOutput, hotLevel: number, hotExpireTime?: string | null) {
  if (!canSetHotLevel.value || !item.hasLandlord || hotLevelSavingId.value)
    return
  hotLevelSavingId.value = String(item.id)
  try {
    await setCommunityHotLevel(item.id, hotLevel, hotExpireTime)
    item.hotLevel = hotLevel
    item.hotExpireTime = hotExpireTime || null
    if (selected.value && String(selected.value.id) === String(item.id)) {
      selected.value.hotLevel = hotLevel
      selected.value.hotExpireTime = hotExpireTime || null
    }
    void loadCommunityTickerData()
    uni.showToast({ title: hotLevel ? `已设为 ${hotLevel} 级火热` : '已取消火热标记', icon: 'success' })
  }
  catch {
    uni.showToast({ title: '火热等级设置失败', icon: 'none' })
  }
  finally {
    hotLevelSavingId.value = ''
  }
}

function chooseCommunityHotLevel(item: SlCommunityOutput) {
  if (!canSetHotLevel.value || !item.hasLandlord)
    return
  uni.showActionSheet({
    itemList: ['取消火热标记', '1 级', '2 级', '3 级', '4 级', '5 级'],
    success: (result) => {
      if (result.tapIndex === 0) {
        void saveCommunityHotLevel(item, 0, null)
        return
      }
      uni.showActionSheet({
        itemList: ['7天后到期', '30天后到期', '长期有效'],
        success: (expiry) => {
          const hotExpireTime = expiry.tapIndex === 2
            ? null
            : new Date(Date.now() + (expiry.tapIndex === 0 ? 7 : 30) * 24 * 60 * 60 * 1000).toISOString()
          void saveCommunityHotLevel(item, result.tapIndex, hotExpireTime)
        },
      })
    },
  })
}

async function focusHotCommunity(item: SlCommunityTickerOutput, clearHidden = false) {
  let target = communities.value.find(community => String(community.id) === String(item.communityId)) || null
  if (!target) {
    if (!clearHidden) {
      uni.showModal({
        title: '当前筛选已隐藏该楼盘',
        content: '清除当前筛选后定位到该楼盘？',
        confirmText: '清除并定位',
        success: (result) => {
          if (result.confirm)
            void focusHotCommunity(item, true)
        },
      })
      return
    }
    await resetFilters()
    target = communities.value.find(community => String(community.id) === String(item.communityId)) || null
    try {
      if (!target) {
        target = await getCommunityDetail(item.communityId, isBusinessMode.value)
        communities.value = [target]
        rebuildMarkers()
      }
    }
    catch {
      return
    }
  }
  selectedPreview.value = null
  selected.value = target
  mapLat.value = Number(target.lat ?? item.latitude ?? DEFAULT_CENTER.latitude)
  mapLng.value = Number(target.lng ?? item.longitude ?? DEFAULT_CENTER.longitude)
  mapScale.value = 15
  mapContext?.moveToLocation({ latitude: mapLat.value, longitude: mapLng.value, fail: () => {} })
  hotTickerVisible.value = false
}

function openHotTickerList() {
  hotTickerVisible.value = true
}

async function loadPreviewRegions(fitToResult = false) {
  const requestVersion = ++communityLoadVersion
  loading.value = true
  try {
    const rows = await getPublicRegionMap(buildPreviewQuery())
    if (requestVersion !== communityLoadVersion)
      return
    previewRegions.value = rows
    communities.value = []
    selected.value = null
    selectedPreview.value = null
    refreshRegionAndMarkers()
    if (fitToResult)
      fitMapToPreviewRegions()
  }
  finally {
    if (requestVersion === communityLoadVersion) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

async function loadCommunities(fitToResult = false) {
  if (isPreviewMode.value) {
    await loadPreviewRegions(fitToResult)
    return
  }
  const requestVersion = ++communityLoadVersion
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
    if (requestVersion !== communityLoadVersion)
      return
    communities.value = candidates.filter(hasCoordinate)
    selected.value = null
    // 筛选后把地图视野移到结果范围，否则结果在屏幕外看着像"没变化"
    if (fitToResult)
      fitMapToCommunities()
    refreshRegionAndMarkers()
  }
  finally {
    if (requestVersion === communityLoadVersion) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
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

function fitMapToLandlordCommunities() {
  const points = landlordCoordinateCommunities.value.map(item => ({
    latitude: Number(item.lat),
    longitude: Number(item.lng),
  }))
  if (!points.length || !mapContext)
    return
  mapLat.value = points[0].latitude
  mapLng.value = points[0].longitude
  if (points.length === 1) {
    mapScale.value = 15
    mapContext.moveToLocation({ latitude: points[0].latitude, longitude: points[0].longitude, fail: () => {} })
    return
  }
  mapScale.value = 12
  mapContext.includePoints({ points, padding: [56, 44, 160, 44] })
}

async function activateLandlordMap(force = false, fitToResult = true) {
  await sourceContact.load(force)
  const firstPoint = landlordCoordinateCommunities.value[0]
  if (fitToResult && firstPoint) {
    mapLat.value = Number(firstPoint.lat)
    mapLng.value = Number(firstPoint.lng)
    mapScale.value = landlordCoordinateCommunities.value.length === 1 ? 15 : 12
  }
  if (!fitToResult)
    return
  await nextTick()
  if (landlordFitTimer)
    clearTimeout(landlordFitTimer)
  landlordFitTimer = setTimeout(() => {
    landlordFitTimer = null
    fitMapToLandlordCommunities()
  }, 120)
}

async function refreshLandlordMap() {
  const selectedId = landlordSelected.value?.id
  try {
    await activateLandlordMap(true, false)
    landlordSelected.value = selectedId
      ? landlordCoordinateCommunities.value.find(item => String(item.id) === String(selectedId)) || null
      : null
  }
  finally {
    uni.stopPullDownRefresh()
  }
}

async function refreshMapPage() {
  if (pageRefreshing.value)
    return
  pageRefreshing.value = true
  try {
    if (isLandlordView.value) {
      await refreshLandlordMap()
      return
    }
    const selectedId = selected.value?.id
    await loadCommunities(false)
    selected.value = selectedId
      ? communities.value.find(item => String(item.id) === String(selectedId)) || null
      : null
    await loadCommunityTickerData()
  }
  finally {
    pageRefreshing.value = false
  }
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

async function resetFilters() {
  const userLng = filters.value.userLng
  const userLat = filters.value.userLat
  filters.value = { userLng, userLat }
  keyword.value = ''
  await loadCommunities(true)
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
    url: `/pages/common/community-properties/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}&distance=${encodeURIComponent(String(item.distance ?? ''))}`,
  })
}

async function loadSupplyActivity() {
  if (!canViewSupplyLeaderboard.value) {
    recentActivities.value = []
    leaderboardVisible.value = false
    return
  }
  if (!canViewSupplyActivityDetails.value) {
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

async function loadCommunityTickerData() {
  if (!isBusinessMode.value || !auth.canViewRealData) {
    recentCommunityTickers.value = []
    hotCommunityTickers.value = []
    return
  }
  try {
    const result = await getCommunityTickers(hasLandlordShare.value ? landlordShare.shareToken.value : undefined)
    recentCommunityTickers.value = result.recent || []
    hotCommunityTickers.value = result.hot || []
  }
  catch {
    recentCommunityTickers.value = []
    hotCommunityTickers.value = []
  }
}

function onMapMarkerTap(event: any) {
  if (isLandlordView.value) {
    landlordSelected.value = landlordCoordinateCommunities.value[Number(event.detail?.markerId) - 1] || null
    return
  }
  onMarkerTap(event)
}

function openLandlordRoomState(item: SlSourceContactCommunityOutput) {
  sourceContact.selectCommunity(item.id)
  uni.switchTab({ url: '/pages/admin/sales-control/index' })
}

async function loadLeaderboard() {
  if (!canViewSupplyLeaderboard.value)
    return
  if (!auth.isSuperAdmin)
    leaderboardSort.value = 'communityCount'
  const requestVersion = ++leaderboardRequestVersion
  leaderboardLoading.value = true
  try {
    const result = await getSupplyLeaderboard(leaderboardDays.value, 50, leaderboardSort.value)
    if (requestVersion === leaderboardRequestVersion)
      leaderboard.value = result
  }
  catch {
    if (requestVersion === leaderboardRequestVersion) {
      leaderboard.value = []
      uni.showToast({ title: '更新榜单加载失败', icon: 'none' })
    }
  }
  finally {
    if (requestVersion === leaderboardRequestVersion)
      leaderboardLoading.value = false
  }
}

function openLeaderboard() {
  if (!canViewSupplyLeaderboard.value)
    return
  if (!auth.isSuperAdmin)
    leaderboardSort.value = 'communityCount'
  leaderboardDetail.value = null
  resetLeaderboardDetail()
  leaderboardVisible.value = true
  void loadLeaderboard()
}

function closeLeaderboard() {
  leaderboardVisible.value = false
}

function resetActivityTargets() {
  selectedActivity.value = null
  activityTargets.value = []
  activityTargetPage.value = 1
  activityTargetTotalValue.value = 0
  activityTargetHasMore.value = false
}

function resetLeaderboardDetail() {
  leaderboardDetails.value = []
  leaderboardDetailPage.value = 1
  leaderboardDetailTotalValue.value = 0
  leaderboardDetailHasMore.value = false
  resetActivityTargets()
}

async function loadLeaderboardDetails(item: SlSupplyLeaderboardOutput, append = false) {
  if (!canViewSupplyLeaderboard.value || leaderboardDetailLoading.value || (append && !leaderboardDetailHasMore.value))
    return
  const page = append ? leaderboardDetailPage.value + 1 : 1
  leaderboardDetailLoading.value = true
  try {
    const result = await getSupplyLeaderboardDetails(
      item.userId,
      leaderboardDays.value,
      leaderboardSort.value,
      page,
      20,
    )
    leaderboardDetails.value = append ? [...leaderboardDetails.value, ...result.items] : result.items
    leaderboardDetailPage.value = result.page
    leaderboardDetailTotalValue.value = result.totalValue
    leaderboardDetailHasMore.value = result.hasMore
  }
  catch {
    if (!append)
      resetLeaderboardDetail()
    uni.showToast({ title: '更新明细加载失败', icon: 'none' })
  }
  finally {
    leaderboardDetailLoading.value = false
  }
}

function openLeaderboardDetail(item: SlSupplyLeaderboardOutput) {
  if (!canViewSupplyLeaderboard.value)
    return
  leaderboardDetail.value = item
  resetLeaderboardDetail()
  void loadLeaderboardDetails(item)
}

function backToLeaderboard() {
  if (selectedActivity.value) {
    resetActivityTargets()
    return
  }
  leaderboardDetail.value = null
  resetLeaderboardDetail()
}

async function loadActivityTargets(append = false) {
  if (!canViewSupplyActivityDetails.value || !leaderboardDetail.value || !selectedActivity.value || activityTargetLoading.value || (append && !activityTargetHasMore.value))
    return
  const page = append ? activityTargetPage.value + 1 : 1
  activityTargetLoading.value = true
  try {
    const result = await getSupplyLeaderboardDetails(
      leaderboardDetail.value.userId,
      leaderboardDays.value,
      'affectedCount',
      page,
      20,
      selectedActivity.value.activityId,
    )
    activityTargets.value = append ? [...activityTargets.value, ...result.items] : result.items
    activityTargetPage.value = result.page
    activityTargetTotalValue.value = result.totalValue
    activityTargetHasMore.value = result.hasMore
  }
  catch {
    if (!append) {
      activityTargets.value = []
      activityTargetTotalValue.value = 0
      activityTargetHasMore.value = false
    }
    uni.showToast({ title: '操作对象加载失败', icon: 'none' })
  }
  finally {
    activityTargetLoading.value = false
  }
}

function openActivityTargets(activity: SlSupplyLeaderboardDetailItemOutput) {
  if (!canViewSupplyActivityDetails.value || leaderboardSort.value !== 'activityCount')
    return
  selectedActivity.value = activity
  activityTargets.value = []
  activityTargetPage.value = 1
  activityTargetTotalValue.value = 0
  activityTargetHasMore.value = false
  void loadActivityTargets()
}

function loadMoreLeaderboardDetail() {
  if (selectedActivity.value)
    void loadActivityTargets(true)
  else if (leaderboardDetail.value)
    void loadLeaderboardDetails(leaderboardDetail.value, true)
}

async function openRecentActivityDetail(activity: SlSupplyRecentOutput) {
  if (!canViewSupplyActivityDetails.value)
    return
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
  resetLeaderboardDetail()
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

function selectLeaderboardSort(sort: SlSupplyLeaderboardDimension) {
  if (!auth.isSuperAdmin && sort !== 'communityCount')
    return
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
  return `${item.affectedCount} 条`
}

function entityTypeLabel(entityType: string) {
  if (entityType === 'property')
    return '房源'
  if (entityType === 'building')
    return '楼栋'
  return '楼盘'
}

function detailTitle(item: SlSupplyLeaderboardDetailItemOutput) {
  if (visibleDetailDimension.value === 'communityCount')
    return item.communityName
  if (visibleDetailDimension.value === 'activityCount') {
    const hasSpecificTarget = Boolean(item.propertyId || item.buildingId || item.entityType === 'community')
    return hasSpecificTarget && item.entityName ? `${item.actionName} · ${item.entityName}` : item.actionName
  }
  return item.entityName || item.actionName
}

function detailPath(item: SlSupplyLeaderboardDetailItemOutput) {
  const parts = [item.communityName]
  if (item.buildingName && item.buildingName !== item.communityName)
    parts.push(item.buildingName)
  return parts.filter(Boolean).join(' / ')
}

function detailMeta(item: SlSupplyLeaderboardDetailItemOutput) {
  const time = formatSupplyDateTime(item.updateTime)
  if (visibleDetailDimension.value === 'communityCount')
    return `最后更新：${time}`
  if (visibleDetailDimension.value === 'activityCount')
    return [detailPath(item), time].filter(Boolean).join(' · ')
  return [detailPath(item), item.actionName, time].filter(Boolean).join(' · ')
}

onLoad((query) => {
  if (query?.scene) {
    landlordShare.capture(String(query.scene))
    modeStore.setMode('user')
  }
  mapContext = uni.createMapContext(mapId)
  if (isLandlordView.value) {
    void activateLandlordMap()
    return
  }
  if (landlordShare.hasContext.value) {
    void activateLandlordShare()
    return
  }
  // 微信合规：打开即可匿名浏览地图/楼盘，不强制登录；搜索/详情/联系等动作再触发登录
  loadCommunities()
  getLocation(false)

  // 仅开发者工具：暴露调试桥，供自动化测试驱动 marker 点击链路（真机不生效）
  try {
    if (uni.getSystemInfoSync().platform === 'devtools') {
      ;(getApp() as any).__mapDebug = {
        tapMarker: (markerId: number) => onMapMarkerTap({ detail: { markerId } }),
        state: () => ({
          communities: communities.value.length,
          previewRegions: previewRegions.value.length,
          landlordCommunities: sourceContact.communities.length,
          markers: activeMarkers.value.length,
          selectedName: isLandlordView.value ? landlordSelected.value?.name || null : selected.value?.name || null,
          markerKinds: markers.value.map((m, i) => markerMeta[i]?.type),
          regionDebug: { ...regionDebug },
        }),
      }
    }
  }
  catch {}
})
onShow(() => {
  if (isLandlordView.value) {
    void activateLandlordMap()
    return
  }
  if (landlordShare.hasContext.value) {
    void activateLandlordShare()
    return
  }
  void loadSupplyActivity()
  void loadCommunityTickerData()
})

onUnload(() => {
  if (regionTimer)
    clearTimeout(regionTimer)
  if (landlordFitTimer)
    clearTimeout(landlordFitTimer)
  mapContext = null
})
</script>

<template>
  <view class="map-page" :class="{ 'map-page--landlord': isLandlordView }" :style="safeTop">
    <template v-if="isLandlordView">
      <sl-source-contact-header title="我的楼盘" refresh :refreshing="pageRefreshing || sourceContact.loading" @refresh="refreshMapPage" />

      <view class="landlord-stats-strip">
        <view v-for="item in landlordProfileStats" :key="item.label" class="landlord-stats-strip__item">
          <text class="landlord-stats-strip__value">{{ item.value }}</text>
          <text class="landlord-stats-strip__label">{{ item.label }}</text>
        </view>
      </view>
    </template>

    <template v-else>
      <view class="map-head">
        <text class="map-head__title">楼盘地图</text>
        <view class="map-head__refresh" aria-label="刷新" @tap="refreshMapPage">
          <wd-icon name="refresh" size="20px" color="#126b4f" :class="{ 'map-head__refresh-icon--loading': pageRefreshing }" />
        </view>
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
        <text class="active-summary__clear" @tap="resetFilters">清空</text>
      </view>
    </template>

    <view class="map-shell" :class="{ 'sl-card': !isLandlordView, 'map-shell--landlord': isLandlordView }">
      <map
        :id="mapId"
        class="map"
        :latitude="mapLat"
        :longitude="mapLng"
        :scale="mapScale"
        :markers="activeMarkers"
        show-location
        @markertap="onMapMarkerTap"
        @callouttap="onMapMarkerTap"
        @regionchange="onRegionChange"
      >
        <cover-view v-if="!isLandlordView" class="map-badge" :class="{ 'map-badge--below-hot': showHotCommunityTicker }">
          <cover-view class="map-badge__text">{{ mapBadgeText }}</cover-view>
        </cover-view>
      </map>

      <template v-if="isLandlordView">
        <view v-if="sourceContact.loading && !sourceContact.communities.length" class="landlord-map-empty">
          <wd-loading color="#126b4f" />
          <text>正在加载名下盘源</text>
        </view>
        <view v-else-if="!sourceContact.communities.length" class="landlord-map-empty">
          <wd-icon name="location" size="30px" color="#8fa098" />
          <text>暂未分配楼盘</text>
          <text class="landlord-map-empty__sub">请联系管理员完成楼盘分配</text>
        </view>
        <view v-else-if="!landlordCoordinateCommunities.length" class="landlord-map-empty">
          <wd-icon name="location" size="30px" color="#8fa098" />
          <text>名下楼盘尚未设置坐标</text>
          <text class="landlord-map-empty__sub">请联系管理员完善楼盘位置</text>
        </view>

        <view v-if="landlordSelected" class="landlord-community-preview">
          <view class="landlord-community-preview__media">
            <image v-if="landlordCoverUrl(landlordSelected)" class="landlord-community-preview__image" :src="landlordCoverUrl(landlordSelected) || ''" mode="aspectFill" />
            <view v-else class="landlord-community-preview__placeholder">
              <wd-icon name="home" size="30px" color="#126b4f" />
            </view>
            <view v-if="landlordSelected.promotedCount" class="landlord-promotion-mark">
              推广 {{ landlordSelected.promotedCount }} 套
            </view>
          </view>
          <view class="landlord-community-preview__body">
            <view class="landlord-community-preview__head">
              <text class="landlord-community-preview__name">{{ landlordSelected.name }}</text>
              <view class="landlord-community-preview__close" @tap.stop="landlordSelected = null">
                <wd-icon name="close" size="16px" color="#7a8780" />
              </view>
            </view>
            <text class="landlord-community-preview__rent">{{ landlordRentText(landlordSelected) }}</text>
            <view class="landlord-community-preview__fees">
              <text class="landlord-community-preview__fee">水 {{ moneyText(landlordSelected.waterFee, '元/吨') }}</text>
              <text class="landlord-community-preview__fee">电 {{ moneyText(landlordSelected.electricityFee, '元/度') }}</text>
              <text class="landlord-community-preview__fee">管理 {{ managementFeeText(landlordSelected) }}</text>
              <text class="landlord-community-preview__fee">网络 {{ networkFeeText(landlordSelected) }}</text>
            </view>
            <view class="landlord-community-preview__commission">
              <view class="landlord-community-preview__commission-main">
                <text>佣金条件</text>
                <text>{{ commissionText(landlordSelected) }}</text>
              </view>
              <sl-pet-policy-text v-if="landlordSelected.petPolicy" :value="landlordSelected.petPolicy" class="landlord-community-preview__pet" />
            </view>
            <text class="landlord-community-preview__meta">
              {{ landlordSelected.buildingCount }} 栋 · {{ landlordSelected.availableCount }} 套可用 · {{ landlordSelected.rentedCount }} 套已租
            </text>
            <view class="landlord-community-preview__foot">
              <text class="landlord-community-preview__time">更新 {{ formatCommunityUpdateTime(landlordSelected.supplyUpdateTime) }}</text>
              <wd-button size="small" plain @click="openLandlordNavigation(landlordSelected)">
                导航
              </wd-button>
              <wd-button type="primary" size="small" @click="openLandlordRoomState(landlordSelected)">
                查看楼盘
              </wd-button>
            </view>
          </view>
        </view>
      </template>

      <template v-else>
        <view v-if="showHotCommunityTicker" class="community-ticker community-ticker--hot">
          <view class="community-ticker__signal community-ticker__signal--hot">
            <view class="i-carbon-fire community-ticker__signal-icon" />
          </view>
          <swiper class="community-ticker__swiper" vertical autoplay circular :interval="4200" :duration="350">
            <swiper-item v-for="item in hotCommunityTickers" :key="String(item.communityId)">
              <view class="community-ticker__item" @tap.stop="focusHotCommunity(item)">
                <text class="community-ticker__text">【{{ item.communityName }}】正在火热招租</text>
                <view class="community-ticker__hot-icons">
                  <view v-for="level in hotLevelCount(item.hotLevel, item.hotExpireTime)" :key="level" class="i-carbon-fire community-ticker__hot-icon" />
                </view>
              </view>
            </swiper-item>
          </swiper>
          <view class="community-ticker__list-button" role="button" aria-label="查看火热招租列表" @tap.stop="openHotTickerList">
            <wd-icon name="view-list" size="18px" color="#126b4f" />
          </view>
        </view>

        <view v-if="showSupplyTicker" class="supply-ticker">
          <view class="supply-ticker__signal">
            <wd-icon name="edit" size="16px" color="#fff" />
          </view>
          <swiper v-if="canViewSupplyActivityDetails && recentActivities.length" class="supply-ticker__swiper" vertical autoplay circular :interval="4000" :duration="350">
            <swiper-item v-for="activity in recentActivities" :key="String(activity.id)">
              <view class="supply-ticker__item" @tap.stop="openRecentActivityDetail(activity)">
                <text>{{ formatRecentSupplyActivity(activity) }}</text>
              </view>
            </swiper-item>
          </swiper>
          <view v-else class="supply-ticker__item" @tap.stop="openLeaderboard">
            <text>{{ leaderboardEntryText }}</text>
          </view>
          <view class="supply-ticker__rank" @tap.stop="openLeaderboard">
            <wd-icon name="chart-bar" size="19px" color="#126b4f" />
          </view>
        </view>

        <view v-else-if="showRecentCommunityTicker" class="supply-ticker supply-ticker--recent">
          <view class="supply-ticker__signal">
            <wd-icon name="time" size="16px" color="#fff" />
          </view>
          <swiper class="supply-ticker__swiper" vertical autoplay circular :interval="4000" :duration="350">
            <swiper-item v-for="item in recentCommunityTickers" :key="String(item.communityId)">
              <view class="supply-ticker__item">
                <text>【{{ item.communityName }}】于 {{ formatCommunityUpdateTime(item.supplyUpdateTime) }} 更新</text>
              </view>
            </swiper-item>
          </swiper>
        </view>

        <view v-if="selectedPreview" class="map-card" :class="{ 'map-card--with-ticker': showBottomTicker }">
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

        <view v-if="selected" class="map-card" :class="{ 'map-card--with-ticker': showBottomTicker }">
          <view class="map-card__close" @tap="selected = null">
            <wd-icon name="close" size="16px" color="#9aa3af" />
          </view>
          <view class="map-card__main" @tap="goProperties(selected)">
            <view class="map-card__title-row">
              <text class="map-card__name">{{ selected.name }}</text>
              <view v-if="hotLevelCount(selected.hotLevel, selected.hotExpireTime)" class="map-card__hot">
                <view v-for="level in hotLevelCount(selected.hotLevel, selected.hotExpireTime)" :key="level" class="i-carbon-fire map-card__hot-icon" />
              </view>
            </view>
            <view class="map-card__meta">
              <wd-tag v-if="selected.regionName" plain type="success">
                {{ selected.regionName }}
              </wd-tag>
              <text v-if="isBusinessMode ? selected.availableCount : selected.propertyCount">{{ isBusinessMode ? selected.availableCount : selected.propertyCount }} 套{{ isBusinessMode ? '可租房源' : '房源' }}</text>
              <text v-if="rentText(selected)">{{ rentText(selected) }}</text>
              <text v-if="selected.distance !== null && selected.distance !== undefined">距 {{ selected.distance }}km</text>
            </view>
            <view class="map-card__fees">
              <text>水 {{ moneyText(selected.waterFee, '元/吨') }}</text>
              <text>电 {{ moneyText(selected.electricityFee, '元/度') }}</text>
              <text>管理 {{ managementFeeText(selected) }}</text>
              <text>网络 {{ networkFeeText(selected) }}</text>
            </view>
            <view class="map-card__commission">
              <view class="map-card__commission-main">
                <text>佣金条件</text>
                <text>{{ commissionText(selected) }}</text>
              </view>
              <sl-pet-policy-text v-if="selected.petPolicy" :value="selected.petPolicy" class="map-card__pet" />
            </view>
            <text class="map-card__update">更新 {{ formatCommunityUpdateTime(selected.supplyUpdateTime) }}</text>
          </view>
          <view class="map-card__actions">
            <wd-button v-if="isBusinessMode && selected.announcement" class="map-card__announcement" size="small" plain icon="notification" @click.stop="showCommunityAnnouncement(selected)">
              公告
            </wd-button>
            <wd-button
              v-if="canSetHotLevel && selected.hasLandlord"
              size="small"
              plain
              :loading="hotLevelSavingId === String(selected.id)"
              @click.stop="chooseCommunityHotLevel(selected)"
            >
              火热 {{ hotLevelCount(selected.hotLevel, selected.hotExpireTime) || '未设' }}
              <text v-if="hotLevelCount(selected.hotLevel, selected.hotExpireTime)"> · {{ hotExpireText(selected.hotExpireTime) }}</text>
            </wd-button>
            <wd-button v-if="canManage" size="small" plain @click="editSelected">
              编辑楼盘
            </wd-button>
            <wd-button size="small" plain @click.stop="openNavigation(selected)">
              导航
            </wd-button>
            <wd-button size="small" type="primary" @click="goProperties(selected)">
              查看房源
            </wd-button>
          </view>
        </view>
      </template>
    </view>

    <wd-popup
      v-if="canViewSupplyLeaderboard"
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
              <text class="leaderboard-sheet__title">{{ leaderboardDetailTitle }}</text>
              <text class="leaderboard-sheet__sub">
                {{ selectedActivity ? `操作时间：${formatSupplyDateTime(selectedActivity.updateTime)}` : `近 ${leaderboardDays} 天 · ${leaderboardDimensionLabel}` }}
              </text>
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
            <view class="leaderboard-options leaderboard-options--sort" :class="{ 'is-single': leaderboardSortOptions.length === 1 }">
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
                  最近更新：{{ formatSupplyDateTime(item.lastUpdateTime) }}
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
            <text>{{ selectedActivity ? '本次操作涉及' : '共' }}</text>
            <text>{{ visibleDetailTotalValue }}</text>
            <text>{{ selectedActivity ? '条数据' : leaderboardDimensionUnit }}</text>
          </view>
          <scroll-view scroll-y class="leaderboard-detail__list" @scrolltolower="loadMoreLeaderboardDetail">
            <view v-if="visibleDetailLoading && !visibleDetailItems.length" class="leaderboard-empty">
              明细加载中...
            </view>
            <view v-else-if="!visibleDetailItems.length" class="leaderboard-empty">
              所选时间范围内暂无更新明细
            </view>
            <view
              v-for="activity in visibleDetailItems"
              v-else
              :key="`${String(activity.activityId)}-${String(activity.id)}`"
              class="leaderboard-detail__row"
              :class="{ 'is-clickable': visibleDetailDimension === 'activityCount' }"
              @tap="openActivityTargets(activity)"
            >
              <view class="leaderboard-detail__body">
                <view class="leaderboard-detail__title-line">
                  <text v-if="visibleDetailDimension === 'affectedCount'" class="leaderboard-detail__type">
                    {{ entityTypeLabel(activity.entityType) }}
                  </text>
                  <text class="leaderboard-detail__action">{{ detailTitle(activity) }}</text>
                  <text v-if="activity.isLegacyAggregate" class="leaderboard-detail__legacy">历史汇总</text>
                </view>
                <text class="leaderboard-detail__time">{{ detailMeta(activity) }}</text>
              </view>
              <view class="leaderboard-detail__tail">
                <text v-if="visibleDetailDimension === 'affectedCount' && activity.metricValue > 1" class="leaderboard-detail__count">
                  {{ activity.metricValue }} 条
                </text>
                <wd-icon v-if="visibleDetailDimension === 'activityCount'" name="arrow-right" size="16px" color="#8a978f" />
              </view>
            </view>
            <view v-if="visibleDetailLoading && visibleDetailItems.length" class="leaderboard-detail__more">
              加载中...
            </view>
            <view v-else-if="!visibleDetailHasMore && visibleDetailItems.length" class="leaderboard-detail__more">
              已展示全部明细
            </view>
          </scroll-view>
        </view>
      </view>
    </wd-popup>

    <wd-popup
      v-model="hotTickerVisible"
      position="bottom"
      :z-index="2900"
      custom-style="border-radius: 24rpx 24rpx 0 0; overflow: hidden;"
      safe-area-inset-bottom
      @touchmove.stop
    >
      <view class="hot-ticker-sheet" @tap.stop @touchmove.stop>
        <view class="hot-ticker-sheet__head">
          <view>
            <text class="hot-ticker-sheet__title">火热招租</text>
            <text class="hot-ticker-sheet__sub">按火热等级和更新时间排序</text>
          </view>
          <view class="hot-ticker-sheet__close" @tap="hotTickerVisible = false">
            <wd-icon name="close" size="20px" color="#72817b" />
          </view>
        </view>
        <scroll-view scroll-y class="hot-ticker-sheet__list">
          <view v-for="item in hotCommunityTickers" :key="String(item.communityId)" class="hot-ticker-row" @tap="focusHotCommunity(item)">
            <view class="hot-ticker-row__main">
              <text class="hot-ticker-row__name">{{ item.communityName }}</text>
              <text class="hot-ticker-row__meta">{{ item.availableCount || 0 }} 套可用 · {{ formatCommunityUpdateTime(item.supplyUpdateTime) }}</text>
            </view>
            <view class="hot-ticker-row__level">
              <view v-for="level in hotLevelCount(item.hotLevel, item.hotExpireTime)" :key="level" class="i-carbon-fire hot-ticker-row__fire" />
              <wd-icon name="location" size="18px" color="#126b4f" />
            </view>
          </view>
          <view v-if="!hotCommunityTickers.length" class="hot-ticker-empty">
            暂无火热楼盘
          </view>
        </scroll-view>
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

.map-page--landlord {
  padding-right: 22rpx;
  padding-bottom: calc(126rpx + env(safe-area-inset-bottom));
  padding-left: 22rpx;
}

.landlord-stats-strip {
  display: grid;
  flex: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 16rpx 0;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 8rpx;
  background: #fff;
}

.landlord-stats-strip__item {
  position: relative;
  display: flex;
  min-width: 0;
  padding: 14rpx 6rpx;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.landlord-stats-strip__item + .landlord-stats-strip__item::before {
  position: absolute;
  top: 18rpx;
  bottom: 18rpx;
  left: 0;
  width: 1rpx;
  background: #e5ebe7;
  content: '';
}

.landlord-stats-strip__value {
  color: #126b4f;
  font-size: 28rpx;
  font-weight: 800;
}

.landlord-stats-strip__label {
  color: #72817b;
  font-size: 21rpx;
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

.map-head__refresh {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgb(18 107 79 / 14%);
  border-radius: 8rpx;
  background: #fff;
}

.map-head__refresh-icon--loading {
  animation: map-refresh-spin 0.8s linear infinite;
}

@keyframes map-refresh-spin {
  to {
    transform: rotate(360deg);
  }
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

.map-shell--landlord {
  min-height: 0;
  margin-top: 0;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 8rpx;
  background: #e8eeea;
}

.map {
  display: block;
  width: 100%;
  height: 100%;
}

.landlord-map-empty {
  position: absolute;
  z-index: 12;
  top: 50%;
  left: 50%;
  display: flex;
  width: 360rpx;
  padding: 28rpx 20rpx;
  align-items: center;
  border-radius: 8rpx;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 14rpx 36rpx rgb(27 55 42 / 12%);
  color: #53635c;
  flex-direction: column;
  font-size: 25rpx;
  gap: 12rpx;
  transform: translate(-50%, -50%);
}

.landlord-map-empty__sub {
  color: #8a9791;
  font-size: 22rpx;
}

.landlord-community-preview {
  position: absolute;
  z-index: 12;
  right: 18rpx;
  bottom: 18rpx;
  left: 18rpx;
  display: flex;
  min-height: 244rpx;
  overflow: hidden;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 8rpx;
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 18rpx 42rpx rgb(24 53 39 / 18%);
}

.landlord-community-preview__media {
  position: relative;
  width: 184rpx;
  flex: none;
  background: #e7f0ea;
}

.landlord-community-preview__image,
.landlord-community-preview__placeholder {
  width: 100%;
  height: 100%;
}

.landlord-community-preview__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.landlord-promotion-mark {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  padding: 5rpx 10rpx;
  border-radius: 6rpx;
  background: #126b4f;
  color: #fff;
  font-size: 19rpx;
}

.landlord-community-preview__body {
  display: flex;
  min-width: 0;
  flex: 1;
  padding: 18rpx;
  flex-direction: column;
}

.landlord-community-preview__head,
.landlord-community-preview__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.landlord-community-preview__name {
  overflow: hidden;
  font-size: 29rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.landlord-community-preview__close {
  display: flex;
  width: 42rpx;
  height: 42rpx;
  flex: none;
  align-items: center;
  justify-content: center;
}

.landlord-community-preview__rent {
  margin-top: 7rpx;
  color: #bf6415;
  font-size: 24rpx;
  font-weight: 800;
}

.landlord-community-preview__meta {
  margin-top: 6rpx;
  color: #66756e;
  font-size: 21rpx;
}

.landlord-community-preview__fees {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 5rpx 12rpx;
  margin-top: 8rpx;
  color: #52635b;
  font-size: 19rpx;
}

.landlord-community-preview__fee {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.landlord-community-preview__commission,
.map-card__commission {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 8rpx;
  padding-top: 8rpx;
  border-top: 1rpx solid #edf1ee;
  color: #52635b;
  font-size: 19rpx;
}

.landlord-community-preview__commission-main,
.map-card__commission-main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 10rpx;
}

.landlord-community-preview__commission-main text:last-child,
.map-card__commission-main text:last-child {
  min-width: 0;
  flex: 1;
  line-height: 1.45;
}

.landlord-community-preview__pet,
.map-card__pet {
  flex: none;
  margin-left: 10rpx;
  font-size: 21rpx;
  line-height: 1.45;
  text-align: right;
}

.landlord-community-preview__foot {
  flex-wrap: wrap;
  margin-top: auto;
}

.landlord-community-preview__time {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  color: #8a9791;
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  min-width: 0;
  overflow: hidden;
  font-size: 30rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-card__title-row {
  display: flex;
  min-width: 0;
  padding-right: 48rpx;
  align-items: center;
  gap: 12rpx;
}

.map-card__hot,
.community-ticker__hot-icons {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1rpx;
}

.map-card__hot-icon {
  width: 24rpx;
  height: 24rpx;
  color: #d46d12;
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

.map-card__fees {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6rpx 14rpx;
  margin-top: 12rpx;
  color: #53635c;
  font-size: 20rpx;
}

.map-card__fees text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.map-card__update {
  display: block;
  margin-top: 10rpx;
  color: #88958f;
  font-size: 19rpx;
}

.map-card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14rpx;
  margin-top: 18rpx;
}

.map-card__announcement {
  min-width: 138rpx;
  margin-right: auto;
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

.map-badge--below-hot {
  top: 104rpx;
}

.community-ticker {
  position: absolute;
  right: 16rpx;
  left: 16rpx;
  z-index: 11;
  display: grid;
  height: 72rpx;
  grid-template-columns: 52rpx minmax(0, 1fr) 64rpx;
  align-items: center;
  overflow: hidden;
  border: 1rpx solid rgb(196 99 15 / 18%);
  border-radius: 8rpx;
  background: rgb(255 252 247 / 96%);
  box-shadow: 0 8rpx 28rpx rgb(61 43 25 / 14%);
}

.community-ticker--hot {
  top: 16rpx;
}

.community-ticker__signal {
  display: flex;
  width: 38rpx;
  height: 38rpx;
  align-items: center;
  justify-content: center;
  justify-self: center;
  border-radius: 50%;
  background: #d46d12;
}

.community-ticker__signal-icon {
  width: 24rpx;
  height: 24rpx;
  color: #fff;
}

.community-ticker__swiper,
.community-ticker__item {
  width: 100%;
  height: 72rpx;
}

.community-ticker__item {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10rpx;
  padding-right: 18rpx;
  box-sizing: border-box;
}

.community-ticker__text {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  color: #5d4028;
  font-size: 22rpx;
  font-weight: 780;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-ticker__hot-icon {
  width: 21rpx;
  height: 21rpx;
  color: #d46d12;
}

.community-ticker__list-button {
  display: flex;
  width: 64rpx;
  height: 72rpx;
  align-items: center;
  justify-content: center;
  border-left: 1rpx solid #eadfce;
  background: #fff8ec;
}

.hot-ticker-sheet {
  padding: 26rpx 24rpx 0;
  background: #f7faf7;
}

.hot-ticker-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.hot-ticker-sheet__title,
.hot-ticker-sheet__sub {
  display: block;
}

.hot-ticker-sheet__title {
  color: var(--sl-ink);
  font-size: 32rpx;
  font-weight: 900;
}

.hot-ticker-sheet__sub {
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 21rpx;
}

.hot-ticker-sheet__close {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
}

.hot-ticker-sheet__list {
  height: 620rpx;
  margin-top: 18rpx;
}

.hot-ticker-row {
  display: flex;
  min-height: 92rpx;
  box-sizing: border-box;
  align-items: center;
  gap: 16rpx;
  padding: 18rpx 4rpx;
  border-bottom: 1rpx solid #e3eae5;
}

.hot-ticker-row__main {
  min-width: 0;
  flex: 1;
}

.hot-ticker-row__name,
.hot-ticker-row__meta {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hot-ticker-row__name {
  color: var(--sl-ink);
  font-size: 26rpx;
  font-weight: 850;
}

.hot-ticker-row__meta {
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 20rpx;
}

.hot-ticker-row__level {
  display: flex;
  align-items: center;
  gap: 5rpx;
}

.hot-ticker-row__fire {
  width: 20rpx;
  height: 20rpx;
  color: #d46d12;
}

.hot-ticker-empty {
  padding: 80rpx 0;
  color: var(--sl-muted);
  font-size: 23rpx;
  text-align: center;
}

.supply-ticker--recent {
  grid-template-columns: 52rpx minmax(0, 1fr);
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

.leaderboard-options--sort.is-single {
  grid-template-columns: 1fr;
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
  display: flex;
  height: 88rpx;
  align-items: baseline;
  justify-content: center;
  gap: 8rpx;
  border: 1rpx solid #dfe9e2;
  border-radius: 8rpx;
  background: #edf6ef;
}

.leaderboard-detail__summary text {
  color: #68766f;
  font-size: 22rpx;
  font-weight: 700;
}

.leaderboard-detail__summary text:nth-child(2) {
  color: #126b4f;
  font-size: 36rpx;
  font-weight: 900;
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

.leaderboard-detail__row.is-clickable:active {
  background: #eef5f0;
}

.leaderboard-detail__body {
  min-width: 0;
}

.leaderboard-detail__action,
.leaderboard-detail__time {
  display: block;
}

.leaderboard-detail__title-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10rpx;
}

.leaderboard-detail__type,
.leaderboard-detail__legacy {
  flex: 0 0 auto;
  padding: 5rpx 9rpx;
  border-radius: 5rpx;
  font-size: 18rpx;
  font-weight: 800;
}

.leaderboard-detail__type {
  background: #e1f0e6;
  color: #126b4f;
}

.leaderboard-detail__legacy {
  background: #f3eee0;
  color: #8b6b27;
}

.leaderboard-detail__action {
  min-width: 0;
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

.leaderboard-detail__tail {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.leaderboard-detail__more {
  padding: 24rpx 0 32rpx;
  color: var(--sl-muted);
  font-size: 20rpx;
  text-align: center;
}

.leaderboard-empty {
  padding: 90rpx 20rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
