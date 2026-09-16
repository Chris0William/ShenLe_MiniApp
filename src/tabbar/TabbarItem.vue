<script setup lang="ts">
import type { CustomTabBarItem } from './types'
import { tabbarStore } from './store'

defineProps<{
  item: CustomTabBarItem
  index: number
  isBulge?: boolean
}>()

function getImageByIndex(index: number, item: CustomTabBarItem) {
  if (!item.iconActive) {
    console.warn('image 模式下，需要配置 iconActive (高亮时的图片），否则无法切换高亮图片')
    return item.icon
  }
  return tabbarStore.curIdx === index ? item.iconActive : item.icon
}
</script>

<template>
  <view class="tabbar-item">
    <template v-if="item.iconType === 'uiLib'">
      <view class="tabbar-item__icon" :class="{ 'tabbar-item__icon--active': tabbarStore.curIdx === index }">
        <wd-icon :name="item.icon" :size="isBulge ? '80px' : '22px'" />
      </view>
    </template>
    <template v-else-if="item.iconType === 'unocss' || item.iconType === 'iconfont'">
      <view class="tabbar-item__icon" :class="{ 'tabbar-item__icon--active': tabbarStore.curIdx === index }">
        <view :class="[item.icon, isBulge ? 'text-80px' : 'text-20px']" />
      </view>
    </template>
    <template v-else-if="item.iconType === 'image'">
      <image :src="getImageByIndex(index, item)" mode="scaleToFill" :class="isBulge ? 'h-80px w-80px' : 'h-24px w-24px'" />
    </template>
    <view v-if="!isBulge" class="tabbar-item__text">
      {{ item.text }}
    </view>
    <!-- 角标显示 -->
    <view v-if="item.badge">
      <template v-if="item.badge === 'dot'">
        <view class="absolute right-0 top-0 h-2 w-2 rounded-full bg-#f56c6c" />
      </template>
      <template v-else>
        <view class="absolute top-0 box-border h-5 min-w-5 center rounded-full bg-#f56c6c px-1 text-center text-xs text-white -right-3">
          {{ item.badge > 99 ? '99+' : item.badge }}
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.tabbar-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.tabbar-item__icon {
  transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tabbar-item__icon--active {
  animation: tab-icon-bounce 0.32s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes tab-icon-bounce {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.18);
  }
  100% {
    transform: scale(1);
  }
}

.tabbar-item__text {
  margin-top: 3rpx;
  font-size: 22rpx;
  font-weight: 750;
  line-height: 1;
}
</style>
