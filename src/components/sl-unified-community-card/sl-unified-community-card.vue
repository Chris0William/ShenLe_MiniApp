<script setup lang="ts">
import type { SlCommunityOutput } from '@/types/shenle'
import { computed } from 'vue'
import SlPetPolicyText from '@/components/sl-pet-policy-text/sl-pet-policy-text.vue'

/**
 * 统一楼盘地图卡片（以房东端样式为基准）。
 * 业务员端 / 房东端共用；游客差异由 props 控制（租金 ???、佣金恒隐、公告 ???）。
 */
const props = defineProps<{
  community: SlCommunityOutput
  /** 访客视角（业务员端游客扫码态）：隐藏敏感字段 */
  guestMode?: boolean
  /** 是否展示距离 */
  showDistance?: boolean
}>()

const emit = defineEmits<{
  close: []
  /** 点击卡片主体 */
  open: [community: SlCommunityOutput]
  /** 查看楼盘/房源列表 */
  enter: [community: SlCommunityOutput]
  /** 导航 */
  navigate: [community: SlCommunityOutput]
  /** 公告 */
  announcement: [community: SlCommunityOutput]
}>()

const coverUrl = computed(() => props.community.coverImage)
const isVideoCover = computed(() => props.community.coverFileType?.startsWith('video'))

const rentText = computed(() => {
  const c = props.community
  if (c.rentMasked)
    return '???'
  const min = Number(c.minRentPrice)
  const max = Number(c.maxRentPrice)
  if (min > 0 && max > 0 && max !== min)
    return `¥${min}-${max}/月`
  if (min > 0)
    return `¥${min}/月起`
  return '租金待完善'
})

const feeText = (value?: number | null, unit = '元') =>
  value === null || value === undefined ? '未设置' : `${value}${unit}`

const commissionText = computed(() => {
  const c = props.community
  if (c.commissionMasked)
    return '???'
  const fmt = (low?: number | null, high?: number | null) => {
    if (low == null && high == null)
      return '未设置'
    if (low != null && high != null && low !== high)
      return `${low}%-${high}%`
    return `${low ?? high}%`
  }
  return `半年 ${fmt(c.lowestHalfYearCommissionPercent, c.highestHalfYearCommissionPercent)} · 一年 ${fmt(c.lowestOneYearCommissionPercent, c.highestOneYearCommissionPercent)}`
})

const metaText = computed(() => {
  const c = props.community
  return `${c.buildingCount ?? '-'} 栋 · ${c.availableCount ?? 0} 套可用 · ${c.rentedCount ?? 0} 套已租`
})

const updateTimeText = computed(() => {
  const time = props.community.supplyUpdateTime
  if (!time)
    return '暂无更新记录'
  return time.slice(0, 16).replace('T', ' ')
})
</script>

<template>
  <view class="ucard">
    <view class="ucard__media">
      <image v-if="coverUrl && !isVideoCover" class="ucard__image" :src="coverUrl" mode="aspectFill" />
      <view v-else-if="coverUrl && isVideoCover" class="ucard__video-poster">
        <image class="ucard__image" :src="coverUrl" mode="aspectFill" />
        <view class="ucard__play">
          <wd-icon name="play-circle" size="26px" color="#fff" />
        </view>
      </view>
      <view v-else class="ucard__placeholder">
        <wd-icon name="home" size="30px" color="#126b4f" />
      </view>
    </view>

    <view class="ucard__body">
      <view class="ucard__head">
        <text class="ucard__name">{{ community.name }}</text>
        <view class="ucard__close" @tap.stop="emit('close')">
          <wd-icon name="close" size="16px" color="#7a8780" />
        </view>
      </view>

      <text class="ucard__rent">{{ rentText }}</text>

      <view class="ucard__fees">
        <text class="ucard__fee">水 {{ feeText(community.waterFee, '元/吨') }}</text>
        <text class="ucard__fee">电 {{ feeText(community.electricityFee, '元/度') }}</text>
        <text class="ucard__fee">管理 {{ feeText(community.managementFee) }}</text>
        <text class="ucard__fee">网络 {{ feeText(community.networkFee) }}</text>
      </view>

      <view v-if="!guestMode" class="ucard__commission">
        <view class="ucard__commission-main">
          <text>佣金条件</text>
          <text>{{ commissionText }}</text>
        </view>
        <SlPetPolicyText v-if="community.petPolicy" :value="community.petPolicy" class="ucard__pet" />
      </view>

      <text class="ucard__meta">{{ metaText }}</text>

      <view class="ucard__foot">
        <text class="ucard__time">更新 {{ updateTimeText }}</text>
        <wd-button size="small" plain @click.stop="emit('navigate', community)">
          导航
        </wd-button>
        <wd-button
          v-if="community.announcement && !community.announcementMasked"
          class="ucard__announcement"
          size="small"
          plain
          icon="notification"
          @click.stop="emit('announcement', community)"
        >
          公告
        </wd-button>
        <wd-button type="primary" size="small" @click.stop="emit('enter', community)">
          查看楼盘
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.ucard {
  overflow: hidden;
  display: flex;
  border-radius: 22rpx;
  background: #fff;
  box-shadow: 0 18rpx 44rpx rgb(20 40 30 / 14%);
}

.ucard__media {
  position: relative;
  width: 220rpx;
  flex: 0 0 220rpx;
}

.ucard__image {
  width: 100%;
  height: 100%;
}

.ucard__video-poster {
  position: relative;
  width: 100%;
  height: 100%;
}

.ucard__play {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.ucard__placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: #edf5ef;
}

.ucard__body {
  min-width: 0;
  flex: 1;
  padding: 22rpx 24rpx;
}

.ucard__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.ucard__name {
  overflow: hidden;
  color: #1e2f27;
  font-size: 30rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ucard__close {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  flex: 0 0 48rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #f2f6f3;
}

.ucard__rent {
  display: block;
  margin-top: 10rpx;
  color: #126b4f;
  font-size: 28rpx;
  font-weight: 800;
}

.ucard__fees {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 20rpx;
  margin-top: 10rpx;
}

.ucard__fee {
  color: #72817b;
  font-size: 21rpx;
}

.ucard__commission {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 10rpx;
  padding: 12rpx 16rpx;
  border-radius: 12rpx;
  background: #f7faf5;
}

.ucard__commission-main {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.ucard__commission-main text:first-child {
  color: #72817b;
  font-size: 20rpx;
}

.ucard__commission-main text:last-child {
  color: #1e2f27;
  font-size: 23rpx;
  font-weight: 700;
}

.ucard__meta {
  display: block;
  margin-top: 12rpx;
  color: #72817b;
  font-size: 22rpx;
}

.ucard__foot {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 14rpx;
}

.ucard__time {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: #a3aba4;
  font-size: 20rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
