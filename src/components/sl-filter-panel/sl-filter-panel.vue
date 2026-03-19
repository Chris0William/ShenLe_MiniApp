<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getRegionTree } from '@/api/region'
import { getCommunityList } from '@/api/community'
import type { SlRegionTreeOutput } from '@/types/region'
import type { SlCommunitySelectOutput } from '@/types/community'
import type { PropertyFilterState } from '@/types/property'

defineOptions({
  options: { virtualHost: true },
})

const props = defineProps<{
  visible: boolean
  filters: PropertyFilterState
}>()

const emit = defineEmits<{
  confirm: [filters: PropertyFilterState]
  reset: []
  close: []
}>()

// ---- Categories ----
const categories = [
  { key: 'region', label: '区域' },
  { key: 'bedrooms', label: '户型' },
  { key: 'price', label: '租金' },
  { key: 'orientation', label: '朝向' },
  { key: 'decoration', label: '装修' },
  { key: 'rentalType', label: '租赁' },
  { key: 'more', label: '更多' },
]
const activeCategory = ref('region')

// ---- Temp filters (only applied on confirm) ----
const temp = ref<PropertyFilterState>({})

watch(() => props.visible, (v) => {
  if (v) temp.value = { ...props.filters }
})

// ---- Dynamic data ----
const regionTree = ref<SlRegionTreeOutput[]>([])
const communityListData = ref<SlCommunitySelectOutput[]>([])

onMounted(async () => {
  try { regionTree.value = await getRegionTree() } catch {}
  try { communityListData.value = await getCommunityList({}) } catch {}
})

// ---- Flat region list (leaf nodes) ----
const flatRegions = computed(() => {
  const result: { id: number; name: string }[] = []
  function walk(nodes: SlRegionTreeOutput[]) {
    for (const n of nodes) {
      if (n.children?.length) walk(n.children)
      else result.push({ id: n.id, name: n.name })
    }
  }
  walk(regionTree.value)
  return result
})

// ---- Options ----
const bedroomOptions = [
  { label: '一室', value: 1 },
  { label: '二室', value: 2 },
  { label: '三室', value: 3 },
  { label: '四室', value: 4 },
  { label: '五室+', value: 5 },
]

const priceRanges = [
  { label: '1000以下', min: undefined, max: 1000 },
  { label: '1000-2000', min: 1000, max: 2000 },
  { label: '2000-3000', min: 2000, max: 3000 },
  { label: '3000-5000', min: 3000, max: 5000 },
  { label: '5000-8000', min: 5000, max: 8000 },
  { label: '8000以上', min: 8000, max: undefined },
]
const customMinPrice = ref('')
const customMaxPrice = ref('')

const orientationOptions = [
  { label: '东', value: 'east' },
  { label: '南', value: 'south' },
  { label: '西', value: 'west' },
  { label: '北', value: 'north' },
  { label: '南北', value: 'north-south' },
  { label: '东南', value: 'southeast' },
  { label: '东北', value: 'northeast' },
  { label: '西南', value: 'southwest' },
  { label: '西北', value: 'northwest' },
]

const decorationOptions = [
  { label: '毛坯', value: 'rough' },
  { label: '简装', value: 'simple' },
  { label: '精装', value: 'fine' },
  { label: '豪装', value: 'luxury' },
]

const rentalTypeOptions = [
  { label: '整租', value: 'whole' },
  { label: '合租', value: 'shared' },
  { label: '转租', value: 'sublease' },
]

// ---- "More" sub-categories ----
const areaRanges = [
  { label: '30㎡以下', min: undefined, max: 30 },
  { label: '30-50㎡', min: 30, max: 50 },
  { label: '50-80㎡', min: 50, max: 80 },
  { label: '80-100㎡', min: 80, max: 100 },
  { label: '100-150㎡', min: 100, max: 150 },
  { label: '150㎡以上', min: 150, max: undefined },
]

const depositRuleOptions = [
  { label: '一付一', value: '1-1' },
  { label: '一付三', value: '1-3' },
  { label: '二付一', value: '2-1' },
  { label: '二付三', value: '2-3' },
  { label: '半年付', value: 'half-year' },
  { label: '年付', value: 'yearly' },
]

// ---- Helpers ----
function isPriceActive(r: typeof priceRanges[0]) {
  return temp.value.minPrice === r.min && temp.value.maxPrice === r.max
}

function selectPrice(r: typeof priceRanges[0]) {
  if (isPriceActive(r)) {
    temp.value.minPrice = undefined
    temp.value.maxPrice = undefined
  } else {
    temp.value.minPrice = r.min
    temp.value.maxPrice = r.max
    customMinPrice.value = ''
    customMaxPrice.value = ''
  }
}

function applyCustomPrice() {
  const min = customMinPrice.value ? Number(customMinPrice.value) : undefined
  const max = customMaxPrice.value ? Number(customMaxPrice.value) : undefined
  temp.value.minPrice = min
  temp.value.maxPrice = max
}

function isAreaActive(r: typeof areaRanges[0]) {
  return temp.value.minArea === r.min && temp.value.maxArea === r.max
}

function selectArea(r: typeof areaRanges[0]) {
  if (isAreaActive(r)) {
    temp.value.minArea = undefined
    temp.value.maxArea = undefined
  } else {
    temp.value.minArea = r.min
    temp.value.maxArea = r.max
  }
}

function toggle<K extends keyof PropertyFilterState>(key: K, value: PropertyFilterState[K]) {
  temp.value[key] = temp.value[key] === value ? undefined : value
}

// ---- Active count ----
const activeCount = computed(() => {
  let count = 0
  const f = temp.value
  if (f.regionId) count++
  if (f.bedrooms) count++
  if (f.minPrice !== undefined || f.maxPrice !== undefined) count++
  if (f.orientation) count++
  if (f.decoration) count++
  if (f.rentalType) count++
  if (f.minArea !== undefined || f.maxArea !== undefined) count++
  if (f.communityId) count++
  if (f.depositRule) count++
  return count
})

// ---- Category has selection indicator ----
function categoryHasValue(key: string): boolean {
  const f = temp.value
  switch (key) {
    case 'region': return !!f.regionId
    case 'bedrooms': return !!f.bedrooms
    case 'price': return f.minPrice !== undefined || f.maxPrice !== undefined
    case 'orientation': return !!f.orientation
    case 'decoration': return !!f.decoration
    case 'rentalType': return !!f.rentalType
    case 'more': return !!(f.minArea !== undefined || f.maxArea !== undefined || f.communityId || f.depositRule)
    default: return false
  }
}

// ---- Actions ----
function onReset() {
  temp.value = {}
  customMinPrice.value = ''
  customMaxPrice.value = ''
  emit('reset')
}

function onConfirm() {
  emit('confirm', { ...temp.value })
}
</script>

<template>
  <view v-if="visible" class="filter-panel">
    <view class="panel-body">
      <!-- 左栏：分类 -->
      <scroll-view scroll-y class="left-col">
        <view
          v-for="cat in categories"
          :key="cat.key"
          class="cat-item"
          :class="{ active: activeCategory === cat.key, selected: categoryHasValue(cat.key) }"
          @tap="activeCategory = cat.key"
        >
          <text>{{ cat.label }}</text>
          <view v-if="categoryHasValue(cat.key)" class="cat-dot" />
        </view>
      </scroll-view>

      <!-- 右栏：选项 -->
      <scroll-view scroll-y class="right-col">
        <!-- 区域 -->
        <view v-if="activeCategory === 'region'" class="option-list">
          <view
            class="opt-chip"
            :class="{ active: !temp.regionId }"
            @tap="temp.regionId = undefined"
          >
            <text>全部</text>
          </view>
          <view
            v-for="r in flatRegions"
            :key="r.id"
            class="opt-chip"
            :class="{ active: temp.regionId === r.id }"
            @tap="toggle('regionId', r.id)"
          >
            <text>{{ r.name }}</text>
          </view>
        </view>

        <!-- 户型 -->
        <view v-if="activeCategory === 'bedrooms'" class="option-list">
          <view
            class="opt-chip"
            :class="{ active: !temp.bedrooms }"
            @tap="temp.bedrooms = undefined"
          >
            <text>不限</text>
          </view>
          <view
            v-for="b in bedroomOptions"
            :key="b.value"
            class="opt-chip"
            :class="{ active: temp.bedrooms === b.value }"
            @tap="toggle('bedrooms', b.value)"
          >
            <text>{{ b.label }}</text>
          </view>
        </view>

        <!-- 租金 -->
        <view v-if="activeCategory === 'price'" class="option-list">
          <view
            class="opt-chip"
            :class="{ active: temp.minPrice === undefined && temp.maxPrice === undefined }"
            @tap="temp.minPrice = undefined; temp.maxPrice = undefined; customMinPrice = ''; customMaxPrice = ''"
          >
            <text>不限</text>
          </view>
          <view
            v-for="(r, idx) in priceRanges"
            :key="idx"
            class="opt-chip"
            :class="{ active: isPriceActive(r) }"
            @tap="selectPrice(r)"
          >
            <text>{{ r.label }}</text>
          </view>
          <!-- 自定义区间 -->
          <view class="custom-range">
            <input
              v-model="customMinPrice"
              class="range-input"
              type="number"
              placeholder="最低"
              @blur="applyCustomPrice"
            />
            <text class="range-sep">—</text>
            <input
              v-model="customMaxPrice"
              class="range-input"
              type="number"
              placeholder="最高"
              @blur="applyCustomPrice"
            />
            <text class="range-unit">元/月</text>
          </view>
        </view>

        <!-- 朝向 -->
        <view v-if="activeCategory === 'orientation'" class="option-list">
          <view
            class="opt-chip"
            :class="{ active: !temp.orientation }"
            @tap="temp.orientation = undefined"
          >
            <text>不限</text>
          </view>
          <view
            v-for="o in orientationOptions"
            :key="o.value"
            class="opt-chip"
            :class="{ active: temp.orientation === o.value }"
            @tap="toggle('orientation', o.value)"
          >
            <text>{{ o.label }}</text>
          </view>
        </view>

        <!-- 装修 -->
        <view v-if="activeCategory === 'decoration'" class="option-list">
          <view
            class="opt-chip"
            :class="{ active: !temp.decoration }"
            @tap="temp.decoration = undefined"
          >
            <text>不限</text>
          </view>
          <view
            v-for="d in decorationOptions"
            :key="d.value"
            class="opt-chip"
            :class="{ active: temp.decoration === d.value }"
            @tap="toggle('decoration', d.value)"
          >
            <text>{{ d.label }}</text>
          </view>
        </view>

        <!-- 租赁方式 -->
        <view v-if="activeCategory === 'rentalType'" class="option-list">
          <view
            class="opt-chip"
            :class="{ active: !temp.rentalType }"
            @tap="temp.rentalType = undefined"
          >
            <text>不限</text>
          </view>
          <view
            v-for="rt in rentalTypeOptions"
            :key="rt.value"
            class="opt-chip"
            :class="{ active: temp.rentalType === rt.value }"
            @tap="toggle('rentalType', rt.value)"
          >
            <text>{{ rt.label }}</text>
          </view>
        </view>

        <!-- 更多 -->
        <view v-if="activeCategory === 'more'" class="more-section">
          <!-- 面积 -->
          <text class="sub-title">面积</text>
          <view class="option-list">
            <view
              class="opt-chip"
              :class="{ active: temp.minArea === undefined && temp.maxArea === undefined }"
              @tap="temp.minArea = undefined; temp.maxArea = undefined"
            >
              <text>不限</text>
            </view>
            <view
              v-for="(a, idx) in areaRanges"
              :key="idx"
              class="opt-chip"
              :class="{ active: isAreaActive(a) }"
              @tap="selectArea(a)"
            >
              <text>{{ a.label }}</text>
            </view>
          </view>

          <!-- 楼盘 -->
          <text class="sub-title">楼盘</text>
          <view class="option-list">
            <view
              class="opt-chip"
              :class="{ active: !temp.communityId }"
              @tap="temp.communityId = undefined"
            >
              <text>不限</text>
            </view>
            <view
              v-for="c in communityListData"
              :key="c.id"
              class="opt-chip"
              :class="{ active: temp.communityId === c.id }"
              @tap="toggle('communityId', c.id)"
            >
              <text>{{ c.name }}</text>
            </view>
          </view>

          <!-- 押付 -->
          <text class="sub-title">押付方式</text>
          <view class="option-list">
            <view
              class="opt-chip"
              :class="{ active: !temp.depositRule }"
              @tap="temp.depositRule = undefined"
            >
              <text>不限</text>
            </view>
            <view
              v-for="dr in depositRuleOptions"
              :key="dr.value"
              class="opt-chip"
              :class="{ active: temp.depositRule === dr.value }"
              @tap="toggle('depositRule', dr.value)"
            >
              <text>{{ dr.label }}</text>
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <!-- 底部按钮 -->
    <view class="panel-footer">
      <view class="btn-reset" @tap="onReset">
        <text>重置</text>
      </view>
      <view class="btn-confirm" @tap="onConfirm">
        <text>确定{{ activeCount > 0 ? `(${activeCount})` : '' }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.filter-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 0;
  background-color: $sl-bg-page;
}

.panel-body {
  display: flex;
  flex: 1;
  height: 0;
}

// ---- Left column ----
.left-col {
  width: 180rpx;
  flex-shrink: 0;
  background-color: $sl-bg-page;
}

.cat-item {
  position: relative;
  padding: $sl-spacing-md $sl-spacing-sm;
  font-size: $sl-font-md;
  color: $sl-text-secondary;
  text-align: center;

  &.active {
    background-color: $sl-bg-card;
    color: $sl-primary;
    font-weight: 600;
  }

  &.selected .cat-dot {
    display: block;
  }
}

.cat-dot {
  display: none;
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  width: 12rpx;
  height: 12rpx;
  border-radius: 50%;
  background-color: $sl-primary;
}

// ---- Right column ----
.right-col {
  flex: 1;
  background-color: $sl-bg-card;
  padding: $sl-spacing-md;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-sm;
  margin-bottom: $sl-spacing-sm;
}

.opt-chip {
  padding: 12rpx $sl-spacing-md;
  background-color: $sl-bg-page;
  border-radius: 40rpx;
  font-size: $sl-font-sm;
  color: $sl-text-primary;

  &.active {
    background-color: $sl-primary-dark;
    color: #ffffff;
    font-weight: 600;
  }
}

// ---- Custom range ----
.custom-range {
  display: flex;
  align-items: center;
  gap: $sl-spacing-xs;
  margin-top: $sl-spacing-sm;
}

.range-input {
  flex: 1;
  height: 56rpx;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius-sm;
  text-align: center;
  font-size: $sl-font-sm;
  color: $sl-text-primary;
}

.range-sep {
  font-size: $sl-font-sm;
  color: $sl-text-placeholder;
}

.range-unit {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
  flex-shrink: 0;
}

// ---- More sub-sections ----
.more-section {
  display: flex;
  flex-direction: column;
  gap: $sl-spacing-xs;
}

.sub-title {
  font-size: $sl-font-sm;
  font-weight: 600;
  color: $sl-text-primary;
  margin-top: $sl-spacing-sm;
  margin-bottom: $sl-spacing-xs;
}

// ---- Footer ----
.panel-footer {
  display: flex;
  gap: $sl-spacing-md;
  padding: $sl-spacing-md;
  background-color: $sl-bg-card;
  border-top: 1rpx solid $sl-border-color;
  flex-shrink: 0;
  padding-bottom: calc(#{$sl-spacing-md} + env(safe-area-inset-bottom));
}

.btn-reset {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius;
  font-size: $sl-font-md;
  color: $sl-text-secondary;
}

.btn-confirm {
  flex: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  background-color: $sl-primary-dark;
  border-radius: $sl-border-radius;
  font-size: $sl-font-md;
  color: #ffffff;
  font-weight: 600;
}
</style>
