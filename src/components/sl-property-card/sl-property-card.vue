<script setup lang="ts">
import type { SlPropertyListOutput } from '@/types/property'
import { BASE_URL } from '@/api/http'

defineProps<{
  property: SlPropertyListOutput
  showActions?: boolean
}>()

const emit = defineEmits<{
  tap: [id: number]
}>()

function formatPrice(price: number | null | undefined): string {
  if (price == null || price === 0) return '¥面议'
  return `¥${price.toLocaleString()}/月`
}

function coverSrc(url?: string): string {
  if (!url) return '/static/images/placeholder.png'
  if (url.startsWith('http')) return url
  return `${BASE_URL}/${url}`
}

function isVideo(url?: string): boolean {
  if (!url) return false
  const ext = url.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'mov', 'avi', 'webm', '3gp'].includes(ext)
}
</script>

<template>
  <view class="card" @tap="emit('tap', property.id)">
    <view class="cover-wrap">
      <image
        class="card-cover"
        :src="isVideo(property.coverImage) ? '/static/images/placeholder.png' : coverSrc(property.coverImage)"
        mode="aspectFill"
      />
      <view v-if="isVideo(property.coverImage)" class="play-badge">
        <text class="play-icon">&#x25B6;</text>
      </view>
    </view>
    <view class="card-body">
      <view class="card-title">{{ property.title }}</view>
      <view class="card-info">
        <text v-if="property.communityName">{{ property.communityName }}</text>
        <text v-if="property.floorInfo"> · {{ property.floorInfo }}</text>
      </view>
      <view class="card-meta">
        <text>{{ property.area ?? '-' }}㎡</text>
        <text> · </text>
        <text>{{ property.houseType }}</text>
      </view>
      <view class="card-bottom">
        <text class="card-price">{{ formatPrice(property.rentPrice) }}</text>
        <sl-status-badge :status="property.status" />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.card {
  display: flex;
  gap: $sl-spacing-sm;
  padding: $sl-spacing-md;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  margin-bottom: $sl-spacing-sm;
}

.cover-wrap {
  position: relative;
  width: 220rpx;
  height: 166rpx;
  flex-shrink: 0;
}

.card-cover {
  width: 100%;
  height: 100%;
  border-radius: $sl-border-radius-sm;
  background-color: #f0f0f0;
}

.play-badge {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-icon {
  font-size: 24rpx;
  color: #ffffff;
  margin-left: 4rpx;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  min-width: 0;
}

.card-title {
  font-size: $sl-font-md;
  font-weight: 600;
  color: $sl-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-info, .card-meta {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
}

.card-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.card-price {
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-price;
}
</style>
