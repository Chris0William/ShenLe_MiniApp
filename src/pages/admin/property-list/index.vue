<script setup lang="ts">
import type { PageSlPropertyInput, PropertyFilterState, SlPropertyListOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { deleteProperty, getPropertyPage, updatePropertyStatus } from '@/api/property'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { buildPropertyFilterQuery, countPropertyFilters, getPropertyFilterLabels } from '@/utils/property-filter'
import { idToQuery } from '@/utils/shenle'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '房源管理',
    enablePullDownRefresh: true,
  },
})

const keyword = ref('')
const status = ref<number | undefined>()
const filters = ref<PropertyFilterState>({})
const filterVisible = ref(false)
const page = ref(1)
const pageSize = 10
const total = ref(0)
const items = ref<SlPropertyListOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const finished = computed(() => total.value > 0 && items.value.length >= total.value)
const filterCount = computed(() => countPropertyFilters(filters.value))
const statusCount = computed(() => status.value === undefined ? 0 : 1)
const activeCount = computed(() => filterCount.value + statusCount.value)
const filterLabels = computed(() => getPropertyFilterLabels(filters.value))

function buildQuery(): PageSlPropertyInput {
  return {
    page: page.value,
    pageSize,
    title: keyword.value.trim() || undefined,
    status: status.value,
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

async function changeStatus(item: SlPropertyListOutput, nextStatus: number) {
  if (item.status === nextStatus)
    return
  await updatePropertyStatus({ id: item.id, status: nextStatus })
  uni.showToast({ title: '状态已更新', icon: 'success' })
  await load(true)
}

function selectStatus(value?: number) {
  status.value = value
  load(true)
}

function onFilterConfirm(nextFilters: PropertyFilterState) {
  filters.value = nextFilters
  filterVisible.value = false
  load(true)
}

function resetFilters() {
  filters.value = {}
  filterVisible.value = false
  load(true)
}

function clearAllFilters() {
  keyword.value = ''
  status.value = undefined
  filters.value = {}
  load(true)
}

function openDetail(item: SlPropertyListOutput) {
  uni.navigateTo({ url: `/pages/common/property-detail/index?id=${idToQuery(item.id)}` })
}

function openForm(item?: SlPropertyListOutput) {
  const query = item ? `?id=${idToQuery(item.id)}` : ''
  uni.navigateTo({ url: `/pages/common/property-form/index${query}` })
}

function removeItem(item: SlPropertyListOutput) {
  uni.showModal({
    title: '删除房源',
    content: '确定删除 ' + (item.title || '该房源') + '？',
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      await deleteProperty({ id: item.id })
      uni.showToast({ title: '删除成功', icon: 'success' })
      await load(true)
    },
  })
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
  <view class="sl-page property-page">
    <view class="admin-head">
      <view>
        <text class="admin-head__eyebrow">Admin · Property</text>
        <text class="admin-head__title">房源管理</text>
      </view>
    </view>

    <view class="search sl-card">
      <wd-icon name="search" size="20px" color="#7a8780" />
      <input v-model="keyword" class="search__input" placeholder="搜索房源名称 / 小区 / 房号" confirm-type="search" @confirm="load(true)">
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
        <wd-tag :type="status === undefined ? 'success' : 'default'" @click="selectStatus(undefined)">
          全部
        </wd-tag>
        <wd-tag
          v-for="item in PROPERTY_STATUS_OPTIONS"
          :key="item.value"
          :type="status === item.value ? item.tone as any : 'default'"
          @click="selectStatus(item.value)"
        >
          {{ item.label }}
        </wd-tag>
      </view>
    </scroll-view>

    <view v-if="activeCount || keyword" class="active-summary sl-card">
      <view class="active-summary__body">
        <wd-tag v-if="keyword" plain type="primary">
          搜索：{{ keyword }}
        </wd-tag>
        <wd-tag v-if="status !== undefined" plain type="warning">
          状态：{{ PROPERTY_STATUS_OPTIONS.find(item => item.value === status)?.label }}
        </wd-tag>
        <wd-tag v-for="label in filterLabels" :key="label" plain type="success">
          {{ label }}
        </wd-tag>
      </view>
      <text class="active-summary__clear" @tap="clearAllFilters">清空</text>
    </view>

    <view class="result-head">
      <view>
        <text class="result-head__title">房源列表</text>
        <text class="result-head__desc">下拉刷新 · 触底加载 · 状态快捷维护</text>
      </view>
      <view class="result-head__actions">
        <text class="result-head__total">{{ total }} 套</text>
        <wd-button size="small" type="primary" icon="add" @click="openForm()">
          新增
        </wd-button>
      </view>
    </view>

    <view class="list">
      <view v-for="item in items" :key="String(item.id)" class="admin-card sl-card">
        <sl-property-card :item="item" compact @tap="openDetail" />
        <view class="manage-actions">
          <wd-button size="small" type="primary" plain @click="openForm(item)">
            编辑
          </wd-button>
          <wd-button size="small" type="danger" plain @click="removeItem(item)">
            删除
          </wd-button>
        </view>
        <view class="status-actions">
          <wd-button
            v-for="option in PROPERTY_STATUS_OPTIONS"
            :key="option.value"
            size="small"
            :type="item.status === option.value ? 'primary' : 'default'"
            plain
            @click="changeStatus(item, option.value)"
          >
            {{ option.label }}
          </wd-button>
        </view>
      </view>
    </view>

    <view v-if="loading" class="loading sl-card">
      <wd-icon name="loading" size="18px" color="#126b4f" />
      <text>加载中...</text>
    </view>
    <view v-else-if="hasLoaded && !items.length" class="empty sl-card">
      <wd-icon name="home" size="42px" color="#8ea099" />
      <text class="empty__title">暂无房源数据</text>
      <text class="empty__desc">换个筛选条件，或先新增一套房源。</text>
      <wd-button size="small" type="primary" @click="openForm()">
        新增房源
      </wd-button>
    </view>
    <view v-else-if="finished" class="loading">
      已经到底了
    </view>

    <sl-property-filter
      :visible="filterVisible"
      :filters="filters"
      @confirm="onFilterConfirm"
      @reset="resetFilters"
      @close="filterVisible = false"
    />
  </view>
</template>

<style scoped lang="scss">
.property-page {
  padding-bottom: calc(148rpx + env(safe-area-inset-bottom));
}

.admin-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 28rpx;
}

.admin-head__eyebrow,
.admin-head__title {
  display: block;
}

.admin-head__eyebrow {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.admin-head__title {
  margin-top: 8rpx;
  font-size: 42rpx;
  font-weight: 850;
}

.search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 14rpx;
  margin-top: 24rpx;
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
  margin: 20rpx 0 0;
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

.result-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18rpx;
  margin: 30rpx 2rpx 18rpx;
}

.result-head__title,
.result-head__desc,
.result-head__total {
  display: block;
}

.result-head__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 12rpx;
}

.result-head__title {
  font-size: 32rpx;
  font-weight: 850;
}

.result-head__desc {
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.result-head__total {
  color: var(--sl-brand);
  font-size: 26rpx;
  font-weight: 850;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.admin-card {
  overflow: hidden;
}

.admin-card :deep(.property) {
  border: 0;
  box-shadow: none;
}

.manage-actions,
.status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.manage-actions {
  padding: 0 18rpx 12rpx;
}

.status-actions {
  padding: 0 18rpx 18rpx;
}

.loading,
.empty {
  margin-top: 22rpx;
  padding: 28rpx 0;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  padding: 66rpx 24rpx;
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
</style>
