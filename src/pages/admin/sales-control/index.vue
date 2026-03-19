<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { getRegionTree, getRegionStats } from '@/api/region'

const appStore = useAppStore()
import { getCommunityList } from '@/api/community'
import { getBuildingStats } from '@/api/building'
import { getPropertyList, updatePropertyStatus } from '@/api/property'
import type { SlRegionTreeOutput, SlRegionStatsOutput } from '@/types/region'
import type { SlCommunitySelectOutput } from '@/types/community'
import type { SlBuildingStatsOutput } from '@/types/building'
import type { SlPropertyListOutput } from '@/types/property'

// ---- Navigation ----
const level = ref(1)
const breadcrumbs = ref<string[]>(['区域概览'])

// ---- Status map ----
const STATUS_BG: Record<number, string> = {
  0: '#e6f7e6', // vacant
  1: '#fff7e6', // reserved
  2: '#e6f0ff', // rented
}
const STATUS_COLOR: Record<number, string> = {
  0: '#52c41a',
  1: '#faad14',
  2: '#1890ff',
}
const STATUS_NAME: Record<number, string> = {
  0: '空置',
  1: '预定',
  2: '已租',
}

// ---- Level 1: Region list ----
interface RegionRow {
  id: number
  name: string
  stats: SlRegionStatsOutput | null
}
const regionList = ref<RegionRow[]>([])

function flattenLeaf(nodes: SlRegionTreeOutput[]): SlRegionTreeOutput[] {
  const result: SlRegionTreeOutput[] = []
  for (const n of nodes) {
    if (n.children?.length) result.push(...flattenLeaf(n.children))
    else result.push(n)
  }
  return result
}

async function loadRegions() {
  try {
    const tree = await getRegionTree()
    const leaves = flattenLeaf(tree)
    regionList.value = leaves.map(l => ({ id: l.id, name: l.name, stats: null }))
    // Load stats in parallel
    await Promise.all(
      regionList.value.map(async r => {
        try {
          r.stats = await getRegionStats(r.id)
        } catch {}
      }),
    )
  } catch {}
}

// ---- Level 2: Community + Building ----
interface CommunityRow {
  community: SlCommunitySelectOutput
  buildings: SlBuildingStatsOutput[]
}
const selectedRegion = ref({ id: 0 as number, name: '' })
const communityData = ref<CommunityRow[]>([])

async function drillRegion(r: RegionRow) {
  selectedRegion.value = { id: r.id, name: r.name }
  level.value = 2
  breadcrumbs.value = ['区域概览', r.name]
  try {
    const comms = await getCommunityList({ regionId: r.id })
    communityData.value = await Promise.all(
      comms.map(async c => ({
        community: c,
        buildings: await getBuildingStats(c.id).catch(() => [] as SlBuildingStatsOutput[]),
      })),
    )
  } catch {}
}

// ---- Level 3: Floor grid ----
const selectedBuilding = ref<SlBuildingStatsOutput | null>(null)
const properties = ref<SlPropertyListOutput[]>([])

const floorGrid = computed(() => {
  if (!selectedBuilding.value) return []
  const totalFloors = selectedBuilding.value.totalFloors || 1
  const floors: { floor: number; rooms: SlPropertyListOutput[] }[] = []
  for (let f = totalFloors; f >= 1; f--) {
    floors.push({
      floor: f,
      rooms: properties.value
        .filter(p => p.floor === f)
        .sort((a, b) => (a.roomNo || '').localeCompare(b.roomNo || '')),
    })
  }
  return floors
})

async function drillBuilding(b: SlBuildingStatsOutput, communityName = '') {
  selectedBuilding.value = b
  level.value = 3
  breadcrumbs.value = ['区域概览', selectedRegion.value.name, communityName ? communityName + ' · ' + b.name : b.name]
  try {
    properties.value = await getPropertyList({ buildingId: b.id })
  } catch {}
}

// ---- Navigation ----
function goBack() {
  if (level.value === 3) {
    level.value = 2
    breadcrumbs.value = ['区域概览', selectedRegion.value.name]
    selectedBuilding.value = null
    properties.value = []
  } else if (level.value === 2) {
    level.value = 1
    breadcrumbs.value = ['区域概览']
    communityData.value = []
  }
}

// ---- Status change modal ----
const showModal = ref(false)
const activeProperty = ref<SlPropertyListOutput | null>(null)

function onRoomTap(p: SlPropertyListOutput) {
  activeProperty.value = p
  showModal.value = true
}

async function changeStatus(s: number) {
  if (!activeProperty.value) return
  try {
    await updatePropertyStatus({ id: activeProperty.value.id, status: s })
    uni.showToast({ title: '状态已更新', icon: 'success' })
    showModal.value = false
    // Refresh
    if (selectedBuilding.value) drillBuilding(selectedBuilding.value, breadcrumbs.value[2]?.split(' · ')[0] || '')
  } catch {}
}

function goDetail() {
  if (!activeProperty.value) return
  showModal.value = false
  uni.navigateTo({ url: `/pages/common/property-detail/index?id=${activeProperty.value.id}` })
}

function goEdit() {
  if (!activeProperty.value) return
  showModal.value = false
  uni.navigateTo({ url: `/pages/common/property-form/index?id=${activeProperty.value.id}` })
}

function getRate(rented: number, total: number) {
  if (!total) return 0
  return Math.round((rented / total) * 100)
}

onMounted(() => {
  if (level.value === 1) loadRegions()
})
</script>

<template>
  <view class="page">
    <!-- 顶部导航 -->
    <view class="header" :style="{ paddingTop: appStore.headerPaddingStyle(8) }">
      <view class="nav-row">
        <view v-if="level > 1" class="back-btn" @tap="goBack">
          <text>&#x2190;</text>
        </view>
        <text class="header-title">销控表</text>
      </view>
      <view class="breadcrumb">
        <text
          v-for="(b, idx) in breadcrumbs"
          :key="idx"
          class="crumb"
          :class="{ last: idx === breadcrumbs.length - 1 }"
        >
          <text v-if="idx > 0"> / </text>{{ b }}
        </text>
      </view>
    </view>

    <!-- 图例 -->
    <view class="legend-bar">
      <view v-for="(name, status) in STATUS_NAME" :key="status" class="legend-item">
        <view class="legend-dot" :style="{ backgroundColor: STATUS_COLOR[Number(status)] }" />
        <text class="legend-text">{{ name }}</text>
      </view>
    </view>

    <!-- Level 1: 区域概览 -->
    <scroll-view v-if="level === 1" scroll-y class="content-scroll">
      <view v-if="regionList.length === 0" class="empty-wrap">
        <sl-empty-state text="暂无区域数据" />
      </view>
      <view v-else class="region-list">
        <view
          v-for="r in regionList"
          :key="r.id"
          class="region-card"
          @tap="drillRegion(r)"
        >
          <view class="region-top">
            <text class="region-name">{{ r.name }}</text>
            <text class="region-arrow">&#x203A;</text>
          </view>
          <template v-if="r.stats">
            <view class="stat-row">
              <view class="stat-item">
                <text class="stat-num" style="color: #52c41a">{{ r.stats.availableCount }}</text>
                <text class="stat-lbl">可租</text>
              </view>
              <view class="stat-item">
                <text class="stat-num" style="color: #1890ff">{{ r.stats.rentedCount }}</text>
                <text class="stat-lbl">已租</text>
              </view>
              <view class="stat-item">
                <text class="stat-num">{{ r.stats.propertyCount }}</text>
                <text class="stat-lbl">总计</text>
              </view>
            </view>
            <view class="progress-bar">
              <view
                class="progress-fill"
                :style="{ width: getRate(r.stats.rentedCount, r.stats.propertyCount) + '%' }"
              />
            </view>
            <text class="rate-text">
              出租率 {{ getRate(r.stats.rentedCount, r.stats.propertyCount) }}%
            </text>
          </template>
        </view>
      </view>
      <view style="height: 120rpx" />
    </scroll-view>

    <!-- Level 2: 楼盘楼栋 -->
    <scroll-view v-if="level === 2" scroll-y class="content-scroll">
      <view v-if="communityData.length === 0" class="empty-wrap">
        <sl-empty-state text="该区域暂无楼盘" />
      </view>
      <view v-else class="community-list">
        <view v-for="cd in communityData" :key="cd.community.id" class="community-section">
          <text class="community-name">{{ cd.community.name }}</text>
          <view v-if="cd.buildings.length === 0" class="no-building">
            <text>暂无楼栋</text>
          </view>
          <view v-else class="building-grid">
            <view
              v-for="b in cd.buildings"
              :key="b.id"
              class="building-card"
              @tap="drillBuilding(b, cd.community.name)"
            >
              <text class="building-name">{{ b.name }}</text>
              <view class="building-stats">
                <text class="bs-item" style="color: #52c41a">可租{{ b.availableCount }}</text>
                <text class="bs-item" style="color: #1890ff">已租{{ b.rentedCount }}</text>
              </view>
              <text class="building-total">
                {{ b.propertyCount }}套 · {{ b.totalFloors ?? '-' }}层
              </text>
            </view>
          </view>
        </view>
      </view>
      <view style="height: 120rpx" />
    </scroll-view>

    <!-- Level 3: 楼层网格 -->
    <scroll-view v-if="level === 3" scroll-y class="content-scroll">
      <view v-if="floorGrid.length === 0" class="empty-wrap">
        <sl-empty-state text="该楼栋暂无房源" />
      </view>
      <view v-else class="floor-grid">
        <view v-for="row in floorGrid" :key="row.floor" class="floor-row">
          <view class="floor-label">
            <text>{{ row.floor }}F</text>
          </view>
          <scroll-view scroll-x class="room-scroll">
            <view class="room-list">
              <view
                v-for="p in row.rooms"
                :key="p.id"
                class="room-cell"
                :style="{
                  backgroundColor: STATUS_BG[p.status] || '#f5f5f5',
                  borderColor: STATUS_COLOR[p.status] || '#ddd',
                }"
                @tap="onRoomTap(p)"
              >
                <text class="room-no">{{ p.roomNo || '-' }}</text>
                <text
                  class="room-status"
                  :style="{ color: STATUS_COLOR[p.status] }"
                >
                  {{ STATUS_NAME[p.status] }}
                </text>
                <text class="room-rent">¥{{ p.rentPrice ?? '-' }}</text>
              </view>
              <view v-if="row.rooms.length === 0" class="room-empty">
                <text>暂无房间</text>
              </view>
            </view>
          </scroll-view>
        </view>
      </view>
      <view style="height: 120rpx" />
    </scroll-view>

    <!-- 房间操作弹窗 -->
    <view v-if="showModal" class="modal-mask" @tap="showModal = false">
      <view class="modal-panel" @tap.stop>
        <view class="modal-header">
          <text class="modal-title">
            {{ activeProperty?.roomNo || '房间' }} -
            {{ STATUS_NAME[activeProperty?.status ?? 0] }}
          </text>
          <text class="modal-close" @tap="showModal = false">&#x2715;</text>
        </view>
        <view class="modal-info">
          <text>{{ activeProperty?.title }}</text>
          <text class="modal-rent">¥{{ activeProperty?.rentPrice ?? '-' }}/月</text>
        </view>
        <view class="modal-section">
          <text class="modal-label">更改状态</text>
          <view class="status-btns">
            <view
              v-for="(name, s) in STATUS_NAME"
              :key="s"
              class="status-btn"
              :class="{ active: Number(s) === activeProperty?.status }"
              :style="{
                backgroundColor: Number(s) === activeProperty?.status ? STATUS_COLOR[Number(s)] : STATUS_BG[Number(s)],
                color: Number(s) === activeProperty?.status ? '#fff' : STATUS_COLOR[Number(s)],
              }"
              @tap="changeStatus(Number(s))"
            >
              {{ name }}
            </view>
          </view>
        </view>
        <view class="modal-actions">
          <view class="modal-btn" @tap="goDetail">查看详情</view>
          <view class="modal-btn primary" @tap="goEdit">编辑房源</view>
        </view>
      </view>
    </view>

    <sl-custom-tabbar :current="3" />
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
  padding: $sl-spacing-sm $sl-spacing-lg;
  // padding-top 由 :style 动态设置
  background-color: $sl-primary;
  flex-shrink: 0;
}

.nav-row {
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  margin-bottom: $sl-spacing-xs;
}

.back-btn {
  font-size: $sl-font-xl;
  color: #ffffff;
  padding-right: $sl-spacing-sm;
}

.header-title {
  font-size: $sl-font-xl;
  font-weight: 700;
  color: #ffffff;
}

.breadcrumb {
  font-size: $sl-font-xs;
  color: rgba(255, 255, 255, 0.8);
}

.crumb.last {
  color: #ffffff;
  font-weight: 600;
}

.legend-bar {
  display: flex;
  justify-content: center;
  gap: $sl-spacing-lg;
  padding: $sl-spacing-xs $sl-spacing-md;
  background-color: $sl-bg-card;
  border-bottom: 1rpx solid $sl-border-color;
  flex-shrink: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.legend-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}

.legend-text {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

.content-scroll {
  flex: 1;
  height: 0;
}

.empty-wrap {
  padding: $sl-spacing-xl;
}

// ---- Level 1 ----
.region-list {
  padding: $sl-spacing-sm;
  display: flex;
  flex-direction: column;
  gap: $sl-spacing-sm;
}

.region-card {
  padding: $sl-spacing-md;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
}

.region-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $sl-spacing-sm;
}

.region-name {
  font-size: $sl-font-lg;
  font-weight: 600;
  color: $sl-text-primary;
}

.region-arrow {
  font-size: $sl-font-xl;
  color: $sl-text-placeholder;
}

.stat-row {
  display: flex;
  gap: $sl-spacing-md;
  margin-bottom: $sl-spacing-sm;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}

.stat-num {
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-primary;
}

.stat-lbl {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

.progress-bar {
  height: 10rpx;
  background-color: $sl-bg-page;
  border-radius: 5rpx;
  overflow: hidden;
  margin-bottom: $sl-spacing-xs;
}

.progress-fill {
  height: 100%;
  background-color: $sl-primary;
  border-radius: 5rpx;
}

.rate-text {
  font-size: $sl-font-xs;
  color: $sl-primary;
}

// ---- Level 2 ----
.community-list {
  padding: $sl-spacing-sm;
}

.community-section {
  margin-bottom: $sl-spacing-md;
}

.community-name {
  display: block;
  font-size: $sl-font-lg;
  font-weight: 600;
  color: $sl-text-primary;
  margin-bottom: $sl-spacing-sm;
  padding-left: $sl-spacing-xs;
}

.no-building {
  padding: $sl-spacing-md;
  text-align: center;
  font-size: $sl-font-sm;
  color: $sl-text-placeholder;
}

.building-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-sm;
}

.building-card {
  width: calc(50% - #{$sl-spacing-sm} / 2);
  padding: $sl-spacing-md;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.building-name {
  font-size: $sl-font-md;
  font-weight: 600;
  color: $sl-text-primary;
}

.building-stats {
  display: flex;
  gap: $sl-spacing-sm;
}

.bs-item {
  font-size: $sl-font-xs;
}

.building-total {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

// ---- Level 3 ----
.floor-grid {
  padding: $sl-spacing-sm;
}

.floor-row {
  display: flex;
  align-items: stretch;
  margin-bottom: $sl-spacing-xs;
}

.floor-label {
  width: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
  font-weight: 600;
  flex-shrink: 0;
}

.room-scroll {
  flex: 1;
  white-space: nowrap;
}

.room-list {
  display: flex;
  gap: $sl-spacing-xs;
  padding: 2rpx 0;
}

.room-cell {
  width: 140rpx;
  min-height: 120rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  border-radius: 8rpx;
  border: 2rpx solid;
  flex-shrink: 0;
}

.room-no {
  font-size: $sl-font-sm;
  font-weight: 600;
  color: $sl-text-primary;
}

.room-status {
  font-size: 20rpx;
}

.room-rent {
  font-size: 20rpx;
  color: $sl-text-secondary;
}

.room-empty {
  display: flex;
  align-items: center;
  padding: $sl-spacing-sm;
  font-size: $sl-font-xs;
  color: $sl-text-placeholder;
}

// ---- Modal ----
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}

.modal-panel {
  width: 100%;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius $sl-border-radius 0 0;
  padding: $sl-spacing-lg;
  padding-bottom: calc(#{$sl-spacing-lg} + #{$sl-safe-bottom});
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $sl-spacing-md;
}

.modal-title {
  font-size: $sl-font-lg;
  font-weight: 600;
  color: $sl-text-primary;
}

.modal-close {
  font-size: $sl-font-lg;
  color: $sl-text-placeholder;
  padding: $sl-spacing-xs;
}

.modal-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $sl-spacing-md;
  font-size: $sl-font-md;
  color: $sl-text-secondary;
}

.modal-rent {
  font-weight: 700;
  color: $sl-text-price;
}

.modal-section {
  margin-bottom: $sl-spacing-md;
}

.modal-label {
  display: block;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-bottom: $sl-spacing-sm;
}

.status-btns {
  display: flex;
  gap: $sl-spacing-sm;
}

.status-btn {
  flex: 1;
  text-align: center;
  padding: $sl-spacing-sm;
  border-radius: $sl-border-radius-sm;
  font-size: $sl-font-sm;
  font-weight: 600;
}

.modal-actions {
  display: flex;
  gap: $sl-spacing-sm;
}

.modal-btn {
  flex: 1;
  text-align: center;
  padding: $sl-spacing-sm;
  border-radius: $sl-border-radius;
  font-size: $sl-font-md;
  font-weight: 600;
  background-color: $sl-bg-page;
  color: $sl-text-primary;

  &.primary {
    background-color: $sl-primary;
    color: #ffffff;
  }
}
</style>
