<script setup lang="ts">
defineProps<{ text?: string }>()
</script>

<template>
  <view class="empty">
    <text class="empty-icon">📭</text>
    <text class="empty-text">{{ text || '暂无数据' }}</text>
  </view>
</template>

<style lang="scss" scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 0;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: $sl-spacing-md;
}

.empty-text {
  font-size: $sl-font-md;
  color: $sl-text-placeholder;
}
</style>
