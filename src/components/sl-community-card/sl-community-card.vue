<script setup lang="ts">
import type { SlCommunityOutput } from '@/types/shenle'
import { computed, ref, watch } from 'vue'
import { downloadFile } from '@/api/file'
import { formatMoney, resolveAssetUrl } from '@/utils/shenle'
import { formatSupplyTime } from '@/utils/supply-activity'

const props = defineProps<{
  item: SlCommunityOutput
  compact?: boolean
  showNavigate?: boolean
  availableOnly?: boolean
}>()

// 注意：自定义事件不能叫 tap——mp-weixin 上会被原生 tap 事件遮蔽，handler 收到 TouchEvent 而非 item
const emit = defineEmits<{
  select: [item: SlCommunityOutput]
  navigate: [item: SlCommunityOutput]
  previewVideo: [item: SlCommunityOutput]
}>()

const cover = ref(resolveAssetUrl(props.item.coverImage))
let coverSeq = 0

const IMAGE_SUFFIXES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic']
const VIDEO_SUFFIXES = ['.mp4', '.mov', '.m4v', '.avi', '.webm']

const coverKind = computed(() => mediaKind(props.item.coverFileType, props.item.coverSuffix || props.item.coverImage))

function extensionOf(value?: string | null) {
  const clean = String(value || '').split('?')[0].toLowerCase()
  const index = clean.lastIndexOf('.')
  return index >= 0 ? clean.slice(index) : ''
}

function mediaKind(fileType?: string | null, suffixOrUrl?: string | null) {
  const type = String(fileType || '').toLowerCase()
  const suffix = extensionOf(suffixOrUrl)
  if (type.startsWith('video') || VIDEO_SUFFIXES.includes(suffix))
    return 'video'
  if (type.startsWith('image') || IMAGE_SUFFIXES.includes(suffix))
    return 'image'
  return 'image'
}

function rentRangeText(item: SlCommunityOutput) {
  const min = item.minRentPrice
  const max = item.maxRentPrice
  const hasMin = min !== null && min !== undefined
  const hasMax = max !== null && max !== undefined
  if (!hasMin && !hasMax)
    return '暂无报价'
  if (hasMin && hasMax && min === max)
    return `¥${formatMoney(min)}/月`
  if (hasMin && hasMax)
    return `¥${formatMoney(min)}-${formatMoney(max)}/月`
  if (hasMin)
    return `¥${formatMoney(min)}起/月`
  return `最高 ¥${formatMoney(max ?? 0)}/月`
}

function distanceText(item: SlCommunityOutput) {
  const distance = item.distance
  if (distance === null || distance === undefined)
    return ''
  return distance < 1 ? `${Math.round(distance * 1000)}m` : `${Number(distance).toFixed(distance % 1 === 0 ? 0 : 1)}km`
}

watch(
  () => [
    props.item.coverImageId,
    props.item.coverImage,
    props.item.coverFileType,
    props.item.coverSuffix,
    props.item.coverPosterFileId,
    props.item.coverPosterUrl,
  ],
  async () => {
    const seq = ++coverSeq
    if (coverKind.value === 'video') {
      cover.value = props.item.coverPosterUrl ? resolveAssetUrl(props.item.coverPosterUrl) : ''
      if (!props.item.coverPosterFileId)
        return
      try {
        const localPath = await downloadFile(props.item.coverPosterFileId)
        if (seq === coverSeq)
          cover.value = localPath
      }
      catch {}
      return
    }
    if (!props.item.coverImageId) {
      cover.value = props.item.coverImage ? resolveAssetUrl(props.item.coverImage) : ''
      return
    }
    try {
      const localPath = await downloadFile(props.item.coverImageId)
      if (seq === coverSeq)
        cover.value = localPath
    }
    catch {
      if (seq === coverSeq)
        cover.value = resolveAssetUrl(props.item.coverImage)
    }
  },
  { immediate: true },
)
</script>

<template>
  <view class="community sl-card" :class="{ 'community--compact': compact }" @tap="emit('select', item)">
    <image v-if="coverKind === 'image' && cover" class="community__cover" :src="cover" mode="aspectFill" />
    <view v-else-if="coverKind === 'video'" class="community__cover community__cover--video" @tap.stop="emit('previewVideo', item)">
      <image v-if="cover" class="community__poster" :src="cover" mode="aspectFill" />
      <view class="community__play">
        <wd-icon name="play-circle" size="28px" color="#fff" />
        <text>视频</text>
      </view>
    </view>
    <view v-else class="community__cover community__cover--empty">
      <wd-icon name="image" size="26px" color="#8ea099" />
    </view>

    <view class="community__body">
      <view class="community__top">
        <text class="community__name">{{ item.name }}</text>
        <wd-tag v-if="item.regionName" type="success" plain>
          {{ item.regionName }}
        </wd-tag>
      </view>
      <text class="community__types">{{ item.houseTypes || '暂无户型信息' }}</text>
      <view class="community__meta">
        <text class="community__rent">{{ rentRangeText(item) }}</text>
        <text v-if="distanceText(item)" class="community__distance">距 {{ distanceText(item) }}</text>
      </view>
      <view class="community__bottom">
        <text>{{ availableOnly ? (item.availableCount || 0) : (item.propertyCount || 0) }} 套房源符合要求</text>
        <text v-if="item.address" class="community__address">{{ item.address }}</text>
      </view>
      <view v-if="item.lastUpdaterName || item.ownerName" class="community__people">
        <text v-if="item.lastUpdaterName">更新人：{{ item.lastUpdaterName }}{{ formatSupplyTime(item.supplyUpdateTime) ? ` · ${formatSupplyTime(item.supplyUpdateTime)}` : '' }}</text>
        <text v-if="item.ownerName">对接人：{{ item.ownerName }}</text>
      </view>
    </view>

    <view v-if="showNavigate" class="community__nav" @tap.stop="emit('navigate', item)">
      <wd-icon name="location" size="18px" color="#126b4f" />
      <text>导航</text>
    </view>
    <wd-icon v-else name="arrow-right" size="20px" color="#8a978f" />
  </view>
</template>

<style scoped lang="scss">
.community {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 18rpx;
}

.community__cover {
  width: 166rpx;
  height: 166rpx;
  flex: 0 0 166rpx;
  border-radius: 20rpx;
  background: #edf2eb;
}

.community__cover--video,
.community__cover--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.community__cover--video {
  position: relative;
  overflow: hidden;
  gap: 10rpx;
  background: linear-gradient(135deg, #0f6a4c, #173f34);
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
}

.community__poster {
  width: 100%;
  height: 100%;
}

.community__play {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  background: transparent;
}

.community__body {
  min-width: 0;
  flex: 1;
}

.community__top {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10rpx;
}

.community__name {
  min-width: 0;
  overflow: hidden;
  color: var(--sl-ink);
  font-size: 30rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community__types {
  display: block;
  margin-top: 10rpx;
  overflow: hidden;
  color: var(--sl-muted);
  font-size: 23rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.community__rent {
  color: #c26916;
  font-size: 30rpx;
  font-weight: 900;
}

.community__distance {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #eef5ef;
  color: var(--sl-brand);
  font-size: 22rpx;
  font-weight: 800;
}

.community__bottom {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 10rpx;
  color: #5e6c65;
  font-size: 22rpx;
}

.community__address {
  max-width: 340rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community__people {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 8rpx 16rpx;
  margin-top: 10rpx;
  color: #718078;
  font-size: 21rpx;
}

.community__nav {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  color: var(--sl-brand);
  font-size: 22rpx;
  font-weight: 800;
}

.community--compact {
  padding: 16rpx;
}

.community--compact .community__cover {
  width: 132rpx;
  height: 132rpx;
  flex-basis: 132rpx;
}
</style>
