<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getAgreement } from '@/constants/agreements'

const agreementType = ref('privacy')
const agreement = computed(() => getAgreement(agreementType.value))

onLoad((query) => {
  agreementType.value = query?.type === 'service' ? 'service' : 'privacy'
})
</script>

<template>
  <view class="sl-page agreement-page">
    <view class="agreement-card sl-card">
      <text class="agreement-title">{{ agreement.title }}</text>
      <text class="agreement-date">更新日期：{{ agreement.updatedAt }}</text>
      <view class="agreement-body">
        <text v-for="(item, index) in agreement.paragraphs" :key="index" class="agreement-p">
          {{ index + 1 }}. {{ item }}
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.agreement-page {
  min-height: 100vh;
  padding-bottom: 56rpx;
}

.agreement-card {
  margin-top: 20rpx;
  padding: 34rpx 30rpx;
}

.agreement-title {
  display: block;
  color: var(--sl-ink);
  font-size: 38rpx;
  font-weight: 900;
}

.agreement-date {
  display: block;
  margin-top: 12rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.agreement-body {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  margin-top: 30rpx;
}

.agreement-p {
  color: #405248;
  font-size: 27rpx;
  line-height: 1.75;
}
</style>
