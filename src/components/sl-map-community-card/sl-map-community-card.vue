<script setup lang="ts">
import type { SlCommunityOutput } from '@/types/shenle'
import { computed } from 'vue'
import SlPetPolicyText from '@/components/sl-pet-policy-text/sl-pet-policy-text.vue'

/**
 * 业务员/管理端地图楼盘卡片（master .map-card 紧凑信息版式）。
 * 游客扫码态由 guestMode 控制脱敏：租金 ???、佣金块隐藏、公告 ???。
 */
const props = defineProps<{
  community: SlCommunityOutput
  /** 访客视角（扫码临时授权态）：隐藏敏感字段 */
  guestMode?: boolean
  /** 业务员视角：显示可租套数而非总套数 */
  availableOnly?: boolean
  /** 允许设置火热等级（超管） */
  canSetHotLevel?: boolean
  /** 允许编辑楼盘（管理端） */
  canManage?: boolean
  /** 火热等级保存中 */
  hotLevelSaving?: boolean
}>()

const emit = defineEmits<{
  close: []
  /** 点击卡片主体 */
  open: [community: SlCommunityOutput]
  /** 查看房源列表 */
  enter: [community: SlCommunityOutput]
  /** 导航 */
  navigate: [community: SlCommunityOutput]
  /** 公告 */
  announcement: [community: SlCommunityOutput]
  /** 设置火热等级 */
  setHotLevel: [community: SlCommunityOutput]
  /** 编辑楼盘 */
  edit: [community: SlCommunityOutput]
}>()

const rentLabel = computed(() => {
  const c = props.community
  if (c.rentMasked)
    return '???'
  const min = Number(c.minRentPrice)
  const max = Number(c.maxRentPrice)
  if (min > 0 && max > 0 && max !== min)
    return `¥${min}-${max}/月`
  if (min > 0)
    return `¥${min}/月起`
  return ''
})

const countLabel = computed(() => {
  const c = props.community
  const count = props.availableOnly ? (c.availableCount ?? 0) : (c.propertyCount ?? 0)
  return props.availableOnly ? `${count} 套可租房源` : `${count} 套房源`
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
  if (c.commissionMasked)
    return '???'
  return `半年 ${commissionRangeLabel(c.lowestHalfYearCommissionPercent, c.highestHalfYearCommissionPercent)} · 一年 ${commissionRangeLabel(c.lowestOneYearCommissionPercent, c.highestOneYearCommissionPercent)}`
})

/** 楼盘属性标签：电梯/楼梯 + 宠物；电梯未设置默认视为电梯 */
const elevatorTag = computed(() => props.community.elevatorMode === 2 ? '楼梯' : '电梯')

function hotLevelCount(level?: number | null, expireTime?: string | null) {
  if (expireTime && new Date(expireTime).getTime() <= Date.now())
    return 0
  return Math.max(0, Math.min(5, Number(level) || 0))
}

function hotExpireText(expireTime?: string | null) {
  if (!expireTime)
    return '长期有效'
  const date = new Date(expireTime)
  if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now())
    return '已到期'
  return `到期 ${date.getMonth() + 1}月${date.getDate()}日`
}

const updateTimeText = computed(() => {
  const time = props.community.supplyUpdateTime
  if (!time)
    return '暂无更新记录'
  return time.slice(0, 16).replace('T', ' ')
})

const distanceLabel = computed(() => {
  const distance = props.community.distance
  if (distance === null || distance === undefined)
    return ''
  return distance < 1 ? `距 ${Math.round(distance * 1000)}m` : `距 ${distance}km`
})
</script>

<template>
  <view class="bmapcard">
    <view class="bmapcard__main" @tap="emit('open', community)">
      <view class="bmapcard__title-row">
        <text class="bmapcard__name">{{ community.name }}</text>
        <view v-if="hotLevelCount(community.hotLevel, community.hotExpireTime)" class="bmapcard__hot">
          <view v-for="level in hotLevelCount(community.hotLevel, community.hotExpireTime)" :key="level" class="i-carbon-fire bmapcard__hot-icon" />
        </view>
      </view>
      <view class="bmapcard__meta">
        <wd-tag v-if="community.regionName" plain type="success">
          {{ community.regionName }}
        </wd-tag>
        <text>{{ countLabel }}</text>
        <text v-if="rentLabel">{{ rentLabel }}</text>
        <text v-if="distanceLabel">{{ distanceLabel }}</text>
      </view>

      <view class="bmapcard__attr-tags">
        <view class="attr-tag">
          <text>{{ elevatorTag }}</text>
        </view>
        <SlPetPolicyText v-if="community.petPolicy" :value="community.petPolicy" class="attr-tag attr-tag--pet" />
      </view>

      <view class="bmapcard__fees">
        <text>水 {{ feeText(community.waterFee, '元/吨') }}</text>
        <text>电 {{ feeText(community.electricityFee, '元/度') }}</text>
        <text>管理 {{ feeText(community.managementFee) }}</text>
        <text>网络 {{ feeText(community.networkFee) }}</text>
      </view>

      <view v-if="!guestMode" class="bmapcard__commission">
        <view class="bmapcard__commission-main">
          <text>佣金条件</text>
          <text>{{ commissionLabel }}</text>
        </view>
        <text class="bmapcard__time">更新 {{ updateTimeText }}</text>
      </view>
      <text v-else class="bmapcard__time bmapcard__time--solo">更新 {{ updateTimeText }}</text>
    </view>

    <view class="bmapcard__close" aria-label="关闭" @tap.stop="emit('close')">
      <wd-icon name="close" size="16px" color="#9aa3af" />
    </view>

    <view class="bmapcard__actions">
      <wd-button
        v-if="!guestMode && community.announcement && !community.announcementMasked"
        class="bmapcard__announcement"
        size="small"
        plain
        icon="notification"
        @click.stop="emit('announcement', community)"
      >
        公告
      </wd-button>
      <wd-button
        v-if="canSetHotLevel && community.hasLandlord"
        size="small"
        plain
        :loading="hotLevelSaving"
        @click.stop="emit('setHotLevel', community)"
      >
        火热 {{ hotLevelCount(community.hotLevel, community.hotExpireTime) || '未设' }}
        <text v-if="hotLevelCount(community.hotLevel, community.hotExpireTime)"> · {{ hotExpireText(community.hotExpireTime) }}</text>
      </wd-button>
      <wd-button v-if="canManage" size="small" plain @click.stop="emit('edit', community)">
        编辑楼盘
      </wd-button>
      <wd-button size="small" plain @click.stop="emit('navigate', community)">
        导航
      </wd-button>
      <wd-button size="small" type="primary" @click.stop="emit('enter', community)">
        查看房源
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.bmapcard {
  position: relative;
  padding: 22rpx 24rpx;
  border: 1rpx solid rgb(18 107 79 / 12%);
  border-radius: 22rpx;
  background: rgb(255 255 255 / 96%);
  box-shadow: 0 10rpx 36rpx rgb(31 51 41 / 16%);
}

.bmapcard__main {
  min-width: 0;
}

.bmapcard__title-row {
  display: flex;
  min-width: 0;
  padding-right: 48rpx;
  align-items: center;
  gap: 12rpx;
}

.bmapcard__name {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 30rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bmapcard__hot {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 1rpx;
}

.bmapcard__hot-icon {
  width: 24rpx;
  height: 24rpx;
  color: #d46d12;
}

.bmapcard__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 14rpx;
  margin-top: 12rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.bmapcard__attr-tags {
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

.bmapcard__fees {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6rpx 14rpx;
  margin-top: 12rpx;
  color: #53635c;
  font-size: 20rpx;
}

.bmapcard__fees text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bmapcard__commission {
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

.bmapcard__commission-main {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 10rpx;
}

.bmapcard__commission-main text:last-child {
  min-width: 0;
  flex: 1;
  line-height: 1.45;
}

.bmapcard__time {
  overflow: hidden;
  min-width: 0;
  color: #88958f;
  font-size: 19rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bmapcard__time--solo {
  display: block;
  margin-top: 10rpx;
}

.bmapcard__close {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  display: flex;
  width: 48rpx;
  height: 48rpx;
  align-items: center;
  justify-content: center;
}

.bmapcard__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 14rpx;
  margin-top: 18rpx;
}

.bmapcard__announcement {
  min-width: 138rpx;
  margin-right: auto;
}
</style>
