<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import {
  getTagPage,
  getTagCategoryList,
  addTag,
  updateTag,
  deleteTag,
} from '@/api/tag'
import type { SlTagOutput, SlTagCategoryOutput } from '@/types/tag'

const appStore = useAppStore()

// Categories
const categories = ref<SlTagCategoryOutput[]>([])
const activeCategory = ref('')

// List
const list = ref<SlTagOutput[]>([])
const pg = ref(1)
const pageSize = 20
const loadStatus = ref<'more' | 'loading' | 'noMore'>('more')

const filteredList = computed(() => {
  if (!activeCategory.value) return list.value
  return list.value.filter(t => t.category === activeCategory.value)
})

// Form
const showForm = ref(false)
const isEdit = ref(false)
const form = ref({
  id: '',
  name: '',
  category: '',
  color: '#1890ff',
  icon: '',
  orderNo: 0,
  remark: '',
})

const TAG_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb',
]

async function loadCategories() {
  try {
    categories.value = await getTagCategoryList()
  } catch {}
}

async function loadData(reset = false) {
  if (reset) { pg.value = 1; list.value = [] }
  if (loadStatus.value === 'loading') return
  loadStatus.value = 'loading'
  try {
    const res = await getTagPage({
      page: pg.value,
      pageSize,
    })
    list.value = reset ? res.items : [...list.value, ...res.items]
    loadStatus.value = res.items.length < pageSize ? 'noMore' : 'more'
    pg.value++
  } catch {
    loadStatus.value = 'more'
  }
}

function switchCategory(cat: string) {
  activeCategory.value = cat === activeCategory.value ? '' : cat
}

function openAdd() {
  isEdit.value = false
  form.value = {
    id: '',
    name: '',
    category: activeCategory.value || (categories.value[0]?.category ?? ''),
    color: '#1890ff',
    icon: '',
    orderNo: 0,
    remark: '',
  }
  showForm.value = true
}

function openEdit(item: SlTagOutput) {
  isEdit.value = true
  form.value = {
    id: item.id,
    name: item.name,
    category: item.category,
    color: item.color || '#1890ff',
    icon: item.icon || '',
    orderNo: item.orderNo || 0,
    remark: item.remark || '',
  }
  showForm.value = true
}

async function onSubmit() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入标签名称', icon: 'none' })
    return
  }
  if (!form.value.category) {
    uni.showToast({ title: '请选择分类', icon: 'none' })
    return
  }
  try {
    if (isEdit.value) {
      await updateTag({
        id: form.value.id,
        name: form.value.name,
        category: form.value.category,
        color: form.value.color || undefined,
        icon: form.value.icon || undefined,
        orderNo: form.value.orderNo,
        remark: form.value.remark || undefined,
      })
      uni.showToast({ title: '更新成功', icon: 'success' })
    } else {
      await addTag({
        name: form.value.name,
        category: form.value.category,
        color: form.value.color || undefined,
        icon: form.value.icon || undefined,
        orderNo: form.value.orderNo,
        remark: form.value.remark || undefined,
      })
      uni.showToast({ title: '新增成功', icon: 'success' })
    }
    showForm.value = false
    loadData(true)
  } catch {}
}

function onDelete(item: SlTagOutput) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除标签「${item.name}」？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deleteTag({ id: item.id })
        uni.showToast({ title: '删除成功', icon: 'success' })
        loadData(true)
      } catch {}
    },
  })
}

function getCategoryName(cat: string): string {
  return categories.value.find(c => c.category === cat)?.categoryName || cat
}

function onLoadMore() {
  if (loadStatus.value === 'more') loadData()
}

onShow(() => {
  loadCategories()
  loadData(true)
})
</script>

<template>
  <view class="page">
    <view class="page-header" :style="{ paddingTop: appStore.headerPaddingStyle(12) }">
      <text class="page-title">标签管理</text>
    </view>

    <!-- Category tabs -->
    <scroll-view scroll-x class="tab-scroll">
      <view class="tab-bar">
        <view
          class="tab-item"
          :class="{ active: !activeCategory }"
          @tap="switchCategory('')"
        >
          全部
        </view>
        <view
          v-for="c in categories"
          :key="c.category"
          class="tab-item"
          :class="{ active: activeCategory === c.category }"
          @tap="switchCategory(c.category)"
        >
          {{ c.categoryName }}
        </view>
      </view>
    </scroll-view>

    <!-- Tag list -->
    <scroll-view scroll-y class="list-area" @scrolltolower="onLoadMore">
      <view v-if="filteredList.length === 0 && loadStatus !== 'loading'" class="empty-wrap">
        <sl-empty-state text="暂无标签数据" />
      </view>
      <view v-for="item in filteredList" :key="item.id" class="tag-card">
        <view class="tag-left">
          <view class="tag-color" :style="{ backgroundColor: item.color || '#1890ff' }" />
          <view class="tag-info">
            <text class="tag-name">{{ item.name }}</text>
            <text class="tag-cat">{{ getCategoryName(item.category) }}</text>
          </view>
        </view>
        <view class="tag-actions">
          <text class="act-btn edit" @tap="openEdit(item)">编辑</text>
          <text class="act-btn del" @tap="onDelete(item)">删除</text>
        </view>
      </view>
      <sl-load-more v-if="filteredList.length > 0" :status="loadStatus" />
    </scroll-view>

    <!-- FAB -->
    <view class="fab" @tap="openAdd">
      <text class="fab-icon">+</text>
    </view>

    <!-- Form Modal -->
    <view v-if="showForm" class="modal-mask" @tap="showForm = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-title">{{ isEdit ? '编辑标签' : '新增标签' }}</text>
        <view class="form-group">
          <text class="form-label">名称</text>
          <input v-model="form.name" class="form-input" placeholder="请输入标签名称" />
        </view>
        <view class="form-group">
          <text class="form-label">分类</text>
          <view class="cat-options">
            <view
              v-for="c in categories"
              :key="c.category"
              class="cat-chip"
              :class="{ active: form.category === c.category }"
              @tap="form.category = c.category"
            >
              {{ c.categoryName }}
            </view>
          </view>
        </view>
        <view class="form-group">
          <text class="form-label">颜色</text>
          <view class="color-options">
            <view
              v-for="c in TAG_COLORS"
              :key="c"
              class="color-dot"
              :class="{ active: form.color === c }"
              :style="{ backgroundColor: c }"
              @tap="form.color = c"
            />
          </view>
        </view>
        <view class="form-group">
          <text class="form-label">排序</text>
          <input v-model.number="form.orderNo" class="form-input" type="number" placeholder="0" />
        </view>
        <view class="form-group">
          <text class="form-label">备注</text>
          <input v-model="form.remark" class="form-input" placeholder="选填" />
        </view>
        <view class="form-actions">
          <view class="form-btn cancel" @tap="showForm = false">取消</view>
          <view class="form-btn confirm" @tap="onSubmit">确定</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background-color: $sl-bg-page;
}

.page-header {
  padding: $sl-spacing-md $sl-spacing-lg;
  // padding-top 由 :style 动态设置
  background-color: $sl-bg-card;
}

.page-title {
  font-size: $sl-font-xl;
  font-weight: 700;
  color: $sl-text-primary;
}

.tab-scroll {
  background-color: $sl-bg-card;
  border-bottom: 1rpx solid $sl-border-color;
  flex-shrink: 0;
  white-space: nowrap;
}

.tab-bar {
  display: inline-flex;
  gap: $sl-spacing-sm;
  padding: $sl-spacing-sm $sl-spacing-md;
}

.tab-item {
  display: inline-block;
  padding: $sl-spacing-xs $sl-spacing-md;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  background-color: $sl-bg-page;
  border-radius: 30rpx;
  flex-shrink: 0;

  &.active {
    color: $sl-primary;
    background-color: rgba(24, 144, 255, 0.1);
    font-weight: 600;
  }
}

.list-area {
  flex: 1;
  padding: $sl-spacing-sm;
  padding-bottom: 200rpx;
}

.empty-wrap {
  padding: $sl-spacing-xl;
}

.tag-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $sl-spacing-md;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  margin-bottom: $sl-spacing-sm;
}

.tag-left {
  display: flex;
  align-items: center;
  gap: $sl-spacing-md;
}

.tag-color {
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  flex-shrink: 0;
}

.tag-info {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.tag-name {
  font-size: $sl-font-md;
  font-weight: 600;
  color: $sl-text-primary;
}

.tag-cat {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

.tag-actions {
  display: flex;
  gap: $sl-spacing-sm;
}

.act-btn {
  font-size: $sl-font-xs;
  padding: $sl-spacing-xs $sl-spacing-sm;
  border-radius: 6rpx;

  &.edit {
    color: #faad14;
    background-color: rgba(250, 173, 20, 0.1);
  }

  &.del {
    color: $sl-danger;
    background-color: rgba(255, 77, 79, 0.1);
  }
}

.fab {
  position: fixed;
  right: $sl-spacing-lg;
  bottom: calc(#{$sl-spacing-xl} + #{$sl-safe-bottom});
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background-color: $sl-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.4);
}

.fab-icon {
  font-size: 48rpx;
  color: #ffffff;
  font-weight: 300;
}

// Modal
.modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-panel {
  width: 85%;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  padding: $sl-spacing-lg;
}

.modal-title {
  display: block;
  font-size: $sl-font-lg;
  font-weight: 600;
  color: $sl-text-primary;
  margin-bottom: $sl-spacing-md;
  text-align: center;
}

.form-group {
  margin-bottom: $sl-spacing-md;
}

.form-label {
  display: block;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-bottom: $sl-spacing-xs;
}

.form-input {
  width: 100%;
  height: 80rpx;
  padding: 0 $sl-spacing-md;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius-sm;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  box-sizing: border-box;
}

.cat-options {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-sm;
}

.cat-chip {
  padding: $sl-spacing-xs $sl-spacing-md;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  background-color: $sl-bg-page;
  border-radius: 30rpx;

  &.active {
    color: $sl-primary;
    background-color: rgba(24, 144, 255, 0.1);
    font-weight: 600;
  }
}

.color-options {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-md;
}

.color-dot {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  position: relative;

  &.active::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20rpx;
    height: 20rpx;
    border-radius: 50%;
    background-color: #ffffff;
  }
}

.form-actions {
  display: flex;
  gap: $sl-spacing-sm;
  margin-top: $sl-spacing-lg;
}

.form-btn {
  flex: 1;
  text-align: center;
  padding: $sl-spacing-sm;
  border-radius: $sl-border-radius;
  font-size: $sl-font-md;
  font-weight: 600;

  &.cancel {
    background-color: $sl-bg-page;
    color: $sl-text-secondary;
  }

  &.confirm {
    background-color: $sl-primary;
    color: #ffffff;
  }
}
</style>
