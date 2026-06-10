<script setup lang="ts">
import type { PageSlCommunityInput, PropertyFilterState, SlCommunityOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { useShenleAuthStore } from '@/store/auth'
import { buildCommunityCandidateFilterQuery, countCommunityFilters, filterCommunitiesByClientDistance, getCommunityFilterLabels } from '@/utils/property-filter'
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

const keyword = ref('')
const filters = ref<PropertyFilterState>({
  userLng: DEFAULT_CENTER.longitude,
  userLat: DEFAULT_CENTER.latitude,
})
const mapLat = ref(DEFAULT_CENTER.latitude)
const mapLng = ref(DEFAULT_CENTER.longitude)
const mapScale = ref(13)
const communities = ref<SlCommunityOutput[]>([])
const loading = ref(false)
const locating = ref(false)
const locationReady = ref(false)
const locationLabel = ref('点击选择位置')
let mapContext: UniApp.MapContext | null = null

const filterCount = computed(() => countCommunityFilters(filters.value))
const activeCount = computed(() => filterCount.value + (keyword.value.trim() ? 1 : 0))
const filterLabels = computed(() => getCommunityFilterLabels(filters.value))

const markers = computed(() => communities.value.map((item, index) => ({
  id: index + 1,
  latitude: Number(item.lat),
  longitude: Number(item.lng),
  iconPath: '/static/images/dot-red.png',
  width: 26,
  height: 26,
})))

function buildQuery(pageNumber = 1, size = 200): PageSlCommunityInput {
  return {
    page: pageNumber,
    pageSize: size,
    name: keyword.value.trim() || undefined,
    status: 0,
    ...buildCommunityCandidateFilterQuery(filters.value),
  }
}

function hasCoordinate(item: SlCommunityOutput) {
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
}

async function loadCommunities() {
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
    communities.value = filterCommunitiesByClientDistance(candidates, filters.value).filter(hasCoordinate)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function requestLocation() {
  return new Promise<UniApp.GetLocationSuccess>((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 4000,
      success: resolve,
      fail: reject,
    })
  })
}

function applyReferencePoint(longitude: number, latitude: number, label: string, moveMap = true) {
  filters.value = {
    ...filters.value,
    userLng: longitude,
    userLat: latitude,
  }
  locationLabel.value = label
  locationReady.value = true
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
  locating.value = true
  try {
    const res = await requestLocation()
    applyReferencePoint(res.longitude, res.latitude, '当前位置')
    if (showTip)
      uni.showToast({ title: '已更新当前位置', icon: 'success' })
    await loadCommunities()
  }
  catch {
    locationReady.value = false
    if (showTip)
      uni.showToast({ title: '定位失败，请手动选点', icon: 'none' })
  }
  finally {
    locating.value = false
  }
}

async function chooseReferencePoint() {
  if (locating.value)
    return
  locating.value = true
  try {
    const res = await new Promise<any>((resolve, reject) => {
      uni.chooseLocation({ success: resolve, fail: reject })
    })
    const label = res.name || res.address || '选定位置'
    applyReferencePoint(res.longitude, res.latitude, label)
    await loadCommunities()
  }
  catch {
    uni.showToast({ title: '未选择位置', icon: 'none' })
  }
  finally {
    locating.value = false
  }
}

function onFilterConfirm(nextFilters: PropertyFilterState, nextKeyword?: string) {
  filters.value = {
    ...nextFilters,
    userLng: filters.value.userLng,
    userLat: filters.value.userLat,
  }
  if (nextKeyword !== undefined)
    keyword.value = nextKeyword
  loadCommunities()
}

function resetFilters() {
  const userLng = filters.value.userLng
  const userLat = filters.value.userLat
  filters.value = { userLng, userLat }
  keyword.value = ''
  loadCommunities()
}

function markerToCommunity(markerId: number) {
  return communities.value[markerId - 1] || null
}

function onMarkerTap(event: any) {
  const item = markerToCommunity(Number(event.detail?.markerId))
  goProperties(item)
}

function goProperties(item: SlCommunityOutput | null) {
  if (!item)
    return
  uni.navigateTo({
    url: `/pages/common/community-properties/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}`,
  })
}

onLoad(() => {
  // 冷启动直接落在本页时拦截器不生效，需自行守卫登录态与管理员权限
  const auth = useShenleAuthStore()
  if (!auth.isLogin) {
    uni.navigateTo({ url: `/pages/common/login/index?redirect=${encodeURIComponent('/pages/user/map/index')}` })
    return
  }
  if (!auth.isAdmin) {
    uni.reLaunch({ url: '/pages/common/login/index?denied=1' })
    return
  }
  mapContext = uni.createMapContext(mapId)
  loadCommunities()
  getLocation(false)
})
onPullDownRefresh(loadCommunities)
</script>

<template>
  <view class="map-page" :style="safeTop">
    <view class="map-head">
      <view>
        <text class="map-head__title">楼盘地图</text>
      </view>
      <view class="map-head__actions">
        <wd-button size="small" plain @click="chooseReferencePoint">
          选点
        </wd-button>
        <wd-button size="small" plain @click="getLocation(true)">
          {{ locating ? '定位中' : '定位' }}
        </wd-button>
        <wd-button size="small" type="primary" @click="loadCommunities">
          刷新
        </wd-button>
      </view>
    </view>

    <view class="location-strip sl-card" @tap="chooseReferencePoint">
      <wd-icon name="location" size="18px" color="#126b4f" />
      <text>{{ locating ? '定位中...' : locationLabel }}</text>
      <text class="location-strip__state">{{ locationReady ? '距离参考点' : '未定位' }}</text>
    </view>

    <sl-property-filter-bar
      :filters="filters"
      :keyword="keyword"
      mount-key="admin-map-filter"
      @confirm="onFilterConfirm"
      @reset="resetFilters"
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
      >
        <cover-view class="map-badge">
          <cover-view class="map-badge__text">{{ loading ? '加载中' : `${communities.length} 个楼盘` }}</cover-view>
        </cover-view>
      </map>
    </view>
  </view>
</template>

<style scoped lang="scss">
.map-page {
  display: flex;
  height: 100vh;
  flex-direction: column;
  box-sizing: border-box;
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

.map-head__actions {
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10rpx;
}

.location-strip {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
  color: var(--sl-ink);
  font-size: 25rpx;
  font-weight: 850;
}

.location-strip__state {
  margin-left: auto;
  color: var(--sl-muted);
  font-size: 22rpx;
  font-weight: 600;
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
