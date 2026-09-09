<script setup lang="ts">
import { computed } from 'vue'
import { useSourceContactStore } from '@/store/source-contact'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  back?: boolean
  showSupport?: boolean
  refresh?: boolean
  refreshing?: boolean
}>(), {
  subtitle: '',
  back: false,
  showSupport: true,
  refresh: false,
  refreshing: false,
})

const emit = defineEmits<{
  back: []
  refresh: []
}>()

const sourceContact = useSourceContactStore()
const supportText = computed(() => {
  const profile = sourceContact.profile
  if (!profile?.supportUserName)
    return '主维护人暂未分配'
  return `主维护人：${profile.supportUserName}`
})

function callSupport() {
  const phone = sourceContact.profile?.supportUserPhone
  if (!phone) {
    uni.showToast({ title: '维护人暂未设置联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: phone })
}
</script>

<template>
  <view class="source-head">
    <view class="source-head__bar">
      <view v-if="props.back" class="source-head__icon" @tap="emit('back')">
        <wd-icon name="arrow-left" size="21px" color="#126b4f" />
      </view>
      <view class="source-head__text">
        <text class="source-head__title">{{ props.title }}</text>
        <text v-if="props.subtitle" class="source-head__subtitle">{{ props.subtitle }}</text>
      </view>
      <view v-if="props.refresh" class="source-head__icon" aria-label="刷新" @tap="emit('refresh')">
        <wd-icon name="refresh" size="20px" color="#126b4f" :class="{ 'source-head__refresh--loading': props.refreshing }" />
      </view>
      <view v-else-if="props.back" class="source-head__spacer" />
    </view>

    <view v-if="props.showSupport" class="support-line" @tap="callSupport">
      <view class="support-line__main">
        <wd-icon name="service" size="16px" color="#126b4f" />
        <text>{{ supportText }}</text>
        <text v-if="sourceContact.profile?.supportUserPhone" class="support-line__phone">
          {{ sourceContact.profile.supportUserPhone }}
        </text>
      </view>
      <wd-icon v-if="sourceContact.profile?.supportUserPhone" name="phone" size="17px" color="#126b4f" />
    </view>
  </view>
</template>

<style scoped lang="scss">
.source-head {
  flex: none;
}

.source-head__bar {
  display: flex;
  min-height: 76rpx;
  align-items: center;
  gap: 16rpx;
}

.source-head__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
}

.source-head__title {
  overflow: hidden;
  color: #1e2f27;
  font-size: 36rpx;
  font-weight: 800;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-head__subtitle {
  margin-top: 5rpx;
  overflow: hidden;
  color: #72817b;
  font-size: 23rpx;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.source-head__icon,
.source-head__spacer {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgb(18 107 79 / 14%);
  border-radius: 8rpx;
  background: #fff;
}

.source-head__refresh--loading {
  animation: source-head-spin 0.8s linear infinite;
}

@keyframes source-head-spin {
  to {
    transform: rotate(360deg);
  }
}

.source-head__spacer {
  border-color: transparent;
  background: transparent;
}

.support-line {
  display: flex;
  min-height: 58rpx;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
  padding: 0 20rpx;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 8rpx;
  background: rgb(255 255 255 / 82%);
  color: #53635c;
  font-size: 23rpx;
}

.support-line__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10rpx;
}

.support-line__phone {
  color: #126b4f;
  font-weight: 700;
}
</style>
