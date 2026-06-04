<script setup lang="ts">
import type { AddSlTagInput, SlTagCategoryOutput, SlTagOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { addTag, deleteTag, getTagCategoryList, getTagPage, updateTag } from '@/api/tag'

definePage({
  style: {
    navigationBarTitleText: '标签管理',
    enablePullDownRefresh: true,
  },
})

interface TagForm {
  id: string
  name: string
  category: string
  color: string
  icon: string
  orderNo: string
  status: number
  remark: string
}

const fallbackCategories: SlTagCategoryOutput[] = [
  { value: 'house', label: '房源标签' },
  { value: 'facility', label: '配套设施' },
  { value: 'feature', label: '房源特色' },
]
const colorOptions = ['#126b4f', '#e4a11b', '#2f80ed', '#c94832', '#7c3aed', '#0f9f86', '#6b7280']
const statusOptions = [
  { value: 0, label: '正常' },
  { value: 1, label: '禁用' },
] as const

const categories = ref<SlTagCategoryOutput[]>(fallbackCategories)
const activeCategory = ref('')
const keyword = ref('')
const list = ref<SlTagOutput[]>([])
const page = ref(1)
const pageSize = 20
const total = ref(0)
const loading = ref(false)
const finished = ref(false)
const formVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)

const form = reactive<TagForm>({
  id: '',
  name: '',
  category: '',
  color: '#126b4f',
  icon: '',
  orderNo: '100',
  status: 0,
  remark: '',
})

const categoryNames = computed(() => categories.value.map(item => item.label))
const formCategoryIndex = computed(() => Math.max(0, categories.value.findIndex(item => item.value === form.category)))
const grouped = computed(() => categories.value.map(category => ({
  ...category,
  count: list.value.filter(item => item.category === category.value).length,
})))

function toNumber(value: string, fallback?: number) {
  if (value === '')
    return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function categoryLabel(value: string) {
  return categories.value.find(item => item.value === value)?.label || value
}

function statusLabel(status?: number) {
  return status === 1 ? '禁用' : '正常'
}

async function loadCategories() {
  try {
    const res = await getTagCategoryList()
    categories.value = res.length ? res : fallbackCategories
  }
  catch {
    categories.value = fallbackCategories
  }
}

async function loadData(reset = false) {
  if (loading.value)
    return
  if (reset) {
    page.value = 1
    list.value = []
    finished.value = false
  }
  if (finished.value)
    return

  loading.value = true
  try {
    const res = await getTagPage({
      page: page.value,
      pageSize,
      name: keyword.value.trim() || undefined,
      category: activeCategory.value || undefined,
    })
    list.value = reset ? res.items : [...list.value, ...res.items]
    total.value = res.total
    finished.value = list.value.length >= res.total || res.items.length < pageSize
    page.value += 1
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function switchCategory(value: string) {
  activeCategory.value = activeCategory.value === value ? '' : value
  loadData(true)
}

function onFormCategoryChange(event: any) {
  const idx = Number(event.detail.value)
  form.category = categories.value[idx]?.value || ''
}

function resetForm(item?: SlTagOutput) {
  isEdit.value = !!item
  form.id = item ? String(item.id) : ''
  form.name = item?.name || ''
  form.category = item?.category || activeCategory.value || categories.value[0]?.value || ''
  form.color = item?.color || '#126b4f'
  form.icon = item?.icon || ''
  form.orderNo = String(item?.orderNo ?? 100)
  form.status = item?.status ?? 0
  form.remark = item?.remark || ''
}

function openAdd() {
  resetForm()
  formVisible.value = true
}

function openEdit(item: SlTagOutput) {
  resetForm(item)
  formVisible.value = true
}

function buildPayload(): AddSlTagInput {
  return {
    name: form.name.trim(),
    category: form.category,
    color: form.color || undefined,
    icon: form.icon.trim() || undefined,
    orderNo: toNumber(form.orderNo, 100),
    status: form.status,
    remark: form.remark.trim() || undefined,
  }
}

async function submitForm() {
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入标签名称', icon: 'none' })
    return
  }
  if (!form.category) {
    uni.showToast({ title: '请选择标签分类', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value)
      await updateTag({ ...payload, id: form.id })
    else
      await addTag(payload)
    uni.showToast({ title: isEdit.value ? '更新成功' : '新增成功', icon: 'success' })
    formVisible.value = false
    await loadData(true)
  }
  finally {
    submitting.value = false
  }
}

function confirmDelete(item: SlTagOutput) {
  uni.showModal({
    title: '删除标签',
    content: `确定删除「${item.name}」？已被房源使用时后端会拦截。`,
    success: async (res) => {
      if (!res.confirm)
        return
      await deleteTag(item.id)
      uni.showToast({ title: '删除成功', icon: 'success' })
      await loadData(true)
    },
  })
}

onLoad(async () => {
  await loadCategories()
  await loadData(true)
})
onPullDownRefresh(() => loadData(true))
onReachBottom(() => loadData())
</script>

<template>
  <view class="sl-page tag-page">
    <view class="toolbar sl-card">
      <view class="search-row">
        <input v-model="keyword" class="search-input" placeholder="搜索标签名称" confirm-type="search" @confirm="loadData(true)">
        <wd-button size="small" type="primary" @click="loadData(true)">
          搜索
        </wd-button>
      </view>
      <scroll-view scroll-x class="category-scroll">
        <view class="category-row">
          <view class="chip" :class="{ active: !activeCategory }" @tap="switchCategory('')">
            全部
          </view>
          <view
            v-for="item in grouped"
            :key="item.value"
            class="chip"
            :class="{ active: activeCategory === item.value }"
            @tap="switchCategory(item.value)"
          >
            {{ item.label }} {{ item.count ? item.count : '' }}
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="sl-section-head">
      <text class="sl-section-title">标签列表</text>
      <text class="sl-section-extra">{{ list.length }}/{{ total }}</text>
    </view>

    <view v-if="!list.length && !loading" class="empty sl-card">
      <wd-icon name="discount" size="38px" color="#8ea099" />
      <text>暂无标签数据</text>
    </view>

    <view class="tag-list">
      <view v-for="item in list" :key="String(item.id)" class="tag-card sl-card">
        <view class="tag-left">
          <view class="tag-color" :style="{ background: item.color || '#126b4f' }" />
          <view>
            <view class="title-line">
              <text class="tag-name">{{ item.name }}</text>
              <wd-tag :type="item.status === 0 ? 'success' : 'default'" plain>
                {{ statusLabel(item.status) }}
              </wd-tag>
            </view>
            <text class="tag-meta">{{ categoryLabel(item.category) }} · 排序 {{ item.orderNo }}</text>
          </view>
        </view>
        <view class="actions">
          <wd-button size="small" type="primary" plain @click="openEdit(item)">
            编辑
          </wd-button>
          <wd-button size="small" type="danger" plain @click="confirmDelete(item)">
            删除
          </wd-button>
        </view>
      </view>
    </view>

    <view v-if="loading" class="load-tip">
      加载中...
    </view>
    <view v-else-if="finished && list.length" class="load-tip">
      已经到底了
    </view>

    <view class="fab" @tap="openAdd">
      <wd-icon name="add" size="26px" color="#fff" />
    </view>

    <wd-popup v-model="formVisible" position="bottom" custom-style="border-radius: 30rpx 30rpx 0 0; overflow: hidden;" safe-area-inset-bottom>
      <view class="form-sheet">
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ isEdit ? '编辑标签' : '新增标签' }}</text>
            <text class="sheet-sub">标签用于房源展示、筛选和亮点描述。</text>
          </view>
          <wd-icon name="close" size="22px" color="#72817b" @click="formVisible = false" />
        </view>

        <view class="form-body">
          <view class="form-row">
            <text>标签名称</text>
            <input v-model="form.name" placeholder="如：近地铁 / 家私齐全">
          </view>
          <picker mode="selector" :value="formCategoryIndex" :range="categoryNames" @change="onFormCategoryChange">
            <view class="form-row form-row--picker">
              <text>分类</text>
              <text>{{ categoryLabel(form.category) || '请选择' }}</text>
            </view>
          </picker>
          <view class="form-row">
            <text>颜色</text>
            <view class="color-row">
              <view
                v-for="color in colorOptions"
                :key="color"
                class="color-dot"
                :class="{ active: form.color === color }"
                :style="{ background: color }"
                @tap="form.color = color"
              />
            </view>
          </view>
          <view class="grid-2">
            <view class="form-row">
              <text>图标</text>
              <input v-model="form.icon" placeholder="可选">
            </view>
            <view class="form-row">
              <text>排序</text>
              <input v-model="form.orderNo" type="number">
            </view>
          </view>
          <view class="form-row">
            <text>状态</text>
            <view class="segmented">
              <view
                v-for="item in statusOptions"
                :key="item.value"
                :class="{ active: form.status === item.value }"
                @tap="form.status = item.value"
              >
                {{ item.label }}
              </view>
            </view>
          </view>
          <view class="form-row form-row--textarea">
            <text>备注</text>
            <textarea v-model="form.remark" placeholder="内部管理备注" />
          </view>
        </view>

        <view class="sheet-actions">
          <wd-button plain block type="default" @click="formVisible = false">
            取消
          </wd-button>
          <wd-button block type="primary" :loading="submitting" @click="submitForm">
            保存
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.tag-page {
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}

.toolbar {
  margin-top: 22rpx;
  padding: 22rpx;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.search-input {
  flex: 1;
  height: 72rpx;
  box-sizing: border-box;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #f2f6f0;
  font-size: 26rpx;
}

.category-scroll {
  margin-top: 18rpx;
  white-space: nowrap;
}

.category-row {
  display: inline-flex;
  gap: 12rpx;
}

.chip {
  padding: 12rpx 22rpx;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 999rpx;
  background: #f7faf4;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.chip.active {
  background: var(--sl-brand);
  color: #fff;
}

.tag-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.tag-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 24rpx;
}

.tag-left,
.title-line,
.actions,
.sheet-head,
.sheet-actions,
.color-row {
  display: flex;
  align-items: center;
}

.tag-left {
  min-width: 0;
  flex: 1;
  gap: 18rpx;
}

.tag-color {
  width: 54rpx;
  height: 54rpx;
  flex: 0 0 54rpx;
  border: 6rpx solid #fff;
  border-radius: 999rpx;
  box-shadow: 0 8rpx 18rpx rgb(18 107 79 / 14%);
}

.title-line {
  gap: 10rpx;
}

.tag-name,
.sheet-title {
  font-size: 31rpx;
  font-weight: 850;
}

.tag-meta,
.sheet-sub,
.load-tip {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.tag-meta,
.sheet-sub {
  display: block;
  margin-top: 8rpx;
}

.actions {
  gap: 10rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  padding: 70rpx 20rpx;
  color: var(--sl-muted);
}

.load-tip {
  padding: 26rpx 0;
  text-align: center;
}

.fab {
  position: fixed;
  right: 34rpx;
  bottom: calc(92rpx + env(safe-area-inset-bottom));
  z-index: 8;
  display: flex;
  width: 96rpx;
  height: 96rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: linear-gradient(135deg, var(--sl-brand), #24815f);
  box-shadow: 0 18rpx 38rpx rgb(18 107 79 / 28%);
}

.form-sheet {
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.sheet-head {
  justify-content: space-between;
  gap: 18rpx;
}

.form-body {
  max-height: 62vh;
  margin-top: 22rpx;
  overflow-y: auto;
}

.form-row {
  margin-bottom: 18rpx;
  padding: 18rpx 20rpx;
  border-radius: 18rpx;
  background: #f6f9f4;
}

.form-row text:first-child {
  display: block;
  margin-bottom: 10rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.form-row input,
.form-row textarea {
  width: 100%;
  color: var(--sl-ink);
  font-size: 28rpx;
}

.form-row textarea {
  min-height: 120rpx;
}

.form-row--picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.form-row--picker text:first-child {
  margin-bottom: 0;
}

.form-row--picker text:last-child {
  color: var(--sl-ink);
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
}

.color-row {
  gap: 16rpx;
}

.color-dot {
  width: 52rpx;
  height: 52rpx;
  border: 6rpx solid #fff;
  border-radius: 999rpx;
  box-shadow: 0 8rpx 18rpx rgb(18 107 79 / 14%);
}

.color-dot.active {
  outline: 4rpx solid rgb(18 107 79 / 24%);
}

.segmented {
  display: inline-flex;
  overflow: hidden;
  border-radius: 999rpx;
  background: #eaf2e8;
}

.segmented view {
  padding: 12rpx 24rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.segmented .active {
  background: var(--sl-brand);
  color: #fff;
}

.sheet-actions {
  gap: 16rpx;
  margin-top: 24rpx;
}
</style>
