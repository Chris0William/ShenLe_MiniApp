<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  getPropertyPage,
  deleteProperty,
  updatePropertyStatus,
} from '@/api/property'
import type { SlPropertyListOutput } from '@/types/property'
import { downloadFile } from '@/api/file'

// ---- Page params ----
const communityId = ref(0)
const communityName = ref('')

onMounted(() => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  const opts = current?.$page?.options || current?.options || {}
  communityId.value = Number(opts.communityId) || 0
  communityName.value = decodeURIComponent(opts.communityName || '')
  uni.setNavigationBarTitle({ title: communityName.value || '房源列表' })
  loadData(true)
})

// ---- Status tabs ----
const statusTabs = [
  { label: '全部', value: undefined as number | undefined },
  { label: '空置', value: 0 },
  { label: '预定', value: 1 },
  { label: '已租', value: 2 },
]
const activeStatus = ref<number | undefined>(undefined)
const keyword = ref('')

function onTabChange(value: number | undefined) {
  activeStatus.value = value
  loadData(true)
}

function onSearch() {
  loadData(true)
}

// ---- Pagination ----
const page = ref(1)
const pageSize = 10
const list = ref<SlPropertyListOutput[]>([])
const loadStatus = ref<'more' | 'loading' | 'noMore'>('more')

async function loadData(reset = false) {
  if (reset) {
    page.value = 1
    list.value = []
  }
  if (loadStatus.value === 'loading') return
  loadStatus.value = 'loading'
  try {
    const res = await getPropertyPage({
      page: page.value,
      pageSize,
      communityId: communityId.value,
      status: activeStatus.value,
      title: keyword.value || undefined,
    })
    const newItems = res.items
    list.value = reset ? newItems : [...list.value, ...newItems]
    loadStatus.value = newItems.length < pageSize ? 'noMore' : 'more'
    page.value++
    loadCovers(newItems)
  } catch {
    loadStatus.value = 'more'
  }
}

function onLoadMore() {
  if (loadStatus.value === 'more') loadData()
}

function onRefresh() {
  loadData(true)
}

// ---- Cover cache ----
const coverCache = ref<Record<string, string>>({})

function coverSrc(item: SlPropertyListOutput): string {
  if (!item.coverImageId) return ''
  return coverCache.value[String(item.coverImageId)] || ''
}

async function loadCovers(items: SlPropertyListOutput[]) {
  for (const item of items) {
    const id = item.coverImageId
    if (!id || coverCache.value[String(id)]) continue
    try {
      const path = await downloadFile(String(id))
      coverCache.value[String(id)] = path
    } catch {}
  }
}

// ---- Actions ----
function onCardTap(id: number) {
  uni.navigateTo({ url: `/pages/common/property-detail/index?id=${id}` })
}

function onEdit(id: number) {
  uni.navigateTo({ url: `/pages/common/property-form/index?id=${id}` })
}

// ---- Manage modal ----
const showManageModal = ref(false)
const manageTargetId = ref(0)
const statusOptions = [
  { label: '空置', value: 0, color: '#22C55E' },
  { label: '预定', value: 1, color: '#F97316' },
  { label: '已租', value: 2, color: '#94A3B8' },
]

function onManage(id: number) {
  manageTargetId.value = id
  showManageModal.value = true
}

async function confirmStatusChange(status: number) {
  showManageModal.value = false
  try {
    await updatePropertyStatus({ id: manageTargetId.value, status })
    uni.showToast({ title: '状态已更新', icon: 'success' })
    loadData(true)
  } catch {}
}

function onDeleteFromModal() {
  showManageModal.value = false
  uni.showModal({
    title: '确认删除',
    content: '删除后不可恢复，确定删除？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await deleteProperty({ id: String(manageTargetId.value) })
          uni.showToast({ title: '删除成功', icon: 'success' })
          loadData(true)
        } catch {}
      }
    },
  })
}

function goAddProperty() {
  uni.navigateTo({
    url: `/pages/common/property-form/index?communityId=${communityId.value}`,
  })
}
</script>

<template>
  <view class="page">
    <!-- Search -->
    <view class="search-row">
      <view class="search-bar">
        <text class="search-icon">&#x1F50D;</text>
        <input
          v-model="keyword"
          class="search-input"
          placeholder="搜索房号/标题"
          placeholder-class="search-placeholder"
          confirm-type="search"
          @confirm="onSearch"
        />
      </view>
    </view>

    <!-- Status tabs -->
    <scroll-view scroll-x class="status-tabs" :show-scrollbar="false">
      <view
        v-for="tab in statusTabs"
        :key="tab.label"
        class="tab"
        :class="{ active: activeStatus === tab.value }"
        @tap="onTabChange(tab.value)"
      >
        <text>{{ tab.label }}</text>
        <view v-if="activeStatus === tab.value" class="tab-indicator" />
      </view>
    </scroll-view>

    <!-- Property List -->
    <scroll-view
      scroll-y
      class="list-area"
      refresher-enabled
      :refresher-triggered="false"
      @refresherrefresh="onRefresh"
      @scrolltolower="onLoadMore"
    >
      <view v-if="list.length === 0 && loadStatus !== 'loading'" class="empty-wrap">
        <sl-empty-state text="暂无房源数据" />
      </view>
      <view v-else class="property-list">
        <view
          v-for="item in list"
          :key="item.id"
          class="property-card"
          @tap="onCardTap(item.id)"
        >
          <!-- Cover -->
          <view class="card-cover-wrap">
            <image
              v-if="coverSrc(item)"
              class="card-cover"
              :src="coverSrc(item)"
              mode="aspectFill"
            />
            <view v-else class="card-cover placeholder-cover">
              <text class="placeholder-text">暂无图片</text>
            </view>
          </view>

          <!-- Content -->
          <view class="card-body">
            <view class="card-title-row">
              <text class="card-title">{{ item.title }}</text>
              <view class="badge" :class="'s' + item.status">
                <text>{{ item.statusName }}</text>
              </view>
            </view>
            <text class="card-desc">{{ item.houseType }} | {{ item.area ?? '-' }}㎡</text>
            <view class="card-bottom">
              <text class="card-price">¥{{ item.rentPrice }}<text class="price-unit">/月</text></text>
              <view class="card-actions">
                <view class="act-btn outline" @tap.stop="onEdit(item.id)">
                  <text>编辑</text>
                </view>
                <view class="act-btn solid" @tap.stop="onManage(item.id)">
                  <text>管理</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <sl-load-more :status="loadStatus" />
      </view>
      <view style="height: 200rpx" />
    </scroll-view>

    <!-- FAB -->
    <view class="fab" @tap="goAddProperty">
      <text class="fab-icon">+</text>
    </view>

    <!-- Manage Modal -->
    <view v-if="showManageModal" class="modal-mask" @tap="showManageModal = false">
      <view class="modal-sheet" @tap.stop>
        <text class="modal-title">房源管理</text>

        <text class="modal-subtitle">修改状态</text>
        <view class="modal-options">
          <view
            v-for="opt in statusOptions"
            :key="opt.value"
            class="modal-option"
            @tap="confirmStatusChange(opt.value)"
          >
            <view class="opt-dot" :style="{ backgroundColor: opt.color }" />
            <text>{{ opt.label }}</text>
          </view>
        </view>

        <view class="modal-divider" />

        <view class="modal-danger" @tap="onDeleteFromModal">
          <text>删除房源</text>
        </view>

        <view class="modal-cancel" @tap="showManageModal = false">
          <text>取消</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  height: 100vh;
  background-color: $sl-bg-page;
  display: flex;
  flex-direction: column;
}

// ---- Search ----
.search-row {
  padding: $sl-spacing-md $sl-spacing-lg;
  background-color: $sl-bg-card;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  padding: 0 $sl-spacing-md;
  background-color: $sl-bg-hover;
  border-radius: $sl-border-radius;
  height: 80rpx;
}

.search-icon {
  font-size: $sl-font-md;
  color: $sl-text-placeholder;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  font-size: $sl-font-md;
  color: $sl-text-primary;
}

.search-placeholder {
  color: $sl-text-placeholder;
}

// ---- Status tabs ----
.status-tabs {
  display: flex;
  white-space: nowrap;
  padding: 0 $sl-spacing-lg;
  background-color: $sl-bg-card;
  border-bottom: 1rpx solid $sl-border-color-light;
}

.tab {
  display: inline-flex;
  align-items: center;
  gap: 4rpx;
  padding: $sl-spacing-sm 0;
  margin-right: $sl-spacing-xl;
  position: relative;
  font-size: $sl-font-md;
  font-weight: 500;
  color: $sl-text-secondary;

  &.active {
    color: $sl-primary-dark;
    font-weight: 600;
  }
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4rpx;
  background-color: $sl-primary-dark;
  border-radius: 2rpx 2rpx 0 0;
}

// ---- List ----
.list-area {
  flex: 1;
  height: 0;
}

.empty-wrap {
  padding: $sl-spacing-xl;
}

.property-list {
  padding: $sl-spacing-lg;
  display: flex;
  flex-direction: column;
  gap: $sl-spacing-md;
}

// ---- Property Card ----
.property-card {
  display: flex;
  gap: $sl-spacing-lg;
  padding: $sl-spacing-lg;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius-lg;
  box-shadow: $sl-shadow-sm;
}

.card-cover-wrap {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  flex-shrink: 0;
}

.card-cover {
  width: 100%;
  height: 100%;
  border-radius: $sl-border-radius;
  background-color: $sl-bg-hover;
}

.placeholder-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #F1F5F9;
}

.placeholder-text {
  font-size: 22rpx;
  color: $sl-text-placeholder;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.card-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: $sl-spacing-xs;
}

.card-title {
  flex: 1;
  font-size: $sl-font-md;
  font-weight: 700;
  color: $sl-text-primary;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: $sl-spacing-sm;
}

.badge {
  padding: 4rpx $sl-spacing-sm;
  font-size: $sl-font-xs;
  font-weight: 500;
  border-radius: 12rpx;
  border: 1rpx solid;
  flex-shrink: 0;

  &.s0 { background-color: #D1FAE5; color: #047857; border-color: #A7F3D0; }
  &.s1 { background-color: #FFEDD5; color: #C2410C; border-color: #FED7AA; }
  &.s2 { background-color: #DBEAFE; color: #1D4ED8; border-color: #BFDBFE; }
}

.card-desc {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-bottom: $sl-spacing-sm;
}

.card-bottom {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-top: auto;
}

.card-price {
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-price;
}

.price-unit {
  font-size: $sl-font-sm;
  font-weight: 400;
  color: $sl-text-placeholder;
}

// ---- Action Buttons ----
.card-actions {
  display: flex;
  gap: $sl-spacing-sm;
}

.act-btn {
  padding: 8rpx $sl-spacing-sm;
  border-radius: $sl-border-radius-sm;
  font-size: $sl-font-sm;

  &.outline {
    color: #475569;
    border: 1rpx solid $sl-border-color;
  }

  &.solid {
    color: #ffffff;
    background-color: $sl-text-primary;
  }
}

// ---- FAB ----
.fab {
  position: fixed;
  right: $sl-spacing-xl;
  bottom: calc(48rpx + env(safe-area-inset-bottom));
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background-color: $sl-primary-dark;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12rpx 32rpx rgba(37, 99, 235, 0.35);
  z-index: 10;
}

.fab-icon {
  font-size: 56rpx;
  color: #ffffff;
  line-height: 1;
}

// ---- Modal Sheet ----
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-end;
  z-index: 999;
}

.modal-sheet {
  width: 100%;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius-xl $sl-border-radius-xl 0 0;
  padding: $sl-spacing-xl $sl-spacing-lg;
  padding-bottom: calc(#{$sl-spacing-xl} + env(safe-area-inset-bottom));
}

.modal-title {
  display: block;
  font-size: $sl-font-lg;
  font-weight: 700;
  color: $sl-text-primary;
  text-align: center;
  margin-bottom: $sl-spacing-lg;
}

.modal-subtitle {
  display: block;
  font-size: $sl-font-sm;
  font-weight: 600;
  color: $sl-text-secondary;
  margin-bottom: $sl-spacing-md;
}

.modal-options {
  display: flex;
  flex-direction: column;
  gap: $sl-spacing-sm;
}

.modal-option {
  display: flex;
  align-items: center;
  gap: $sl-spacing-md;
  padding: $sl-spacing-md;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius;
}

.opt-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
}

.modal-divider {
  height: 1rpx;
  background-color: $sl-border-color-light;
  margin: $sl-spacing-lg 0;
}

.modal-danger {
  padding: $sl-spacing-md;
  text-align: center;
  font-size: $sl-font-md;
  color: $sl-danger;
  background-color: rgba(239, 68, 68, 0.06);
  border-radius: $sl-border-radius;
}

.modal-cancel {
  margin-top: $sl-spacing-md;
  padding: $sl-spacing-md;
  text-align: center;
  font-size: $sl-font-md;
  color: $sl-text-secondary;
}
</style>
