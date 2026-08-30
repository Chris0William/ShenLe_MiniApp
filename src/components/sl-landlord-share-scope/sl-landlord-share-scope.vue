<script setup lang="ts">
defineProps<{
  ownerName: string
  communityCount?: number
}>()

const emit = defineEmits<{
  clear: []
}>()
</script>

<template>
  <view class="share-scope" @tap.stop>
    <view class="i-carbon-link share-scope__icon" />
    <text class="share-scope__text">房东盘源：{{ ownerName || '已选房东' }}<text v-if="communityCount"> · {{ communityCount }} 个楼盘</text></text>
    <view class="share-scope__clear" role="button" aria-label="清除房东筛选" @tap.stop="emit('clear')">
      <wd-icon name="close" size="13px" color="#126b4f" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.share-scope {
  display: flex;
  min-width: 0;
  min-height: 58rpx;
  box-sizing: border-box;
  margin-top: 14rpx;
  padding: 0 12rpx 0 16rpx;
  align-items: center;
  gap: 8rpx;
  border: 1rpx solid rgb(18 107 79 / 18%);
  border-radius: 8rpx;
  background: #edf7ef;
}
.share-scope__text {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  color: #126b4f;
  font-size: 22rpx;
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.share-scope__icon {
  width: 15px;
  height: 15px;
  flex: 0 0 15px;
  color: #126b4f;
}
.share-scope__clear {
  display: flex;
  width: 44rpx;
  height: 44rpx;
  flex: 0 0 44rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(18 107 79 / 10%);
}
</style>
