<script setup lang="ts">
import { ref, computed, onMounted, getCurrentInstance, nextTick } from 'vue'
import { useAppStore } from '@/stores/app'
import { getCommunityPage } from '@/api/community'
import { getRegionTree } from '@/api/region'
import { downloadFile } from '@/api/file'
import type { SlCommunityOutput, PageSlCommunityInput } from '@/types/community'
import type { SlRegionTreeOutput } from '@/types/region'
import { BEDROOM_OPTIONS } from '@/utils/constants'

const appStore = useAppStore()

// ---- Location ----
const userLng = ref<number | undefined>(undefined)
const userLat = ref<number | undefined>(undefined)
const locationReady = ref(false)
const locationLoading = ref(false)
const locationAddress = ref('')

const DISTANCE_OPTIONS = [
  { label: '不限', value: undefined as number | undefined },
  { label: '500m', value: 0.5 },
  { label: '1km', value: 1 },
  { label: '3km', value: 3 },
  { label: '5km', value: 5 },
]
const selDistanceIdx = ref(0)

// 腾讯位置服务 Key（在 lbs.qq.com 免费注册获取，并将 apis.map.qq.com 加入合法域名）
const QQMAP_KEY = 'YOUR_KEY_HERE'

// 逆地理编码：坐标 → 地名
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  return new Promise((resolve) => {
    uni.request({
      url: `https://apis.map.qq.com/ws/geocoder/v1/?location=${lat},${lng}&key=${QQMAP_KEY}&get_poi=1`,
      success: (res: any) => {
        const data = res.data
        if (data?.status === 0) {
          const poi = data.result?.pois?.[0]?.title
          const district = data.result?.address_component?.district
          const street = data.result?.address_component?.street
          resolve(poi || (district && street ? district + street : district) || '已定位')
        } else {
          resolve('已定位')
        }
      },
      fail: () => resolve('已定位'),
    })
  })
}

// 进页面自动静默定位（只拿坐标，不弹界面）
function autoLocate() {
  locationLoading.value = true
  uni.getLocation({
    type: 'gcj02',
    success: async (res) => {
      userLng.value = res.longitude
      userLat.value = res.latitude
      locationReady.value = true
      locationAddress.value = await reverseGeocode(res.latitude, res.longitude)
      locationLoading.value = false
      loadData(true)
    },
    fail: () => {
      locationLoading.value = false
    },
  })
}

// 用户手动点击，打开地图选择精确地址
function getLocation() {
  locationLoading.value = true
  uni.chooseLocation({
    success: (res) => {
      userLng.value = res.longitude
      userLat.value = res.latitude
      locationAddress.value = res.name || res.address || '已定位'
      locationReady.value = true
      locationLoading.value = false
      loadData(true)
    },
    fail: () => {
      locationLoading.value = false
    },
  })
}

function distanceText(item: SlCommunityOutput): string {
  if (!item.distance && item.distance !== 0) return ''
  if (item.distance < 1) return `${Math.round(item.distance * 1000)}m`
  return `${item.distance}km`
}

// ---- Region tree ----
const regionTree = ref<SlRegionTreeOutput[]>([])
const selL1 = ref<number | undefined>(undefined)
const selL2 = ref<number | undefined>(undefined)

const l2List = computed(() => {
  if (!selL1.value) return []
  const node = regionTree.value.find(r => r.id === selL1.value)
  return node?.children ?? []
})

const selRegionId = computed(() => selL2.value ?? selL1.value)

// 当选了有坐标的区域时，用区域中心坐标代替 GPS 作为距离参考点
const refLng = computed<number | undefined>(() => {
  if (selL2.value) {
    const l1 = regionTree.value.find(r => r.id === selL1.value)
    const l2 = l1?.children?.find(r => r.id === selL2.value)
    if (l2?.centerLng) return l2.centerLng
  }
  if (selL1.value) {
    const l1 = regionTree.value.find(r => r.id === selL1.value)
    if (l1?.centerLng) return l1.centerLng
  }
  return userLng.value
})

const refLat = computed<number | undefined>(() => {
  if (selL2.value) {
    const l1 = regionTree.value.find(r => r.id === selL1.value)
    const l2 = l1?.children?.find(r => r.id === selL2.value)
    if (l2?.centerLat) return l2.centerLat
  }
  if (selL1.value) {
    const l1 = regionTree.value.find(r => r.id === selL1.value)
    if (l1?.centerLat) return l1.centerLat
  }
  return userLat.value
})

async function loadRegionTree() {
  try {
    regionTree.value = await getRegionTree()
  } catch {}
}

// ---- Dropdown ----
type DropdownName = 'location' | 'bedroom' | 'price'
const activeDropdown = ref<DropdownName | null>(null)
const filterBarBottom = ref(0)

function measureFilterBar() {
  const query = uni.createSelectorQuery().in(instance!)
  query.select('.filter-bar').boundingClientRect((rect: any) => {
    if (rect) filterBarBottom.value = rect.bottom
  }).exec()
}

function toggleDropdown(name: DropdownName) {
  if (activeDropdown.value === name) {
    activeDropdown.value = null
    return
  }
  activeDropdown.value = name
  showSearch.value = false
  // 每次打开时重新测量，防止布局变化
  nextTick(() => measureFilterBar())
}

function closeDropdown() {
  activeDropdown.value = null
}

function resetCurrentFilter() {
  switch (activeDropdown.value) {
    case 'location':
      selL1.value = undefined
      selL2.value = undefined
      selDistanceIdx.value = 0
      break
    case 'bedroom':
      selBedroom.value = undefined
      break
    case 'price':
      priceMin.value = 0
      priceMax.value = PRICE_MAX
      break
  }
  activeDropdown.value = null
  loadData(true)
}

function confirmDropdown() {
  activeDropdown.value = null
  loadData(true)
}

// ---- Filter labels ----
const locationLabel = computed(() => {
  const parts: string[] = []
  if (selL2.value) {
    const l1 = regionTree.value.find(r => r.id === selL1.value)
    const l2 = l1?.children?.find(r => r.id === selL2.value)
    if (l2) parts.push(l2.name)
  } else if (selL1.value) {
    const l1 = regionTree.value.find(r => r.id === selL1.value)
    if (l1) parts.push(l1.name)
  }
  if (selDistanceIdx.value > 0) parts.push(DISTANCE_OPTIONS[selDistanceIdx.value].label)
  return parts.length ? parts.join(' ') : '位置'
})

const bedroomLabel = computed(() => {
  if (!selBedroom.value) return '户型'
  const opt = BEDROOM_OPTIONS.find(o => o.value === selBedroom.value)
  return opt?.label ?? '户型'
})

const priceLabel = computed(() => {
  if (priceMin.value === 0 && priceMax.value >= PRICE_MAX) return '租金'
  if (priceMin.value > 0 && priceMax.value >= PRICE_MAX) return `≥¥${priceMin.value}`
  if (priceMin.value === 0) return `≤¥${priceMax.value}`
  return `¥${priceMin.value}-${priceMax.value}`
})


// ---- Search ----
const showSearch = ref(false)
const keyword = ref('')

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (showSearch.value) activeDropdown.value = null
}

function onSearch() {
  showSearch.value = false
  loadData(true)
}

function clearSearch() {
  keyword.value = ''
  showSearch.value = false
  loadData(true)
}

// ---- Filter state ----
const selBedroom = ref<number | undefined>(undefined)

const PRICE_MAX = 10000
const PRICE_STEP = 100
const priceMin = ref(0)
const priceMax = ref(PRICE_MAX)

const priceMinLabel = computed(() => priceMin.value === 0 ? '不限' : `¥${priceMin.value}`)
const priceMaxLabel = computed(() => priceMax.value >= PRICE_MAX ? '不限' : `¥${priceMax.value}`)

const minPct = computed(() => (priceMin.value / PRICE_MAX) * 100)
const maxPct = computed(() => (priceMax.value / PRICE_MAX) * 100)

let dragging: 'min' | 'max' | null = null
let trackLeft = 0
let trackWidth = 0
const instance = getCurrentInstance()

function measureTrack() {
  const query = uni.createSelectorQuery().in(instance!)
  query.select('.range-track').boundingClientRect((rect: any) => {
    if (!rect) return
    trackLeft = rect.left
    trackWidth = rect.width
  }).exec()
}

function onTrackTouchStart() {
  measureTrack()
}

function valueFromX(x: number): number {
  let pct = (x - trackLeft) / trackWidth
  pct = Math.max(0, Math.min(1, pct))
  const raw = pct * PRICE_MAX
  return Math.round(raw / PRICE_STEP) * PRICE_STEP
}

function onThumbTouchStart(which: 'min' | 'max') {
  dragging = which
  measureTrack()
}

function onThumbTouchMove(e: any) {
  if (!dragging || !trackWidth) return
  const x = e.touches[0].clientX
  const val = valueFromX(x)
  if (dragging === 'min') {
    priceMin.value = Math.min(val, priceMax.value)
  } else {
    priceMax.value = Math.max(val, priceMin.value)
  }
}

function onThumbTouchEnd() {
  dragging = null
}

// ---- Pagination / community list ----
const page = ref(1)
const pageSize = 10
const list = ref<SlCommunityOutput[]>([])
const loadStatus = ref<'more' | 'loading' | 'noMore'>('more')
const refreshing = ref(false)

async function loadData(reset = false) {
  if (reset) {
    page.value = 1
    list.value = []
  }
  if (loadStatus.value === 'loading') return
  loadStatus.value = 'loading'

  const distOpt = DISTANCE_OPTIONS[selDistanceIdx.value]

  const input: PageSlCommunityInput = {
    page: page.value,
    pageSize,
    name: keyword.value || undefined,
    status: 0,
    bedrooms: selBedroom.value,
    minPrice: priceMin.value > 0 ? priceMin.value : undefined,
    maxPrice: priceMax.value < PRICE_MAX ? priceMax.value : undefined,
    userLng: refLng.value,
    userLat: refLat.value,
    distanceKm: distOpt?.value,
  }

  try {
    const res = await getCommunityPage(input)
    const newItems = res.items
    list.value = reset ? newItems : [...list.value, ...newItems]

    loadStatus.value = 'noMore'
    page.value++
    loadCovers(newItems)
  } catch {
    loadStatus.value = 'more'
  } finally {
    refreshing.value = false
  }
}

function onLoadMore() {
  if (loadStatus.value === 'more') loadData()
}

function onRefresh() {
  refreshing.value = true
  loadData(true)
}

// ---- Cover cache ----
const coverCache = ref<Record<string, string>>({})

function coverSrc(item: SlCommunityOutput): string {
  if (!item.coverImageId) return ''
  return coverCache.value[String(item.coverImageId)] || ''
}

async function loadCovers(items: SlCommunityOutput[]) {
  for (const item of items) {
    const id = item.coverImageId
    if (!id || coverCache.value[String(id)]) continue
    try {
      const path = await downloadFile(String(id))
      coverCache.value[String(id)] = path
    } catch {}
  }
}

// ---- Navigation ----
function onCommunityTap(item: SlCommunityOutput) {
  uni.navigateTo({
    url: `/pages/common/community-properties/index?communityId=${item.id}&communityName=${encodeURIComponent(item.name)}`,
  })
}

function goAddProperty() {
  uni.navigateTo({ url: '/pages/common/property-form/index' })
}

function openNavigation(item: SlCommunityOutput) {
  if (!item.lat || !item.lng) {
    uni.showToast({ title: '暂无位置信息', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude: item.lat,
    longitude: item.lng,
    name: item.name,
    address: item.address ?? item.name,
  })
}

// ---- Helpers ----
function rentRangeText(item: SlCommunityOutput): string {
  if (!item.minRentPrice && !item.maxRentPrice) return '暂无报价'
  if (item.minRentPrice === item.maxRentPrice) return `¥${item.minRentPrice}/月`
  return `¥${item.minRentPrice ?? 0}~${item.maxRentPrice ?? 0}/月`
}

// ---- Init ----
onMounted(() => {
  autoLocate()
  loadRegionTree()
  loadData(true)
  nextTick(() => measureFilterBar())
})
</script>

<template>
  <view class="page">
    <!-- Title -->
    <view class="page-title-row" :style="{ paddingTop: appStore.headerPaddingStyle(12) }">
      <text class="page-title">房源管理</text>
      <view class="location-tag" @tap="getLocation">
        <text class="location-icon">📍</text>
        <text class="location-text">
          {{ locationLoading ? '定位中...' : locationAddress || '点击选择位置' }}
        </text>
      </view>
    </view>

    <!-- Filter bar -->
    <view class="filter-bar">
      <view
        class="fb-item"
        :class="{ active: !!selRegionId || selDistanceIdx > 0, open: activeDropdown === 'location' }"
        @tap="toggleDropdown('location')"
      >
        <text class="fb-label">{{ locationLabel }}</text>
        <text class="fb-arrow" :class="{ up: activeDropdown === 'location' }">▽</text>
      </view>
      <view
        class="fb-item"
        :class="{ active: !!selBedroom, open: activeDropdown === 'bedroom' }"
        @tap="toggleDropdown('bedroom')"
      >
        <text class="fb-label">{{ bedroomLabel }}</text>
        <text class="fb-arrow" :class="{ up: activeDropdown === 'bedroom' }">▽</text>
      </view>
      <view
        class="fb-item"
        :class="{ active: priceMin > 0 || priceMax < PRICE_MAX, open: activeDropdown === 'price' }"
        @tap="toggleDropdown('price')"
      >
        <text class="fb-label">{{ priceLabel }}</text>
        <text class="fb-arrow" :class="{ up: activeDropdown === 'price' }">▽</text>
      </view>
      <view class="fb-divider" />
      <view
        class="fb-search"
        :class="{ active: showSearch || keyword }"
        @tap="toggleSearch"
      >
        <text class="fb-search-icon">&#x1F50D;</text>
      </view>
    </view>

    <!-- Search expand -->
    <view v-if="showSearch" class="search-expand">
      <view class="search-bar">
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索楼盘名称"
          placeholder-class="search-placeholder"
          confirm-type="search"
          :focus="showSearch"
          @confirm="onSearch"
        />
        <view v-if="keyword" class="search-clear" @tap="clearSearch">
          <text>✕</text>
        </view>
      </view>
      <view class="search-ok" @tap="onSearch"><text>搜索</text></view>
    </view>

    <!-- Community list -->
    <scroll-view
      scroll-y
      class="community-list"
      refresher-enabled
      :refresher-triggered="refreshing"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <view v-if="list.length === 0 && loadStatus !== 'loading'" class="empty-wrap">
        <sl-empty-state text="暂无楼盘数据" />
      </view>
      <view v-else class="list-inner">
        <view
          v-for="item in list"
          :key="item.id"
          class="community-card"
          @tap="onCommunityTap(item)"
        >
          <!-- Cover -->
          <view class="cc-cover-wrap">
            <image
              v-if="coverSrc(item)"
              class="cc-cover"
              :src="coverSrc(item)"
              mode="aspectFill"
            />
            <view v-else class="cc-cover placeholder-cover">
              <text class="placeholder-text">暂无图片</text>
            </view>
          </view>

          <!-- Info -->
          <view class="cc-info">
            <view class="cc-top-row">
              <text class="cc-name">{{ item.name }}</text>
              <view v-if="item.regionName" class="cc-region-tag">
                <text>{{ item.regionName }}</text>
              </view>
            </view>

            <text v-if="item.houseTypes" class="cc-types">{{ item.houseTypes }}</text>

            <view class="cc-meta-row">
              <text class="cc-rent">{{ rentRangeText(item) }}</text>
              <view v-if="distanceText(item)" class="cc-distance-tag">
                <text class="cc-distance-icon">📍</text>
                <text class="cc-distance-text">{{ distanceText(item) }}</text>
              </view>
            </view>

            <view class="cc-bottom-row">
              <text class="cc-count">{{ item.propertyCount }}套房源符合要求</text>
              <view class="cc-nav-link" @tap.stop="openNavigation(item)">
                <text class="cc-nav-link-text">导航</text>
              </view>
            </view>
          </view>

          <!-- Arrow -->
          <view class="cc-arrow">
            <text>›</text>
          </view>
        </view>

        <sl-load-more :status="loadStatus" />
      </view>
      <view style="height: 200rpx" />
    </scroll-view>

    <!-- Dropdown overlay -->
    <view v-if="activeDropdown" class="dropdown-overlay" @tap="closeDropdown" />

    <!-- Dropdown panel -->
    <view v-if="activeDropdown" class="dropdown-panel" :style="{ top: filterBarBottom + 'px' }">
      <!-- Location (region + distance combined) -->
      <view v-if="activeDropdown === 'location'" class="dp-location">
        <!-- Distance row -->
        <view class="dp-distance-row">
          <view
            v-for="(opt, idx) in DISTANCE_OPTIONS"
            :key="idx"
            class="dp-dist-chip"
            :class="{ active: selDistanceIdx === idx }"
            @tap="selDistanceIdx = idx"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
        <!-- Region split -->
        <view class="dp-region-split">
          <scroll-view scroll-y class="dp-region-left">
            <view
              class="dp-region-l1-item"
              :class="{ active: !selL1 }"
              @tap="selL1 = undefined; selL2 = undefined"
            >
              <text>不限</text>
            </view>
            <view
              v-for="r1 in regionTree"
              :key="r1.id"
              class="dp-region-l1-item"
              :class="{ active: selL1 === r1.id }"
              @tap="selL1 = r1.id; selL2 = undefined"
            >
              <text>{{ r1.name }}</text>
            </view>
          </scroll-view>
          <scroll-view scroll-y class="dp-region-right">
            <view v-if="!selL1" class="dp-region-l2-item active">
              <text>全部区域</text>
            </view>
            <view
              v-if="selL1 && l2List.length === 0"
              class="dp-region-l2-item active"
            >
              <text>{{ regionTree.find(r => r.id === selL1)?.name ?? '' }}</text>
            </view>
            <view
              v-for="r2 in l2List"
              :key="r2.id"
              class="dp-region-l2-item"
              :class="{ active: selL2 === r2.id }"
              @tap="selL2 = r2.id"
            >
              <text>{{ r2.name }}</text>
            </view>
          </scroll-view>
        </view>
      </view>

      <!-- Bedroom -->
      <view v-if="activeDropdown === 'bedroom'" class="dp-content">
        <view class="dp-chips">
          <view
            v-for="opt in BEDROOM_OPTIONS"
            :key="String(opt.value)"
            class="dp-chip"
            :class="{ active: selBedroom === opt.value }"
            @tap="selBedroom = opt.value"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>

      <!-- Price -->
      <view v-if="activeDropdown === 'price'" class="dp-content">
        <view class="fp-range-labels">
          <text class="fp-range-val">{{ priceMinLabel }}</text>
          <text class="fp-range-sep">—</text>
          <text class="fp-range-val">{{ priceMaxLabel }}</text>
        </view>
        <view class="range-slider" @touchstart="onTrackTouchStart">
          <view class="range-track">
            <view
              class="range-active"
              :style="{ left: minPct + '%', width: (maxPct - minPct) + '%' }"
            />
            <view
              class="range-thumb"
              :style="{ left: minPct + '%' }"
              @touchstart.stop="onThumbTouchStart('min')"
              @touchmove.stop.prevent="onThumbTouchMove"
              @touchend.stop="onThumbTouchEnd"
            >
              <view class="thumb-tooltip"><text>{{ priceMinLabel }}</text></view>
            </view>
            <view
              class="range-thumb"
              :style="{ left: maxPct + '%' }"
              @touchstart.stop="onThumbTouchStart('max')"
              @touchmove.stop.prevent="onThumbTouchMove"
              @touchend.stop="onThumbTouchEnd"
            >
              <view class="thumb-tooltip"><text>{{ priceMaxLabel }}</text></view>
            </view>
          </view>
          <view class="range-ticks">
            <text>¥0</text>
            <text>¥5000</text>
            <text>¥10000</text>
          </view>
        </view>
      </view>


      <!-- Actions -->
      <view class="dp-actions">
        <view class="dp-btn reset" @tap="resetCurrentFilter"><text>重置</text></view>
        <view class="dp-btn confirm" @tap="confirmDropdown"><text>确定</text></view>
      </view>
    </view>

    <!-- FAB -->
    <view v-show="!activeDropdown" class="fab" @tap="goAddProperty">
      <text class="fab-icon">+</text>
    </view>

    <sl-custom-tabbar :current="1" />
  </view>
</template>

<style lang="scss" scoped>
.page {
  height: 100vh;
  background-color: $sl-bg-page;
  display: flex;
  flex-direction: column;
}

// ---- Page title ----
.page-title-row {
  padding: $sl-spacing-md $sl-spacing-lg $sl-spacing-sm;
  background-color: $sl-bg-card;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6rpx;
}

.location-tag {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 4rpx 14rpx;
  background-color: $sl-bg-hover;
  border-radius: 20rpx;
}

.location-icon {
  font-size: 24rpx;
  line-height: 1;
}

.location-text {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
  white-space: nowrap;
}

.page-title {
  font-size: $sl-font-xl;
  font-weight: 700;
  color: $sl-text-primary;
}

// ---- Filter bar ----
.filter-bar {
  display: flex;
  align-items: center;
  background-color: $sl-bg-card;
  border-bottom: 1rpx solid $sl-border-color-light;
  flex-shrink: 0;
  padding: 0 $sl-spacing-sm;
}

.fb-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 24rpx 20rpx;
  flex-shrink: 0;

  &.active {
    .fb-label { color: $sl-primary-dark; font-weight: 600; }
    .fb-arrow { color: $sl-primary-dark; }
  }

  &.open {
    .fb-label { color: $sl-primary-dark; }
    .fb-arrow { color: $sl-primary-dark; }
  }
}

.fb-label {
  font-size: $sl-font-sm;
  color: $sl-text-primary;
  max-width: 120rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fb-arrow {
  font-size: 20rpx;
  color: $sl-text-secondary;
  transition: transform 0.2s;

  &.up {
    display: inline-block;
    transform: rotate(180deg);
  }
}

.fb-divider {
  flex: 1;
}

.fb-search {
  padding: 20rpx 16rpx;
  flex-shrink: 0;

  &.active .fb-search-icon {
    color: $sl-primary-dark;
  }
}

.fb-search-icon {
  font-size: $sl-font-md;
  color: $sl-text-secondary;
}

// ---- Search expand ----
.search-expand {
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  padding: $sl-spacing-sm $sl-spacing-lg $sl-spacing-md;
  background-color: $sl-bg-card;
  flex-shrink: 0;
  border-bottom: 1rpx solid $sl-border-color-light;
}

.search-bar {
  flex: 1;
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  padding: 0 $sl-spacing-md;
  background-color: $sl-bg-hover;
  border-radius: $sl-border-radius;
  height: 72rpx;
}

.search-input {
  flex: 1;
  font-size: $sl-font-md;
  color: $sl-text-primary;
}

.search-placeholder {
  color: $sl-text-placeholder;
}

.search-clear {
  font-size: $sl-font-sm;
  color: $sl-text-placeholder;
  padding: 8rpx;
}

.search-ok {
  padding: 16rpx 24rpx;
  font-size: $sl-font-sm;
  font-weight: 600;
  color: $sl-primary-dark;
  flex-shrink: 0;
}

// ---- Community list ----
.community-list {
  flex: 1;
  height: 0;
}

.empty-wrap {
  padding: $sl-spacing-xl;
}

.list-inner {
  padding: $sl-spacing-md;
  display: flex;
  flex-direction: column;
  gap: $sl-spacing-md;
}

// ---- Community card ----
.community-card {
  display: flex;
  gap: $sl-spacing-md;
  padding: $sl-spacing-lg;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius-lg;
  box-shadow: $sl-shadow-sm;
  align-items: center;
}

.cc-cover-wrap {
  width: 160rpx;
  height: 160rpx;
  flex-shrink: 0;
}

.cc-cover {
  width: 100%;
  height: 100%;
  border-radius: $sl-border-radius;
  background-color: $sl-bg-hover;
}

.placeholder-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #F1F5F9;
  border-radius: $sl-border-radius;
}

.placeholder-text {
  font-size: 22rpx;
  color: $sl-text-placeholder;
}

.cc-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cc-top-row {
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  margin-bottom: 8rpx;
}

.cc-name {
  font-size: $sl-font-md;
  font-weight: 700;
  color: $sl-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-region-tag {
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  background-color: rgba(37, 99, 235, 0.1);
  font-size: $sl-font-xs;
  color: $sl-primary-dark;
  flex-shrink: 0;
}

.cc-types {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-bottom: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-meta-row {
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  margin-bottom: 6rpx;
  flex-wrap: wrap;
}

.cc-rent {
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-price;
}

.cc-distance-tag {
  display: flex;
  align-items: center;
  gap: 4rpx;
  background-color: $sl-bg-hover;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}

.cc-distance-icon {
  font-size: 20rpx;
}

.cc-distance-text {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

.cc-bottom-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cc-count {
  font-size: $sl-font-sm;
  color: $sl-primary-dark;
  font-weight: 500;
}

.cc-nav-link {
  padding: 4rpx 16rpx;
  background-color: rgba(37, 99, 235, 0.1);
  border-radius: 20rpx;
}

.cc-nav-link-text {
  font-size: $sl-font-xs;
  color: $sl-primary-dark;
  font-weight: 600;
}

.cc-arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  color: $sl-text-placeholder;
}

// ---- Dropdown overlay ----
.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 99;
}

// ---- Dropdown panel ----
.dropdown-panel {
  position: fixed;
  left: 0;
  right: 0;
  background-color: $sl-bg-card;
  z-index: 100;
  padding: $sl-spacing-lg;
  box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.12);
  transform-origin: top center;
  overflow: hidden;
  animation: dropdownSlideIn 0.28s cubic-bezier(0.4, 0, 0.2, 1) both;
}

@keyframes dropdownSlideIn {
  from {
    transform: scaleY(0);
    opacity: 0;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}

.dp-content {
  margin-bottom: $sl-spacing-md;
}

.dp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-sm;
}

// ---- Location combined panel ----
.dp-location {
  margin-bottom: $sl-spacing-md;
}

.dp-distance-row {
  display: flex;
  gap: $sl-spacing-sm;
  margin-bottom: $sl-spacing-md;
  flex-wrap: wrap;
}

.dp-dist-chip {
  padding: 10rpx 28rpx;
  border-radius: $sl-border-radius;
  background-color: $sl-bg-hover;
  font-size: $sl-font-sm;
  color: $sl-text-primary;
  flex-shrink: 0;

  &.active {
    background-color: $sl-primary-dark;
    color: #ffffff;
  }
}

.dp-region-split {
  display: flex;
  height: 400rpx;
  border-top: 1rpx solid $sl-border-color-light;
  margin: 0 #{-$sl-spacing-lg};
}

.dp-region-left {
  width: 200rpx;
  flex-shrink: 0;
  border-right: 1rpx solid $sl-border-color-light;
  background-color: $sl-bg-hover;
}

.dp-region-l1-item {
  padding: 28rpx 24rpx;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  border-left: 6rpx solid transparent;

  &.active {
    color: $sl-primary-dark;
    font-weight: 600;
    background-color: $sl-bg-card;
    border-left-color: $sl-primary-dark;
  }
}

.dp-region-right {
  flex: 1;
}

.dp-region-l2-item {
  padding: 28rpx 32rpx;
  font-size: $sl-font-sm;
  color: $sl-text-primary;

  &.active {
    color: $sl-primary-dark;
    font-weight: 600;
  }
}

.dp-chip {
  padding: 12rpx 28rpx;
  border-radius: $sl-border-radius;
  background-color: $sl-bg-hover;
  font-size: $sl-font-sm;
  color: $sl-text-primary;

  &.active {
    background-color: $sl-primary-dark;
    color: #ffffff;
  }
}

// ---- Range labels ----
.fp-range-labels {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $sl-spacing-sm;
  margin-bottom: $sl-spacing-md;
}

.fp-range-val {
  font-size: $sl-font-md;
  font-weight: 600;
  color: $sl-primary-dark;
}

.fp-range-sep {
  font-size: $sl-font-sm;
  color: $sl-text-placeholder;
}

// ---- Dual range slider ----
.range-slider {
  padding: 40rpx 20rpx 16rpx;
}

.range-track {
  position: relative;
  height: 6rpx;
  background-color: #E2E8F0;
  border-radius: 3rpx;
}

.range-active {
  position: absolute;
  top: 0;
  height: 100%;
  background-color: $sl-primary-dark;
  border-radius: 3rpx;
}

.range-thumb {
  position: absolute;
  top: 50%;
  width: 48rpx;
  height: 48rpx;
  margin-left: -24rpx;
  margin-top: -24rpx;
  background-color: #ffffff;
  border: 4rpx solid $sl-primary-dark;
  border-radius: 50%;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-tooltip {
  position: absolute;
  top: -52rpx;
  white-space: nowrap;
  background-color: $sl-primary-dark;
  color: #ffffff;
  font-size: 22rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
}

.range-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $sl-text-placeholder;
}

// ---- Dropdown actions ----
.dp-actions {
  display: flex;
  gap: $sl-spacing-md;
  margin-top: $sl-spacing-lg;
}

.dp-btn {
  flex: 1;
  padding: 20rpx 0;
  text-align: center;
  border-radius: $sl-border-radius;
  font-size: $sl-font-md;
  font-weight: 600;

  &.reset {
    background-color: $sl-bg-hover;
    color: $sl-text-secondary;
  }

  &.confirm {
    background-color: $sl-primary-dark;
    color: #ffffff;
  }
}

// ---- FAB ----
.fab {
  position: fixed;
  right: $sl-spacing-xl;
  bottom: calc(#{$sl-tabbar-height} + 48rpx + env(safe-area-inset-bottom));
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background-color: $sl-primary-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 32rpx rgba(37, 99, 235, 0.35);
  z-index: 10;
}

.fab-icon {
  font-size: 56rpx;
  color: #ffffff;
  line-height: 1;
}
</style>
