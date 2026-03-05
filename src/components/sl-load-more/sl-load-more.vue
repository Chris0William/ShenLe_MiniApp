<script setup lang="ts">
defineProps<{ status: 'loading' | 'noMore' | 'more' }>()
</script>

<template>
  <view class="load-more">
    <text v-if="status === 'loading'" class="text">加载中...</text>
    <text v-else-if="status === 'noMore'" class="text">没有更多了</text>
    <text v-else class="text">上拉加载更多</text>
  </view>
</template>

<style lang="scss" scoped>
.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $sl-spacing-lg 0;
}

.text {
  font-size: $sl-font-sm;
  color: $sl-text-placeholder;
}
</style>
