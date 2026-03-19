<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'
import { useUserStore } from '@/stores/user'
import { getPropertyGlobalStats } from '@/api/property'
import type { SlPropertyGlobalStatsOutput } from '@/types/property'

const appStore = useAppStore()
const userStore = useUserStore()

const stats = ref<SlPropertyGlobalStatsOutput>({
  totalCount: 0,
  vacantCount: 0,
  reservedCount: 0,
  rentedCount: 0,
  monthlyIncome: 0,
})

const occupancyPercent = computed(() => {
  if (stats.value.totalCount === 0) return 0
  return Math.round((stats.value.rentedCount / stats.value.totalCount) * 100)
})

const todayStr = computed(() => {
  const d = new Date()
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`
})

const activityItems = computed(() => {
  const items: { title: string; desc: string; time: string }[] = []
  const s = stats.value
  if (s.vacantCount > 0)
    items.push({ title: '空置待租', desc: `${s.vacantCount} 套房源等待出租`, time: '今天' })
  if (s.rentedCount > 0)
    items.push({ title: '已租房源', desc: `已出租 ${s.rentedCount} 套房源`, time: '今天' })
  if (s.reservedCount > 0)
    items.push({ title: '预定中', desc: `${s.reservedCount} 套房源已预定`, time: '今天' })
  if (s.monthlyIncome > 0)
    items.push({ title: '月租金收入', desc: `本月收入 ¥${s.monthlyIncome.toLocaleString()}`, time: '本月' })
  if (items.length === 0)
    items.push({ title: '暂无动态', desc: '添加房源后将显示最新动态', time: '' })
  return items
})

async function loadStats() {
  try {
    stats.value = await getPropertyGlobalStats()
  } catch {}
}

function goTo(url: string) {
  uni.navigateTo({ url })
}

onMounted(() => {
  loadStats()
})
</script>

<template>
  <view class="page">
    <!-- Header -->
    <view class="header" :style="{ paddingTop: appStore.headerPaddingStyle(0) }">
      <text class="greeting">你好，{{ userStore.nickName || '管理员' }}</text>
      <text class="date">{{ todayStr }}</text>
    </view>

    <!-- Scrollable body -->
    <scroll-view scroll-y class="scroll-body" :show-scrollbar="false">
      <!-- Stats Grid 2×2 -->
      <view class="stats-grid">
        <view class="stat-card primary">
          <text class="stat-label">总房源数</text>
          <text class="stat-num">{{ stats.totalCount }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">空置房源</text>
          <text class="stat-num">{{ stats.vacantCount }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">已租房源</text>
          <text class="stat-num">{{ stats.rentedCount }}</text>
        </view>
        <view class="stat-card">
          <text class="stat-label">出租率</text>
          <text class="stat-num">{{ occupancyPercent }}%</text>
        </view>
      </view>

      <!-- Quick Actions -->
      <view class="section">
        <text class="section-title">快捷操作</text>
        <view class="quick-card">
          <view class="quick-item" hover-class="quick-item-hover" hover-stay-time="150" @tap="goTo('/pages/common/property-form/index')">
            <view class="quick-icon blue">
              <text>+</text>
            </view>
            <text class="quick-label">新增房源</text>
          </view>
          <view class="quick-item" hover-class="quick-item-hover" hover-stay-time="150" @tap="goTo('/pages/common/community-manage/index')">
            <view class="quick-icon orange">
              <text class="icon-text">&#9962;</text>
            </view>
            <text class="quick-label">楼盘管理</text>
          </view>
          <view class="quick-item" hover-class="quick-item-hover" hover-stay-time="150" @tap="goTo('/pages/common/region-manage/index')">
            <view class="quick-icon green">
              <text class="icon-text">&#9906;</text>
            </view>
            <text class="quick-label">区域管理</text>
          </view>
          <view class="quick-item" hover-class="quick-item-hover" hover-stay-time="150" @tap="goTo('/pages/common/tag-manage/index')">
            <view class="quick-icon purple">
              <text>#</text>
            </view>
            <text class="quick-label">标签管理</text>
          </view>
        </view>
      </view>

      <!-- Activity Feed -->
      <view class="section">
        <text class="section-title">最近动态</text>
        <view class="activity-card">
          <view
            v-for="(item, idx) in activityItems"
            :key="idx"
            class="activity-item"
            :class="{ last: idx === activityItems.length - 1 }"
          >
            <view class="activity-info">
              <text class="activity-title">{{ item.title }}</text>
              <text class="activity-desc">{{ item.desc }}</text>
            </view>
            <text class="activity-time">{{ item.time }}</text>
          </view>
        </view>
      </view>

      <view style="height: 200rpx" />
    </scroll-view>

    <sl-custom-tabbar :current="2" />
  </view>
</template>

<style lang="scss" scoped>
.page {
  height: 100vh;
  background-color: $sl-bg-page;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

// ---- Header ----
.header {
  padding: $sl-spacing-lg $sl-spacing-xl;
  padding-bottom: $sl-spacing-xl;
  flex-shrink: 0;
}

.greeting {
  display: block;
  font-size: $sl-font-xxl;
  font-weight: 700;
  color: $sl-text-primary;
}

.date {
  display: block;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-top: $sl-spacing-xs;
}

// ---- Scroll body ----
.scroll-body {
  flex: 1;
  height: 0;
}

// ---- Stats Grid ----
.stats-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 0 $sl-spacing-lg;
  margin-bottom: $sl-spacing-xl;
}

.stat-card {
  width: calc(50% - 12rpx);
  height: 224rpx;
  padding: $sl-spacing-lg;
  border-radius: $sl-border-radius-xl;
  background-color: $sl-bg-card;
  box-shadow: $sl-shadow-sm;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-bottom: $sl-spacing-md;
  box-sizing: border-box;

  &.primary {
    background-color: $sl-primary-dark;
    .stat-label { color: rgba(255, 255, 255, 0.7); }
    .stat-num { color: #ffffff; }
  }
}

.stat-label {
  font-size: $sl-font-sm;
  font-weight: 500;
  color: $sl-text-placeholder;
}

.stat-num {
  font-size: 60rpx;
  font-weight: 700;
  color: $sl-text-primary;
}

// ---- Sections ----
.section {
  padding: 0 $sl-spacing-lg;
  margin-bottom: $sl-spacing-xl;
}

.section-title {
  display: block;
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-primary;
  margin-bottom: $sl-spacing-md;
  padding: 0 $sl-spacing-xs;
}

// ---- Quick Actions Card ----
.quick-card {
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius-xl;
  padding: $sl-spacing-lg;
  display: flex;
  justify-content: space-between;
  box-shadow: $sl-shadow-sm;
}

.quick-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sl-spacing-sm;
}

.quick-item-hover {
  opacity: 0.6;
  transform: scale(0.95);
}

.quick-icon {
  width: 96rpx;
  height: 96rpx;
  border-radius: $sl-border-radius-lg;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $sl-font-xxl;
  margin-bottom: $sl-spacing-xs;

  &.blue { background-color: #DBEAFE; color: #2563EB; }
  &.orange { background-color: #FFEDD5; color: #EA580C; }
  &.green { background-color: #D1FAE5; color: #059669; }
  &.purple { background-color: #F3E8FF; color: #9333EA; }
}

.icon-text {
  font-size: $sl-font-xl;
}

.quick-label {
  font-size: 22rpx;
  font-weight: 500;
  color: #475569;
}

// ---- Activity Feed ----
.activity-card {
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius-xl;
  padding: $sl-spacing-sm;
  box-shadow: $sl-shadow-sm;
}

.activity-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $sl-spacing-md;
  border-bottom: 1rpx solid $sl-border-color-light;
  border-radius: $sl-border-radius;

  &.last {
    border-bottom: none;
  }
}

.activity-info {
  flex: 1;
  min-width: 0;
}

.activity-title {
  display: block;
  font-size: $sl-font-md;
  font-weight: 600;
  color: $sl-text-primary;
}

.activity-desc {
  display: block;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-top: 4rpx;
}

.activity-time {
  font-size: $sl-font-xs;
  color: $sl-text-placeholder;
  flex-shrink: 0;
}
</style>
