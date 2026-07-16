<script setup lang="ts">
import type { SlCommunityOutput } from '@/types/shenle'
import { computed } from 'vue'
import { formatSupplyTime } from '@/utils/supply-activity'

const props = withDefaults(defineProps<{
  community?: SlCommunityOutput | null
}>(), {
  community: null,
})

const updaterName = computed(() => String(props.community?.lastUpdaterName || '').trim())
const ownerName = computed(() => String(props.community?.ownerName || '').trim())
const ownerPhone = computed(() => String(props.community?.ownerPhone || '').trim())
const updateTime = computed(() => formatSupplyTime(props.community?.supplyUpdateTime))
const hasContent = computed(() => !!(updaterName.value || ownerName.value || ownerPhone.value))

function callOwnerPhone() {
  if (!ownerPhone.value)
    return
  uni.makePhoneCall({ phoneNumber: ownerPhone.value })
}
</script>

<template>
  <view v-if="hasContent" class="supply-contacts">
    <wd-icon name="info-circle" size="16px" color="#126b4f" />
    <view class="supply-contacts__line">
      <text v-if="updaterName" class="supply-contacts__item">
        <text class="supply-contacts__label">更新人</text>
        {{ updaterName }}<text v-if="updateTime" class="supply-contacts__time"> · {{ updateTime }}</text>
      </text>
      <text v-if="updaterName && (ownerName || ownerPhone)" class="supply-contacts__divider">|</text>
      <text v-if="ownerName || ownerPhone" class="supply-contacts__item">
        <text class="supply-contacts__label">对接人</text>
        {{ ownerName || '未填写' }}
      </text>
    </view>
    <view v-if="ownerPhone" class="supply-contacts__call" @tap.stop="callOwnerPhone">
      <wd-icon name="call" size="14px" color="#126b4f" />
      <text>{{ ownerPhone }}</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.supply-contacts {
  display: flex;
  min-width: 0;
  min-height: 64rpx;
  align-items: center;
  gap: 10rpx;
  box-sizing: border-box;
  padding: 0 16rpx;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 8rpx;
  background: #f0f7f2;
}

.supply-contacts__line {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 8rpx;
  overflow: hidden;
  color: #52635b;
  font-size: 21rpx;
  white-space: nowrap;
}

.supply-contacts__item {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.supply-contacts__label {
  margin-right: 6rpx;
  color: #126b4f;
  font-weight: 800;
}

.supply-contacts__time,
.supply-contacts__divider {
  color: #829087;
}

.supply-contacts__call {
  display: flex;
  height: 46rpx;
  flex: 0 0 auto;
  align-items: center;
  gap: 6rpx;
  padding: 0 10rpx;
  border: 1rpx solid rgb(18 107 79 / 18%);
  border-radius: 6rpx;
  background: #fff;
  color: #126b4f;
  font-size: 20rpx;
  font-weight: 800;
}
</style>
