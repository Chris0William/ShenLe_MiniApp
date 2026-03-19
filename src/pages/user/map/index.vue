<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { getCommunityPage } from '@/api/community'
import type { SlCommunityOutput } from '@/types/community'

const appStore = useAppStore()

// ---- 地图中心 ----
const mapLat = ref(22.5431)   // 默认广东东莞
const mapLng = ref(114.0579)
const mapScale = ref(14)

// ---- 定位 ----
function getLocation() {
  uni.getLocation({
    type: 'gcj02',
    success: (res) => {
      mapLat.value = res.latitude
      mapLng.value = res.longitude
    },
  })
}

// ---- 楼盘数据 ----
const communities = ref<SlCommunityOutput[]>([])

async function loadCommunities() {
  try {
    const res = await getCommunityPage({ page: 1, pageSize: 500, status: 0 })
    communities.value = res.items.filter((c: SlCommunityOutput) => c.lat && c.lng)
  } catch {}
}

// ---- 标注点 ----
const markers = computed(() =>
  communities.value.map(c => ({
    id: c.id,
    latitude: c.lat!,
    longitude: c.lng!,
    width: 24,
    height: 24,
    callout: {
      content: `${c.name}\n${rentText(c)}`,
      display: 'ALWAYS',
      fontSize: 11,
      borderRadius: 6,
      padding: 6,
      bgColor: '#2563EB',
      color: '#ffffff',
      textAlign: 'center',
    },
  }))
)

// ---- 选中楼盘 ----
const selected = ref<SlCommunityOutput | null>(null)

function onMarkerTap(e: any) {
  const id = e.detail.markerId
  selected.value = communities.value.find(c => c.id === id) ?? null
}

function onCalloutTap(e: any) {
  const id = e.detail.markerId
  const item = communities.value.find(c => c.id === id)
  goProperties(item ?? null)
}

function onMapTap() {
  selected.value = null
}

function goProperties(item: SlCommunityOutput | null) {
  if (!item) return
  uni.navigateTo({
    url: `/pages/common/community-properties/index?communityId=${item.id}&communityName=${encodeURIComponent(item.name)}`,
  })
}

// ---- Helpers ----
function rentText(item: SlCommunityOutput): string {
  if (!item.minRentPrice && !item.maxRentPrice) return '暂无报价'
  if (item.minRentPrice === item.maxRentPrice) return `¥${item.minRentPrice}/月`
  return `¥${item.minRentPrice}起/月`
}

onMounted(() => {
  getLocation()
  loadCommunities()
})
</script>

<template>
  <view class="page">
    <!-- 地图 -->
    <map
      class="map"
      :style="{ paddingTop: appStore.headerPaddingStyle(0) }"
      :latitude="mapLat"
      :longitude="mapLng"
      :scale="mapScale"
      :markers="markers"
      show-location
      @markertap="onMarkerTap"
      @callouttap="onCalloutTap"
      @tap="onMapTap"
    />

    <!-- 底部信息卡片 -->
    <view class="bottom-panel">
      <!-- 选中楼盘 -->
      <view v-if="selected" class="community-card" @tap="goProperties(selected)">
        <view class="card-info">
          <text class="card-name">{{ selected.name }}</text>
          <view v-if="selected.regionName" class="card-tag">
            <text>{{ selected.regionName }}</text>
          </view>
          <text v-if="selected.houseTypes" class="card-types">{{ selected.houseTypes }}</text>
          <view class="card-bottom">
            <text class="card-rent">{{ rentText(selected) }}</text>
            <text class="card-count">{{ selected.propertyCount }}套在租</text>
          </view>
        </view>
        <view class="card-arrow">
          <text>›</text>
        </view>
      </view>

      <!-- 无选中 -->
      <view v-else class="hint-row">
        <text class="hint-text">点击地图上的标注查看楼盘</text>
        <text class="hint-count">共 {{ communities.length }} 个楼盘</text>
      </view>
    </view>

    <sl-custom-tabbar :current="1" />
  </view>
</template>

<style lang="scss" scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: $sl-bg-page;
}

.map {
  flex: 1;
  width: 100%;
}

// ---- 底部面板 ----
.bottom-panel {
  background-color: $sl-bg-card;
  padding: $sl-spacing-md $sl-spacing-lg;
  box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.08);
  min-height: 120rpx;
  display: flex;
  align-items: center;
}

.hint-row {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hint-text {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
}

.hint-count {
  font-size: $sl-font-sm;
  color: $sl-primary-dark;
  font-weight: 500;
}

// ---- 选中卡片 ----
.community-card {
  flex: 1;
  display: flex;
  align-items: center;
  gap: $sl-spacing-md;
}

.card-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.card-name {
  font-size: $sl-font-md;
  font-weight: 700;
  color: $sl-text-primary;
}

.card-tag {
  align-self: flex-start;
  padding: 2rpx 12rpx;
  background-color: rgba(37, 99, 235, 0.1);
  border-radius: 8rpx;
  font-size: $sl-font-xs;
  color: $sl-primary-dark;
}

.card-types {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
}

.card-bottom {
  display: flex;
  align-items: baseline;
  gap: $sl-spacing-sm;
}

.card-rent {
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-price;
}

.card-count {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

.card-arrow {
  font-size: 40rpx;
  color: $sl-text-placeholder;
  flex-shrink: 0;
}
</style>
