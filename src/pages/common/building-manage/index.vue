<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { getBuildingList, getBuildingDetail, addBuilding, updateBuilding, deleteBuilding } from '@/api/building'
import { getCommunityList } from '@/api/community'
import { uploadFile, downloadFile } from '@/api/file'
import type { SlBuildingOutput } from '@/types/building'
import type { SlCommunitySelectOutput } from '@/types/community'

const appStore = useAppStore()
const communityId = ref('')
const communityName = ref('')
const list = ref<SlBuildingOutput[]>([])
const communities = ref<SlCommunitySelectOutput[]>([])

// Form
const showForm = ref(false)
const isEdit = ref(false)
const form = ref({
  id: '',
  name: '',
  communityId: '',
  totalFloors: 1,
  unitsPerFloor: 1,
  orderNo: 0,
  imageIds: [] as string[],
  imageUrls: [] as string[],
  coverImageId: '',
})

async function loadData() {
  try {
    list.value = await getBuildingList({
      communityId: communityId.value || undefined,
    })
  } catch {}
}

async function loadCommunities() {
  try {
    communities.value = await getCommunityList({})
    if (communityId.value) {
      const c = communities.value.find(c => c.id === communityId.value)
      if (c) communityName.value = c.name
    }
  } catch {}
}

function openAdd() {
  isEdit.value = false
  form.value = {
    id: '',
    name: '',
    communityId: communityId.value,
    totalFloors: 1,
    unitsPerFloor: 1,
    orderNo: 0,
    imageIds: [],
    imageUrls: [],
    coverImageId: '',
  }
  showForm.value = true
}

async function openEdit(item: SlBuildingOutput) {
  isEdit.value = true
  form.value = {
    id: item.id,
    name: item.name,
    communityId: item.communityId,
    totalFloors: item.totalFloors || 1,
    unitsPerFloor: item.unitsPerFloor || 1,
    orderNo: item.orderNo || 0,
    imageIds: [],
    imageUrls: [],
    coverImageId: '',
  }
  // 加载详情中的图片（需要带 token 下载到本地临时路径）
  try {
    const detail = await getBuildingDetail(String(item.id))
    if (detail.images?.length) {
      const ids = detail.images.map(i => String(i.id))
      const urls: string[] = []
      for (const id of ids) {
        try { urls.push(await downloadFile(id)) } catch { urls.push('') }
      }
      form.value.imageIds = ids
      form.value.imageUrls = urls
    }
    if (detail.coverImageId) form.value.coverImageId = String(detail.coverImageId)
  } catch {}
  showForm.value = true
}

async function onChooseImage() {
  uni.chooseImage({
    count: 9 - form.value.imageIds.length,
    success: async (res) => {
      for (const path of res.tempFilePaths) {
        try {
          const file = await uploadFile(path)
          form.value.imageIds.push(file.id)
          form.value.imageUrls.push(path) // 直接用本地临时路径
          if (!form.value.coverImageId) form.value.coverImageId = file.id
        } catch {}
      }
    },
  })
}

function removeImage(idx: number) {
  const removedId = form.value.imageIds[idx]
  form.value.imageIds.splice(idx, 1)
  form.value.imageUrls.splice(idx, 1)
  if (form.value.coverImageId === removedId) {
    form.value.coverImageId = form.value.imageIds[0] || ''
  }
}

function setCover(idx: number) {
  form.value.coverImageId = form.value.imageIds[idx]
}

async function onSubmit() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入楼栋名称', icon: 'none' })
    return
  }
  if (!form.value.communityId) {
    uni.showToast({ title: '请选择所属楼盘', icon: 'none' })
    return
  }
  try {
    const imageData = {
      coverImageId: form.value.coverImageId ? Number(form.value.coverImageId) : undefined,
      imageIds: form.value.imageIds.map(Number),
    }
    if (isEdit.value) {
      await updateBuilding({
        id: form.value.id,
        name: form.value.name,
        communityId: form.value.communityId,
        totalFloors: form.value.totalFloors,
        orderNo: form.value.orderNo,
        ...imageData,
      })
      uni.showToast({ title: '更新成功', icon: 'success' })
    } else {
      await addBuilding({
        name: form.value.name,
        communityId: form.value.communityId,
        totalFloors: form.value.totalFloors,
        orderNo: form.value.orderNo,
        ...imageData,
      })
      uni.showToast({ title: '新增成功', icon: 'success' })
    }
    showForm.value = false
    loadData()
  } catch {}
}

function onDelete(item: SlBuildingOutput) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除楼栋「${item.name}」？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deleteBuilding({ id: item.id })
        uni.showToast({ title: '删除成功', icon: 'success' })
        loadData()
      } catch {}
    },
  })
}

// Community picker
const showPicker = ref(false)
function pickCommunity(id: string) {
  form.value.communityId = id
  showPicker.value = false
}
function getCommunityName(id: string): string {
  return communities.value.find(c => c.id === id)?.name || '未选择'
}

onLoad((options) => {
  if (options?.communityId) communityId.value = options.communityId
})

onShow(() => {
  loadCommunities()
  loadData()
})
</script>

<template>
  <view class="page">
    <view class="page-header" :style="{ paddingTop: appStore.headerPaddingStyle(12) }">
      <text class="page-title">楼栋管理</text>
      <text v-if="communityName" class="page-sub">{{ communityName }}</text>
    </view>

    <scroll-view scroll-y class="list-area">
      <view v-if="list.length === 0" class="empty-wrap">
        <sl-empty-state text="暂无楼栋数据" />
      </view>
      <view v-for="item in list" :key="item.id" class="card">
        <view class="card-top">
          <text class="card-name">{{ item.name }}</text>
          <text class="card-sub">{{ item.communityName }}</text>
        </view>
        <view class="card-meta">
          <text>{{ item.totalFloors }}层</text>
          <text> · </text>
          <text>每层{{ item.unitsPerFloor }}户</text>
          <text> · </text>
          <text>{{ item.propertyCount || 0 }}套房源</text>
        </view>
        <view class="card-actions">
          <text class="act-btn edit" @tap="openEdit(item)">编辑</text>
          <text class="act-btn del" @tap="onDelete(item)">删除</text>
        </view>
      </view>
    </scroll-view>

    <view class="fab" @tap="openAdd">
      <text class="fab-icon">+</text>
    </view>

    <!-- Form Modal -->
    <view v-if="showForm" class="modal-mask" @tap="showForm = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-title">{{ isEdit ? '编辑楼栋' : '新增楼栋' }}</text>
        <view class="form-group">
          <text class="form-label">名称</text>
          <input v-model="form.name" class="form-input" placeholder="如：1栋、A座" />
        </view>
        <view v-if="!communityId" class="form-group">
          <text class="form-label">所属楼盘</text>
          <view class="form-input picker" @tap="showPicker = true">
            <text :class="{ ph: !form.communityId }">
              {{ form.communityId ? getCommunityName(form.communityId) : '请选择楼盘' }}
            </text>
          </view>
        </view>
        <view class="form-group">
          <text class="form-label">总层数</text>
          <input v-model.number="form.totalFloors" class="form-input" type="number" placeholder="1" />
        </view>
        <view class="form-group">
          <text class="form-label">每层户数</text>
          <input v-model.number="form.unitsPerFloor" class="form-input" type="number" placeholder="1" />
        </view>
        <view class="form-group">
          <text class="form-label">排序</text>
          <input v-model.number="form.orderNo" class="form-input" type="number" placeholder="0" />
        </view>
        <view class="form-group">
          <text class="form-label">图片（点击设为封面）</text>
          <view class="image-grid">
            <view
              v-for="(url, idx) in form.imageUrls"
              :key="idx"
              class="image-item"
              @tap="setCover(idx)"
            >
              <image :src="url" mode="aspectFill" class="image-thumb" />
              <view v-if="form.imageIds[idx] === form.coverImageId" class="cover-badge">
                <text>封面</text>
              </view>
              <view class="image-delete" @tap.stop="removeImage(idx)">
                <text>×</text>
              </view>
            </view>
            <view v-if="form.imageIds.length < 9" class="image-add" @tap="onChooseImage">
              <text class="add-icon">+</text>
              <text class="add-text">添加</text>
            </view>
          </view>
        </view>
        <view class="form-actions">
          <view class="form-btn cancel" @tap="showForm = false">取消</view>
          <view class="form-btn confirm" @tap="onSubmit">确定</view>
        </view>
      </view>
    </view>

    <!-- Community picker -->
    <view v-if="showPicker" class="modal-mask" @tap="showPicker = false">
      <view class="picker-panel" @tap.stop>
        <text class="modal-title">选择楼盘</text>
        <scroll-view scroll-y class="picker-list">
          <view
            v-for="c in communities"
            :key="c.id"
            class="picker-item"
            :class="{ selected: form.communityId === c.id }"
            @tap="pickCommunity(c.id)"
          >
            {{ c.name }}
          </view>
        </scroll-view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $sl-bg-page;
}

.page-header {
  padding: $sl-spacing-md $sl-spacing-lg;
  // padding-top 由 :style 动态设置
  background-color: $sl-bg-card;
  border-bottom: 1rpx solid $sl-border-color;
}

.page-title {
  font-size: $sl-font-xl;
  font-weight: 700;
  color: $sl-text-primary;
}

.page-sub {
  display: block;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-top: $sl-spacing-xs;
}

.list-area {
  padding: $sl-spacing-sm;
  padding-bottom: 200rpx;
}

.empty-wrap {
  padding: $sl-spacing-xl;
}

.card {
  padding: $sl-spacing-md;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  margin-bottom: $sl-spacing-sm;
}

.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: $sl-spacing-xs;
}

.card-name {
  font-size: $sl-font-md;
  font-weight: 600;
  color: $sl-text-primary;
}

.card-sub {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

.card-meta {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-bottom: $sl-spacing-sm;
}

.card-actions {
  display: flex;
  gap: $sl-spacing-sm;
  justify-content: flex-end;
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

  &.picker {
    display: flex;
    align-items: center;
  }

  .ph {
    color: $sl-text-placeholder;
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

// Images
.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-xs;
}

.image-item {
  width: 140rpx;
  height: 140rpx;
  position: relative;
  border-radius: $sl-border-radius-sm;
  overflow: hidden;
}

.image-thumb {
  width: 100%;
  height: 100%;
}

.cover-badge {
  position: absolute;
  left: 0;
  top: 0;
  background-color: $sl-primary;
  color: #ffffff;
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 0 0 $sl-border-radius-sm 0;
}

.image-delete {
  position: absolute;
  right: 0;
  top: 0;
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  font-size: $sl-font-sm;
  border-radius: 0 0 0 $sl-border-radius-sm;
}

.image-add {
  width: 140rpx;
  height: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius-sm;
  border: 2rpx dashed $sl-border-color;
}

.add-icon {
  font-size: 40rpx;
  color: $sl-text-placeholder;
  line-height: 1;
}

.add-text {
  font-size: 20rpx;
  color: $sl-text-placeholder;
}

.picker-panel {
  width: 85%;
  max-height: 70vh;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  padding: $sl-spacing-lg;
  display: flex;
  flex-direction: column;
}

.picker-list {
  flex: 1;
  max-height: 500rpx;
}

.picker-item {
  padding: $sl-spacing-md;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  border-bottom: 1rpx solid $sl-border-color;

  &.selected {
    color: $sl-primary;
    font-weight: 600;
  }
}
</style>
