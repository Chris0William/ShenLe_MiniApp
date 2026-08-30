<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

definePage({
  style: {
    navigationStyle: 'custom',
    disableScroll: true,
  },
})

onLoad(() => {
  uni.reLaunch({ url: '/pages/user/map/index' })
})
</script>

<template>
  <view class="legacy-entry" />
</template>

<style scoped lang="scss">
.legacy-entry {
  min-height: 100vh;
  background: #f4f7f2;
}
</style>
