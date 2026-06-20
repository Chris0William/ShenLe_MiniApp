<script setup lang="ts">
// 统一的「当前位置 / 距离参考点」卡片，地图页与房源页共用，避免两套实现漂移。
defineProps<{
  /** 是否正在定位中 */
  locating?: boolean
  /** 位置文案（如逆地理地址，未定位时为空） */
  label?: string
}>()
defineEmits<{
  /** 点击卡片或「选点」时触发，由页面打开地图选点 */
  (e: 'choose'): void
}>()
</script>

<template>
  <view class="location-card sl-card" @tap="$emit('choose')">
    <view class="location-card__main">
      <wd-icon name="location" size="18px" color="#126b4f" />
      <view>
        <text class="location-card__label">当前位置 / 距离参考点</text>
        <text class="location-card__value">{{ locating ? '定位中...' : (label || '点击选择参考点') }}</text>
      </view>
    </view>
    <view class="location-card__actions">
      <text class="location-card__action">选点</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.location-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 18rpx 20rpx;
}

.location-card__main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 14rpx;
}

.location-card__label,
.location-card__value {
  display: block;
}

.location-card__label {
  color: var(--sl-muted);
  font-size: 22rpx;
}

.location-card__value {
  max-width: 460rpx;
  overflow: hidden;
  margin-top: 4rpx;
  color: var(--sl-ink);
  font-size: 27rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.location-card__actions {
  display: flex;
  flex-shrink: 0;
  gap: 14rpx;
}

.location-card__action {
  flex-shrink: 0;
  color: var(--sl-brand);
  font-size: 24rpx;
  font-weight: 850;
}
</style>
