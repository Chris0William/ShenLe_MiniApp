<script setup lang="ts">
import type { SlCommunityOutput } from '@/types/shenle'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { idToQuery } from '@/utils/shenle'

definePage({
  style: {
    navigationBarTitleText: '我的楼盘',
    enablePullDownRefresh: true,
  },
})

const list = ref<SlCommunityOutput[]>([])
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    const result = await getCommunityPage({ page: 1, pageSize: 200, status: 0, ownerScope: 'self' })
    list.value = result.items
  }
  catch {
    uni.showToast({ title: '加载失败，请下拉重试', icon: 'none' })
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function goBuildings(item: SlCommunityOutput) {
  uni.navigateTo({
    url: `/pages/common/building-manage/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}`,
  })
}

onShow(loadData)
onPullDownRefresh(loadData)
</script>

<template>
  <view class="sl-page my-communities-page">
    <view class="sl-hero">
      <text class="sl-title">我的楼盘</text>
      <text class="sl-subtitle">共 {{ list.length }} 个楼盘</text>
    </view>

    <view v-if="loading && !list.length" class="load-tip">
      加载中...
    </view>

    <view v-else-if="!list.length" class="empty sl-card">
      <wd-icon name="home" size="38px" color="#8ea099" />
      <text class="empty__title">还没有楼盘</text>
      <text class="empty__desc">你名下还没有楼盘，可联系管理员分配</text>
    </view>

    <view v-else class="community-list">
      <view
        v-for="item in list"
        :key="String(item.id)"
        class="community-card sl-card"
        @tap="goBuildings(item)"
      >
        <view class="card-main">
          <view class="card-info">
            <text class="card-name">{{ item.name }}</text>
            <text class="card-meta">{{ item.buildingCount }} 栋 · {{ item.propertyCount }} 套房源</text>
            <text v-if="item.address" class="card-addr">{{ item.address }}</text>
          </view>
          <view class="card-arrow">
            <wd-icon name="arrow-right" size="18px" color="#8ea099" />
          </view>
        </view>
      </view>
    </view>

    <view v-if="loading && list.length" class="load-tip">
      刷新中...
    </view>
  </view>
</template>

<style scoped lang="scss">
.my-communities-page {
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.community-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.community-card {
  padding: 28rpx;
}

.card-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}

.card-info {
  min-width: 0;
  flex: 1;
}

.card-name {
  display: block;
  font-size: 32rpx;
  font-weight: 850;
  color: var(--sl-ink);
}

.card-meta {
  display: block;
  margin-top: 10rpx;
  font-size: 24rpx;
  color: var(--sl-muted);
}

.card-addr {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--sl-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-arrow {
  flex: 0 0 auto;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  margin-top: 24rpx;
  padding: 70rpx 24rpx;
  text-align: center;
}

.empty__title {
  color: var(--sl-ink);
  font-size: 30rpx;
  font-weight: 850;
}

.empty__desc {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.load-tip {
  padding: 28rpx 0;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
