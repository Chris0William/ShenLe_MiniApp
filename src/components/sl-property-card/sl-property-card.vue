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
let coverSeq = 0

watch(
  () => [props.item.coverImageId, props.item.coverImage],
  async () => {
    const seq = ++coverSeq
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
    <image class="property__cover" :src="cover" mode="aspectFill" />
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
</style>
