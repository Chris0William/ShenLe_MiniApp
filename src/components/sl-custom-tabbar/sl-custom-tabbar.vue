<script setup lang="ts">
import { computed, inject } from 'vue'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  current: number
  /** Shell 页自身的 tabbar 设为 true，始终可见 */
  visible?: boolean
}>()

const emit = defineEmits<{ change: [index: number] }>()

const appStore = useAppStore()

// Shell 通过 provide('sl-hide-tabbar', true) 隐藏嵌套页面的 tabbar
const hideTabbar = inject<boolean>('sl-hide-tabbar', false)
const shouldShow = computed(() => props.visible ?? !hideTabbar)

interface TabItem {
  text: string
  icon: string
  iconActive: string
}

const userTabs: TabItem[] = [
  { text: '找房', icon: '🏠', iconActive: '🏠' },
  { text: '地图', icon: '🗺', iconActive: '🗺' },
  { text: '我的', icon: '👤', iconActive: '👤' },
]

const adminTabs: TabItem[] = [
  { text: '工作台', icon: '📊', iconActive: '📊' },
  { text: '房源', icon: '🏘', iconActive: '🏘' },
  { text: '销控', icon: '📋', iconActive: '📋' },
  { text: '我的', icon: '👤', iconActive: '👤' },
]

const tabs = computed(() => appStore.mode === 'admin' ? adminTabs : userTabs)

function onTabTap(index: number) {
  if (index === props.current) return
  emit('change', index)
}
</script>

<template>
  <template v-if="shouldShow">
    <view class="tabbar">
      <view
        v-for="(tab, index) in tabs"
        :key="tab.text"
        class="tabbar-item"
        :class="{ active: index === current }"
        @tap="onTabTap(index)"
      >
        <text class="tabbar-icon">{{ index === current ? tab.iconActive : tab.icon }}</text>
        <text class="tabbar-text">{{ tab.text }}</text>
      </view>
    </view>
    <!-- 占位，防止页面内容被遮挡 -->
    <view class="tabbar-placeholder" />
  </template>
</template>

<style lang="scss" scoped>
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: 12rpx 0;
  padding-bottom: calc(12rpx + $sl-safe-bottom);
  background-color: $sl-bg-card;
  border-top: 1rpx solid $sl-border-color;
  z-index: 999;
}

.tabbar-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}

.tabbar-icon {
  font-size: 40rpx;
  line-height: 1;
}

.tabbar-text {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

.tabbar-item.active .tabbar-text {
  color: $sl-primary;
  font-weight: 600;
}

.tabbar-placeholder {
  height: calc(#{$sl-tabbar-height} + #{$sl-safe-bottom});
}
</style>
