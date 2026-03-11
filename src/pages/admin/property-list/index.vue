<script setup lang="ts">
import { ref, computed, onMounted, getCurrentInstance } from 'vue'
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

const DISTANCE_OPTIONS = [
  { label: '不限', value: undefined as number | undefined },
  { label: '1km', value: 1 },
  { label: '3km', value: 3 },
  { label: '5km', value: 5 },
  { label: '10km', value: 10 },
]
const selDistanceIdx = ref(0)

function getLocation() {
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      userLng.value = res.longitude
      userLat.value = res.latitude
      locationReady.value = true
    },
    fail: () => {
      locationReady.value = false
    },
  })
}

function distanceText(item: SlCommunityOutput): string {
  if (!item.distance && item.distance !== 0) return ''
  if (item.distance < 1) return `${Math.round(item.distance * 1000)}m`
  return `${item.distance}km`
}

// ---- Region tree (left sidebar) ----
const regionOpen = ref(false)
const regionTree = ref<SlRegionTreeOutput[]>([])
const selL1 = ref<number | undefined>(undefined)
const selL2 = ref<number | undefined>(undefined)

const l2List = computed(() => {
  if (!selL1.value) return []
  const node = regionTree.value.find(r => r.id === selL1.value)
  return node?.children ?? []
})

const selRegionId = computed(() => selL2.value ?? selL1.value)

async function loadRegionTree() {
  try {
    regionTree.value = await getRegionTree()
  } catch {}
}

function onSelectL1(id: number | undefined) {
  selL1.value = selL1.value === id ? undefined : id
  selL2.value = undefined
  loadData(true)
}

function onSelectL2(id: number | undefined) {
  selL2.value = selL2.value === id ? undefined : id
  loadData(true)
}

function toggleRegion() {
  regionOpen.value = !regionOpen.value
}

// ---- Search popup ----
const showSearch = ref(false)
const keyword = ref('')

function toggleSearch() {
  showSearch.value = !showSearch.value
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

// ---- Filter panel (top) ----
const showFilter = ref(false)
const selBedroom = ref<number | undefined>(undefined)

// 租金双滑块：0~10000，步长100
const PRICE_MAX = 10000
const PRICE_STEP = 100
const priceMin = ref(0)
const priceMax = ref(PRICE_MAX)

const priceMinLabel = computed(() => priceMin.value === 0 ? '不限' : `¥${priceMin.value}`)
const priceMaxLabel = computed(() => priceMax.value >= PRICE_MAX ? '不限' : `¥${priceMax.value}`)

// 双滑块百分比
const minPct = computed(() => (priceMin.value / PRICE_MAX) * 100)
const maxPct = computed(() => (priceMax.value / PRICE_MAX) * 100)

// 滑块拖拽
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

function toggleFilter() {
  showFilter.value = !showFilter.value
}

function resetFilter() {
  selBedroom.value = undefined
  priceMin.value = 0
  priceMax.value = PRICE_MAX
  selDistanceIdx.value = 0
  showFilter.value = false
  loadData(true)
}

function confirmFilter() {
  showFilter.value = false
  loadData(true)
}

const filterCount = computed(() => {
  let n = 0
  if (selBedroom.value) n++
  if (priceMin.value > 0 || priceMax.value < PRICE_MAX) n++
  if (selDistanceIdx.value > 0) n++
  return n
})

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
    regionId: selRegionId.value,
    status: 0,
    bedrooms: selBedroom.value,
    minPrice: priceMin.value > 0 ? priceMin.value : undefined,
    maxPrice: priceMax.value < PRICE_MAX ? priceMax.value : undefined,
    userLng: userLng.value,
    userLat: userLat.value,
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

// ---- Helpers ----
function rentRangeText(item: SlCommunityOutput): string {
  if (!item.minRentPrice && !item.maxRentPrice) return '暂无报价'
  if (item.minRentPrice === item.maxRentPrice) return `¥${item.minRentPrice}/月`
  return `¥${item.minRentPrice ?? 0}~${item.maxRentPrice ?? 0}/月`
}

// ---- Init ----
onMounted(() => {
  getLocation()
  loadRegionTree()
  loadData(true)
})
</script>

<template>
  <view class="page">
    <!-- Title line (full width, above sidebar) -->
    <view class="page-title-row" :style="{ paddingTop: appStore.headerPaddingStyle(12) }">
      <text class="page-title">房源管理</text>
    </view>

    <!-- Main body: sidebar + (toolbar + list) -->
    <view class="main-body">
      <!-- Region sidebar toggle -->
      <view class="region-toggle" @tap="toggleRegion">
        <text class="toggle-arrow">{{ regionOpen ? '◀' : '▶' }}</text>
      </view>

      <!-- Region sidebar -->
      <scroll-view v-if="regionOpen" scroll-y class="region-sidebar">
        <view
          class="rs-item l1"
          :class="{ active: !selL1 }"
          @tap="onSelectL1(undefined)"
        >
          <text>不限区域</text>
        </view>

        <view v-for="r1 in regionTree" :key="r1.id">
          <view
            class="rs-item l1"
            :class="{ active: selL1 === r1.id && !selL2 }"
            @tap="onSelectL1(r1.id)"
          >
            <text>{{ r1.name }}</text>
            <text v-if="selL1 === r1.id" class="l1-arrow">◀</text>
          </view>

          <template v-if="selL1 === r1.id && l2List.length">
            <view class="rs-divider" />
            <view
              v-for="r2 in l2List"
              :key="r2.id"
              class="rs-item l2"
              :class="{ active: selL2 === r2.id }"
              @tap="onSelectL2(r2.id)"
            >
              <text>{{ r2.name }}</text>
            </view>
          </template>
        </view>
      </scroll-view>

      <!-- Right content: toolbar + community list -->
      <view class="right-content">
        <!-- Toolbar: search/filter buttons right-aligned -->
        <view class="toolbar-row">
          <view
            class="toolbar-btn"
            :class="{ active: showSearch || keyword }"
            @tap="toggleSearch"
          >
            <text class="tb-icon">&#x1F50D;</text>
          </view>
          <view
            class="toolbar-btn"
            :class="{ active: showFilter || filterCount > 0 }"
            @tap="toggleFilter"
          >
            <text class="tb-icon">&#x2630;</text>
            <view v-if="filterCount > 0 && !showFilter" class="tb-badge">
              <text>{{ filterCount }}</text>
            </view>
          </view>
        </view>

        <!-- Search input (expandable) -->
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

        <!-- Filter Panel -->
        <view v-if="showFilter" class="filter-panel">
          <view class="fp-section">
            <text class="fp-label">户型</text>
            <view class="fp-chips">
              <view
                v-for="opt in BEDROOM_OPTIONS"
                :key="String(opt.value)"
                class="fp-chip"
                :class="{ active: selBedroom === opt.value }"
                @tap="selBedroom = opt.value"
              >
                <text>{{ opt.label }}</text>
              </view>
            </view>
          </view>

          <view class="fp-section">
            <text class="fp-label">租金范围</text>
            <view class="fp-range-labels">
              <text class="fp-range-val">{{ priceMinLabel }}</text>
              <text class="fp-range-sep">—</text>
              <text class="fp-range-val">{{ priceMaxLabel }}</text>
            </view>
            <!-- 双滑块 -->
            <view
              class="range-slider"
              @touchstart="onTrackTouchStart"
            >
              <view class="range-track">
                <!-- 高亮区间 -->
                <view
                  class="range-active"
                  :style="{ left: minPct + '%', width: (maxPct - minPct) + '%' }"
                />
                <!-- 最低滑块 -->
                <view
                  class="range-thumb"
                  :style="{ left: minPct + '%' }"
                  @touchstart.stop="onThumbTouchStart('min')"
                  @touchmove.stop.prevent="onThumbTouchMove"
                  @touchend.stop="onThumbTouchEnd"
                >
                  <view class="thumb-tooltip">
                    <text>{{ priceMinLabel }}</text>
                  </view>
                </view>
                <!-- 最高滑块 -->
                <view
                  class="range-thumb"
                  :style="{ left: maxPct + '%' }"
                  @touchstart.stop="onThumbTouchStart('max')"
                  @touchmove.stop.prevent="onThumbTouchMove"
                  @touchend.stop="onThumbTouchEnd"
                >
                  <view class="thumb-tooltip">
                    <text>{{ priceMaxLabel }}</text>
                  </view>
                </view>
              </view>
              <!-- 刻度标签 -->
              <view class="range-ticks">
                <text>¥0</text>
                <text>¥5000</text>
                <text>¥10000</text>
              </view>
            </view>
          </view>

          <view v-if="locationReady" class="fp-section">
            <text class="fp-label">附近距离</text>
            <view class="fp-chips">
              <view
                v-for="(opt, idx) in DISTANCE_OPTIONS"
                :key="idx"
                class="fp-chip"
                :class="{ active: selDistanceIdx === idx }"
                @tap="selDistanceIdx = idx"
              >
                <text>{{ opt.label }}</text>
              </view>
            </view>
          </view>

          <view class="fp-actions">
            <view class="fp-btn reset" @tap="resetFilter"><text>重置</text></view>
            <view class="fp-btn confirm" @tap="confirmFilter"><text>确定</text></view>
          </view>
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

                <view class="cc-rent-row">
                  <text class="cc-rent">{{ rentRangeText(item) }}</text>
                  <text v-if="distanceText(item)" class="cc-distance">{{ distanceText(item) }}</text>
                </view>

                <text v-if="item.houseTypes" class="cc-types">{{ item.houseTypes }}</text>

                <text class="cc-count">{{ item.propertyCount }}套房源符合要求</text>
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
      </view>
    </view>

    <!-- FAB -->
    <view v-show="!showFilter" class="fab" @tap="goAddProperty">
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

// ---- Main body (sidebar + right content) ----
.main-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// ---- Region toggle ----
.region-toggle {
  width: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: $sl-bg-card;
  border-right: 1rpx solid $sl-border-color-light;
  flex-shrink: 0;
}

.toggle-arrow {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
}

// ---- Region sidebar ----
.region-sidebar {
  width: 200rpx;
  flex-shrink: 0;
  background-color: $sl-bg-card;
  border-right: 1rpx solid $sl-border-color-light;
  height: 100%;
}

.rs-item {
  padding: $sl-spacing-md $sl-spacing-sm;
  font-size: $sl-font-sm;
  color: $sl-text-primary;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &.active {
    color: $sl-primary-dark;
    font-weight: 600;
    background-color: rgba(37, 99, 235, 0.06);
  }

  &.l2 {
    padding-left: $sl-spacing-md;
    font-size: $sl-font-sm;
    color: $sl-text-secondary;

    &.active {
      color: $sl-primary-dark;
      background-color: rgba(37, 99, 235, 0.06);
    }
  }
}

.l1-arrow {
  font-size: $sl-font-xs;
  color: $sl-primary-dark;
}

.rs-divider {
  height: 1rpx;
  background-color: $sl-border-color-light;
  margin: 0 $sl-spacing-sm;
}

// ---- Right content ----
.right-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// ---- Page title (full width, above sidebar) ----
.page-title-row {
  padding: $sl-spacing-md $sl-spacing-lg;
  background-color: $sl-bg-card;
  flex-shrink: 0;
}

.page-title {
  font-size: $sl-font-xl;
  font-weight: 700;
  color: $sl-text-primary;
}

// ---- Toolbar row ----
.toolbar-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: $sl-spacing-sm;
  padding: $sl-spacing-sm $sl-spacing-md;
  background-color: $sl-bg-page;
  flex-shrink: 0;
}

.toolbar-btn {
  position: relative;
  width: 72rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: $sl-bg-hover;
  border-radius: $sl-border-radius;

  &.active {
    background-color: $sl-primary-dark;
    .tb-icon { color: #ffffff; }
  }
}

.tb-icon {
  font-size: $sl-font-md;
  color: #475569;
}

.tb-badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 32rpx;
  height: 32rpx;
  border-radius: 16rpx;
  background-color: $sl-danger;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $sl-font-xs;
  color: #ffffff;
  padding: 0 6rpx;
}

// ---- Search expand ----
.search-expand {
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  padding: 0 $sl-spacing-lg $sl-spacing-md;
  background-color: $sl-bg-card;
  flex-shrink: 0;
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

// ---- Filter Panel ----
.filter-panel {
  background-color: $sl-bg-card;
  padding: $sl-spacing-md $sl-spacing-lg $sl-spacing-lg;
  border-bottom: 1rpx solid $sl-border-color-light;
  flex-shrink: 0;
}

.fp-section {
  margin-bottom: $sl-spacing-lg;
}

.fp-label {
  display: block;
  font-size: $sl-font-sm;
  font-weight: 600;
  color: $sl-text-secondary;
  margin-bottom: $sl-spacing-sm;
}

.fp-chips {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-sm;
}

.fp-chip {
  padding: 12rpx 24rpx;
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

.fp-actions {
  display: flex;
  gap: $sl-spacing-md;
  margin-top: $sl-spacing-md;
}

.fp-btn {
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

.cc-rent-row {
  display: flex;
  align-items: baseline;
  gap: $sl-spacing-sm;
  margin-bottom: 6rpx;
}

.cc-rent {
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-price;
}

.cc-distance {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
  background-color: $sl-bg-hover;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
}

.cc-types {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-bottom: 6rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cc-count {
  font-size: $sl-font-sm;
  color: $sl-primary-dark;
  font-weight: 500;
}

.cc-arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  color: $sl-text-placeholder;
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
