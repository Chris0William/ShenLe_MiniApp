<script setup lang="ts">
import type { SlPropertyListOutput } from '@/types/shenle'
import { computed } from 'vue'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { formatMoney, getStatusMeta } from '@/utils/shenle'

const props = withDefaults(defineProps<{
  communityName?: string
  buildingName?: string
  totalFloors?: number | null
  propertyCount?: number | null
  availableCount?: number | null
  rentedCount?: number | null
  properties?: SlPropertyListOutput[]
  loading?: boolean
  showLegend?: boolean
}>(), {
  communityName: '',
  buildingName: '',
  totalFloors: null,
  propertyCount: null,
  availableCount: null,
  rentedCount: null,
  properties: () => [],
  loading: false,
  showLegend: true,
})

const emit = defineEmits<{
  select: [item: SlPropertyListOutput]
}>()

interface FloorRow {
  floor: number | null
  label: string
  rooms: SlPropertyListOutput[]
}

const resolvedPropertyCount = computed(() => props.propertyCount ?? props.properties.length)
const resolvedRentedCount = computed(() => props.rentedCount ?? props.properties.filter(item => item.status === 2).length)
const resolvedAvailableCount = computed(() => props.availableCount ?? props.properties.filter(item => item.status === 0 || item.status === 1).length)
const resolvedTotalFloors = computed(() => {
  const actualMax = Math.max(0, ...props.properties.map(item => getFloor(item) || 0))
  return Math.max(props.totalFloors || 0, actualMax)
})
const rentedRate = computed(() => resolvedPropertyCount.value
  ? Math.round((resolvedRentedCount.value / resolvedPropertyCount.value) * 100)
  : 0)

const floorGrid = computed<FloorRow[]>(() => {
  const floors = new Map<number | null, SlPropertyListOutput[]>()
  for (const item of props.properties) {
    const floor = getFloor(item)
    const key = floor || null
    floors.set(key, [...(floors.get(key) || []), item])
  }

  const rows: FloorRow[] = []
  for (let floor = resolvedTotalFloors.value; floor >= 1; floor -= 1) {
    rows.push({
      floor,
      label: `${floor}F`,
      rooms: (floors.get(floor) || []).sort(sortRooms),
    })
  }

  const unknown = floors.get(null)
  if (unknown?.length)
    rows.push({ floor: null, label: '未知楼层', rooms: unknown.sort(sortRooms) })
  return rows
})

function getFloor(item: SlPropertyListOutput) {
  if (item.floor !== null && item.floor !== undefined)
    return Number(item.floor)
  const matched = item.floorInfo?.match(/(\d+)/)
  return matched ? Number(matched[1]) : 0
}

function roomLabel(item: SlPropertyListOutput) {
  return item.roomNo || item.title || '房间'
}

function sortRooms(left: SlPropertyListOutput, right: SlPropertyListOutput) {
  return roomLabel(left).localeCompare(roomLabel(right), 'zh-CN', { numeric: true })
}

function statusTone(status: number) {
  return getStatusMeta(status).tone as any
}

function statusLabel(status: number) {
  return getStatusMeta(status).label
}
</script>

<template>
  <view class="sales-board">
    <view v-if="showLegend" class="sales-board__legend sl-card">
      <view v-for="item in PROPERTY_STATUS_OPTIONS" :key="item.value" class="legend-item">
        <view class="legend-dot" :class="`legend-dot--${item.value}`" />
        <text>{{ item.label }}</text>
      </view>
    </view>

    <view class="building-summary sl-card">
      <view class="building-summary__head">
        <text class="building-summary__name">{{ buildingName || '楼栋' }}</text>
        <text class="building-summary__desc">{{ communityName || '所属楼盘' }} · {{ resolvedTotalFloors || '-' }} 层</text>
      </view>
      <view class="building-summary__stats">
        <view><text>{{ resolvedPropertyCount }}</text><text>房源</text></view>
        <view><text>{{ resolvedRentedCount }}</text><text>已租</text></view>
        <view><text>{{ resolvedAvailableCount }}</text><text>空置</text></view>
        <view><text>{{ rentedRate }}%</text><text>出租率</text></view>
      </view>
    </view>

    <view v-if="loading" class="board-state sl-card">
      房间加载中...
    </view>
    <view v-else-if="!properties.length" class="board-state board-state--empty sl-card">
      <wd-icon name="home" size="36px" color="#8ea099" />
      <text>暂无房源数据</text>
    </view>
    <view v-else class="floor-list">
      <view v-for="row in floorGrid" :key="row.label" class="floor-row">
        <view class="floor-label">
          {{ row.label }}
        </view>
        <scroll-view scroll-x class="room-scroll">
          <view class="room-list">
            <view v-if="!row.rooms.length" class="room-empty">
              暂无房间
            </view>
            <view
              v-for="room in row.rooms"
              :key="String(room.id)"
              class="room-cell"
              :class="`room-cell--${room.status}`"
              @tap="emit('select', room)"
            >
              <text class="room-cell__no">{{ roomLabel(room) }}</text>
              <wd-tag :type="statusTone(room.status)" custom-class="room-cell__tag">
                {{ room.statusName || statusLabel(room.status) }}
              </wd-tag>
              <text class="room-cell__price">¥{{ formatMoney(room.rentPrice) }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.sales-board {
  width: 100%;
}

.sales-board__legend {
  display: flex;
  justify-content: space-around;
  margin-bottom: 18rpx;
  padding: 18rpx 12rpx;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.legend-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 999rpx;
}

.legend-dot--0 {
  background: #2fb06f;
}

.legend-dot--1 {
  background: #e4a11b;
}

.legend-dot--2 {
  background: #7d8b85;
}

.legend-dot--3 {
  background: #c94832;
}

.building-summary {
  margin-bottom: 18rpx;
  padding: 24rpx;
}

.building-summary__name,
.building-summary__desc {
  display: block;
}

.building-summary__name {
  overflow: hidden;
  font-size: 31rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.building-summary__desc {
  margin-top: 7rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.building-summary__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 22rpx;
}

.building-summary__stats view {
  padding: 14rpx 2rpx;
  border-radius: 8rpx;
  background: #f3f7f1;
  text-align: center;
}

.building-summary__stats text:first-child {
  display: block;
  color: var(--sl-brand);
  font-size: 28rpx;
  font-weight: 900;
}

.building-summary__stats text:last-child {
  display: block;
  margin-top: 4rpx;
  color: var(--sl-muted);
  font-size: 20rpx;
}

.floor-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.floor-row {
  display: flex;
  align-items: stretch;
  gap: 14rpx;
}

.floor-label {
  display: flex;
  width: 74rpx;
  flex: 0 0 74rpx;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #eaf2e8;
  color: var(--sl-brand);
  font-size: 24rpx;
  font-weight: 900;
}

.room-scroll {
  min-width: 0;
  flex: 1;
  white-space: nowrap;
}

.room-list {
  display: inline-flex;
  min-height: 144rpx;
  gap: 12rpx;
}

.room-cell,
.room-empty {
  display: inline-flex;
  width: 176rpx;
  min-height: 144rpx;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 12rpx;
  border: 2rpx solid transparent;
  border-radius: 8rpx;
  background: #edf6ef;
  text-align: center;
}

.room-cell--1 {
  border-color: rgb(228 161 27 / 22%);
  background: #fff6df;
}

.room-cell--2 {
  border-color: rgb(125 139 133 / 18%);
  background: #eef2f0;
}

.room-cell--3 {
  border-color: rgb(201 72 50 / 18%);
  background: #fff0ed;
}

.room-cell__no {
  max-width: 148rpx;
  overflow: hidden;
  font-size: 25rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room-cell__price {
  margin-top: 8rpx;
  color: #c26916;
  font-size: 23rpx;
  font-weight: 850;
}

.room-empty {
  color: var(--sl-muted);
  font-size: 22rpx;
}

.board-state {
  margin-top: 18rpx;
  padding: 24rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}

.board-state--empty {
  display: flex;
  min-height: 220rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
}
</style>
