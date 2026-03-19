<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ status: number }>()

const statusMap: Record<number, { name: string; color: string; bg: string }> = {
  0: { name: '空置', color: '#22C55E', bg: '#F0FDF4' },
  1: { name: '预定', color: '#F97316', bg: '#FFF7ED' },
  2: { name: '已租', color: '#9CA3AF', bg: '#F3F4F6' },
}

const info = computed(() => statusMap[props.status] || statusMap[0])
</script>

<template>
  <view class="badge" :style="{ color: info.color, backgroundColor: info.bg }">
    {{ info.name }}
  </view>
</template>

<style lang="scss" scoped>
.badge {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: $sl-font-xs;
  font-weight: 500;
  line-height: 1.4;
}
</style>
