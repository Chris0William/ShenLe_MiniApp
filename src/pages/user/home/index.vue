<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { getCommunityPage } from '@/api/community'
import { getRegionTree } from '@/api/region'
import { PRICE_RANGES } from '@/utils/constants'
import { downloadFile } from '@/api/file'
import type { SlCommunityOutput } from '@/types/community'
import type { SlRegionTreeOutput } from '@/types/region'

const appStore = useAppStore()

// ---- List ----
const list = ref<SlCommunityOutput[]>([])
const pg = ref(1)
const pageSize = 10
const loadStatus = ref<'more' | 'loading' | 'noMore'>('more')
const refreshing = ref(false)

// ---- Search ----
const keyword = ref('')

// ---- Active panel ----
const activePanel = ref('')

// ---- Region filter ----
const regionTree = ref<SlRegionTreeOutput[]>([])
const activeL1 = ref('')
const selRegionId = ref<number | undefined>(undefined)
const selRegionName = ref('')

const l2List = computed(() => {
  if (!activeL1.value) return []
  return regionTree.value.find(r => String(r.id) === activeL1.value)?.children || []
})

// ---- Price filter ----
const selPriceIdx = ref(0)

// ---- Labels ----
const regionLabel = computed(() => selRegionName.value || '区域')
const priceLabel = computed(() =>
  selPriceIdx.value > 0 ? PRICE_RANGES[selPriceIdx.value].label : '租金',
)

function isFilterActive(name: string) {
  if (name === 'region') return !!selRegionId.value
  if (name === 'price') return selPriceIdx.value > 0
  return false
}

// ---- Data loading ----
async function loadData(reset = false) {
  if (reset) {
    pg.value = 1
    list.value = []
  }
  if (loadStatus.value === 'loading') return
  loadStatus.value = 'loading'
  try {
    const priceRange = PRICE_RANGES[selPriceIdx.value]
    const res = await getCommunityPage({
      page: pg.value,
      pageSize,
      name: keyword.value || undefined,
      regionId: selRegionId.value,
      status: 0,
      minPrice: priceRange?.min,
      maxPrice: priceRange?.max,
    })
    const newItems = res.items
    list.value = reset ? newItems : [...list.value, ...newItems]
    loadStatus.value = newItems.length < pageSize ? 'noMore' : 'more'
    pg.value++
    loadCovers(newItems)
  } catch {
    loadStatus.value = 'more'
  }
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

// ---- Price display ----
function formatRentRange(min: number | null, max: number | null): string {
  if (!min && !max) return '价格面议'
  if (min && max && min === max) return `¥${min.toLocaleString()}/月`
  if (min && max) return `¥${min.toLocaleString()}~${max.toLocaleString()}/月`
  if (min) return `¥${min.toLocaleString()}起/月`
  return `最高¥${max!.toLocaleString()}/月`
}

// ---- Panel toggle ----
function togglePanel(name: string) {
  if (activePanel.value === name) {
    activePanel.value = ''
    return
  }
  activePanel.value = name
  if (name === 'region' && !activeL1.value && regionTree.value.length) {
    activeL1.value = String(regionTree.value[0].id)
  }
}

function closePanel() {
  activePanel.value = ''
}

// ---- Region ----
function pickL1(id: string) {
  activeL1.value = id
}

function pickRegion(id: number | undefined, name: string) {
  selRegionId.value = id
  selRegionName.value = name
  closePanel()
  loadData(true)
}

function clearRegion() {
  selRegionId.value = undefined
  selRegionName.value = ''
  activeL1.value = ''
  closePanel()
  loadData(true)
}

// ---- Price ----
function pickPrice(idx: number) {
  selPriceIdx.value = idx
  closePanel()
  loadData(true)
}

// ---- Search ----
function onSearch() {
  loadData(true)
}

// ---- Scroll ----
async function onRefresh() {
  refreshing.value = true
  await loadData(true)
  refreshing.value = false
}

function onLoadMore() {
  if (loadStatus.value === 'more') loadData()
}

// ---- Navigate ----
function goCommunity(id: number) {
  // TODO: Navigate to community detail or property list filtered by community
  uni.showToast({ title: '楼盘详情开发中', icon: 'none' })
}

// ---- Init ----
onMounted(async () => {
  try {
    regionTree.value = await getRegionTree()
  } catch {}
  loadData(true)
})
</script>

<template>
  <view class="page">
    <!-- 搜索栏 -->
    <view class="header" :style="{ paddingTop: appStore.headerPaddingStyle(10) }">
      <view class="search-bar">
        <text class="search-icon">&#x1F50D;</text>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索楼盘名称"
          placeholder-class="search-ph"
          confirm-type="search"
          @confirm="onSearch"
        />
      </view>
    </view>

    <!-- 筛选栏 -->
    <view class="filter-bar">
      <view
        class="filter-btn"
        :class="{ on: activePanel === 'region' || isFilterActive('region') }"
        @tap="togglePanel('region')"
      >
        <text>{{ regionLabel }}</text>
        <text class="arrow" :class="{ up: activePanel === 'region' }">&#x25BC;</text>
      </view>
      <view
        class="filter-btn"
        :class="{ on: activePanel === 'price' || isFilterActive('price') }"
        @tap="togglePanel('price')"
      >
        <text>{{ priceLabel }}</text>
        <text class="arrow" :class="{ up: activePanel === 'price' }">&#x25BC;</text>
      </view>
    </view>

    <!-- 内容区域 -->
    <view class="content">
      <!-- 下拉遮罩 + 面板 -->
      <view v-if="activePanel" class="dropdown-mask" @tap="closePanel">
        <!-- 区域面板 -->
        <view v-if="activePanel === 'region'" class="dropdown-panel region-panel" @tap.stop>
          <view class="region-all" @tap="clearRegion">
            <text :class="{ selected: !selRegionId }">不限区域</text>
          </view>
          <view class="region-cols">
            <scroll-view scroll-y class="region-l1">
              <view
                v-for="r in regionTree"
                :key="r.id"
                class="region-l1-item"
                :class="{ active: activeL1 === String(r.id) }"
                @tap="pickL1(String(r.id))"
              >
                {{ r.name }}
              </view>
            </scroll-view>
            <scroll-view scroll-y class="region-l2">
              <view
                class="region-l2-item"
                :class="{ selected: selRegionId === Number(activeL1) }"
                @tap="pickRegion(Number(activeL1), regionTree.find(r => String(r.id) === activeL1)?.name || '')"
              >
                全部
              </view>
              <view
                v-for="r in l2List"
                :key="r.id"
                class="region-l2-item"
                :class="{ selected: selRegionId === r.id }"
                @tap="pickRegion(r.id, r.name)"
              >
                {{ r.name }}
              </view>
            </scroll-view>
          </view>
        </view>

        <!-- 价格面板 -->
        <view v-if="activePanel === 'price'" class="dropdown-panel" @tap.stop>
          <view
            v-for="(p, idx) in PRICE_RANGES"
            :key="idx"
            class="option-item"
            :class="{ selected: selPriceIdx === idx }"
            @tap="pickPrice(idx)"
          >
            {{ p.label }}
          </view>
        </view>
      </view>

      <!-- 楼盘列表 -->
      <scroll-view
        scroll-y
        class="list-scroll"
        :refresher-enabled="true"
        :refresher-triggered="refreshing"
        @refresherrefresh="onRefresh"
        @scrolltolower="onLoadMore"
      >
        <view class="list-content">
          <template v-if="list.length > 0">
            <view
              v-for="item in list"
              :key="item.id"
              class="community-card"
              @tap="goCommunity(item.id)"
            >
              <!-- 封面 -->
              <view class="cover-wrap">
                <image
                  v-if="coverSrc(item)"
                  class="community-cover"
                  :src="coverSrc(item)"
                  mode="aspectFill"
                />
                <view v-else class="community-cover placeholder-cover">
                  <text class="placeholder-text">暂无图片</text>
                </view>
              </view>
              <!-- 信息 -->
              <view class="community-body">
                <view class="community-header">
                  <text class="community-name">{{ item.name }}</text>
                  <text v-if="item.regionName" class="community-region">{{ item.regionName }}</text>
                </view>
                <text class="community-price">{{ formatRentRange(item.minRentPrice, item.maxRentPrice) }}</text>
                <view class="community-meta">
                  <text v-if="item.houseTypes" class="community-types">{{ item.houseTypes }}</text>
                  <text v-else class="community-types">暂无户型信息</text>
                </view>
                <view class="community-footer">
                  <text class="community-count">{{ item.propertyCount }}套房源</text>
                  <text v-if="item.address" class="community-addr">{{ item.address }}</text>
                </view>
              </view>
            </view>
          </template>
          <sl-empty-state
            v-if="list.length === 0 && loadStatus !== 'loading'"
            text="暂无符合条件的楼盘"
          />
          <sl-load-more v-if="list.length > 0" :status="loadStatus" />
        </view>
        <view style="height: 120rpx" />
      </scroll-view>
    </view>

    <sl-custom-tabbar :current="0" />
  </view>
</template>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: $sl-bg-page;
}

.header {
  padding: $sl-spacing-sm $sl-spacing-md;
  background-color: $sl-bg-card;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: $sl-spacing-xs;
  padding: $sl-spacing-xs $sl-spacing-md;
  background-color: $sl-bg-page;
  border-radius: 40rpx;
}

.search-icon {
  font-size: $sl-font-sm;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  height: 56rpx;
}

.search-ph {
  color: $sl-text-placeholder;
}

.filter-bar {
  display: flex;
  background-color: $sl-bg-card;
  border-bottom: 1rpx solid $sl-border-color;
  flex-shrink: 0;
}

.filter-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  padding: $sl-spacing-sm 0;
  font-size: $sl-font-md;
  color: $sl-text-primary;

  &.on {
    color: $sl-primary;
  }
}

.arrow {
  font-size: 18rpx;
  transition: transform 0.2s;

  &.up {
    transform: rotate(180deg);
  }
}

.content {
  flex: 1;
  position: relative;
  overflow: hidden;
}

// ---- Dropdown ----
.dropdown-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.35);
  z-index: 100;
}

.dropdown-panel {
  background-color: $sl-bg-card;
  max-height: 60vh;
  overflow-y: auto;
}

.option-item {
  padding: $sl-spacing-md $sl-spacing-lg;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  border-bottom: 1rpx solid $sl-border-color;

  &.selected {
    color: $sl-primary;
    font-weight: 600;
  }
}

// ---- Region panel ----
.region-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.region-all {
  padding: $sl-spacing-md $sl-spacing-lg;
  border-bottom: 1rpx solid $sl-border-color;
  font-size: $sl-font-md;

  .selected {
    color: $sl-primary;
    font-weight: 600;
  }
}

.region-cols {
  display: flex;
  height: 500rpx;
}

.region-l1 {
  width: 240rpx;
  background-color: $sl-bg-page;
  height: 100%;
}

.region-l1-item {
  padding: $sl-spacing-md $sl-spacing-lg;
  font-size: $sl-font-md;
  color: $sl-text-secondary;

  &.active {
    background-color: $sl-bg-card;
    color: $sl-primary;
    font-weight: 600;
  }
}

.region-l2 {
  flex: 1;
  height: 100%;
}

.region-l2-item {
  padding: $sl-spacing-md $sl-spacing-lg;
  font-size: $sl-font-md;
  color: $sl-text-primary;

  &.selected {
    color: $sl-primary;
    font-weight: 600;
  }
}

// ---- List ----
.list-scroll {
  height: 100%;
}

.list-content {
  padding: $sl-spacing-sm;
}

// ---- Community Card ----
.community-card {
  display: flex;
  gap: $sl-spacing-sm;
  padding: $sl-spacing-md;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  margin-bottom: $sl-spacing-sm;
}

.cover-wrap {
  position: relative;
  width: 220rpx;
  height: 166rpx;
  flex-shrink: 0;
}

.community-cover {
  width: 100%;
  height: 100%;
  border-radius: $sl-border-radius-sm;
  background-color: #f0f0f0;
}

.placeholder-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #F1F5F9;
}

.placeholder-text {
  font-size: 24rpx;
  color: $sl-text-placeholder;
}

.play-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-icon {
  font-size: 24rpx;
  color: #ffffff;
  margin-left: 4rpx;
}

.community-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.community-header {
  display: flex;
  align-items: center;
  gap: $sl-spacing-xs;
}

.community-name {
  font-size: $sl-font-md;
  font-weight: 600;
  color: $sl-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-region {
  font-size: $sl-font-xs;
  color: $sl-primary;
  background-color: rgba($sl-primary, 0.08);
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  flex-shrink: 0;
}

.community-price {
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-price;
}

.community-meta {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
}

.community-types {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-footer {
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  margin-top: auto;
  font-size: $sl-font-xs;
  color: $sl-text-placeholder;
}

.community-count {
  color: $sl-text-secondary;
  font-weight: 500;
}

.community-addr {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
