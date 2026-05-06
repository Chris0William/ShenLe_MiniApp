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
const filters = ref<PropertyFilterState>({})
const page = ref(1)
const pageSize = 10
const total = ref(0)
const items = ref<SlPropertyListOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const finished = computed(() => total.value > 0 && items.value.length >= total.value)
const filterCount = computed(() => countPropertyFilters(filters.value))
const activeCount = computed(() => filterCount.value + (keyword.value.trim() ? 1 : 0))
const filterLabels = computed(() => getPropertyFilterLabels(filters.value))

function buildQuery(): PageSlPropertyInput {
  return {
    page: page.value,
    pageSize,
    title: keyword.value.trim() || undefined,
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

function onFilterConfirm(nextFilters: PropertyFilterState, nextKeyword?: string) {
  filters.value = nextFilters
  if (nextKeyword !== undefined)
    keyword.value = nextKeyword
  load(true)
}

function resetFilters() {
  filters.value = {}
  keyword.value = ''
  load(true)
}

function clearAllFilters() {
  keyword.value = ''
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
    content: `确定删除「${item.title}」？删除后将从列表和销控中移除。`,
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
      <wd-button size="small" type="primary" icon="add" @click="openForm">
        新增
      </wd-button>
    </view>

    <sl-property-filter-bar
      :filters="filters"
      :keyword="keyword"
      mount-key="admin-property-list"
      @confirm="onFilterConfirm"
      @reset="resetFilters"
    />

    <view v-if="activeCount" class="active-summary sl-card">
      <view class="active-summary__body">
        <wd-tag v-if="keyword" plain type="primary">
          搜索：{{ keyword }}
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
      <text class="result-head__total">{{ total }} 套</text>
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
  margin: 30rpx 2rpx 18rpx;
}

.result-head__title,
.result-head__desc,
.result-head__total {
  display: block;
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
