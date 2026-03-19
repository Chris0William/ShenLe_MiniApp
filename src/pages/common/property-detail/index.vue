<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getPropertyDetail } from '@/api/property'
import { downloadFile } from '@/api/file'
import type { SlPropertyOutput } from '@/types/property'

const id = ref('')
const detail = ref<SlPropertyOutput | null>(null)
const currentSwiper = ref(0)
const imageUrls = ref<string[]>([])

async function loadImages() {
  if (!detail.value) return
  const imgs = detail.value.images
  if (imgs?.length) {
    const urls: string[] = []
    for (const img of imgs) {
      try { urls.push(await downloadFile(String(img.id))) } catch { urls.push('') }
    }
    imageUrls.value = urls.filter(Boolean)
  } else if (detail.value.coverImageId) {
    try {
      imageUrls.value = [await downloadFile(String(detail.value.coverImageId))]
    } catch {}
  }
}

const locationText = computed(() => {
  if (!detail.value) return ''
  const d = detail.value
  const parts = [d.communityName, d.buildingName]
  if (d.floor && d.totalFloors) parts.push(`${d.floor}/${d.totalFloors}层`)
  if (d.roomNo) parts.push(d.roomNo)
  return parts.filter(Boolean).join(' · ')
})

async function loadDetail() {
  if (!id.value) return
  try {
    detail.value = await getPropertyDetail(id.value)
    loadImages()
  } catch {}
}

function callPhone() {
  if (!detail.value?.landlordPhone) {
    uni.showToast({ title: '暂无联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: detail.value.landlordPhone })
}

function onSwiperChange(e: any) {
  currentSwiper.value = e.detail.current
}

onLoad((options) => {
  if (options?.id) {
    id.value = options.id
    loadDetail()
  }
})
</script>

<template>
  <view class="page">
    <!-- 图片轮播 -->
    <view class="swiper-area">
      <swiper
        v-if="imageUrls.length"
        class="swiper"
        :current="currentSwiper"
        @change="onSwiperChange"
      >
        <swiper-item v-for="(url, idx) in imageUrls" :key="idx">
          <image class="swiper-img" :src="url" mode="aspectFill" />
        </swiper-item>
      </swiper>
      <view v-else class="swiper-empty">
        <text>暂无图片</text>
      </view>
      <view v-if="imageUrls.length > 1" class="swiper-counter">
        {{ currentSwiper + 1 }}/{{ imageUrls.length }}
      </view>
    </view>

    <template v-if="detail">
      <!-- 基本信息 -->
      <view class="info-card">
        <view class="price-row">
          <text class="price">¥{{ (detail.rentPrice ?? 0).toLocaleString() }}/月</text>
          <sl-status-badge :status="detail.status" />
        </view>
        <text class="title">{{ detail.title }}</text>
        <view class="meta">
          <text>{{ detail.area ?? '-' }}㎡</text>
          <text> · </text>
          <text>{{ detail.houseType }}</text>
          <text v-if="detail.floor || detail.totalFloors"> · {{ detail.floor ?? '-' }}/{{ detail.totalFloors ?? '-' }}层</text>
        </view>
        <view class="location">
          <text class="location-text">{{ locationText }}</text>
        </view>
      </view>

      <!-- 房源信息 -->
      <view class="section-card">
        <text class="section-title">房源信息</text>
        <view class="info-grid">
          <view class="info-item">
            <text class="label">朝向</text>
            <text class="val">{{ detail.orientation || '-' }}</text>
          </view>
          <view class="info-item">
            <text class="label">装修</text>
            <text class="val">{{ detail.decoration || '-' }}</text>
          </view>
          <view class="info-item">
            <text class="label">租赁方式</text>
            <text class="val">{{ detail.rentalType || '-' }}</text>
          </view>
          <view class="info-item">
            <text class="label">押付方式</text>
            <text class="val">{{ detail.depositRule || '-' }}</text>
          </view>
          <view v-if="detail.deposit" class="info-item">
            <text class="label">押金</text>
            <text class="val">¥{{ detail.deposit.toLocaleString() }}</text>
          </view>
          <view class="info-item">
            <text class="label">面积</text>
            <text class="val">{{ detail.area ?? '-' }}㎡</text>
          </view>
        </view>
      </view>

      <!-- 房源特色 -->
      <view v-if="detail.tags?.length" class="section-card">
        <text class="section-title">房源特色</text>
        <view class="tag-list">
          <view
            v-for="tag in detail.tags"
            :key="tag.id"
            class="tag-chip"
            :style="tag.color ? { color: tag.color, borderColor: tag.color } : {}"
          >
            {{ tag.name }}
          </view>
        </view>
      </view>

      <!-- 配套设施 -->
      <view v-if="detail.facilities?.length" class="section-card">
        <text class="section-title">配套设施</text>
        <view class="facility-grid">
          <view v-for="f in detail.facilities" :key="f.id" class="facility-item">
            <text v-if="f.icon" class="facility-icon">{{ f.icon }}</text>
            <text class="facility-name">{{ f.name }}</text>
          </view>
        </view>
      </view>

      <!-- 房源描述 -->
      <view v-if="detail.description" class="section-card">
        <text class="section-title">房源描述</text>
        <text class="desc-text">{{ detail.description }}</text>
      </view>

      <!-- 联系人 -->
      <view v-if="detail.landlordName" class="section-card">
        <text class="section-title">联系人</text>
        <view class="contact-row">
          <text class="contact-name">{{ detail.landlordName }}</text>
          <text v-if="detail.landlordPhone" class="contact-phone" @tap="callPhone">
            {{ detail.landlordPhone }}
          </text>
        </view>
      </view>
    </template>

    <!-- 底部操作栏 -->
    <view class="action-bar">
      <view class="action-btn phone" @tap="callPhone">
        <text>联系房东</text>
      </view>
      <view class="action-btn primary" @tap="callPhone">
        <text>预约看房</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $sl-bg-page;
  padding-bottom: 130rpx;
}

// ---- Swiper ----
.swiper-area {
  position: relative;
  width: 100%;
  height: 500rpx;
  background-color: #e0e0e0;
}

.swiper {
  width: 100%;
  height: 100%;
}

.swiper-img {
  width: 100%;
  height: 100%;
}

.swiper-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $sl-font-md;
  color: $sl-text-secondary;
}

.swiper-counter {
  position: absolute;
  right: $sl-spacing-md;
  bottom: $sl-spacing-md;
  padding: 4rpx 16rpx;
  background-color: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  font-size: $sl-font-xs;
  border-radius: 20rpx;
}

// ---- Info card ----
.info-card {
  padding: $sl-spacing-md $sl-spacing-lg;
  background-color: $sl-bg-card;
  margin-bottom: $sl-spacing-sm;
}

.price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $sl-spacing-xs;
}

.price {
  font-size: $sl-font-xxl;
  font-weight: 700;
  color: $sl-text-price;
}

.title {
  font-size: $sl-font-lg;
  font-weight: 600;
  color: $sl-text-primary;
  margin-bottom: $sl-spacing-xs;
}

.meta {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-bottom: $sl-spacing-xs;
}

.location {
  margin-top: $sl-spacing-xs;
}

.location-text {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
}

// ---- Section card ----
.section-card {
  padding: $sl-spacing-md $sl-spacing-lg;
  background-color: $sl-bg-card;
  margin-bottom: $sl-spacing-sm;
}

.section-title {
  display: block;
  font-size: $sl-font-lg;
  font-weight: 600;
  color: $sl-text-primary;
  margin-bottom: $sl-spacing-md;
}

// ---- Info grid ----
.info-grid {
  display: flex;
  flex-wrap: wrap;
}

.info-item {
  width: 50%;
  display: flex;
  justify-content: space-between;
  padding: $sl-spacing-xs 0;
  padding-right: $sl-spacing-md;
  box-sizing: border-box;
}

.label {
  font-size: $sl-font-md;
  color: $sl-text-secondary;
}

.val {
  font-size: $sl-font-md;
  color: $sl-text-primary;
}

// ---- Tags ----
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-sm;
}

.tag-chip {
  padding: $sl-spacing-xs $sl-spacing-md;
  font-size: $sl-font-sm;
  color: $sl-primary;
  background-color: rgba(24, 144, 255, 0.08);
  border: 1rpx solid rgba(24, 144, 255, 0.3);
  border-radius: 8rpx;
}

// ---- Facilities ----
.facility-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-md;
}

.facility-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
  width: calc(25% - #{$sl-spacing-md});
  flex-direction: column;
}

.facility-icon {
  font-size: 40rpx;
}

.facility-name {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

// ---- Description ----
.desc-text {
  font-size: $sl-font-md;
  color: $sl-text-secondary;
  line-height: 1.8;
  white-space: pre-wrap;
}

// ---- Contact ----
.contact-row {
  display: flex;
  align-items: center;
  gap: $sl-spacing-md;
}

.contact-name {
  font-size: $sl-font-md;
  color: $sl-text-primary;
  font-weight: 600;
}

.contact-phone {
  font-size: $sl-font-md;
  color: $sl-primary;
}

// ---- Action bar ----
.action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: $sl-spacing-sm;
  padding: $sl-spacing-sm $sl-spacing-lg;
  padding-bottom: calc(#{$sl-spacing-sm} + #{$sl-safe-bottom});
  background-color: $sl-bg-card;
  border-top: 1rpx solid $sl-border-color;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $sl-spacing-sm 0;
  border-radius: $sl-border-radius;
  font-size: $sl-font-md;
  font-weight: 600;

  &.phone {
    background-color: #f0f9ff;
    color: $sl-primary;
  }

  &.primary {
    background-color: $sl-primary;
    color: #ffffff;
  }
}
</style>
