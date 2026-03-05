<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'

onLoad(() => {
  const appStore = useAppStore()
  const userStore = useUserStore()
  userStore.loadFromStorage()
  appStore.loadMode()
  uni.reLaunch({ url: '/pages/shell/index' })
})
</script>

<template>
  <view class="page">
    <view class="loading">加载中...</view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.loading {
  font-size: $sl-font-md;
  color: $sl-text-placeholder;
}
</style>
