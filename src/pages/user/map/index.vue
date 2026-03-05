<script setup lang="ts">
import { useAppStore } from '@/stores/app'
const appStore = useAppStore()
</script>

<template>
  <view class="page">
    <!-- 顶部筛选栏 -->
    <view class="header" :style="{ paddingTop: appStore.headerPaddingStyle(0) }">
      <view class="filter-bar">
        <view class="filter-item"><text>区域</text></view>
        <view class="filter-item"><text>价格</text></view>
        <view class="filter-item"><text>户型</text></view>
      </view>
    </view>

    <!-- 地图占位 -->
    <view class="map-area">
      <text class="map-placeholder">地图加载中...</text>
    </view>

    <!-- 底部抽屉占位 -->
    <view class="drawer">
      <view class="drawer-handle" />
      <text class="drawer-title">附近房源</text>
      <sl-empty-state text="在地图上选择区域查看房源" />
    </view>

    <sl-custom-tabbar :current="1" />
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $sl-bg-page;
  display: flex;
  flex-direction: column;
}

.header {
  // padding-top 由 :style 动态设置
  background-color: $sl-bg-card;
  z-index: 10;
}

.filter-bar {
  display: flex;
  border-bottom: 1rpx solid $sl-border-color;
}

.filter-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $sl-spacing-sm 0;
  font-size: $sl-font-md;
  color: $sl-text-primary;
}

.map-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e8f4e8;
  min-height: 500rpx;
}

.map-placeholder {
  font-size: $sl-font-md;
  color: $sl-text-secondary;
}

.drawer {
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius-lg $sl-border-radius-lg 0 0;
  padding: $sl-spacing-sm $sl-spacing-md;
}

.drawer-handle {
  width: 60rpx;
  height: 8rpx;
  background-color: $sl-border-color;
  border-radius: 4rpx;
  margin: 0 auto $sl-spacing-sm;
}

.drawer-title {
  font-size: $sl-font-lg;
  font-weight: 600;
  color: $sl-text-primary;
  margin-bottom: $sl-spacing-sm;
}
</style>
