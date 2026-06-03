<script setup lang="ts">
import type { PropertyFilterState, ShenLeId, SlRegionTreeOutput } from '@/types/shenle'
import { computed, getCurrentInstance, nextTick, onMounted, ref, watch } from 'vue'
import { getRegionTree } from '@/api/region'
import { BEDROOM_OPTIONS, DISTANCE_OPTIONS } from '@/constants/shenle'
import { clonePropertyFilters, sameId } from '@/utils/property-filter'

type DropdownName = 'location' | 'bedrooms' | 'price'

interface RegionHit {
  node: SlRegionTreeOutput
  parent?: SlRegionTreeOutput
}

interface RegionChip {
  id?: ShenLeId
  name: string
  level?: number
  node?: SlRegionTreeOutput
}

const props = defineProps<{
  filters: PropertyFilterState
  keyword?: string
  mountKey?: string
}>()

const emit = defineEmits<{
  confirm: [filters: PropertyFilterState, keyword?: string]
  reset: []
}>()

const PRICE_MAX = 10000
const PRICE_STEP = 100
const activeDropdown = ref<DropdownName | null>(null)
const sheetVisible = ref(false)
const draft = ref<PropertyFilterState>({})
const draftKeyword = ref('')
const regionTree = ref<SlRegionTreeOutput[]>([])
const regionLoading = ref(false)
const regionParentId = ref<ShenLeId | undefined>()
const instance = getCurrentInstance()

let dragging: 'min' | 'max' | null = null
let trackLeft = 0
let trackWidth = 0

const locationActive = computed(() => !!props.filters.regionId || props.filters.distanceKm !== undefined)
const bedroomActive = computed(() => props.filters.bedrooms !== undefined)
const priceActive = computed(() => props.filters.minPrice !== undefined || props.filters.maxPrice !== undefined)
const keywordActive = computed(() => !!props.keyword?.trim())

const locationLabel = computed(() => {
  const parts: string[] = []
  if (props.filters.regionName)
    parts.push(props.filters.regionName)
  else if (props.filters.regionId)
    parts.push('已选区域')
  if (props.filters.distanceKm !== undefined)
    parts.push(distanceLabel(props.filters.distanceKm))
  return parts.length ? parts.join(' ') : '位置'
})

const bedroomLabel = computed(() => {
  if (props.filters.bedrooms === undefined)
    return '户型'
  return BEDROOM_OPTIONS.find(item => item.value === props.filters.bedrooms)?.label || `${props.filters.bedrooms}室`
})

const priceLabel = computed(() => priceRangeLabel(props.filters, '租金'))
const selectedParent = computed(() => regionParentId.value === undefined ? undefined : findRegion(regionParentId.value)?.node)
const childRegions = computed(() => selectedParent.value?.children || [])
const priceMinValue = computed(() => draft.value.minPrice ?? 0)
const priceMaxValue = computed(() => draft.value.maxPrice ?? PRICE_MAX)
const priceMinLabel = computed(() => priceBoundaryLabel(priceMinValue.value))
const priceMaxLabel = computed(() => priceBoundaryLabel(priceMaxValue.value))
const minPct = computed(() => (priceMinValue.value / PRICE_MAX) * 100)
const maxPct = computed(() => (priceMaxValue.value / PRICE_MAX) * 100)
const sheetRegionChips = computed<RegionChip[]>(() => {
  const chips: RegionChip[] = [{ name: '不限' }]
  const walk = (nodes: SlRegionTreeOutput[]) => {
    for (const node of nodes) {
      chips.push({ id: node.id, name: node.name, level: node.level, node })
      if (node.children?.length)
        walk(node.children)
    }
  }
  walk(regionTree.value)
  return chips
})

watch(() => props.filters, () => {
  if (!activeDropdown.value && !sheetVisible.value)
    syncDraft()
}, { deep: true })

watch(() => props.keyword, () => {
  if (!sheetVisible.value)
    draftKeyword.value = props.keyword || ''
})

onMounted(() => {
  syncDraft()
  loadRegions()
})

function syncDraft() {
  draft.value = clonePropertyFilters(props.filters)
  draftKeyword.value = props.keyword || ''
  normalizeDraftPrice()
  syncRegionCursor()
}

function normalizeDraftPrice() {
  const min = draft.value.minPrice
  const max = draft.value.maxPrice
  if (min !== undefined && max !== undefined && min > max) {
    draft.value.minPrice = max
    draft.value.maxPrice = min
  }
}

async function loadRegions() {
  if (regionLoading.value || regionTree.value.length)
    return
  regionLoading.value = true
  try {
    regionTree.value = await getRegionTree()
    syncRegionCursor()
  }
  finally {
    regionLoading.value = false
  }
}

function findRegion(id?: ShenLeId): RegionHit | undefined {
  if (id === undefined)
    return undefined
  let hit: RegionHit | undefined
  const walk = (nodes: SlRegionTreeOutput[], parent?: SlRegionTreeOutput) => {
    for (const node of nodes) {
      if (sameId(node.id, id)) {
        hit = { node, parent }
        return
      }
      if (node.children?.length) {
        walk(node.children, node)
        if (hit)
          return
      }
    }
  }
  walk(regionTree.value)
  return hit
}

function syncRegionCursor() {
  const hit = findRegion(draft.value.regionId)
  regionParentId.value = hit?.parent?.id ?? hit?.node?.id
}

function toggleDropdown(name: DropdownName) {
  if (activeDropdown.value === name) {
    closeDropdown()
    return
  }
  if (!activeDropdown.value)
    syncDraft()
  activeDropdown.value = name
  sheetVisible.value = false
  loadRegions()
  nextTick(() => measureTrack())
}

function closeDropdown() {
  activeDropdown.value = null
  syncDraft()
}

function openSheet() {
  activeDropdown.value = null
  syncDraft()
  sheetVisible.value = true
  loadRegions()
  nextTick(() => measureTrack())
}

function closeSheet() {
  sheetVisible.value = false
  syncDraft()
}

function clearLocation() {
  draft.value.regionId = undefined
  draft.value.regionName = undefined
  draft.value.distanceKm = undefined
  draft.value.userLng = undefined
  draft.value.userLat = undefined
  regionParentId.value = undefined
}

function selectRegionParent(region?: SlRegionTreeOutput) {
  if (!region) {
    clearLocation()
    return
  }
  regionParentId.value = region.id
  draft.value.regionId = region.id
  draft.value.regionName = region.name
  applyRegionReferencePoint(region)
}

function selectParentAll() {
  if (!selectedParent.value)
    return
  draft.value.regionId = selectedParent.value.id
  draft.value.regionName = selectedParent.value.name
  applyRegionReferencePoint(selectedParent.value)
}

function selectRegionChild(region: SlRegionTreeOutput) {
  draft.value.regionId = region.id
  draft.value.regionName = region.name
  applyRegionReferencePoint(region)
}

function selectRegionChip(chip: RegionChip) {
  if (!chip.node) {
    clearLocation()
    return
  }
  const hit = findRegion(chip.node.id)
  regionParentId.value = hit?.parent?.id ?? chip.node.id
  draft.value.regionId = chip.node.id
  draft.value.regionName = chip.node.name
  applyRegionReferencePoint(chip.node)
}

function applyRegionReferencePoint(region: SlRegionTreeOutput) {
  if (draft.value.distanceKm === undefined)
    return
  if (region.centerLng !== undefined && region.centerLat !== undefined) {
    draft.value.userLng = Number(region.centerLng)
    draft.value.userLat = Number(region.centerLat)
  }
}

function selectDistance(value?: number) {
  draft.value.distanceKm = value
  if (value === undefined) {
    draft.value.userLng = undefined
    draft.value.userLat = undefined
    return
  }
  void ensureReferencePoint()
}

async function ensureReferencePoint() {
  const region = draft.value.regionId ? findRegion(draft.value.regionId)?.node : selectedParent.value
  if (region?.centerLng !== undefined && region.centerLat !== undefined) {
    draft.value.userLng = Number(region.centerLng)
    draft.value.userLat = Number(region.centerLat)
    return
  }
  if (draft.value.userLng !== undefined && draft.value.userLat !== undefined)
    return
  try {
    const position = await getLocationOnce()
    draft.value.userLng = position.longitude
    draft.value.userLat = position.latitude
  }
  catch {
    uni.showToast({ title: '附近距离需要定位授权', icon: 'none' })
  }
}

function getLocationOnce(): Promise<{ longitude: number, latitude: number }> {
  return new Promise((resolve, reject) => {
    uni.getLocation({
      type: 'gcj02',
      success: res => resolve({ longitude: res.longitude, latitude: res.latitude }),
      fail: reject,
    })
  })
}

function setBedroom(value?: number) {
  draft.value.bedrooms = value
}

function clearBedrooms() {
  draft.value.bedrooms = undefined
}

function setPriceRange(min: number, max: number) {
  const boundedMin = Math.max(0, Math.min(PRICE_MAX, min))
  const boundedMax = Math.max(0, Math.min(PRICE_MAX, max))
  const nextMin = Math.min(boundedMin, boundedMax)
  const nextMax = Math.max(boundedMin, boundedMax)
  draft.value.minPrice = nextMin > 0 ? nextMin : undefined
  draft.value.maxPrice = nextMax < PRICE_MAX ? nextMax : undefined
}

function clearPrice() {
  draft.value.minPrice = undefined
  draft.value.maxPrice = undefined
}

function resetCurrent() {
  if (activeDropdown.value === 'location')
    clearLocation()
  if (activeDropdown.value === 'bedrooms')
    clearBedrooms()
  if (activeDropdown.value === 'price')
    clearPrice()
  confirmCurrent()
}

async function confirmCurrent() {
  if (draft.value.distanceKm !== undefined)
    await ensureReferencePoint()
  activeDropdown.value = null
  emit('confirm', clonePropertyFilters(draft.value), props.keyword)
}

function resetSheet() {
  draft.value = {}
  draftKeyword.value = ''
  regionParentId.value = undefined
}

async function confirmSheet() {
  if (draft.value.distanceKm !== undefined)
    await ensureReferencePoint()
  sheetVisible.value = false
  emit('confirm', clonePropertyFilters(draft.value), draftKeyword.value.trim())
}

function resetAll() {
  draft.value = {}
  draftKeyword.value = ''
  regionParentId.value = undefined
  activeDropdown.value = null
  sheetVisible.value = false
  emit('reset')
}

function distanceLabel(value?: number) {
  if (value === undefined)
    return '不限'
  return DISTANCE_OPTIONS.find(item => item.value === value)?.label || (value < 1 ? `${Math.round(value * 1000)}m` : `${value}km`)
}

function priceBoundaryLabel(value: number) {
  return value <= 0 || value >= PRICE_MAX ? '不限' : `¥${value}`
}

function priceRangeLabel(filters: Pick<PropertyFilterState, 'minPrice' | 'maxPrice'>, fallback: string) {
  const min = filters.minPrice ?? 0
  const max = filters.maxPrice ?? PRICE_MAX
  if (min <= 0 && max >= PRICE_MAX)
    return fallback
  if (min > 0 && max >= PRICE_MAX)
    return `¥${min}以上`
  if (min <= 0)
    return `¥${max}以下`
  return `¥${min}-${max}`
}

function measureTrack() {
  const query = uni.createSelectorQuery().in(instance)
  query.select('.range-track').boundingClientRect((rect) => {
    const node = Array.isArray(rect) ? rect[0] : rect
    if (!node)
      return
    trackLeft = node.left || 0
    trackWidth = node.width || 0
  }).exec()
}

function onTrackTouchStart() {
  measureTrack()
}

function onThumbTouchStart(which: 'min' | 'max') {
  dragging = which
  measureTrack()
}

function valueFromX(x: number) {
  if (!trackWidth)
    return 0
  const pct = Math.max(0, Math.min(1, (x - trackLeft) / trackWidth))
  return Math.round((pct * PRICE_MAX) / PRICE_STEP) * PRICE_STEP
}

function onThumbTouchMove(event: TouchEvent) {
  if (!dragging || !trackWidth)
    return
  const x = event.touches[0]?.clientX ?? trackLeft
  const value = valueFromX(x)
  if (dragging === 'min')
    setPriceRange(Math.min(value, priceMaxValue.value), priceMaxValue.value)
  else
    setPriceRange(priceMinValue.value, Math.max(value, priceMinValue.value))
}

function onThumbTouchEnd() {
  dragging = null
}
</script>

<template>
  <view class="filter-shell" :class="{ open: activeDropdown || sheetVisible }">
    <view class="filter-bar">
      <view
        class="filter-tab"
        :class="{ active: locationActive, open: activeDropdown === 'location' }"
        @tap="toggleDropdown('location')"
      >
        <text class="filter-tab__label">{{ locationLabel }}</text>
        <text class="filter-tab__arrow">▾</text>
      </view>
      <view
        class="filter-tab"
        :class="{ active: bedroomActive, open: activeDropdown === 'bedrooms' }"
        @tap="toggleDropdown('bedrooms')"
      >
        <text class="filter-tab__label">{{ bedroomLabel }}</text>
        <text class="filter-tab__arrow">▾</text>
      </view>
      <view
        class="filter-tab"
        :class="{ active: priceActive, open: activeDropdown === 'price' }"
        @tap="toggleDropdown('price')"
      >
        <text class="filter-tab__label">{{ priceLabel }}</text>
        <text class="filter-tab__arrow">▾</text>
      </view>
      <view class="filter-spacer" />
      <view class="filter-search" :class="{ active: keywordActive || sheetVisible }" @tap="openSheet">
        <wd-icon name="search" size="18px" :color="keywordActive || sheetVisible ? '#2f66ee' : '#293241'" />
      </view>
    </view>

    <view v-if="activeDropdown" class="filter-mask" @tap="closeDropdown" />

    <view v-if="activeDropdown" class="dropdown-panel">
      <view v-if="activeDropdown === 'location'" class="dropdown-section">
        <text class="section-title">附近距离</text>
        <view class="chip-row">
          <view
            v-for="item in DISTANCE_OPTIONS"
            :key="item.label"
            class="filter-chip"
            :class="{ active: draft.distanceKm === item.value }"
            @tap="selectDistance(item.value)"
          >
            <text>{{ item.label }}</text>
          </view>
        </view>

        <view class="region-split">
          <scroll-view scroll-y class="region-left">
            <view class="region-left__item" :class="{ active: !draft.regionId }" @tap="selectRegionParent()">
              <text>不限</text>
            </view>
            <view
              v-for="region in regionTree"
              :key="String(region.id)"
              class="region-left__item"
              :class="{ active: sameId(regionParentId, region.id) }"
              @tap="selectRegionParent(region)"
            >
              <text>{{ region.name }}</text>
            </view>
            <view v-if="!regionTree.length" class="region-empty">
              {{ regionLoading ? '加载中...' : '暂无区域' }}
            </view>
          </scroll-view>
          <scroll-view scroll-y class="region-right">
            <view v-if="!selectedParent" class="region-right__item active">
              <text>全部区域</text>
            </view>
            <template v-else>
              <view class="region-right__item" :class="{ active: sameId(draft.regionId, selectedParent.id) }" @tap="selectParentAll">
                <text>全部区域</text>
              </view>
              <view
                v-for="child in childRegions"
                :key="String(child.id)"
                class="region-right__item"
                :class="{ active: sameId(draft.regionId, child.id) }"
                @tap="selectRegionChild(child)"
              >
                <text>{{ child.name }}</text>
              </view>
            </template>
          </scroll-view>
        </view>
      </view>

      <view v-if="activeDropdown === 'bedrooms'" class="dropdown-section dropdown-section--short">
        <view class="chip-row chip-row--large">
          <view
            v-for="item in BEDROOM_OPTIONS"
            :key="item.label"
            class="filter-chip"
            :class="{ active: draft.bedrooms === item.value }"
            @tap="setBedroom(item.value)"
          >
            <text>{{ item.label }}</text>
          </view>
        </view>
      </view>

      <view v-if="activeDropdown === 'price'" class="dropdown-section dropdown-section--short">
        <view class="range-title">
          <text>{{ priceMinLabel }}</text>
          <text class="range-title__dash">—</text>
          <text>{{ priceMaxLabel }}</text>
        </view>
        <view class="range-slider" @touchstart="onTrackTouchStart">
          <view class="range-track">
            <view class="range-active" :style="{ left: `${minPct}%`, width: `${maxPct - minPct}%` }" />
            <view
              class="range-thumb"
              :style="{ left: `${minPct}%` }"
              @touchstart.stop="onThumbTouchStart('min')"
              @touchmove.stop.prevent="onThumbTouchMove"
              @touchend.stop="onThumbTouchEnd"
              @touchcancel.stop="onThumbTouchEnd"
            />
            <view
              class="range-thumb"
              :style="{ left: `${maxPct}%` }"
              @touchstart.stop="onThumbTouchStart('max')"
              @touchmove.stop.prevent="onThumbTouchMove"
              @touchend.stop="onThumbTouchEnd"
              @touchcancel.stop="onThumbTouchEnd"
            />
          </view>
          <view class="range-ticks">
            <text>¥0</text>
            <text>¥5000</text>
            <text>¥10000</text>
          </view>
        </view>
      </view>

      <view class="panel-actions">
        <wd-button size="large" type="info" plain block @click="resetCurrent">
          重置
        </wd-button>
        <wd-button size="large" type="primary" block @click="confirmCurrent">
          确定
        </wd-button>
      </view>
    </view>

    <wd-popup
      :model-value="sheetVisible"
      position="bottom"
      custom-style="height: 86vh; border-radius: 32rpx 32rpx 0 0; overflow: hidden; background: #ffffff;"
      safe-area-inset-bottom
      :z-index="120"
      @close="closeSheet"
      @click-modal="closeSheet"
    >
      <view class="sheet-panel">
        <view class="sheet-head">
          <text class="sheet-title">筛选</text>
          <view class="sheet-close" @tap="closeSheet">
            <wd-icon name="close" size="18px" color="#4b5563" />
          </view>
        </view>

        <view class="sheet-search-row">
          <wd-icon name="search" size="18px" color="#9aa3af" />
          <input
            v-model="draftKeyword"
            class="sheet-input"
            placeholder="输入楼盘名称"
            confirm-type="search"
            @confirm="confirmSheet"
          >
        </view>

        <scroll-view scroll-y class="sheet-body">
          <view class="sheet-block">
            <text class="sheet-block__title">附近距离</text>
            <view class="chip-row">
              <view
                v-for="item in DISTANCE_OPTIONS"
                :key="item.label"
                class="filter-chip"
                :class="{ active: draft.distanceKm === item.value }"
                @tap="selectDistance(item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">选区域</text>
            <view class="sheet-region-grid">
              <view
                v-for="chip in sheetRegionChips"
                :key="chip.id === undefined ? 'all' : String(chip.id)"
                class="filter-chip sheet-region-chip"
                :class="{ active: chip.id === undefined ? !draft.regionId : sameId(draft.regionId, chip.id), child: chip.level && chip.level > 1 }"
                @tap="selectRegionChip(chip)"
              >
                <text>{{ chip.name }}</text>
              </view>
            </view>
          </view>

          <view class="sheet-block">
            <text class="sheet-block__title">租金范围</text>
            <view class="range-title range-title--sheet">
              <text>{{ priceMinLabel }}</text>
              <text class="range-title__dash">—</text>
              <text>{{ priceMaxLabel }}</text>
            </view>
            <view class="range-slider" @touchstart="onTrackTouchStart">
              <view class="range-track">
                <view class="range-active" :style="{ left: `${minPct}%`, width: `${maxPct - minPct}%` }" />
                <view
                  class="range-thumb"
                  :style="{ left: `${minPct}%` }"
                  @touchstart.stop="onThumbTouchStart('min')"
                  @touchmove.stop.prevent="onThumbTouchMove"
                  @touchend.stop="onThumbTouchEnd"
                  @touchcancel.stop="onThumbTouchEnd"
                />
                <view
                  class="range-thumb"
                  :style="{ left: `${maxPct}%` }"
                  @touchstart.stop="onThumbTouchStart('max')"
                  @touchmove.stop.prevent="onThumbTouchMove"
                  @touchend.stop="onThumbTouchEnd"
                  @touchcancel.stop="onThumbTouchEnd"
                />
              </view>
              <view class="range-ticks">
                <text>¥0</text>
                <text>¥5000</text>
                <text>¥10000</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <view class="sheet-footer">
          <wd-button size="large" type="info" plain block @click="resetSheet">
            重置
          </wd-button>
          <wd-button size="large" type="primary" block @click="confirmSheet">
            完成
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.filter-shell {
  position: relative;
  z-index: 12;
  margin-top: 22rpx;
}

.filter-shell.open {
  z-index: 80;
}

.filter-bar {
  position: relative;
  z-index: 84;
  display: flex;
  min-height: 88rpx;
  align-items: center;
  box-sizing: border-box;
  padding: 0 14rpx 0 18rpx;
  border: 1rpx solid #eef1f7;
  border-radius: 26rpx;
  background: #fff;
  box-shadow: 0 16rpx 36rpx rgb(31 49 81 / 8%);
}

.filter-tab {
  display: flex;
  min-width: 0;
  max-width: 164rpx;
  align-items: center;
  gap: 8rpx;
  padding: 20rpx 16rpx;
  color: #293241;
  font-size: 28rpx;
  font-weight: 600;
}

.filter-tab.active,
.filter-tab.open {
  color: #2f66ee;
}

.filter-tab.open .filter-tab__arrow {
  transform: rotate(180deg);
}

.filter-tab__label {
  display: block;
  overflow: hidden;
  max-width: 112rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-tab__arrow {
  display: inline-block;
  color: currentcolor;
  font-size: 22rpx;
  line-height: 1;
  transition: transform 0.18s ease;
}

.filter-spacer {
  flex: 1;
}

.filter-search {
  display: flex;
  width: 60rpx;
  height: 60rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #f7f8fb;
}

.filter-search.active {
  background: rgb(47 102 238 / 10%);
}

.filter-mask {
  position: fixed;
  z-index: 82;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgb(16 24 40 / 30%);
}

.dropdown-panel {
  position: absolute;
  z-index: 86;
  top: calc(100% + 12rpx);
  right: 0;
  left: 0;
  overflow: hidden;
  border: 1rpx solid #eef1f7;
  border-radius: 26rpx;
  background: #fff;
  box-shadow: 0 24rpx 54rpx rgb(30 51 92 / 16%);
  animation: dropdown-in 0.22s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes dropdown-in {
  from {
    transform: translateY(-14rpx);
    opacity: 0;
  }

  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.dropdown-section {
  padding: 28rpx 26rpx 22rpx;
}

.dropdown-section--short {
  min-height: 220rpx;
}

.section-title,
.sheet-block__title {
  display: block;
  margin-bottom: 18rpx;
  color: #111827;
  font-size: 28rpx;
  font-weight: 800;
}

.chip-row,
.sheet-region-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 18rpx;
}

.chip-row--large {
  padding-top: 8rpx;
}

.filter-chip {
  box-sizing: border-box;
  min-width: 118rpx;
  padding: 18rpx 24rpx;
  border: 1rpx solid transparent;
  border-radius: 16rpx;
  background: #f4f6fa;
  color: #374151;
  font-size: 26rpx;
  line-height: 1;
  text-align: center;
}

.filter-chip.active {
  border-color: #2f66ee;
  background: #2f66ee;
  box-shadow: 0 12rpx 24rpx rgb(47 102 238 / 22%);
  color: #fff;
  font-weight: 800;
}

.region-split {
  display: flex;
  overflow: hidden;
  height: 420rpx;
  margin: 26rpx -26rpx -22rpx;
  border-top: 1rpx solid #eef1f7;
}

.region-left {
  width: 210rpx;
  height: 100%;
  flex: 0 0 210rpx;
  background: #f7f8fb;
}

.region-right {
  height: 100%;
  flex: 1;
  background: #fff;
}

.region-left__item,
.region-right__item {
  position: relative;
  padding: 28rpx 28rpx;
  color: #4b5563;
  font-size: 27rpx;
}

.region-left__item.active {
  background: #fff;
  color: #2f66ee;
  font-weight: 800;
}

.region-left__item.active::before {
  position: absolute;
  top: 24rpx;
  bottom: 24rpx;
  left: 0;
  width: 6rpx;
  border-radius: 0 999rpx 999rpx 0;
  background: #2f66ee;
  content: '';
}

.region-right__item.active {
  color: #2f66ee;
  font-weight: 800;
}

.region-empty {
  padding: 34rpx 18rpx;
  color: #9aa3af;
  font-size: 24rpx;
  text-align: center;
}

.range-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18rpx;
  margin: 6rpx 0 34rpx;
  color: #2f66ee;
  font-size: 34rpx;
  font-weight: 850;
}

.range-title--sheet {
  margin-top: 0;
}

.range-title__dash {
  color: #a3aab8;
  font-weight: 600;
}

.range-slider {
  padding: 30rpx 22rpx 12rpx;
}

.range-track {
  position: relative;
  height: 8rpx;
  border-radius: 999rpx;
  background: #dfe5ef;
}

.range-active {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 999rpx;
  background: #2f66ee;
}

.range-thumb {
  position: absolute;
  z-index: 2;
  top: 50%;
  width: 48rpx;
  height: 48rpx;
  box-sizing: border-box;
  margin-top: -24rpx;
  margin-left: -24rpx;
  border: 7rpx solid #2f66ee;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 8rpx 20rpx rgb(47 102 238 / 24%);
}

.range-ticks {
  display: flex;
  justify-content: space-between;
  margin-top: 26rpx;
  color: #9aa3af;
  font-size: 22rpx;
}

.panel-actions,
.sheet-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 22rpx;
  padding: 22rpx 26rpx 26rpx;
  border-top: 1rpx solid #eef1f7;
  background: #fff;
}

.sheet-panel {
  display: flex;
  height: 86vh;
  flex-direction: column;
  background: #fff;
}

.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 30rpx 20rpx;
}

.sheet-title {
  color: #111827;
  font-size: 36rpx;
  font-weight: 900;
}

.sheet-close {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #f4f6fa;
}

.sheet-search-row {
  display: flex;
  min-height: 76rpx;
  align-items: center;
  gap: 14rpx;
  margin: 0 30rpx 18rpx;
  padding: 0 22rpx;
  border-radius: 18rpx;
  background: #f5f7fb;
}

.sheet-input {
  min-width: 0;
  flex: 1;
  color: #111827;
  font-size: 27rpx;
}

.sheet-body {
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 0 30rpx 24rpx;
}

.sheet-block {
  padding: 26rpx 0 6rpx;
}

.sheet-region-grid {
  gap: 16rpx;
}

.sheet-region-chip {
  max-width: 210rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sheet-region-chip.child {
  background: #fafbfe;
}

.sheet-region-chip.child.active {
  background: #2f66ee;
}
</style>
