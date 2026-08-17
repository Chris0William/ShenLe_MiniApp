<script setup lang="ts">
import type { SlSourceContactCommunityOutput } from '@/types/shenle'
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useSourceContactStore } from '@/store/source-contact'
import { useSafeTopStyle } from '@/utils/safe-area'

const DEFAULT_CENTER = { latitude: 22.5431, longitude: 114.0579 }
const MAP_ID = 'source-contact-map'
const safeTop = useSafeTopStyle()
const sourceContact = useSourceContactStore()
const componentInstance = getCurrentInstance()
const mapLat = ref(DEFAULT_CENTER.latitude)
const mapLng = ref(DEFAULT_CENTER.longitude)
const mapScale = ref(12)
const mapVisible = ref(false)
const selected = ref<SlSourceContactCommunityOutput | null>(null)
let mapContext: UniApp.MapContext | null = null
let mapMountTimer: ReturnType<typeof setTimeout> | null = null

const coordinateCommunities = computed(() => sourceContact.communities.filter((item) => {
  if (item.lat === null || item.lat === undefined || item.lng === null || item.lng === undefined)
    return false
  const latitude = Number(item.lat)
  const longitude = Number(item.lng)
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && (latitude !== 0 || longitude !== 0)
}))

const markers = computed(() => coordinateCommunities.value.map((item, index) => ({
  id: index + 1,
  latitude: Number(item.lat),
  longitude: Number(item.lng),
  iconPath: '/static/images/pin-green.png',
  width: 28,
  height: 34,
  anchor: { x: 0.5, y: 1 },
  callout: {
    display: 'ALWAYS' as const,
    content: `${item.name}\n${item.availableCount} 套可用`,
    padding: 7,
    borderRadius: 7,
    borderWidth: 0,
    borderColor: '#126b4f',
    fontSize: 11,
    color: '#ffffff',
    bgColor: '#126b4f',
    textAlign: 'center' as const,
  },
})))

const profileStats = computed(() => [
  { label: '楼盘', value: sourceContact.profile?.communityCount || 0 },
  { label: '空置', value: sourceContact.profile?.availableCount || 0 },
  { label: '已租', value: sourceContact.profile?.rentedCount || 0 },
  { label: '推广', value: sourceContact.profile?.promotedCount || 0 },
])

function rentText(item: SlSourceContactCommunityOutput) {
  const min = Number(item.minRentPrice || 0)
  const max = Number(item.maxRentPrice || 0)
  if (min > 0 && max > 0 && min !== max)
    return `¥${min}-${max}/月`
  if (min > 0)
    return `¥${min}/月起`
  return '租金待完善'
}

function coverUrl(item: SlSourceContactCommunityOutput) {
  const isVideo = item.coverFileType?.startsWith('video')
    || ['.mp4', '.mov', '.m4v', '.avi', '.webm'].includes((item.coverSuffix || '').toLowerCase())
  return isVideo ? item.coverPosterUrl : item.coverImage
}

function formatUpdateTime(value?: string | null) {
  if (!value)
    return '暂无更新记录'
  return value.replace('T', ' ').slice(0, 16)
}

async function fitMarkers() {
  if (!mapVisible.value)
    return
  await nextTick()
  const points = coordinateCommunities.value.map(item => ({
    latitude: Number(item.lat),
    longitude: Number(item.lng),
  }))
  if (!points.length)
    return
  mapLat.value = points[0].latitude
  mapLng.value = points[0].longitude
  if (points.length === 1) {
    mapScale.value = 15
    return
  }
  setTimeout(() => {
    mapContext?.includePoints({ points, padding: [56, 44, 160, 44] })
  }, 220)
}

async function mountMap() {
  const firstPoint = coordinateCommunities.value[0]
  if (firstPoint) {
    mapLat.value = Number(firstPoint.lat)
    mapLng.value = Number(firstPoint.lng)
    mapScale.value = coordinateCommunities.value.length === 1 ? 15 : 12
  }
  if (!mapVisible.value) {
    await nextTick()
    await new Promise<void>((resolve) => {
      mapMountTimer = setTimeout(resolve, 80)
    })
    mapVisible.value = true
    await nextTick()
    mapContext = uni.createMapContext(MAP_ID, componentInstance?.proxy as any)
  }
  await fitMarkers()
}

async function refresh() {
  await sourceContact.load(true)
  selected.value = null
  await mountMap()
  uni.stopPullDownRefresh()
}

async function activate() {
  await sourceContact.load()
  await mountMap()
}

function onMarkerTap(event: any) {
  selected.value = coordinateCommunities.value[Number(event.detail?.markerId) - 1] || null
}

function openRoomState(item: SlSourceContactCommunityOutput) {
  sourceContact.selectCommunity(item.id)
  uni.switchTab({ url: '/pages/admin/sales-control/index' })
}

onMounted(async () => {
  await sourceContact.load()
  await mountMap()
})

onBeforeUnmount(() => {
  if (mapMountTimer)
    clearTimeout(mapMountTimer)
})

defineExpose({ refresh, activate })
</script>

<template>
  <view class="source-map-page" :style="safeTop">
    <sl-source-contact-header title="我的盘源" subtitle="仅展示分配给我的楼盘" />

    <view class="stats-strip">
      <view v-for="item in profileStats" :key="item.label" class="stats-strip__item">
        <text class="stats-strip__value">{{ item.value }}</text>
        <text class="stats-strip__label">{{ item.label }}</text>
      </view>
    </view>

    <view class="map-shell">
      <map
        v-if="mapVisible"
        :id="MAP_ID"
        class="map"
        :latitude="mapLat"
        :longitude="mapLng"
        :scale="mapScale"
        :markers="markers"
        show-location
        @markertap="onMarkerTap"
        @callouttap="onMarkerTap"
      />

      <view class="map-tools">
        <view class="map-tool" @tap="refresh">
          <wd-icon name="refresh" size="19px" color="#126b4f" />
        </view>
      </view>

      <view v-if="sourceContact.loading && !sourceContact.communities.length" class="map-empty">
        <wd-loading color="#126b4f" />
        <text>正在加载名下盘源</text>
      </view>
      <view v-else-if="!sourceContact.communities.length" class="map-empty">
        <wd-icon name="location" size="30px" color="#8fa098" />
        <text>暂未分配楼盘</text>
        <text class="map-empty__sub">请联系管理员完成盘源分配</text>
      </view>
      <view v-else-if="!coordinateCommunities.length" class="map-empty">
        <wd-icon name="location" size="30px" color="#8fa098" />
        <text>名下楼盘尚未设置坐标</text>
        <text class="map-empty__sub">请联系系统维护人完善楼盘位置</text>
      </view>

      <view v-if="selected" class="community-preview">
        <view class="community-preview__media">
          <image v-if="coverUrl(selected)" class="community-preview__image" :src="coverUrl(selected) || ''" mode="aspectFill" />
          <view v-else class="community-preview__placeholder">
            <wd-icon name="home" size="30px" color="#126b4f" />
          </view>
          <view v-if="selected.promotedCount" class="promotion-mark">
            推广 {{ selected.promotedCount }} 套
          </view>
        </view>
        <view class="community-preview__body">
          <view class="community-preview__head">
            <text class="community-preview__name">{{ selected.name }}</text>
            <view class="community-preview__close" @tap.stop="selected = null">
              <wd-icon name="close" size="16px" color="#7a8780" />
            </view>
          </view>
          <text class="community-preview__rent">{{ rentText(selected) }}</text>
          <text class="community-preview__meta">
            {{ selected.buildingCount }} 栋 · {{ selected.availableCount }} 套可用 · {{ selected.rentedCount }} 套已租
          </text>
          <view class="community-preview__foot">
            <text class="community-preview__time">更新 {{ formatUpdateTime(selected.supplyUpdateTime) }}</text>
            <wd-button type="primary" size="small" @click="openRoomState(selected)">
              查看房态
            </wd-button>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.source-map-page {
  display: flex;
  width: 100%;
  height: 100vh;
  flex-direction: column;
  padding-right: 22rpx;
  padding-bottom: calc(126rpx + env(safe-area-inset-bottom));
  padding-left: 22rpx;
  box-sizing: border-box;
  overflow: hidden;
}

.stats-strip {
  display: grid;
  flex: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 16rpx 0;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 8rpx;
  background: #fff;
}

.stats-strip__item {
  position: relative;
  display: flex;
  min-width: 0;
  padding: 14rpx 6rpx;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.stats-strip__item + .stats-strip__item::before {
  position: absolute;
  top: 18rpx;
  bottom: 18rpx;
  left: 0;
  width: 1rpx;
  background: #e5ebe7;
  content: '';
}

.stats-strip__value {
  color: #126b4f;
  font-size: 28rpx;
  font-weight: 800;
}

.stats-strip__label {
  color: #72817b;
  font-size: 21rpx;
}

.map-shell {
  position: relative;
  min-height: 0;
  flex: 1;
  overflow: hidden;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 8rpx;
  background: #e8eeea;
}

.map {
  width: 100%;
  height: 100%;
}

.map-tools {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
}

.map-tool {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgb(18 107 79 / 14%);
  border-radius: 8rpx;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 8rpx 18rpx rgb(27 55 42 / 12%);
}

.map-empty {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  width: 360rpx;
  padding: 28rpx 20rpx;
  align-items: center;
  border-radius: 8rpx;
  background: rgb(255 255 255 / 94%);
  box-shadow: 0 14rpx 36rpx rgb(27 55 42 / 12%);
  color: #53635c;
  flex-direction: column;
  font-size: 25rpx;
  gap: 12rpx;
  transform: translate(-50%, -50%);
}

.map-empty__sub {
  color: #8a9791;
  font-size: 22rpx;
}

.community-preview {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  left: 18rpx;
  display: flex;
  min-height: 190rpx;
  overflow: hidden;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 8rpx;
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 18rpx 42rpx rgb(24 53 39 / 18%);
}

.community-preview__media {
  position: relative;
  width: 184rpx;
  flex: none;
  background: #e7f0ea;
}

.community-preview__image,
.community-preview__placeholder {
  width: 100%;
  height: 100%;
}

.community-preview__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.promotion-mark {
  position: absolute;
  top: 10rpx;
  left: 10rpx;
  padding: 5rpx 10rpx;
  border-radius: 6rpx;
  background: #126b4f;
  color: #fff;
  font-size: 19rpx;
}

.community-preview__body {
  display: flex;
  min-width: 0;
  flex: 1;
  padding: 18rpx;
  flex-direction: column;
}

.community-preview__head,
.community-preview__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.community-preview__name {
  overflow: hidden;
  font-size: 29rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-preview__close {
  display: flex;
  width: 42rpx;
  height: 42rpx;
  flex: none;
  align-items: center;
  justify-content: center;
}

.community-preview__rent {
  margin-top: 7rpx;
  color: #bf6415;
  font-size: 24rpx;
  font-weight: 800;
}

.community-preview__meta {
  margin-top: 6rpx;
  color: #66756e;
  font-size: 21rpx;
}

.community-preview__foot {
  margin-top: auto;
}

.community-preview__time {
  overflow: hidden;
  color: #8a9791;
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
