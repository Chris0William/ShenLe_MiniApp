<script setup lang="ts">
import type { PageSlPropertyInput, PropertyFilterState, SlPropertyListOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getPropertyPage } from '@/api/property'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { buildPropertyFilterQuery, countPropertyFilters, getPropertyFilterLabels } from '@/utils/property-filter'
import { idToQuery } from '@/utils/shenle'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '找房',
    enablePullDownRefresh: true,
  },
})

const keyword = ref('')
const selectedStatus = ref<number | undefined>()
const filters = ref<PropertyFilterState>({})
const filterVisible = ref(false)
const page = ref(1)
const pageSize = 10
const total = ref(0)
const items = ref<SlPropertyListOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const finished = computed(() => items.value.length >= total.value && total.value > 0)
const filterCount = computed(() => countPropertyFilters(filters.value))
const activeLabels = computed(() => getPropertyFilterLabels(filters.value))

function buildQuery(): PageSlPropertyInput {
  return {
    page: page.value,
    pageSize,
    title: keyword.value.trim() || undefined,
    status: selectedStatus.value,
    ...buildPropertyFilterQuery(filters.value),
  }
}

async function load(reset = false) {
  if (loading.value)
    return
  if (reset) {
    page.value = 1
    items.value = []
    total.value = 0
  }
  loading.value = true
  try {
    const result = await getPropertyPage(buildQuery())
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
    hasLoaded.value = true
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function selectStatus(value?: number) {
  selectedStatus.value = value
  load(true)
}

function onFilterConfirm(nextFilters: PropertyFilterState) {
  filters.value = nextFilters
  filterVisible.value = false
  load(true)
}

function clearAll() {
  keyword.value = ''
  selectedStatus.value = undefined
  filters.value = {}
  load(true)
}

function openDetail(item: SlPropertyListOutput) {
  uni.navigateTo({ url: `/pages/common/property-detail/index?id=${idToQuery(item.id)}` })
}

onLoad(() => load(true))
onPullDownRefresh(() => load(true))
onReachBottom(() => {
  if (!finished.value) {
    page.value += 1
    load()
  }
})
</script>

<template>
  <view class="sl-page home-page">
    <view class="home-top">
      <view>
        <text class="home-top__eyebrow">ShenLe Rent</text>
        <text class="home-top__title">找一套刚刚好的房子</text>
      </view>
    </view>

    <view class="search sl-card">
      <wd-icon name="search" size="20px" color="#7a8780" />
      <input v-model="keyword" class="search__input" confirm-type="search" placeholder="输入小区、房号或关键词" @confirm="load(true)">
      <wd-button size="small" type="primary" @click="load(true)">
        搜索
      </wd-button>
      <view class="filter-trigger" :class="{ active: filterCount > 0 }" @tap="filterVisible = true">
        <wd-icon name="filter" size="18px" :color="filterCount > 0 ? '#ffffff' : '#126b4f'" />
        <text>筛选</text>
        <text v-if="filterCount" class="filter-trigger__badge">{{ filterCount }}</text>
      </view>
    </view>

    <scroll-view scroll-x class="chips">
      <view class="chips__inner">
        <wd-tag :type="selectedStatus === undefined ? 'success' : 'default'" @click="selectStatus(undefined)">
          全部
        </wd-tag>
        <wd-tag
          v-for="item in PROPERTY_STATUS_OPTIONS"
          :key="item.value"
          :type="selectedStatus === item.value ? item.tone as any : 'default'"
          @click="selectStatus(item.value)"
        >
          {{ item.label }}
        </wd-tag>
      </view>
    </scroll-view>

    <view v-if="keyword || selectedStatus !== undefined || activeLabels.length" class="active-summary sl-card">
      <view class="active-summary__body">
        <wd-tag v-if="keyword" plain type="primary">
          搜索：{{ keyword }}
        </wd-tag>
        <wd-tag v-if="selectedStatus !== undefined" plain type="warning">
          状态：{{ PROPERTY_STATUS_OPTIONS.find(item => item.value === selectedStatus)?.label }}
        </wd-tag>
        <wd-tag v-for="label in activeLabels" :key="label" plain type="success">
          {{ label }}
        </wd-tag>
      </view>
      <text class="active-summary__clear" @tap="clearAll">清空</text>
    </view>

    <view class="sl-section-head">
      <view>
        <text class="sl-section-title">推荐房源</text>
        <text class="section-desc">筛选条件会实时同步到列表。</text>
      </view>
      <text class="sl-section-extra">{{ total }} 套</text>
    </view>

    <view class="list">
      <sl-property-card v-for="item in items" :key="String(item.id)" :item="item" @tap="openDetail" />
      <view v-if="!loading && hasLoaded && items.length === 0" class="empty sl-card">
        <wd-icon name="home" size="38px" color="#8ea099" />
        <text>暂无房源数据</text>
        <wd-button size="small" type="primary" @click="clearAll">
          清空筛选
        </wd-button>
      </view>
      <view v-if="loading" class="loading">
        加载中...
      </view>
      <view v-else-if="finished && items.length > 0" class="loading">
        已经到底了
      </view>
    </view>

    <sl-property-filter
      :visible="filterVisible"
      :filters="filters"
      @confirm="onFilterConfirm"
      @close="filterVisible = false"
    />
  </view>
</template>

<style scoped lang="scss">
.home-page {
  padding-bottom: calc(148rpx + env(safe-area-inset-bottom));
}

.home-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 28rpx;
}

.home-top__eyebrow,
.home-top__title {
  display: block;
}

.home-top__eyebrow {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.home-top__title {
  margin-top: 8rpx;
  font-size: 42rpx;
  font-weight: 850;
}

.search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 14rpx;
  margin-top: 26rpx;
  padding: 18rpx;
}

.search__input {
  min-width: 0;
  font-size: 27rpx;
}

.filter-trigger {
  position: relative;
  display: flex;
  height: 58rpx;
  align-items: center;
  gap: 6rpx;
  box-sizing: border-box;
  padding: 0 18rpx;
  border: 1rpx solid rgb(18 107 79 / 16%);
  border-radius: 999rpx;
  color: var(--sl-brand);
  font-size: 24rpx;
  font-weight: 800;
}

.filter-trigger.active {
  border-color: transparent;
  background: var(--sl-brand);
  color: #fff;
}

.filter-trigger__badge {
  min-width: 26rpx;
  height: 26rpx;
  border-radius: 999rpx;
  background: var(--sl-brand-2);
  color: #fff;
  font-size: 18rpx;
  line-height: 26rpx;
  text-align: center;
}

.chips {
  margin-top: 20rpx;
  white-space: nowrap;
}

.chips__inner {
  display: inline-flex;
  gap: 14rpx;
  padding-right: 28rpx;
}

.active-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 18rpx;
  padding: 16rpx 18rpx;
}

.active-summary__body {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-wrap: wrap;
  gap: 10rpx;
}

.active-summary__clear {
  color: var(--sl-danger);
  font-size: 24rpx;
  font-weight: 800;
}

.section-desc {
  display: block;
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  padding: 70rpx 24rpx;
  color: var(--sl-muted);
}

.loading {
  padding: 24rpx 0;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
