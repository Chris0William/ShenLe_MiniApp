<script setup lang="ts">
import type { SlPropertyOutput } from '@/types/shenle'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getPropertyDetail } from '@/api/property'
import { formatArea, formatMoney, getStatusMeta, resolveAssetUrl } from '@/utils/shenle'

definePage({
  style: {
    navigationBarTitleText: '房源详情',
  },
})

const id = ref('')
const detail = ref<SlPropertyOutput | null>(null)
const loading = ref(true)
const status = computed(() => getStatusMeta(detail.value?.status))
const gallery = computed(() => {
  const images = detail.value?.images?.map(item => resolveAssetUrl(item.url)).filter(Boolean) || []
  return images.length ? images : [resolveAssetUrl(detail.value?.coverImage)]
})

async function loadDetail() {
  if (!id.value)
    return
  loading.value = true
  try {
    detail.value = await getPropertyDetail(id.value)
  }
  finally {
    loading.value = false
  }
}

function callLandlord() {
  uni.makePhoneCall({ phoneNumber: detail.value?.landlordPhone || '10086' })
}

onLoad((query) => {
  id.value = String(query?.id || '')
  loadDetail()
})
</script>

<template>
  <view class="sl-page sl-page--plain detail">
    <view v-if="loading" class="loading sl-card">
      加载房源详情...
    </view>
    <template v-else-if="detail">
      <swiper class="gallery" indicator-dots circular>
        <swiper-item v-for="img in gallery" :key="img">
          <image class="gallery__image" :src="img" mode="aspectFill" />
        </swiper-item>
      </swiper>

      <view class="detail-main sl-card">
        <view class="sl-row-between">
          <text class="detail-title">{{ detail.title }}</text>
          <wd-tag :type="status.tone as any">{{ detail.statusName || status.label }}</wd-tag>
        </view>
        <text class="detail-community">{{ detail.communityName }} {{ detail.buildingName || '' }}</text>
        <view class="price-line">
          <text class="price">¥{{ formatMoney(detail.rentPrice) }}</text>
          <text class="unit">/月</text>
        </view>
        <view class="facts">
          <view><text>{{ detail.houseType }}</text><text>户型</text></view>
          <view><text>{{ formatArea(detail.area) }}</text><text>面积</text></view>
          <view><text>{{ detail.floorInfo || `${detail.floor || '--'}/${detail.totalFloors || '--'}层` }}</text><text>楼层</text></view>
        </view>
      </view>

      <view class="section sl-card">
        <text class="section__title">房源信息</text>
        <view class="info-row"><text>朝向</text><text>{{ detail.orientation || '待补充' }}</text></view>
        <view class="info-row"><text>装修</text><text>{{ detail.decoration || '待补充' }}</text></view>
        <view class="info-row"><text>出租方式</text><text>{{ detail.rentalType || '待补充' }}</text></view>
        <view class="info-row"><text>押付</text><text>{{ detail.depositRule || '待补充' }}</text></view>
      </view>

      <view v-if="detail.tags?.length || detail.facilities?.length" class="section sl-card">
        <text class="section__title">标签与配套</text>
        <view class="tag-list">
          <wd-tag v-for="tag in detail.tags" :key="`tag-${String(tag.id)}`" plain>{{ tag.name }}</wd-tag>
          <wd-tag v-for="tag in detail.facilities" :key="`facility-${String(tag.id)}`" type="success" plain>{{ tag.name }}</wd-tag>
        </view>
      </view>

      <view class="section sl-card">
        <text class="section__title">描述</text>
        <text class="description">{{ detail.description || detail.remark || '暂无描述，后续会接入更完整的房源亮点。' }}</text>
      </view>

      <view class="bottom-bar sl-safe-bottom">
        <wd-button block type="primary" @click="callLandlord">
          联系房东
        </wd-button>
      </view>
    </template>
  </view>
</template>

<style scoped lang="scss">
.detail {
  padding-top: 0;
}

.loading {
  margin-top: 40rpx;
  padding: 40rpx;
  color: var(--sl-muted);
  text-align: center;
}

.gallery {
  height: 520rpx;
  margin: 0 -28rpx;
  background: #e8eee6;
}

.gallery__image {
  width: 100%;
  height: 100%;
}

.detail-main,
.section {
  margin-top: 22rpx;
  padding: 28rpx;
}

.detail-title {
  max-width: 520rpx;
  font-size: 38rpx;
  font-weight: 850;
  line-height: 1.25;
}

.detail-community {
  display: block;
  margin-top: 14rpx;
  color: var(--sl-muted);
  font-size: 25rpx;
}

.price-line {
  margin-top: 22rpx;
}

.price {
  color: #c26916;
  font-size: 48rpx;
  font-weight: 900;
}

.unit {
  color: #c26916;
  font-size: 24rpx;
}

.facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 26rpx;
}

.facts view {
  padding: 18rpx 10rpx;
  border-radius: 18rpx;
  background: #f2f6f0;
  text-align: center;
}

.facts text:first-child {
  display: block;
  font-size: 28rpx;
  font-weight: 800;
}

.facts text:last-child {
  display: block;
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.section__title {
  display: block;
  margin-bottom: 18rpx;
  font-size: 30rpx;
  font-weight: 800;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--sl-line);
  color: var(--sl-muted);
  font-size: 26rpx;
}

.info-row:last-child {
  border-bottom: 0;
}

.info-row text:last-child {
  color: var(--sl-ink);
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.description {
  color: #4e5d56;
  font-size: 27rpx;
  line-height: 1.7;
}

.bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 18rpx 28rpx 22rpx;
  border-top: 1rpx solid rgb(18 107 79 / 10%);
  background: rgb(255 255 255 / 96%);
}
</style>
