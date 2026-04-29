<script setup lang="ts">
import type { ShenLeId, SlCommunityOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { idToQuery } from '@/utils/shenle'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '地图找房',
    enablePullDownRefresh: true,
  },
})

const DEFAULT_CENTER = { latitude: 22.5431, longitude: 114.0579 }

const mapLat = ref(DEFAULT_CENTER.latitude)
const mapLng = ref(DEFAULT_CENTER.longitude)
const mapScale = ref(13)
const communities = ref<SlCommunityOutput[]>([])
const selected = ref<SlCommunityOutput | null>(null)
const loading = ref(false)
const locationReady = ref(false)

const markers = computed(() => communities.value.map((item, index) => ({
  id: index + 1,
  latitude: Number(item.lat),
  longitude: Number(item.lng),
  iconPath: '/static/images/dot-red.png',
  width: 26,
  height: 26,
  callout: {
    content: `${item.name}
${rentText(item)}`,
    display: 'ALWAYS' as const,
    fontSize: 11,
    borderRadius: 8,
    borderWidth: 0,
    borderColor: '#126b4f',
    padding: 7,
    bgColor: '#126b4f',
    color: '#ffffff',
    textAlign: 'center' as const,
  },
})))

function hasCoordinate(item: SlCommunityOutput) {
  const lat = Number(item.lat)
  const lng = Number(item.lng)
  return Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0 && lng !== 0
}

async function loadCommunities() {
  loading.value = true
  try {
    const result = await getCommunityPage({ page: 1, pageSize: 500, status: 0 })
    communities.value = result.items.filter(hasCoordinate)
    if (selected.value && !communities.value.some(item => String(item.id) === String(selected.value?.id)))
      selected.value = null
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function getLocation(showTip = false) {
  uni.getLocation({
    type: 'gcj02',
    success(res) {
      mapLat.value = res.latitude
      mapLng.value = res.longitude
      mapScale.value = 14
      locationReady.value = true
      if (showTip)
        uni.showToast({ title: '已定位到附近', icon: 'success' })
    },
    fail() {
      locationReady.value = false
      if (showTip)
        uni.showToast({ title: '定位失败，已展示默认区域', icon: 'none' })
    },
  })
}

function markerToCommunity(markerId: number) {
  return communities.value[markerId - 1] || null
}

function onMarkerTap(event: any) {
  const item = markerToCommunity(Number(event.detail?.markerId))
  selected.value = item
  if (item?.lat && item.lng) {
    mapLat.value = Number(item.lat)
    mapLng.value = Number(item.lng)
    mapScale.value = 15
  }
}

function onCalloutTap(event: any) {
  const item = markerToCommunity(Number(event.detail?.markerId))
  goProperties(item)
}

function onMapTap() {
  selected.value = null
}

function goProperties(item: SlCommunityOutput | null) {
  if (!item)
    return
  uni.navigateTo({
    url: `/pages/common/community-properties/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}`,
  })
}

function focusCommunity(item: SlCommunityOutput) {
  selected.value = item
  mapLat.value = Number(item.lat)
  mapLng.value = Number(item.lng)
  mapScale.value = 15
}

function rentText(item: SlCommunityOutput): string {
  if (!item.minRentPrice && !item.maxRentPrice)
    return '价格待补充'
  if (item.minRentPrice && item.maxRentPrice && item.minRentPrice === item.maxRentPrice)
    return `¥${item.minRentPrice}/月`
  if (item.minRentPrice)
    return `¥${item.minRentPrice}起/月`
  return `最高¥${item.maxRentPrice}/月`
}

function idKey(id: ShenLeId) {
  return String(id)
}

onLoad(() => {
  getLocation(false)
  loadCommunities()
})
onPullDownRefresh(loadCommunities)
</script>

<template>
  <view class="map-page">
    <view class="map-head">
      <view>
        <text class="map-head__eyebrow">Map View</text>
        <text class="map-head__title">地图找房</text>
      </view>
      <view class="map-head__actions">
        <wd-button size="small" plain @click="getLocation(true)">
          定位
        </wd-button>
        <wd-button size="small" type="primary" @click="loadCommunities">
          刷新
        </wd-button>
      </view>
    </view>

    <view class="map-shell sl-card">
      <map
        class="map"
        :latitude="mapLat"
        :longitude="mapLng"
        :scale="mapScale"
        :markers="markers"
        show-location
        @markertap="onMarkerTap"
        @callouttap="onCalloutTap"
        @tap="onMapTap"
      />
      <view class="map-badge">
        <text>{{ loading ? '加载中' : `${communities.length} 个楼盘` }}</text>
        <text>{{ locationReady ? '已定位' : '默认区域' }}</text>
      </view>
    </view>

    <view class="bottom-panel sl-card">
      <view v-if="selected" class="selected-card" @tap="goProperties(selected)">
        <view class="selected-card__body">
          <view class="selected-card__top">
            <text class="selected-card__name">{{ selected.name }}</text>
            <wd-tag type="success" plain>{{ selected.regionName || '未分区' }}</wd-tag>
          </view>
          <text class="selected-card__address">{{ selected.address || '暂无地址' }}</text>
          <view class="selected-card__meta">
            <text>{{ rentText(selected) }}</text>
            <text>{{ selected.propertyCount || 0 }} 套房源</text>
            <text>{{ selected.buildingCount || 0 }} 栋楼</text>
          </view>
        </view>
        <wd-icon name="arrow-right" size="20px" color="#7a8780" />
      </view>

      <view v-else class="hint-row">
        <view>
          <text class="hint-row__title">点击地图标记查看楼盘</text>
          <text class="hint-row__desc">楼盘坐标来自后台楼盘管理，缺少坐标的楼盘不会出现在地图上。</text>
        </view>
        <text class="hint-row__count">{{ communities.length }}</text>
      </view>
    </view>

    <scroll-view scroll-x class="nearby-row">
      <view class="nearby-row__inner">
        <view
          v-for="item in communities.slice(0, 20)"
          :key="idKey(item.id)"
          class="nearby-card"
          :class="{ active: selected && idKey(selected.id) === idKey(item.id) }"
          @tap="focusCommunity(item)"
        >
          <text>{{ item.name }}</text>
          <text>{{ item.propertyCount || 0 }}套 · {{ rentText(item) }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped lang="scss">
.map-page {
  display: flex;
  height: 100vh;
  flex-direction: column;
  box-sizing: border-box;
  padding: 28rpx 24rpx calc(132rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 12% -2%, rgb(228 161 27 / 18%), transparent 260rpx),
    linear-gradient(180deg, #f8fbf4 0%, #eef5ef 100%);
}

.map-head {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding-top: 18rpx;
}

.map-head__eyebrow,
.map-head__title {
  display: block;
}

.map-head__eyebrow {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.map-head__title {
  margin-top: 8rpx;
  font-size: 38rpx;
  font-weight: 850;
}

.map-head__actions {
  display: flex;
  flex-shrink: 0;
  gap: 10rpx;
}

.map-shell {
  position: relative;
  min-height: 520rpx;
  flex: 1;
  overflow: hidden;
  margin-top: 20rpx;
}

.map {
  width: 100%;
  height: 100%;
}

.map-badge {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  display: flex;
  gap: 10rpx;
  pointer-events: none;
}

.map-badge text {
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 8rpx 20rpx rgb(31 60 45 / 10%);
  color: var(--sl-brand);
  font-size: 22rpx;
  font-weight: 800;
}

.bottom-panel {
  flex: 0 0 auto;
  margin-top: 18rpx;
  padding: 22rpx;
}

.selected-card,
.hint-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.selected-card__body {
  min-width: 0;
  flex: 1;
}

.selected-card__top {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.selected-card__name {
  min-width: 0;
  overflow: hidden;
  font-size: 31rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-card__address {
  display: block;
  margin-top: 10rpx;
  overflow: hidden;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.selected-card__meta text {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #f1f6ef;
  color: #4f5f57;
  font-size: 22rpx;
}

.selected-card__meta text:first-child {
  color: #c26916;
  font-weight: 850;
}

.hint-row__title,
.hint-row__desc {
  display: block;
}

.hint-row__title {
  font-size: 29rpx;
  font-weight: 850;
}

.hint-row__desc {
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.hint-row__count {
  color: var(--sl-brand);
  font-size: 42rpx;
  font-weight: 900;
}

.nearby-row {
  flex: 0 0 auto;
  margin-top: 16rpx;
  white-space: nowrap;
}

.nearby-row__inner {
  display: inline-flex;
  gap: 14rpx;
  padding-right: 24rpx;
}

.nearby-card {
  display: inline-flex;
  min-width: 230rpx;
  max-width: 280rpx;
  flex-direction: column;
  gap: 8rpx;
  box-sizing: border-box;
  padding: 18rpx;
  border: 1rpx solid rgb(18 107 79 / 8%);
  border-radius: 22rpx;
  background: rgb(255 255 255 / 82%);
  box-shadow: 0 10rpx 24rpx rgb(31 60 45 / 6%);
}

.nearby-card.active {
  border-color: rgb(18 107 79 / 20%);
  background: #126b4f;
  color: #fff;
}

.nearby-card text:first-child {
  overflow: hidden;
  font-size: 25rpx;
  font-weight: 850;
  text-overflow: ellipsis;
}

.nearby-card text:last-child {
  overflow: hidden;
  color: var(--sl-muted);
  font-size: 21rpx;
  text-overflow: ellipsis;
}

.nearby-card.active text:last-child {
  color: rgb(255 255 255 / 74%);
}
</style>
