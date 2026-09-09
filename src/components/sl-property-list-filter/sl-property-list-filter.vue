<script setup lang="ts">
import type { PropertyListFilterState } from '@/types/shenle'
import { computed, reactive, ref, watch } from 'vue'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'

const props = withDefaults(defineProps<{
  modelValue: PropertyListFilterState
  showStatus?: boolean
}>(), {
  showStatus: true,
})

const emit = defineEmits<{
  'update:modelValue': [value: PropertyListFilterState]
  'apply': [value: PropertyListFilterState]
}>()

const activeFilter = ref<'floor' | 'room' | 'layout' | null>(null)
const keywordDraft = ref('')
const floorDraft = reactive({ min: '', max: '' })
const roomDraft = ref('')
const layoutDraft = reactive<{ bedrooms?: number, livingRooms?: number, bathrooms?: number }>({})
const layoutNumbers = [undefined, 0, 1, 2, 3, 4, 5] as const
const layoutFields = [
  { key: 'bedrooms', label: '室' },
  { key: 'livingRooms', label: '厅' },
  { key: 'bathrooms', label: '卫' },
] as const

watch(() => props.modelValue, syncDraft, { deep: true, immediate: true })

const floorLabel = computed(() => {
  if (props.modelValue.minFloor == null && props.modelValue.maxFloor == null)
    return '楼层'
  return `${props.modelValue.minFloor ?? '不限'}-${props.modelValue.maxFloor ?? '不限'}层`
})
const roomLabel = computed(() => props.modelValue.roomNoSuffix ? `房号 · ${props.modelValue.roomNoSuffix}` : '房号')
const layoutLabel = computed(() => {
  const { bedrooms, livingRooms, bathrooms } = props.modelValue
  if (bedrooms == null && livingRooms == null && bathrooms == null)
    return '户型'
  return `${bedrooms ?? '-'},${livingRooms ?? '-'},${bathrooms ?? '-'}`
})
const hasActive = computed(() => !!props.modelValue.keyword.trim()
  || props.modelValue.status != null
  || props.modelValue.minFloor != null
  || props.modelValue.maxFloor != null
  || !!props.modelValue.roomNoSuffix
  || props.modelValue.bedrooms != null
  || props.modelValue.livingRooms != null
  || props.modelValue.bathrooms != null)

function syncDraft() {
  keywordDraft.value = props.modelValue.keyword || ''
  floorDraft.min = props.modelValue.minFloor == null ? '' : String(props.modelValue.minFloor)
  floorDraft.max = props.modelValue.maxFloor == null ? '' : String(props.modelValue.maxFloor)
  roomDraft.value = props.modelValue.roomNoSuffix || ''
  layoutDraft.bedrooms = props.modelValue.bedrooms
  layoutDraft.livingRooms = props.modelValue.livingRooms
  layoutDraft.bathrooms = props.modelValue.bathrooms
}

function commit(patch: Partial<PropertyListFilterState>) {
  const next = { ...props.modelValue, ...patch }
  emit('update:modelValue', next)
  emit('apply', next)
}

function toggleFilter(name: 'floor' | 'room' | 'layout') {
  activeFilter.value = activeFilter.value === name ? null : name
  syncDraft()
}

function optionalFloor(value: string) {
  if (!value.trim())
    return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw new Error('楼层必须是大于0的整数')
  return parsed
}

function applyKeyword() {
  activeFilter.value = null
  commit({ keyword: keywordDraft.value.trim() })
}

function applyFloor() {
  try {
    const minFloor = optionalFloor(floorDraft.min)
    const maxFloor = optionalFloor(floorDraft.max)
    if (minFloor != null && maxFloor != null && minFloor > maxFloor)
      throw new Error('起始楼层不能大于结束楼层')
    activeFilter.value = null
    commit({ minFloor, maxFloor })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '楼层格式不正确', icon: 'none' })
  }
}

function applyRoom() {
  activeFilter.value = null
  commit({ roomNoSuffix: roomDraft.value.trim() })
}

function applyLayout() {
  activeFilter.value = null
  commit({
    bedrooms: layoutDraft.bedrooms,
    livingRooms: layoutDraft.livingRooms,
    bathrooms: layoutDraft.bathrooms,
  })
}

function selectStatus(status?: number) {
  commit({ status })
}

function reset() {
  activeFilter.value = null
  const next: PropertyListFilterState = {
    keyword: '',
    roomNoSuffix: '',
  }
  emit('update:modelValue', next)
  emit('apply', next)
}
</script>

<template>
  <view class="property-list-filter sl-card">
    <view class="search-row">
      <wd-icon name="search" size="19px" color="#7a8780" />
      <input v-model="keywordDraft" class="search-row__input" placeholder="搜索房源 / 房号" confirm-type="search" @confirm="applyKeyword">
      <wd-button size="small" type="primary" @click="applyKeyword">
        搜索
      </wd-button>
    </view>

    <view class="filter-tabs">
      <view class="filter-tab" :class="{ active: activeFilter === 'floor' || modelValue.minFloor != null || modelValue.maxFloor != null }" @tap="toggleFilter('floor')">
        <text>{{ floorLabel }}</text><wd-icon name="arrow-down" size="13px" />
      </view>
      <view class="filter-tab" :class="{ active: activeFilter === 'room' || !!modelValue.roomNoSuffix }" @tap="toggleFilter('room')">
        <text>{{ roomLabel }}</text><wd-icon name="arrow-down" size="13px" />
      </view>
      <view class="filter-tab" :class="{ active: activeFilter === 'layout' || modelValue.bedrooms != null || modelValue.livingRooms != null || modelValue.bathrooms != null }" @tap="toggleFilter('layout')">
        <text>{{ layoutLabel }}</text><wd-icon name="arrow-down" size="13px" />
      </view>
      <view class="filter-reset" :class="{ active: hasActive }" @tap="reset">
        重置
      </view>
    </view>

    <view v-if="activeFilter === 'floor'" class="filter-panel">
      <text class="filter-panel__title">楼层范围</text>
      <view class="range-row">
        <label><input v-model="floorDraft.min" type="number" placeholder="起始"><text>层</text></label>
        <text>至</text>
        <label><input v-model="floorDraft.max" type="number" placeholder="结束"><text>层</text></label>
      </view>
      <view class="panel-actions">
        <wd-button size="small" plain @click="floorDraft.min = ''; floorDraft.max = ''">
          清空
        </wd-button>
        <wd-button size="small" type="primary" @click="applyFloor">
          确定
        </wd-button>
      </view>
    </view>

    <view v-else-if="activeFilter === 'room'" class="filter-panel">
      <text class="filter-panel__title">按房号结尾匹配</text>
      <view class="suffix-row">
        <input v-model="roomDraft" type="text" placeholder="例如 02 或 5003" confirm-type="search" @confirm="applyRoom">
      </view>
      <view class="panel-actions">
        <wd-button size="small" plain @click="roomDraft = ''">
          清空
        </wd-button>
        <wd-button size="small" type="primary" @click="applyRoom">
          确定
        </wd-button>
      </view>
    </view>

    <view v-else-if="activeFilter === 'layout'" class="filter-panel">
      <text class="filter-panel__title">户型</text>
      <view v-for="field in layoutFields" :key="field.key" class="layout-row">
        <text>{{ field.label }}</text>
        <scroll-view scroll-x class="layout-scroll">
          <view class="layout-options">
            <view
              v-for="number in layoutNumbers"
              :key="`${field.key}-${String(number)}`"
              class="layout-option"
              :class="{ active: layoutDraft[field.key] === number }"
              @tap="layoutDraft[field.key] = number"
            >
              {{ number == null ? '不限' : number }}
            </view>
          </view>
        </scroll-view>
      </view>
      <view class="panel-actions">
        <wd-button size="small" plain @click="layoutDraft.bedrooms = undefined; layoutDraft.livingRooms = undefined; layoutDraft.bathrooms = undefined">
          清空
        </wd-button>
        <wd-button size="small" type="primary" @click="applyLayout">
          确定
        </wd-button>
      </view>
    </view>

    <scroll-view v-if="showStatus" scroll-x class="status-scroll">
      <view class="status-list">
        <view class="status-chip" :class="{ active: modelValue.status === undefined }" @tap="selectStatus()">
          全部
        </view>
        <view v-for="item in PROPERTY_STATUS_OPTIONS" :key="item.value" class="status-chip" :class="{ active: modelValue.status === item.value }" @tap="selectStatus(item.value)">
          {{ item.label }}
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.property-list-filter {
  overflow: hidden;
  padding: 18rpx;
}

.search-row,
.filter-tabs,
.range-row,
.panel-actions,
.layout-row,
.layout-options,
.status-list {
  display: flex;
  align-items: center;
}

.search-row {
  gap: 14rpx;
}

.search-row__input {
  min-width: 0;
  height: 64rpx;
  flex: 1;
  color: var(--sl-ink);
  font-size: 26rpx;
}

.filter-tabs {
  gap: 8rpx;
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid var(--sl-line);
}

.filter-tab,
.filter-reset {
  display: flex;
  min-width: 0;
  height: 58rpx;
  flex: 1;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  border-radius: 8rpx;
  background: #f4f7f3;
  color: #53635c;
  font-size: 23rpx;
  font-weight: 750;
}

.filter-tab text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-tab.active,
.filter-reset.active {
  background: #e8f3ec;
  color: #126b4f;
}

.filter-reset {
  flex: 0 0 78rpx;
}

.filter-panel {
  margin-top: 14rpx;
  padding: 18rpx;
  border-radius: 8rpx;
  background: #f7faf7;
}

.filter-panel__title {
  display: block;
  margin-bottom: 16rpx;
  color: #35473e;
  font-size: 24rpx;
  font-weight: 800;
}

.range-row {
  gap: 12rpx;
}

.range-row label,
.suffix-row {
  display: flex;
  min-width: 0;
  height: 64rpx;
  flex: 1;
  align-items: center;
  padding: 0 16rpx;
  border: 1rpx solid #dfe8e1;
  border-radius: 8rpx;
  background: #fff;
  color: #718078;
  font-size: 23rpx;
}

.range-row input,
.suffix-row input {
  min-width: 0;
  flex: 1;
  color: var(--sl-ink);
  font-size: 25rpx;
}

.panel-actions {
  justify-content: flex-end;
  gap: 12rpx;
  margin-top: 16rpx;
}

.layout-row {
  min-height: 64rpx;
  gap: 14rpx;
}

.layout-row > text {
  width: 34rpx;
  flex: none;
  color: #53635c;
  font-size: 24rpx;
  font-weight: 800;
}

.layout-scroll {
  min-width: 0;
  flex: 1;
  white-space: nowrap;
}

.layout-options {
  display: inline-flex;
  gap: 10rpx;
}

.layout-option,
.status-chip {
  min-width: 58rpx;
  box-sizing: border-box;
  padding: 12rpx 16rpx;
  border-radius: 8rpx;
  background: #edf2ee;
  color: #596860;
  font-size: 22rpx;
  text-align: center;
}

.layout-option.active,
.status-chip.active {
  background: #126b4f;
  color: #fff;
  font-weight: 800;
}

.status-scroll {
  margin-top: 14rpx;
  white-space: nowrap;
}

.status-list {
  display: inline-flex;
  gap: 10rpx;
}
</style>
