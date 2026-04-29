<script lang="ts" setup>
import type { SlPropertyGlobalStatsOutput } from '@/types/shenle'
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getPropertyGlobalStats } from '@/api/property'
import { useShenleAuthStore } from '@/store/auth'
import { formatMoney } from '@/utils/shenle'

defineOptions({ name: 'Home' })
definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '深乐租',
  },
})

const stats = ref<SlPropertyGlobalStatsOutput>({ totalCount: 0, vacantCount: 0, reservedCount: 0, rentedCount: 0, monthlyIncome: 0 })
const loading = ref(false)
const auth = useShenleAuthStore()

async function loadStats() {
  loading.value = true
  try {
    stats.value = await getPropertyGlobalStats()
  }
  catch {}
  finally {
    loading.value = false
  }
}

function go(url: string, tab = false) {
  if (url.startsWith('/pages/admin') && !auth.isLogin) {
    uni.navigateTo({ url: `/pages/common/login/index?redirect=${encodeURIComponent(url)}` })
    return
  }
  if (tab) {
    uni.switchTab({ url })
    return
  }
  uni.navigateTo({ url })
}

onLoad(loadStats)
</script>

<template>
  <view class="sl-page">
    <view class="sl-hero home-hero">
      <text class="sl-eyebrow">ShenLe Rental Console</text>
      <text class="sl-title">深乐租</text>
      <text class="sl-subtitle">把房源、楼栋、销控和出租状态收进一个更顺手的小程序。</text>
    </view>

    <view class="home-metrics sl-grid-2">
      <sl-metric-card label="全部房源" :value="stats.totalCount" hint="已接入后端 SlProperty" />
      <sl-metric-card label="月租收入" :value="`¥${formatMoney(stats.monthlyIncome)}`" hint="已租房源合计" tone="gold" />
      <sl-metric-card label="可出租" :value="stats.vacantCount + stats.reservedCount" hint="空置 + 预定" />
      <sl-metric-card label="已出租" :value="stats.rentedCount" hint="当前签约中" tone="ink" />
    </view>

    <view class="sl-section-head">
      <text class="sl-section-title">快速进入</text>
      <text class="sl-section-extra">{{ loading ? '刷新中' : '重构版骨架' }}</text>
    </view>

    <view class="entry-list">
      <view class="entry sl-card" @tap="go('/pages/user/home/index', true)">
        <view>
          <text class="entry__title">用户端找房</text>
          <text class="entry__desc">筛选、房源卡片、详情页先迁移到新契约。</text>
        </view>
        <wd-button size="small" type="primary">
          进入
        </wd-button>
      </view>
      <view class="entry sl-card" @tap="go('/pages/admin/dashboard/index', true)">
        <view>
          <text class="entry__title">管理端工作台</text>
          <text class="entry__desc">统计、房源列表、状态流转优先可用。</text>
        </view>
        <wd-button size="small" type="primary" plain>
          管理
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.home-hero {
  margin-top: 18rpx;
}

.home-metrics {
  margin-top: 24rpx;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx;
}

.entry__title,
.entry__desc {
  display: block;
}

.entry__title {
  font-size: 30rpx;
  font-weight: 800;
}

.entry__desc {
  max-width: 430rpx;
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  line-height: 1.45;
}
</style>
