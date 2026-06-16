<script setup lang="ts">
import type {
  ShenLeId,
  SlBuildingStatsOutput,
  SlCommunitySelectOutput,
  SlPropertyListOutput,
  SlRegionStatsOutput,
  SlRegionTreeOutput,
} from '@/types/shenle'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getBuildingStats } from '@/api/building'
import { getCommunityList } from '@/api/community'
import { getPropertyList, updatePropertyStatus } from '@/api/property'
import { getRegionStats, getRegionTree } from '@/api/region'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { sameId } from '@/utils/property-filter'
import { useSafeTopStyle } from '@/utils/safe-area'
import { formatMoney, getStatusMeta, idToQuery } from '@/utils/shenle'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '销控台',
    enablePullDownRefresh: true,
  },
})

const safeTop = useSafeTopStyle()

interface RegionRow {
  id: ShenLeId
  name: string
  stats: SlRegionStatsOutput | null
}

interface CommunityRow {
  community: SlCommunitySelectOutput
  buildings: SlBuildingStatsOutput[]
}

interface FloorRow {
  floor: number | null
  label: string
  rooms: SlPropertyListOutput[]
}

const level = ref<1 | 2 | 3>(1)
const breadcrumbs = ref<string[]>(['销控'])
const regionList = ref<RegionRow[]>([])
const regionFilterId = ref<ShenLeId | undefined>()
const displayedRegions = computed(() => {
  if (regionFilterId.value === undefined)
    return regionList.value
  return regionList.value.filter(item => sameId(item.id, regionFilterId.value))
})
const selectedRegion = ref<RegionRow | null>(null)
const communityRows = ref<CommunityRow[]>([])
const selectedCommunityName = ref('')
const selectedBuilding = ref<SlBuildingStatsOutput | null>(null)
const properties = ref<SlPropertyListOutput[]>([])
const activeProperty = ref<SlPropertyListOutput | null>(null)
const actionVisible = ref(false)
const loading = ref(false)
const propertyLoading = ref(false)

const totalRegionStats = computed(() => displayedRegions.value.reduce((acc, item) => {
  acc.community += item.stats?.communityCount || 0
  acc.building += item.stats?.buildingCount || 0
  acc.property += item.stats?.propertyCount || 0
  acc.available += item.stats?.availableCount || 0
  acc.rented += item.stats?.rentedCount || 0
  return acc
}, { community: 0, building: 0, property: 0, available: 0, rented: 0 }))

const floorGrid = computed<FloorRow[]>(() => {
  const floors = new Map<number | null, SlPropertyListOutput[]>()
  for (const item of properties.value) {
    const floor = getFloor(item)
    const key = floor || null
    floors.set(key, [...(floors.get(key) || []), item])
  }

  const totalFloors = selectedBuilding.value?.totalFloors || Math.max(0, ...properties.value.map(item => getFloor(item) || 0))
  const rows: FloorRow[] = []
  for (let floor = totalFloors; floor >= 1; floor -= 1) {
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

function flattenRegions(nodes: SlRegionTreeOutput[]) {
  const result: SlRegionTreeOutput[] = []
  function walk(list: SlRegionTreeOutput[]) {
    for (const item of list) {
      if (item.children?.length)
        walk(item.children)
      else
        result.push(item)
    }
  }
  walk(nodes)
  return result
}

function selectRegionFilter(id?: ShenLeId) {
  regionFilterId.value = id
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const result: R[] = []
  let index = 0
  async function run() {
    while (index < items.length) {
      const current = index
      index += 1
      result[current] = await worker(items[current])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run))
  return result
}

async function loadRegions() {
  loading.value = true
  try {
    level.value = 1
    breadcrumbs.value = ['销控']
    selectedRegion.value = null
    selectedBuilding.value = null
    properties.value = []

    const tree = await getRegionTree()
    const leaves = flattenRegions(tree)
    regionList.value = leaves.map(item => ({ id: item.id, name: item.name, stats: null }))
    // 选中的筛选区域若已不存在则重置
    if (regionFilterId.value !== undefined && !regionList.value.some(r => sameId(r.id, regionFilterId.value)))
      regionFilterId.value = undefined

    await mapLimit(regionList.value, 5, async (region) => {
      try {
        region.stats = await getRegionStats(region.id)
      }
      catch {
        region.stats = null
      }
      return region
    })
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function drillRegion(region: RegionRow) {
  selectedRegion.value = region
  level.value = 2
  breadcrumbs.value = ['销控', region.name]
  communityRows.value = []
  loading.value = true
  try {
    const communities = await getCommunityList({ regionId: region.id })
    communityRows.value = await mapLimit(communities, 6, async community => ({
      community,
      buildings: await getBuildingStats(community.id).catch(() => []),
    }))
  }
  finally {
    loading.value = false
  }
}

async function drillBuilding(building: SlBuildingStatsOutput, communityName: string) {
  selectedBuilding.value = building
  selectedCommunityName.value = communityName
  level.value = 3
  breadcrumbs.value = ['销控', selectedRegion.value?.name || '', `${communityName} · ${building.name}`].filter(Boolean)
  propertyLoading.value = true
  properties.value = []
  try {
    properties.value = await getPropertyList({ buildingId: building.id })
  }
  finally {
    propertyLoading.value = false
  }
}

function goBack() {
  if (level.value === 3) {
    level.value = 2
    selectedBuilding.value = null
    activeProperty.value = null
    actionVisible.value = false
    properties.value = []
    breadcrumbs.value = ['销控', selectedRegion.value?.name || ''].filter(Boolean)
    return
  }
  if (level.value === 2) {
    level.value = 1
    selectedRegion.value = null
    communityRows.value = []
    breadcrumbs.value = ['销控']
  }
}

function refreshCurrent() {
  if (level.value === 1)
    return loadRegions()
  if (level.value === 2 && selectedRegion.value)
    return drillRegion(selectedRegion.value)
  if (level.value === 3 && selectedBuilding.value)
    return drillBuilding(selectedBuilding.value, selectedCommunityName.value)
  return Promise.resolve()
}

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

function rate(rented?: number, total?: number) {
  if (!total)
    return 0
  return Math.round(((rented || 0) / total) * 100)
}

function openProperty(item: SlPropertyListOutput) {
  activeProperty.value = item
  actionVisible.value = true
}

async function changeStatus(status: number) {
  if (!activeProperty.value)
    return
  await updatePropertyStatus({ id: activeProperty.value.id, status })
  uni.showToast({ title: '状态已更新', icon: 'success' })
  actionVisible.value = false
  await refreshCurrent()
}

function goDetail() {
  if (!activeProperty.value)
    return
  actionVisible.value = false
  uni.navigateTo({ url: `/pages/common/property-detail/index?id=${idToQuery(activeProperty.value.id)}` })
}

function goEdit() {
  if (!activeProperty.value)
    return
  actionVisible.value = false
  uni.navigateTo({ url: `/pages/common/property-form/index?id=${idToQuery(activeProperty.value.id)}` })
}

function goCommunityProperties(community: SlCommunitySelectOutput) {
  uni.navigateTo({
    url: `/pages/common/community-properties/index?communityId=${idToQuery(community.id)}&communityName=${encodeURIComponent(community.name)}`,
  })
}

onLoad(loadRegions)
onPullDownRefresh(refreshCurrent)
</script>

<template>
  <view class="sales-page" :style="safeTop">
    <view class="sales-hero">
      <view class="sales-hero__top">
        <view v-if="level > 1" class="back-btn" @tap="goBack">
          <wd-icon name="arrow-left" size="18px" color="#ffffff" />
        </view>
        <view class="sales-hero__text">
          <text class="sales-hero__title">楼栋销控</text>
        </view>
        <wd-button size="small" plain custom-class="hero-refresh" @click="refreshCurrent">
          刷新
        </wd-button>
      </view>
      <view class="breadcrumbs">
        <text v-for="(item, index) in breadcrumbs" :key="`${item}-${index}`">{{ index > 0 ? ' / ' : '' }}{{ item }}</text>
      </view>
    </view>

    <view class="legend sl-card">
      <view v-for="item in PROPERTY_STATUS_OPTIONS" :key="item.value" class="legend__item">
        <view class="legend__dot" :class="`legend__dot--${item.value}`" />
        <text>{{ item.label }}</text>
      </view>
    </view>

    <scroll-view scroll-y class="content-scroll">
      <view v-if="level === 1" class="content-inner">
        <view class="overview sl-card">
          <view>
            <text>{{ totalRegionStats.community }}</text>
            <text>小区</text>
          </view>
          <view>
            <text>{{ totalRegionStats.building }}</text>
            <text>楼栋</text>
          </view>
          <view>
            <text>{{ totalRegionStats.property }}</text>
            <text>房源</text>
          </view>
          <view>
            <text>{{ totalRegionStats.rented }}</text>
            <text>已租</text>
          </view>
        </view>

        <scroll-view v-if="regionList.length" scroll-x class="region-filter">
          <view class="region-filter__inner">
            <view class="filter-chip" :class="{ active: regionFilterId === undefined }" @tap="selectRegionFilter(undefined)">
              全部
            </view>
            <view
              v-for="region in regionList"
              :key="String(region.id)"
              class="filter-chip"
              :class="{ active: sameId(regionFilterId, region.id) }"
              @tap="selectRegionFilter(region.id)"
            >
              {{ region.name }}
            </view>
          </view>
        </scroll-view>

        <view v-if="loading && !regionList.length" class="loading sl-card">
          数据加载中...
        </view>
        <view v-else-if="!displayedRegions.length" class="empty sl-card">
          <wd-icon name="location" size="36px" color="#8ea099" />
          <text>暂无区域数据</text>
        </view>
        <view v-else class="region-list">
          <view v-for="region in displayedRegions" :key="String(region.id)" class="region-card sl-card" @tap="drillRegion(region)">
            <view class="region-card__top">
              <text class="region-card__name">{{ region.name }}</text>
              <wd-icon name="arrow-right" size="18px" color="#72817b" />
            </view>
            <view class="region-card__stats">
              <view><text>{{ region.stats?.buildingCount || 0 }}</text><text>楼栋</text></view>
              <view><text>{{ region.stats?.availableCount || 0 }}</text><text>空置</text></view>
              <view><text>{{ region.stats?.rentedCount || 0 }}</text><text>已租</text></view>
              <view><text>{{ region.stats?.propertyCount || 0 }}</text><text>房源</text></view>
              <view><text>{{ rate(region.stats?.rentedCount, region.stats?.propertyCount) }}%</text><text>出租率</text></view>
            </view>
            <view class="progress">
              <view :style="{ width: `${rate(region.stats?.rentedCount, region.stats?.propertyCount)}%` }" />
            </view>
          </view>
        </view>
      </view>

      <view v-if="level === 2" class="content-inner">
        <view v-if="loading" class="loading sl-card">
          数据加载中...
        </view>
        <view v-else-if="!communityRows.length" class="empty sl-card">
          <wd-icon name="home" size="36px" color="#8ea099" />
          <text>暂无小区数据</text>
        </view>
        <view v-else class="community-list">
          <view v-for="row in communityRows" :key="String(row.community.id)" class="community-card sl-card">
            <view class="community-card__head">
              <view>
                <text class="community-card__name">{{ row.community.name }}</text>
                <text class="community-card__desc">{{ row.buildings.length }} 栋楼 · 点击楼栋进入销控</text>
              </view>
              <wd-button size="small" plain @click="goCommunityProperties(row.community)">
                房源
              </wd-button>
            </view>
            <view v-if="row.buildings.length" class="building-grid">
              <view v-for="building in row.buildings" :key="String(building.id)" class="building-card" @tap="drillBuilding(building, row.community.name)">
                <text class="building-card__name">{{ building.name }}</text>
                <view class="building-card__nums">
                  <text>{{ building.availableCount }} 空置</text>
                  <text>{{ building.rentedCount }} 已租</text>
                </view>
                <text class="building-card__meta">{{ building.propertyCount }}间 · {{ building.totalFloors || '-' }}层</text>
              </view>
            </view>
            <view v-else class="no-building">
              暂无楼栋
            </view>
          </view>
        </view>
      </view>

      <view v-if="level === 3" class="content-inner">
        <view class="building-summary sl-card">
          <view>
            <text class="building-summary__name">{{ selectedBuilding?.name }}</text>
            <text class="building-summary__desc">{{ selectedCommunityName }} · {{ selectedBuilding?.totalFloors || '-' }} 层</text>
          </view>
          <view class="building-summary__stats">
            <text>{{ selectedBuilding?.propertyCount || 0 }}间</text>
            <text>出租率 {{ rate(selectedBuilding?.rentedCount, selectedBuilding?.propertyCount) }}%</text>
          </view>
        </view>

        <view v-if="propertyLoading" class="loading sl-card">
          房间加载中...
        </view>
        <view v-else-if="!properties.length" class="empty sl-card">
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
                  @tap="openProperty(room)"
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
    </scroll-view>

    <wd-popup v-model="actionVisible" position="bottom" custom-style="border-radius: 30rpx 30rpx 0 0; overflow: hidden;" safe-area-inset-bottom>
      <view class="action-sheet">
        <view class="action-sheet__head">
          <view>
            <text class="action-sheet__title">{{ activeProperty?.title || '房源' }}</text>
            <text class="action-sheet__desc">{{ activeProperty?.houseType }} · ¥{{ formatMoney(activeProperty?.rentPrice) }}/月</text>
          </view>
          <wd-tag v-if="activeProperty" :type="statusTone(activeProperty.status)">
            {{ activeProperty.statusName || statusLabel(activeProperty.status) }}
          </wd-tag>
        </view>

        <text class="action-sheet__label">快捷操作</text>
        <view class="action-status">
          <wd-button
            v-for="item in PROPERTY_STATUS_OPTIONS"
            :key="item.value"
            :type="activeProperty?.status === item.value ? 'primary' : 'default'"
            plain
            @click="changeStatus(item.value)"
          >
            {{ item.label }}
          </wd-button>
        </view>

        <view class="action-buttons">
          <wd-button plain block type="default" @click="goDetail">
            查看详情
          </wd-button>
          <wd-button block type="primary" @click="goEdit">
            编辑房源
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.sales-page {
  display: flex;
  height: 100vh;
  flex-direction: column;
  background:
    radial-gradient(circle at 12% -2%, rgb(228 161 27 / 18%), transparent 260rpx),
    linear-gradient(180deg, #f8fbf4 0%, #eef5ef 100%);
}

.sales-hero {
  flex: 0 0 auto;
  padding: 34rpx 28rpx 26rpx;
  background:
    linear-gradient(135deg, rgb(18 107 79 / 98%), rgb(35 94 77 / 94%)),
    radial-gradient(circle at 84% 8%, rgb(228 161 27 / 60%), transparent 240rpx);
  color: #fff;
}

.sales-hero__top {
  display: flex;
  align-items: center;
  gap: 18rpx;
}

.back-btn {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(255 255 255 / 16%);
}

.sales-hero__text {
  min-width: 0;
  flex: 1;
}

.sales-hero__title {
  display: block;
}

.sales-hero__title {
  margin-top: 6rpx;
  font-size: 42rpx;
  font-weight: 900;
}

.breadcrumbs {
  margin-top: 18rpx;
  color: rgb(255 255 255 / 80%);
  font-size: 24rpx;
}

.legend {
  display: flex;
  flex: 0 0 auto;
  justify-content: space-around;
  margin: 18rpx 28rpx 0;
  padding: 18rpx 12rpx;
}

.legend__item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.legend__dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 999rpx;
}

.legend__dot--0 {
  background: #2fb06f;
}
.legend__dot--1 {
  background: #e4a11b;
}
.legend__dot--2 {
  background: #7d8b85;
}
.legend__dot--3 {
  background: #c94832;
}

.content-scroll {
  flex: 1;
  height: 0;
}

.content-inner {
  padding: 22rpx 28rpx calc(130rpx + env(safe-area-inset-bottom));
}

.overview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
  padding: 22rpx 10rpx;
}

.overview view {
  text-align: center;
}

.overview text:first-child {
  display: block;
  color: var(--sl-brand);
  font-size: 34rpx;
  font-weight: 900;
}

.overview text:last-child {
  display: block;
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.region-list,
.community-list,
.floor-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 18rpx;
}

.region-card,
.community-card,
.building-summary,
.loading,
.empty {
  padding: 24rpx;
}

.region-card__top,
.community-card__head,
.building-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.region-card__name,
.community-card__name,
.building-summary__name {
  display: block;
  font-size: 31rpx;
  font-weight: 850;
}

.community-card__desc,
.building-summary__desc {
  display: block;
  margin-top: 7rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.region-filter {
  margin-bottom: 18rpx;
  white-space: nowrap;
}

.region-filter__inner {
  display: inline-flex;
  gap: 14rpx;
  padding: 4rpx 2rpx 8rpx;
}

.filter-chip {
  display: inline-flex;
  height: 60rpx;
  align-items: center;
  padding: 0 28rpx;
  border: 1rpx solid rgb(18 107 79 / 16%);
  border-radius: 999rpx;
  background: #fff;
  color: #5e6c65;
  font-size: 25rpx;
  font-weight: 700;
}

.filter-chip.active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--sl-brand, #126b4f), #24815f);
  box-shadow: 0 8rpx 20rpx rgb(18 107 79 / 22%);
  color: #fff;
}

.region-card__stats {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8rpx;
  margin-top: 22rpx;
}

.region-card__stats view {
  border-radius: 16rpx;
  background: #f3f7f1;
  padding: 14rpx 2rpx;
  text-align: center;
}

.region-card__stats text:first-child {
  display: block;
  color: var(--sl-brand);
  font-size: 28rpx;
  font-weight: 900;
}

.region-card__stats text:last-child {
  display: block;
  margin-top: 4rpx;
  color: var(--sl-muted);
  font-size: 20rpx;
}

.progress {
  overflow: hidden;
  height: 10rpx;
  margin-top: 18rpx;
  border-radius: 999rpx;
  background: #edf4ea;
}

.progress view {
  height: 100%;
  border-radius: 999rpx;
  background: linear-gradient(90deg, var(--sl-brand), var(--sl-brand-2));
}

.building-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
  margin-top: 20rpx;
}

.building-card {
  padding: 20rpx;
  border: 1rpx solid rgb(18 107 79 / 8%);
  border-radius: 20rpx;
  background: #f7faf4;
}

.building-card__name,
.building-card__meta {
  display: block;
}

.building-card__name {
  font-size: 27rpx;
  font-weight: 850;
}

.building-card__nums {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.building-card__nums text {
  padding: 5rpx 10rpx;
  border-radius: 999rpx;
  background: #fff;
  color: var(--sl-brand);
  font-size: 21rpx;
}

.building-card__meta,
.no-building {
  margin-top: 12rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.building-summary {
  margin-bottom: 18rpx;
}

.building-summary__stats {
  text-align: right;
}

.building-summary__stats text:first-child {
  display: block;
  color: var(--sl-brand);
  font-size: 34rpx;
  font-weight: 900;
}

.building-summary__stats text:last-child {
  display: block;
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.floor-row {
  display: flex;
  gap: 14rpx;
  align-items: stretch;
}

.floor-label {
  display: flex;
  width: 74rpx;
  flex: 0 0 74rpx;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
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
  gap: 12rpx;
  min-height: 144rpx;
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
  border-radius: 20rpx;
  background: #edf6ef;
  text-align: center;
}

.room-cell--1 {
  background: #fff6df;
  border-color: rgb(228 161 27 / 22%);
}
.room-cell--2 {
  background: #eef2f0;
  border-color: rgb(125 139 133 / 18%);
}
.room-cell--3 {
  background: #fff0ed;
  border-color: rgb(201 72 50 / 18%);
}

.room-cell__no {
  overflow: hidden;
  max-width: 148rpx;
  font-size: 25rpx;
  font-weight: 850;
  text-overflow: ellipsis;
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

.loading,
.empty {
  margin-top: 18rpx;
  color: var(--sl-muted);
  text-align: center;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
}

.action-sheet {
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.action-sheet__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16rpx;
}

.action-sheet__title,
.action-sheet__desc,
.action-sheet__label {
  display: block;
}

.action-sheet__title {
  font-size: 32rpx;
  font-weight: 850;
}

.action-sheet__desc {
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.action-sheet__label {
  margin: 28rpx 0 14rpx;
  font-size: 26rpx;
  font-weight: 850;
}

.action-status {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
  margin-top: 26rpx;
}
</style>
