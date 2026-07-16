<script setup lang="ts">
import type { SlCommunityOutput } from '@/types/shenle'
import { computed } from 'vue'
import { formatSupplyTime } from '@/utils/supply-activity'

const props = withDefaults(defineProps<{
  community?: SlCommunityOutput | null
  title?: string
}>(), {
  community: null,
  title: '盘源联系人',
})

const rows = computed(() => {
  const community = props.community
  if (!community)
    return []
  return [
    {
      key: 'updater',
      label: '盘源更新人',
      name: community.lastUpdaterName,
      phone: community.lastUpdaterPhone,
      meta: formatSupplyTime(community.supplyUpdateTime),
      icon: 'edit',
    },
    {
      key: 'owner',
      label: '盘源对接人',
      name: community.ownerName,
      phone: community.ownerPhone,
      meta: '',
      icon: 'user',
    },
  ].filter(item => item.name || item.phone)
})

function callPhone(phone?: string | null) {
  const phoneNumber = String(phone || '').trim()
  if (!phoneNumber)
    return
  uni.makePhoneCall({ phoneNumber })
}
</script>

<template>
  <view v-if="rows.length" class="supply-contacts">
    <text v-if="title" class="supply-contacts__title">{{ title }}</text>
    <view class="supply-contacts__list">
      <view v-for="row in rows" :key="row.key" class="supply-contact">
        <view class="supply-contact__icon">
          <wd-icon :name="row.icon" size="18px" color="#126b4f" />
        </view>
        <view class="supply-contact__body">
          <text class="supply-contact__label">{{ row.label }}</text>
          <text class="supply-contact__name">{{ row.name || '未填写姓名' }}</text>
          <text v-if="row.meta" class="supply-contact__meta">最后更新 {{ row.meta }}</text>
        </view>
        <view v-if="row.phone" class="supply-contact__call" @tap.stop="callPhone(row.phone)">
          <wd-icon name="call" size="17px" color="#126b4f" />
          <text>{{ row.phone }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.supply-contacts__title {
  display: block;
  margin-bottom: 16rpx;
  color: var(--sl-ink);
  font-size: 28rpx;
  font-weight: 850;
}

.supply-contacts__list {
  display: flex;
  flex-direction: column;
}

.supply-contact {
  display: grid;
  grid-template-columns: 56rpx minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--sl-line);
}

.supply-contact:first-child {
  padding-top: 0;
}

.supply-contact:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.supply-contact__icon {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #edf7f1;
}

.supply-contact__body {
  min-width: 0;
}

.supply-contact__label,
.supply-contact__name,
.supply-contact__meta {
  display: block;
}

.supply-contact__label {
  color: var(--sl-muted);
  font-size: 21rpx;
}

.supply-contact__name {
  margin-top: 4rpx;
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 26rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.supply-contact__meta {
  margin-top: 4rpx;
  color: #7a8780;
  font-size: 20rpx;
}

.supply-contact__call {
  display: flex;
  min-height: 58rpx;
  align-items: center;
  gap: 8rpx;
  padding: 0 14rpx;
  border: 1rpx solid rgb(18 107 79 / 18%);
  border-radius: 8rpx;
  background: #f5faf6;
  color: #126b4f;
  font-size: 22rpx;
  font-weight: 800;
}
</style>
