<script setup lang="ts">
import type { SlSourceContactCommunityOutput } from '@/types/shenle'
import { computed } from 'vue'
import { resolveAssetUrl } from '@/utils/shenle'
import SlPetPolicyText from '@/components/sl-pet-policy-text/sl-pet-policy-text.vue'

/**
 * 房东端地图楼盘卡片（master .landlord-community-preview 带封面版式）。
 * 定位容器由宿主（地图页 .map-card）提供，本组件只负责内容布局。
 */
const props = defineProps<{
  community: SlSourceContactCommunityOutput
}>()

const emit = defineEmits<{
  close: []
  /** 查看楼盘（进入楼盘信息） */
  enter: [community: SlSourceContactCommunityOutput]
  /** 导航 */
  navigate: [community: SlSourceContactCommunityOutput]
}>()

const VIDEO_SUFFIXES = ['.mp4', '.mov', '.m4v', '.avi', '.webm']

const coverUrl = computed(() => {
  const item = props.community
  const isVideo = item.coverFileType?.startsWith('video')
    || VIDEO_SUFFIXES.includes((item.coverSuffix || '').toLowerCase())
  return isVideo ? (item.coverPosterUrl || '') : (item.coverImage || '')
})

const rentLabel = computed(() => {
  const item = props.community
  const min = Number(item.minRentPrice || 0)
  const max = Number(item.maxRentPrice || 0)
  if (min > 0 && max > 0 && max !== min)
    return `¥${min}-${max}/月`
  if (min > 0)
    return `¥${min}/月起`
  return '租金待完善'
})

const feeText = (value?: number | null, unit = '元') =>
  value === null || value === undefined ? '未设置' : `${value}${unit}`

function commissionRangeLabel(low?: number | null, high?: number | null) {
  if (low == null && high == null)
    return '未设置'
  if (low != null && high != null && low !== high)
    return `${low}%-${high}%`
  return `${low ?? high}%`
}

const commissionLabel = computed(() => {
  const c = props.community
  return `半年 ${commissionRangeLabel(c.lowestHalfYearCommissionPercent, c.highestHalfYearCommissionPercent)} · 一年 ${commissionRangeLabel(c.lowestOneYearCommissionPercent, c.highestOneYearCommissionPercent)}`
})

/** 楼盘属性标签：电梯/楼梯 + 宠物；电梯未设置默认视为电梯 */
const elevatorTag = computed(() => props.community.elevatorMode === 2 ? '楼梯' : '电梯')

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
  <view class="lcard">
    <view class="lcard__media">
      <image v-if="coverUrl" class="lcard__image" :src="resolveAssetUrl(coverUrl)" mode="aspectFill" />
      <view v-else class="lcard__placeholder">
        <wd-icon name="home" size="30px" color="#126b4f" />
      </view>
      <view v-if="community.promotedCount" class="lcard__promotion-mark">
        推广 {{ community.promotedCount }} 套
      </view>
    </view>

    <view class="lcard__body">
      <view class="lcard__head">
        <text class="lcard__name">{{ community.name }}</text>
        <view class="lcard__close" aria-label="关闭" @tap.stop="emit('close')">
          <wd-icon name="close" size="16px" color="#7a8780" />
        </view>
      </view>

      <text class="lcard__rent">{{ rentLabel }}</text>

      <view class="lcard__attr-tags">
        <view class="attr-tag">
          <text>{{ elevatorTag }}</text>
        </view>
        <SlPetPolicyText v-if="community.petPolicy" :value="community.petPolicy" class="attr-tag attr-tag--pet" />
      </view>

      <view class="lcard__fees">
        <text class="lcard__fee">水 {{ feeText(community.waterFee, '元/吨') }}</text>
        <text class="lcard__fee">电 {{ feeText(community.electricityFee, '元/度') }}</text>
        <text class="lcard__fee">管理 {{ feeText(community.managementFee) }}</text>
        <text class="lcard__fee">网络 {{ feeText(community.networkFee) }}</text>
      </view>

      <view class="lcard__commission">
        <view class="lcard__commission-main">
          <text>佣金条件</text>
          <text>{{ commissionLabel }}</text>
        </view>
      </view>

      <text class="lcard__meta">{{ metaText }}</text>

      <view class="lcard__foot">
        <text class="lcard__time">更新 {{ updateTimeText }}</text>
        <wd-button size="small" plain @click.stop="emit('navigate', community)">
          导航
        </wd-button>
        <wd-button type="primary" size="small" @click.stop="emit('enter', community)">
          查看楼盘
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.lcard {
  position: absolute;
  inset: 0;
  display: flex;
  overflow: hidden;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 22rpx;
  background: rgb(255 255 255 / 97%);
  box-shadow: 0 10rpx 36rpx rgb(31 51 41 / 16%);
}

.lcard__media {
  position: relative;
  width: 184rpx;
  flex: 0 0 184rpx;
}

.lcard__image {
  width: 100%;
  height: 100%;
}

.lcard__placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: #edf5ef;
}

.lcard__promotion-mark {
  position: absolute;
  bottom: 10rpx;
  left: 10rpx;
  padding: 4rpx 12rpx;
  border-radius: 8rpx;
  background: rgb(18 107 79 / 85%);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}

.lcard__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  padding: 20rpx 22rpx;
}

.lcard__head {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12rpx;
}

.lcard__name {
  min-width: 0;
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 30rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lcard__close {
  display: flex;
  width: 48rpx;
  height: 48rpx;
  flex: 0 0 48rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #f2f6f3;
}

.lcard__rent {
  margin-top: 8rpx;
  color: #126b4f;
  font-size: 28rpx;
  font-weight: 800;
}

.lcard__attr-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 10rpx;
}

.attr-tag {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 14rpx;
  border: 1rpx solid rgb(18 107 79 / 22%);
  border-radius: 999rpx;
  background: #f2f8f4;
  color: #126b4f;
  font-size: 20rpx;
  font-weight: 700;
  line-height: 1.4;
}

.lcard__fees {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 20rpx;
  margin-top: 10rpx;
}

.lcard__fee {
  color: #72817b;
  font-size: 21rpx;
}

.lcard__commission {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 8rpx;
  padding-top: 8rpx;
  border-top: 1rpx solid #edf1ee;
  color: #52635b;
  font-size: 19rpx;
}

.lcard__commission-main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 10rpx;
}

.lcard__commission-main text:last-child {
  min-width: 0;
  flex: 1;
  line-height: 1.45;
}

.lcard__meta {
  margin-top: 10rpx;
  color: #72817b;
  font-size: 22rpx;
}

.lcard__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14rpx;
  margin-top: auto;
  padding-top: 12rpx;
}

.lcard__time {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  color: #8a9791;
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
