<script setup lang="ts">
import type { PropertyFilterState, ShenLeId, SlCommunitySelectOutput, SlRegionTreeOutput } from '@/types/shenle'
import { computed, ref, watch } from 'vue'
import { getCommunityList } from '@/api/community'
import { getRegionTree } from '@/api/region'
import {
  AREA_SEGMENTS,
  BEDROOM_OPTIONS,
  DECORATION_OPTIONS,
  DEPOSIT_RULE_OPTIONS,
  ORIENTATION_OPTIONS,
  PRICE_SEGMENTS,
  PROPERTY_FILTER_CATEGORIES,
  RENTAL_TYPE_OPTIONS,
} from '@/constants/shenle'
import { clonePropertyFilters, countPropertyFilters, hasPropertyFilter, sameId } from '@/utils/property-filter'

const props = defineProps<{
  visible: boolean
  filters: PropertyFilterState
}>()

const emit = defineEmits<{
  confirm: [filters: PropertyFilterState]
  close: []
}>()

const popupStyle = 'height: 78vh; margin-bottom: calc(112rpx + env(safe-area-inset-bottom)); border-radius: 34rpx 34rpx 0 0; overflow: hidden; background: #f7faf4;'
const activeCategory = ref<(typeof PROPERTY_FILTER_CATEGORIES)[number]['key']>('region')
const temp = ref<PropertyFilterState>(clonePropertyFilters(props.filters))
const regionTree = ref<SlRegionTreeOutput[]>([])
const communityListData = ref<SlCommunitySelectOutput[]>([])
const communityKeyword = ref('')
const customMinPrice = ref('')
const customMaxPrice = ref('')
const loadingOptions = ref(false)

const activeCount = computed(() => countPropertyFilters(temp.value))
const flatRegions = computed(() => {
  const result: { id: ShenLeId, name: string }[] = []
  function walk(nodes: SlRegionTreeOutput[]) {
    for (const node of nodes) {
      if (node.children?.length)
        walk(node.children)
      else
        result.push({ id: node.id, name: node.name })
    }
  }
  walk(regionTree.value)
  return result
})

const filteredCommunities = computed(() => {
  const keyword = communityKeyword.value.trim()
  const data = communityListData.value
  if (!keyword)
    return data
  return data.filter(item => item.name.includes(keyword))
})

watch(() => props.visible, (visible) => {
  if (!visible)
    return
  temp.value = clonePropertyFilters(props.filters)
  syncCustomPrice()
  loadOptions()
})

async function loadOptions() {
  if (loadingOptions.value || (regionTree.value.length && communityListData.value.length))
    return
  loadingOptions.value = true
  try {
    const [regions, communities] = await Promise.allSettled([
      getRegionTree(),
      getCommunityList({}),
    ])
    if (regions.status === 'fulfilled')
      regionTree.value = regions.value
    if (communities.status === 'fulfilled')
      communityListData.value = communities.value
  }
  finally {
    loadingOptions.value = false
  }
}

function syncCustomPrice() {
  const matched = PRICE_SEGMENTS.some(item => item.min === temp.value.minPrice && item.max === temp.value.maxPrice)
  customMinPrice.value = !matched && temp.value.minPrice !== undefined ? String(temp.value.minPrice) : ''
  customMaxPrice.value = !matched && temp.value.maxPrice !== undefined ? String(temp.value.maxPrice) : ''
}

function categoryHasValue(key: string) {
  return hasPropertyFilter(temp.value, key)
}

function setValue<K extends keyof PropertyFilterState>(key: K, value: PropertyFilterState[K]) {
  const current = temp.value[key]
  temp.value[key] = current === value ? undefined : value
}

function setRegion(id?: ShenLeId, name?: string) {
  if (id === undefined || sameId(temp.value.regionId, id)) {
    temp.value.regionId = undefined
    temp.value.regionName = undefined
    return
  }
  temp.value.regionId = id
  temp.value.regionName = name
}

function setCommunity(id?: ShenLeId, name?: string) {
  if (id === undefined || sameId(temp.value.communityId, id)) {
    temp.value.communityId = undefined
    temp.value.communityName = undefined
    return
  }
  temp.value.communityId = id
  temp.value.communityName = name
}

function isPriceActive(segment: typeof PRICE_SEGMENTS[number]) {
  return temp.value.minPrice === segment.min && temp.value.maxPrice === segment.max
}

function selectPrice(segment: typeof PRICE_SEGMENTS[number]) {
  if (segment.min === undefined && segment.max === undefined) {
    temp.value.minPrice = undefined
    temp.value.maxPrice = undefined
  }
  else if (isPriceActive(segment)) {
    temp.value.minPrice = undefined
    temp.value.maxPrice = undefined
  }
  else {
    temp.value.minPrice = segment.min
    temp.value.maxPrice = segment.max
  }
  customMinPrice.value = ''
  customMaxPrice.value = ''
}

function parseRangeValue(value: string) {
  const num = Number(value)
  return value === '' || Number.isNaN(num) ? undefined : num
}

function applyCustomPrice() {
  let min = parseRangeValue(customMinPrice.value)
  let max = parseRangeValue(customMaxPrice.value)
  if (min === undefined && max === undefined)
    return
  if (min !== undefined && max !== undefined && min > max)
    [min, max] = [max, min]
  temp.value.minPrice = min
  temp.value.maxPrice = max
}

function isAreaActive(segment: typeof AREA_SEGMENTS[number]) {
  return temp.value.minArea === segment.min && temp.value.maxArea === segment.max
}

function selectArea(segment: typeof AREA_SEGMENTS[number]) {
  if (segment.min === undefined && segment.max === undefined) {
    temp.value.minArea = undefined
    temp.value.maxArea = undefined
  }
  else if (isAreaActive(segment)) {
    temp.value.minArea = undefined
    temp.value.maxArea = undefined
  }
  else {
    temp.value.minArea = segment.min
    temp.value.maxArea = segment.max
  }
}

function onReset() {
  temp.value = {}
  customMinPrice.value = ''
  customMaxPrice.value = ''
  communityKeyword.value = ''
}

function onConfirm() {
  applyCustomPrice()
  emit('confirm', clonePropertyFilters(temp.value))
}
</script>

<template>
  <wd-popup
    :model-value="visible"
    position="bottom"
    :custom-style="popupStyle"
    :z-index="1100"
    safe-area-inset-bottom
    @touchmove.stop.prevent
    @close="emit('close')"
    @click-modal="emit('close')"
  >
    <view class="filter-panel" @touchmove.stop.prevent>
      <view class="panel-head">
        <view>
          <text class="panel-head__title">筛选房源</text>
          <text class="panel-head__desc">按区域、户型、租金等条件快速定位</text>
        </view>
        <view class="panel-head__close" @tap="emit('close')">
          <wd-icon name="close" size="18px" color="#72817b" />
        </view>
      </view>

      <view class="panel-body">
        <scroll-view scroll-y class="left-col">
          <view
            v-for="cat in PROPERTY_FILTER_CATEGORIES"
            :key="cat.key"
            class="cat-item"
            :class="{ active: activeCategory === cat.key, selected: categoryHasValue(cat.key) }"
            @tap="activeCategory = cat.key"
          >
            <text>{{ cat.label }}</text>
            <view v-if="categoryHasValue(cat.key)" class="cat-dot" />
          </view>
        </scroll-view>

        <scroll-view scroll-y class="right-col">
          <view v-if="activeCategory === 'region'" class="option-list">
            <view class="opt-chip" :class="{ active: !temp.regionId }" @tap="setRegion(undefined)">
              <text>全部区域</text>
            </view>
            <view
              v-for="item in flatRegions"
              :key="String(item.id)"
              class="opt-chip"
              :class="{ active: sameId(temp.regionId, item.id) }"
              @tap="setRegion(item.id, item.name)"
            >
              <text>{{ item.name }}</text>
            </view>
            <view v-if="!flatRegions.length" class="option-empty">
              {{ loadingOptions ? '加载中...' : '暂无区域' }}
            </view>
          </view>

          <view v-if="activeCategory === 'bedrooms'" class="option-list">
            <view
              v-for="item in BEDROOM_OPTIONS"
              :key="item.label"
              class="opt-chip"
              :class="{ active: temp.bedrooms === item.value }"
              @tap="setValue('bedrooms', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <view v-if="activeCategory === 'price'" class="option-block">
            <view class="option-list">
              <view
                v-for="item in PRICE_SEGMENTS"
                :key="item.label"
                class="opt-chip"
                :class="{ active: isPriceActive(item) }"
                @tap="selectPrice(item)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
            <view class="custom-range">
              <input v-model="customMinPrice" class="range-input" type="number" placeholder="最低" @blur="applyCustomPrice">
              <text class="range-sep">-</text>
              <input v-model="customMaxPrice" class="range-input" type="number" placeholder="最高" @blur="applyCustomPrice">
              <text class="range-unit">元/月</text>
            </view>
          </view>

          <view v-if="activeCategory === 'orientation'" class="option-list">
            <view class="opt-chip" :class="{ active: !temp.orientation }" @tap="temp.orientation = undefined">
              <text>不限</text>
            </view>
            <view
              v-for="item in ORIENTATION_OPTIONS"
              :key="item.value"
              class="opt-chip"
              :class="{ active: temp.orientation === item.value }"
              @tap="setValue('orientation', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <view v-if="activeCategory === 'decoration'" class="option-list">
            <view class="opt-chip" :class="{ active: !temp.decoration }" @tap="temp.decoration = undefined">
              <text>不限</text>
            </view>
            <view
              v-for="item in DECORATION_OPTIONS"
              :key="item.value"
              class="opt-chip"
              :class="{ active: temp.decoration === item.value }"
              @tap="setValue('decoration', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <view v-if="activeCategory === 'rentalType'" class="option-list">
            <view class="opt-chip" :class="{ active: !temp.rentalType }" @tap="temp.rentalType = undefined">
              <text>不限</text>
            </view>
            <view
              v-for="item in RENTAL_TYPE_OPTIONS"
              :key="item.value"
              class="opt-chip"
              :class="{ active: temp.rentalType === item.value }"
              @tap="setValue('rentalType', item.value)"
            >
              <text>{{ item.label }}</text>
            </view>
          </view>

          <view v-if="activeCategory === 'more'" class="more-section">
            <text class="sub-title">面积</text>
            <view class="option-list">
              <view
                v-for="item in AREA_SEGMENTS"
                :key="item.label"
                class="opt-chip"
                :class="{ active: isAreaActive(item) }"
                @tap="selectArea(item)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>

            <text class="sub-title">楼盘</text>
            <view class="community-search">
              <wd-icon name="search" size="16px" color="#8b978f" />
              <input v-model="communityKeyword" placeholder="搜索楼盘" confirm-type="search">
            </view>
            <view class="option-list option-list--dense">
              <view class="opt-chip" :class="{ active: !temp.communityId }" @tap="setCommunity(undefined)">
                <text>不限楼盘</text>
              </view>
              <view
                v-for="item in filteredCommunities"
                :key="String(item.id)"
                class="opt-chip"
                :class="{ active: sameId(temp.communityId, item.id) }"
                @tap="setCommunity(item.id, item.name)"
              >
                <text>{{ item.name }}</text>
              </view>
            </view>

            <text class="sub-title">押付方式</text>
            <view class="option-list">
              <view class="opt-chip" :class="{ active: !temp.depositRule }" @tap="temp.depositRule = undefined">
                <text>不限</text>
              </view>
              <view
                v-for="item in DEPOSIT_RULE_OPTIONS"
                :key="item.value"
                class="opt-chip"
                :class="{ active: temp.depositRule === item.value }"
                @tap="setValue('depositRule', item.value)"
              >
                <text>{{ item.label }}</text>
              </view>
            </view>
          </view>
        </scroll-view>
      </view>

      <view class="panel-footer">
        <wd-button size="large" type="info" plain block @click="onReset">
          重置
        </wd-button>
        <wd-button block size="large" type="primary" @click="onConfirm">
          确定{{ activeCount > 0 ? `(${activeCount})` : '' }}
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.filter-panel {
  display: flex;
  height: 78vh;
  flex-direction: column;
  background: radial-gradient(circle at 92% 0, rgb(228 161 27 / 18%), transparent 220rpx), #f7faf4;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 28rpx 22rpx;
  border-bottom: 1rpx solid rgb(18 107 79 / 8%);
}

.panel-head__title,
.panel-head__desc {
  display: block;
}

.panel-head__title {
  font-size: 34rpx;
  font-weight: 850;
}

.panel-head__desc {
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.panel-head__close {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #eef4ed;
}

.panel-body {
  display: flex;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.left-col {
  width: 178rpx;
  height: 100%;
  min-height: 0;
  flex: 0 0 178rpx;
  background: #edf4ea;
}

.cat-item {
  position: relative;
  padding: 28rpx 12rpx;
  color: #63746c;
  font-size: 26rpx;
  text-align: center;
}

.cat-item.active {
  background: #fff;
  color: var(--sl-brand);
  font-weight: 800;
}

.cat-item.active::before {
  position: absolute;
  top: 24rpx;
  bottom: 24rpx;
  left: 0;
  width: 7rpx;
  border-radius: 0 8rpx 8rpx 0;
  background: var(--sl-brand);
  content: '';
}

.cat-dot {
  position: absolute;
  top: 22rpx;
  right: 18rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 999rpx;
  background: var(--sl-brand-2);
}

.right-col {
  height: 100%;
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 24rpx;
  background: #fff;
}

.option-block,
.more-section {
  min-height: 100%;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.option-list--dense {
  max-height: 360rpx;
  overflow: hidden;
}

.opt-chip {
  max-width: 100%;
  box-sizing: border-box;
  padding: 15rpx 22rpx;
  border: 1rpx solid transparent;
  border-radius: 999rpx;
  background: #f1f6ef;
  color: #35463e;
  font-size: 25rpx;
  line-height: 1;
}

.opt-chip.active {
  border-color: rgb(18 107 79 / 22%);
  background: linear-gradient(135deg, #126b4f, #1f805f);
  box-shadow: 0 10rpx 24rpx rgb(18 107 79 / 16%);
  color: #fff;
  font-weight: 800;
}

.option-empty {
  width: 100%;
  padding: 40rpx 0;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}

.custom-range,
.community-search {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 24rpx;
  padding: 14rpx 18rpx;
  border-radius: 18rpx;
  background: #f4f8f2;
}

.range-input,
.community-search input {
  min-width: 0;
  flex: 1;
  color: var(--sl-ink);
  font-size: 25rpx;
}

.range-input {
  text-align: center;
}

.range-sep,
.range-unit {
  color: var(--sl-muted);
  font-size: 23rpx;
}

.more-section {
  padding-bottom: 28rpx;
}

.sub-title {
  display: block;
  margin: 28rpx 0 16rpx;
  color: var(--sl-ink);
  font-size: 27rpx;
  font-weight: 850;
}

.sub-title:first-child {
  margin-top: 0;
}

.community-search {
  margin: 0 0 18rpx;
}

.panel-footer {
  display: grid;
  grid-template-columns: 1fr 1.6fr;
  flex-shrink: 0;
  gap: 18rpx;
  padding: 18rpx 24rpx calc(24rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid rgb(18 107 79 / 8%);
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 -8rpx 24rpx rgb(18 107 79 / 8%);
}
</style>
