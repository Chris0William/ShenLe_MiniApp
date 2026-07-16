<script setup lang="ts">
import type { PropertyMediaSource } from '@/utils/property-management'
import { PROPERTY_MEDIA_SOURCE_ACTIONS } from '@/utils/property-management'

withDefaults(defineProps<{
  zIndex?: number
}>(), {
  zIndex: 2600,
})

const emit = defineEmits<{
  select: [value: PropertyMediaSource]
}>()

const visible = defineModel<boolean>({ default: false })
function selectSource(value: PropertyMediaSource) {
  visible.value = false
  emit('select', value)
}
</script>

<template>
  <wd-popup
    v-model="visible"
    position="bottom"
    :z-index="zIndex"
    custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden;"
    safe-area-inset-bottom
    root-portal
    @touchmove.stop.prevent
  >
    <view class="media-source-sheet" @touchmove.stop.prevent>
      <view class="media-source-sheet__head">
        <text>添加媒体</text>
        <wd-icon name="close" size="22px" color="#72817b" @click="visible = false" />
      </view>

      <view class="media-source-sheet__options">
        <view
          v-for="(action, index) in PROPERTY_MEDIA_SOURCE_ACTIONS"
          :key="action.value"
          class="media-source-option"
          @tap="selectSource(action.value)"
        >
          <view class="media-source-option__icon">
            <wd-icon :name="index === 0 ? 'image' : 'add'" size="23px" color="#126b4f" />
          </view>
          <view class="media-source-option__body">
            <text class="media-source-option__title">{{ action.name }}</text>
            <text class="media-source-option__desc">{{ action.subname }}</text>
          </view>
          <wd-icon name="arrow-right" size="18px" color="#9aa79f" />
        </view>
      </view>

      <view class="media-source-sheet__footer">
        <wd-button plain block @click="visible = false">
          取消
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.media-source-sheet {
  box-sizing: border-box;
  width: 100vw;
  background: #f5f7f3;
}

.media-source-sheet__head {
  display: flex;
  min-height: 88rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 28rpx;
  background: #fff;
  color: var(--sl-ink, #1e2b26);
  font-size: 30rpx;
  font-weight: 800;
}

.media-source-sheet__options {
  display: grid;
  gap: 14rpx;
  padding: 20rpx 22rpx;
}

.media-source-option {
  display: grid;
  min-height: 112rpx;
  align-items: center;
  padding: 0 22rpx;
  border: 1rpx solid #e3ebe5;
  border-radius: 8rpx;
  background: #fff;
  grid-template-columns: 68rpx minmax(0, 1fr) 34rpx;
}

.media-source-option__icon {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #eaf4ef;
}

.media-source-option__body,
.media-source-option__title,
.media-source-option__desc {
  display: block;
}

.media-source-option__title {
  color: var(--sl-ink, #1e2b26);
  font-size: 27rpx;
  font-weight: 750;
}

.media-source-option__desc {
  margin-top: 7rpx;
  color: var(--sl-muted, #72817b);
  font-size: 21rpx;
}

.media-source-sheet__footer {
  padding: 18rpx 22rpx calc(18rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e7ece7;
  background: #fff;
}
</style>
