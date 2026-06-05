<script setup lang="ts">
import type { SlPropertyListOutput } from '@/types/shenle'
import { computed, ref, watch } from 'vue'
import { downloadFile } from '@/api/file'
import { formatArea, formatMoney, getStatusMeta, resolveAssetUrl } from '@/utils/shenle'

const props = defineProps<{
  item: SlPropertyListOutput
  compact?: boolean
}>()

const emit = defineEmits<{
  tap: [item: SlPropertyListOutput]
}>()

const status = computed(() => getStatusMeta(props.item.status))
const cover = ref(resolveAssetUrl(props.item.coverImage))
const previewVideo = ref<{ url: string, title: string } | null>(null)
let coverSeq = 0

const IMAGE_SUFFIXES = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.heic']
const VIDEO_SUFFIXES = ['.mp4', '.mov', '.m4v', '.avi', '.webm']

const coverKind = computed(() => mediaKind(props.item.coverFileType, props.item.coverSuffix || props.item.coverImage))
const videoPreviewVisible = computed({
  get: () => !!previewVideo.value,
  set: (visible: boolean) => {
    if (!visible)
      previewVideo.value = null
  },
})

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

function previewCoverVideo() {
  if (coverKind.value !== 'video' || !cover.value)
    return
  previewVideo.value = { url: cover.value, title: props.item.title || '视频预览' }
}

watch(
  () => [props.item.coverImageId, props.item.coverImage, props.item.coverFileType, props.item.coverSuffix],
  async () => {
    const seq = ++coverSeq
    if (coverKind.value === 'video') {
      cover.value = resolveAssetUrl(props.item.coverImage)
      return
    }
    if (!props.item.coverImageId) {
      cover.value = resolveAssetUrl(props.item.coverImage)
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
  <view class="property sl-card" :class="{ 'property--compact': compact }" @tap="emit('tap', item)">
    <image v-if="coverKind === 'image' && cover" class="property__cover" :src="cover" mode="aspectFill" />
    <view v-else-if="coverKind === 'video' && cover" class="property__cover property__cover--video" @tap.stop="previewCoverVideo">
      <wd-icon name="play-circle" size="28px" color="#fff" />
      <text>视频</text>
    </view>
    <view v-else class="property__cover property__cover--empty">
      <wd-icon name="image" size="26px" color="#8ea099" />
    </view>
    <view class="property__body">
      <view class="sl-row-between">
        <text class="property__title">{{ item.title }}</text>
        <wd-tag :type="status.tone as any" custom-class="property__tag">
          {{ item.statusName || status.label }}
        </wd-tag>
      </view>
      <text class="property__community">{{ item.communityName || '深乐租房源' }}</text>
      <view class="property__meta">
        <text class="property__meta-item">{{ item.houseType }}</text>
        <text class="property__meta-item">{{ formatArea(item.area) }}</text>
        <text class="property__meta-item">{{ item.floorInfo || '楼层待补充' }}</text>
      </view>
      <view class="sl-row-between">
        <text class="property__price">¥{{ formatMoney(item.rentPrice) }}/月</text>
        <text class="property__cta">查看详情</text>
      </view>
    </view>
    <wd-popup v-model="videoPreviewVisible" custom-style="border-radius: 24rpx; overflow: hidden; width: 680rpx;">
      <view class="video-preview" @tap.stop>
        <view class="video-preview__head">
          <text>{{ previewVideo?.title || '视频预览' }}</text>
          <wd-icon name="close" size="20px" color="#72817b" @click.stop="previewVideo = null" />
        </view>
        <video v-if="previewVideo" class="video-preview__player" :src="previewVideo.url" controls autoplay />
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.property {
  display: flex;
  gap: 22rpx;
  padding: 18rpx;
}

.property__cover {
  width: 188rpx;
  height: 178rpx;
  flex: 0 0 188rpx;
  border-radius: 18rpx;
  background: #edf2eb;
}

.property__cover--video,
.property__cover--empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.property__cover--video {
  gap: 10rpx;
  background: linear-gradient(135deg, #0f6a4c, #163b32);
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
}

.property__cover--empty {
  background: #edf2eb;
}

.property__body {
  min-width: 0;
  flex: 1;
}

.property__title {
  max-width: 310rpx;
  overflow: hidden;
  font-size: 30rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property__community {
  display: block;
  margin-top: 10rpx;
  overflow: hidden;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin: 16rpx 0;
  color: #58655f;
  font-size: 23rpx;
}

.property__meta-item {
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  background: #f1f5ef;
}

.property__price {
  color: #c26916;
  font-size: 32rpx;
  font-weight: 850;
}

.property__cta {
  color: var(--sl-brand);
  font-size: 24rpx;
  font-weight: 700;
}

.property--compact .property__cover {
  width: 142rpx;
  height: 138rpx;
  flex-basis: 142rpx;
}

.video-preview {
  background: #fff;
}

.video-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 24rpx;
  color: var(--sl-ink);
  font-size: 28rpx;
  font-weight: 900;
}

.video-preview__player {
  display: block;
  width: 680rpx;
  height: 420rpx;
  background: #10261f;
}
</style>
