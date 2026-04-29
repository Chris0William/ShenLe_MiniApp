<script setup lang="ts">
import type { SlCommunityOutput, SlPropertyGlobalStatsOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { getPropertyGlobalStats } from '@/api/property'
import { useShenleAuthStore } from '@/store/auth'
import { formatMoney } from '@/utils/shenle'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '工作台',
    enablePullDownRefresh: true,
  },
})

const stats = ref<SlPropertyGlobalStatsOutput>({ totalCount: 0, vacantCount: 0, reservedCount: 0, rentedCount: 0, monthlyIncome: 0 })
const communities = ref<SlCommunityOutput[]>([])
const loading = ref(false)
const auth = useShenleAuthStore()
function requireLogin() {
  if (auth.isLogin)
    return true
  uni.navigateTo({ url: `/pages/common/login/index?redirect=${encodeURIComponent('/pages/admin/dashboard/index')}` })
  return false
}

async function load() {
  if (!requireLogin())
    return
  loading.value = true
  try {
    const [globalStats, communityPage] = await Promise.all([
      getPropertyGlobalStats(),
      getCommunityPage({ page: 1, pageSize: 6 }),
    ])
    stats.value = globalStats
    communities.value = communityPage.items
  }
  catch {
    if (!auth.isLogin)
      requireLogin()
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function go(url: string, tab = false) {
  if (tab)
    uni.switchTab({ url })
  else
    uni.navigateTo({ url })
}

onLoad(load)
onPullDownRefresh(load)
</script>

<template>
  <view class="sl-page">
    <view class="sl-hero dashboard-hero">
      <text class="sl-eyebrow">Admin Console</text>
      <text class="sl-title">今日房源状态</text>
      <text class="sl-subtitle">先把统计、房源列表和销控链路迁入新骨架。</text>
    </view>

    <view class="metrics sl-grid-2">
      <sl-metric-card label="房源总数" :value="stats.totalCount" />
      <sl-metric-card label="预计月租" :value="`¥${formatMoney(stats.monthlyIncome)}`" tone="gold" />
      <sl-metric-card label="空置" :value="stats.vacantCount" />
      <sl-metric-card label="预定/已租" :value="`${stats.reservedCount}/${stats.rentedCount}`" tone="ink" />
    </view>

    <view class="actions sl-card">
      <view class="action-item" @tap="go('/pages/admin/property-list/index', true)">
        <view class="action-icon action-icon--green">
          <wd-icon name="view-list" size="25px" color="#126b4f" />
        </view>
        <text>房源管理</text>
      </view>
      <view class="action-item" @tap="go('/pages/admin/sales-control/index')">
        <view class="action-icon action-icon--gold">
          <wd-icon name="chart" size="25px" color="#b46d08" />
        </view>
        <text>销控表</text>
      </view>
      <view class="action-item" @tap="go('/pages/common/property-form/index')">
        <view class="action-icon action-icon--green">
          <wd-icon name="add" size="25px" color="#126b4f" />
        </view>
        <text>发布房源</text>
      </view>
      <view class="action-item" @tap="go('/pages/common/community-manage/index')">
        <view class="action-icon action-icon--green">
          <wd-icon name="home" size="25px" color="#126b4f" />
        </view>
        <text>楼盘管理</text>
      </view>
      <view class="action-item" @tap="go('/pages/common/region-manage/index')">
        <view class="action-icon action-icon--gold">
          <wd-icon name="location" size="25px" color="#b46d08" />
        </view>
        <text>区域管理</text>
      </view>
      <view class="action-item" @tap="go('/pages/common/tag-manage/index')">
        <view class="action-icon action-icon--green">
          <wd-icon name="discount" size="25px" color="#126b4f" />
        </view>
        <text>标签管理</text>
      </view>
    </view>

    <view class="sl-section-head">
      <text class="sl-section-title">楼盘概览</text>
      <text class="sl-section-extra">{{ loading ? '刷新中' : 'Top 6' }}</text>
    </view>

    <view class="community-list">
      <view v-for="item in communities" :key="String(item.id)" class="community sl-card">
        <view>
          <text class="community__name">{{ item.name }}</text>
          <text class="community__meta">{{ item.buildingCount }} 栋 · {{ item.propertyCount }} 套</text>
        </view>
        <view class="community__numbers">
          <text>{{ item.propertyCount }}</text>
          <text>房源</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.dashboard-hero {
  margin-top: 18rpx;
}

.metrics {
  margin-top: 24rpx;
}

.actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  margin-top: 24rpx;
  padding: 24rpx 10rpx;
}

.action-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  color: var(--sl-ink);
  font-size: 24rpx;
  font-weight: 700;
}

.action-icon {
  display: flex;
  width: 76rpx;
  height: 76rpx;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
}

.action-icon--green {
  background: linear-gradient(135deg, rgb(18 107 79 / 14%), rgb(18 107 79 / 5%));
}

.action-icon--gold {
  background: linear-gradient(135deg, rgb(228 161 27 / 23%), rgb(228 161 27 / 8%));
}

.community-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.community {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
}

.community__name,
.community__meta {
  display: block;
}

.community__name {
  font-size: 29rpx;
  font-weight: 800;
}

.community__meta {
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.community__numbers {
  text-align: right;
}

.community__numbers text:first-child {
  display: block;
  color: var(--sl-brand);
  font-size: 34rpx;
  font-weight: 900;
}

.community__numbers text:last-child {
  display: block;
  color: var(--sl-muted);
  font-size: 22rpx;
}
</style>
