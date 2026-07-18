<script setup lang="ts">
import type { AddSlBuildingInput, ShenLeId, SlBuildingOutput, SlCommunitySelectOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { addBuilding, deleteBuilding, getBuildingDetail, getBuildingList, updateBuilding } from '@/api/building'
import { getCommunityList } from '@/api/community'
import { downloadFile, uploadFile } from '@/api/file'
import { useEntityChangeStore } from '@/store/entity-change'
import { MEDIA_SELECTION_BATCH_LIMIT } from '@/utils/media'
import { idToQuery, resolveAssetUrl } from '@/utils/shenle'

definePage({
  style: {
    navigationBarTitleText: '楼栋管理',
    enablePullDownRefresh: true,
  },
})

interface BuildingForm {
  id: string
  communityId: string
  name: string
  totalFloors: string
  orderNo: string
  status: number
  remark: string
  imageIds: ShenLeId[]
  imageUrls: string[]
  coverImageId: string
}

const communities = ref<SlCommunitySelectOutput[]>([])
const communityId = ref('')
const communityNameFromQuery = ref('')
const list = ref<SlBuildingOutput[]>([])
const coverMap = ref<Record<string, string>>({})
const loading = ref(false)
const formVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const uploading = ref(false)
const oneClickCreating = ref(false)
const changeStore = useEntityChangeStore()
const CHANGE_CONSUMER = 'building-manage'

function publishBuildingChange(action: 'created' | 'updated' | 'deleted' | 'structural', ids: ShenLeId[]) {
  changeStore.publishBuildingChange({ action, ids, communityId: communityId.value })
  changeStore.consumeBuildingChange(CHANGE_CONSUMER)
}

const form = reactive<BuildingForm>({
  id: '',
  communityId: '',
  name: '',
  totalFloors: '1',
  orderNo: '100',
  status: 0,
  remark: '',
  imageIds: [],
  imageUrls: [],
  coverImageId: '',
})

const statusOptions = [
  { value: 0, label: '正常' },
  { value: 1, label: '禁用' },
] as const

const communityNames = computed(() => communities.value.map(item => item.name))
const selectedCommunity = computed(() => communities.value.find(item => String(item.id) === String(communityId.value)))
const communityPickerIndex = computed(() => Math.max(0, communities.value.findIndex(item => String(item.id) === String(communityId.value))))
const formCommunityIndex = computed(() => Math.max(0, communities.value.findIndex(item => String(item.id) === String(form.communityId))))
const headerTitle = computed(() => selectedCommunity.value?.name || communityNameFromQuery.value || '请选择楼盘')
const totalRooms = computed(() => list.value.reduce((sum, item) => sum + (item.propertyCount || 0), 0))
const effectiveCoverId = computed(() => String(form.coverImageId || form.imageIds[0] || ''))

function toNumber(value: string, fallback?: number) {
  if (value === '')
    return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function statusLabel(status?: number) {
  return status === 1 ? '禁用' : '正常'
}

function idEquals(left?: ShenLeId | string | null, right?: ShenLeId | string | null) {
  return left !== undefined && left !== null && right !== undefined && right !== null && String(left) === String(right)
}

function coverUrl(item: SlBuildingOutput) {
  const cached = coverMap.value[String(item.id)]
  if (cached)
    return cached
  const url = item.coverImage || item.images?.[0]?.url
  return url ? resolveAssetUrl(url) : ''
}

async function hydrateCoverImages(items: SlBuildingOutput[]) {
  const next: Record<string, string> = {}
  await Promise.all(items.map(async (item) => {
    const key = String(item.id)
    if (!item.coverImageId || coverMap.value[key])
      return
    try {
      next[key] = await downloadFile(item.coverImageId)
    }
    catch {
      const url = item.coverImage || item.images?.[0]?.url
      if (url)
        next[key] = resolveAssetUrl(url)
    }
  }))
  if (Object.keys(next).length)
    coverMap.value = { ...coverMap.value, ...next }
}

async function loadCommunities() {
  communities.value = await getCommunityList({})
  if (!communityId.value && communities.value.length)
    communityId.value = String(communities.value[0].id)
}

async function loadData() {
  if (!communityId.value) {
    list.value = []
    coverMap.value = {}
    uni.stopPullDownRefresh()
    return
  }
  loading.value = true
  try {
    list.value = await getBuildingList({ communityId: communityId.value })
    coverMap.value = {}
    void hydrateCoverImages(list.value)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function reloadAll() {
  await loadCommunities()
  await loadData()
}

function onCommunityChange(event: any) {
  const idx = Number(event.detail.value)
  communityId.value = String(communities.value[idx]?.id || '')
  loadData()
}

function onFormCommunityChange(event: any) {
  const idx = Number(event.detail.value)
  form.communityId = String(communities.value[idx]?.id || '')
}

function resetForm(item?: SlBuildingOutput) {
  isEdit.value = !!item
  form.id = item ? String(item.id) : ''
  form.communityId = item ? String(item.communityId) : communityId.value
  form.name = item?.name || ''
  form.totalFloors = String(item?.totalFloors ?? 1)
  form.orderNo = String(item?.orderNo ?? 100)
  form.status = item?.status ?? 0
  form.remark = item?.remark || ''
  form.imageIds = item?.images?.map(image => image.id) || []
  form.imageUrls = item?.images?.map(image => resolveAssetUrl(image.url)) || []
  if (!form.imageIds.length && item?.coverImageId && item.coverImage) {
    form.imageIds = [item.coverImageId]
    form.imageUrls = [resolveAssetUrl(item.coverImage)]
  }
  form.coverImageId = item?.coverImageId ? String(item.coverImageId) : String(form.imageIds[0] || '')
}

async function loadFormImages(item: SlBuildingOutput) {
  const images = item.images || []
  form.imageIds = images.map(image => image.id)
  form.imageUrls = await Promise.all(images.map(async (image) => {
    try {
      return await downloadFile(image.id)
    }
    catch {
      return resolveAssetUrl(image.url)
    }
  }))

  if (!form.imageIds.length && item.coverImageId && item.coverImage) {
    form.imageIds = [item.coverImageId]
    try {
      form.imageUrls = [await downloadFile(item.coverImageId)]
    }
    catch {
      form.imageUrls = [resolveAssetUrl(item.coverImage)]
    }
  }
  form.coverImageId = item.coverImageId ? String(item.coverImageId) : String(form.imageIds[0] || '')
}

function openAdd() {
  if (!communityId.value) {
    uni.showToast({ title: '请先选择楼盘', icon: 'none' })
    return
  }
  resetForm()
  formVisible.value = true
}

async function openEdit(item: SlBuildingOutput) {
  resetForm(item)
  formVisible.value = true
  try {
    const detail = await getBuildingDetail(item.id)
    resetForm(detail)
    await loadFormImages(detail)
  }
  catch {
    formVisible.value = false
    uni.showToast({ title: '楼栋详情加载失败', icon: 'none' })
  }
}

async function chooseImages() {
  if (uploading.value)
    return
  uni.chooseImage({
    count: MEDIA_SELECTION_BATCH_LIMIT,
    sizeType: ['compressed'],
    success: async (res) => {
      uploading.value = true
      try {
        for (const tempPath of res.tempFilePaths) {
          const file = await uploadFile(tempPath)
          form.imageIds.push(file.id)
          form.imageUrls.push(tempPath)
          if (!form.coverImageId)
            form.coverImageId = String(file.id)
        }
      }
      finally {
        uploading.value = false
      }
    },
  })
}

function removeImage(index: number) {
  const removed = form.imageIds[index]
  form.imageIds.splice(index, 1)
  form.imageUrls.splice(index, 1)
  if (idEquals(form.coverImageId, removed))
    form.coverImageId = String(form.imageIds[0] || '')
}

function setCover(index: number) {
  form.coverImageId = String(form.imageIds[index] || '')
}

function isCoverImage(index: number) {
  return idEquals(effectiveCoverId.value, form.imageIds[index])
}

function previewImage(index: number) {
  if (!form.imageUrls.length)
    return
  uni.previewImage({
    current: form.imageUrls[index],
    urls: form.imageUrls,
  })
}

function buildPayload(): AddSlBuildingInput {
  return {
    communityId: form.communityId,
    name: form.name.trim(),
    totalFloors: toNumber(form.totalFloors, 1),
    orderNo: toNumber(form.orderNo, 100),
    status: form.status,
    remark: form.remark.trim() || undefined,
    coverImageId: effectiveCoverId.value || null,
    imageIds: form.imageIds,
  }
}

async function submitForm() {
  if (!form.communityId) {
    uni.showToast({ title: '请选择所属楼盘', icon: 'none' })
    return
  }
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入楼栋名称', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value) {
      await updateBuilding({ ...payload, id: form.id })
      publishBuildingChange('updated', [form.id])
    }
    else {
      const createdId = await addBuilding(payload)
      publishBuildingChange('created', [createdId])
    }
    uni.showToast({ title: isEdit.value ? '更新成功' : '新增成功', icon: 'success' })
    formVisible.value = false
    communityId.value = String(payload.communityId)
    await loadData()
  }
  finally {
    submitting.value = false
  }
}

async function createDefaultBuilding() {
  if (oneClickCreating.value)
    return
  if (!communityId.value || headerTitle.value === '请选择楼盘') {
    uni.showToast({ title: '请先选择楼盘', icon: 'none' })
    return
  }

  const payload: AddSlBuildingInput = {
    communityId: communityId.value,
    name: headerTitle.value,
    totalFloors: null,
    orderNo: 100,
    status: 0,
    coverImageId: null,
    imageIds: [],
  }

  oneClickCreating.value = true
  try {
    try {
      const createdId = await addBuilding(payload)
      publishBuildingChange('created', [createdId])
    }
    catch {
      try {
        await loadData()
      }
      catch {}

      if (list.value.some(item => item.name === headerTitle.value))
        uni.showToast({ title: '同名楼栋已存在', icon: 'success' })
      else
        uni.showToast({ title: '创建楼栋失败，请重试', icon: 'none' })
      return
    }

    try {
      await loadData()
      uni.showToast({ title: '楼栋已创建', icon: 'success' })
    }
    catch {
      uni.showToast({ title: '楼栋已创建，请下拉刷新', icon: 'none' })
    }
  }
  finally {
    oneClickCreating.value = false
  }
}

function confirmDelete(item: SlBuildingOutput) {
  uni.showModal({
    title: '删除楼栋',
    content: `确定删除「${item.name}」？有房源时后端会拦截。`,
    success: async (res) => {
      if (!res.confirm)
        return
      await deleteBuilding(item.id)
      publishBuildingChange('deleted', [item.id])
      uni.showToast({ title: '删除成功', icon: 'success' })
      await loadData()
    },
  })
}

function goProperties(item: SlBuildingOutput) {
  uni.navigateTo({
    url: `/pages/common/community-properties/index?communityId=${idToQuery(item.communityId)}&communityName=${encodeURIComponent(headerTitle.value)}&buildingId=${idToQuery(item.id)}&buildingName=${encodeURIComponent(item.name)}&buildingTotalFloors=${encodeURIComponent(String(item.totalFloors ?? ''))}`,
  })
}

onLoad(async (query) => {
  communityId.value = String(query?.communityId || '')
  communityNameFromQuery.value = String(query?.communityName || '')
  await reloadAll()
})
onShow(() => {
  const changes = [
    changeStore.consumeBuildingChange(CHANGE_CONSUMER),
    changeStore.consumePropertyChange(CHANGE_CONSUMER),
    changeStore.consumeCommunityChange(CHANGE_CONSUMER),
  ]
  if (changes.some(Boolean))
    void reloadAll()
})
onPullDownRefresh(reloadAll)
</script>

<template>
  <view class="sl-page building-page">
    <view class="sl-hero">
      <text class="sl-title">楼栋管理</text>
      <text class="sl-subtitle">{{ headerTitle }} · 共 {{ list.length }} 栋，{{ totalRooms }} 套房源</text>
    </view>

    <view class="selector sl-card">
      <picker mode="selector" :value="communityPickerIndex" :range="communityNames" @change="onCommunityChange">
        <view class="selector-main">
          <view>
            <text>当前楼盘</text>
            <text>{{ headerTitle }}</text>
          </view>
          <wd-icon name="arrow-down" size="18px" color="#72817b" />
        </view>
      </picker>
      <wd-button type="primary" @click="openAdd">
        新增楼栋
      </wd-button>
    </view>

    <view v-if="communityId && !list.length && !loading" class="empty sl-card">
      <wd-icon name="home" size="38px" color="#8ea099" />
      <text>暂无楼栋数据</text>
      <text>可以直接创建与楼盘同名的默认楼栋。</text>
      <wd-button type="primary" :loading="oneClickCreating" @click="createDefaultBuilding">
        一键创建楼栋
      </wd-button>
    </view>

    <view class="building-list">
      <view v-for="item in list" :key="String(item.id)" class="building-card sl-card" @tap="goProperties(item)">
        <view class="building-card__main">
          <image v-if="coverUrl(item)" class="card-cover" :src="coverUrl(item)" mode="aspectFill" />
          <view class="card-content">
            <view class="card-head">
              <view>
                <view class="title-line">
                  <text class="card-title">{{ item.name }}</text>
                  <wd-tag :type="item.status === 0 ? 'success' : 'default'" plain>
                    {{ statusLabel(item.status) }}
                  </wd-tag>
                </view>
                <text class="card-sub">{{ item.totalFloors || '-' }} 层 · 排序 {{ item.orderNo }}</text>
              </view>
              <view class="metric">
                <text>{{ item.propertyCount || 0 }}</text>
                <text>房源</text>
              </view>
            </view>
            <text class="remark">{{ item.remark || '暂无备注' }}</text>
            <view class="actions" @tap.stop>
              <wd-button size="small" plain @click.stop="goProperties(item)">
                房源
              </wd-button>
              <wd-button size="small" type="primary" plain @click.stop="openEdit(item)">
                编辑
              </wd-button>
              <wd-button size="small" type="danger" plain @click.stop="confirmDelete(item)">
                删除
              </wd-button>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view v-if="loading" class="load-tip">
      加载中...
    </view>

    <wd-popup v-model="formVisible" position="bottom" custom-style="border-radius: 30rpx 30rpx 0 0; overflow: hidden;" safe-area-inset-bottom @touchmove.stop.prevent>
      <view class="form-sheet" @touchmove.stop.prevent>
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ isEdit ? '编辑楼栋' : '新增楼栋' }}</text>
            <text class="sheet-sub">楼层数会影响销控表的楼层网格。</text>
          </view>
          <wd-icon name="close" size="22px" color="#72817b" @click="formVisible = false" />
        </view>

        <view class="form-body">
          <picker mode="selector" :value="formCommunityIndex" :range="communityNames" @change="onFormCommunityChange">
            <view class="form-row form-row--picker">
              <text>所属楼盘</text>
              <text>{{ communities[formCommunityIndex]?.name || '请选择' }}</text>
            </view>
          </picker>
          <view class="form-row">
            <text>楼栋名称</text>
            <input v-model="form.name" placeholder="如：A栋 / 1号楼">
          </view>
          <view class="grid-2">
            <view class="form-row">
              <text>总楼层</text>
              <input v-model="form.totalFloors" type="number">
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
          <view class="form-row form-row--images">
            <view class="image-head">
              <text>楼栋图片</text>
              <text>{{ form.imageIds.length }} 张</text>
            </view>
            <view class="image-grid">
              <view v-for="(url, index) in form.imageUrls" :key="`${url}-${index}`" class="image-item">
                <view class="media-preview-hit" :class="{ 'media-preview-hit--with-action': !isCoverImage(index) }" @tap.stop="previewImage(index)">
                  <image :src="url" mode="aspectFill" />
                </view>
                <text v-if="isCoverImage(index)" class="cover-badge">封面</text>
                <view class="image-remove" @tap.stop="removeImage(index)">
                  <wd-icon name="close" size="14px" color="#fff" />
                </view>
                <view v-if="!isCoverImage(index)" class="image-cover-action" @tap.stop="setCover(index)">
                  设为封面
                </view>
              </view>
              <view class="image-add" @tap="chooseImages">
                <wd-icon name="add" size="24px" color="#126b4f" />
                <text>{{ uploading ? '上传中' : '上传图片' }}</text>
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
.building-page {
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 22rpx;
  padding: 22rpx;
}

.selector picker {
  min-width: 0;
  flex: 1;
}

.selector-main,
.card-head,
.title-line,
.sheet-head,
.sheet-actions {
  display: flex;
  align-items: center;
}

.selector-main,
.card-head,
.sheet-head {
  justify-content: space-between;
  gap: 18rpx;
}

.selector-main text:first-child,
.sheet-sub,
.card-sub,
.remark,
.load-tip {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.selector-main text {
  display: block;
}

.selector-main text:last-child {
  margin-top: 8rpx;
  color: var(--sl-ink);
  font-size: 30rpx;
  font-weight: 850;
}

.building-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  margin-top: 24rpx;
}

.building-card {
  padding: 24rpx;
}

.building-card__main {
  display: flex;
  gap: 18rpx;
}

.card-cover {
  width: 154rpx;
  height: 154rpx;
  flex: 0 0 154rpx;
  border-radius: 20rpx;
  background: #eef4ed;
}

.card-content {
  min-width: 0;
  flex: 1;
}

.title-line {
  gap: 10rpx;
}

.card-title,
.sheet-title {
  font-size: 32rpx;
  font-weight: 850;
}

.card-sub,
.remark {
  display: block;
  margin-top: 10rpx;
}

.metric {
  min-width: 88rpx;
  text-align: right;
}

.metric text:first-child {
  display: block;
  color: var(--sl-brand);
  font-size: 38rpx;
  font-weight: 900;
}

.metric text:last-child {
  color: var(--sl-muted);
  font-size: 22rpx;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 20rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  margin-top: 24rpx;
  padding: 70rpx 20rpx;
  color: var(--sl-muted);
  text-align: center;
}

.load-tip {
  padding: 26rpx 0;
  text-align: center;
}

.form-sheet {
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #fff;
}

.sheet-sub {
  display: block;
  margin-top: 8rpx;
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

.form-row--images {
  background: #fffaf0;
}

.image-head,
.image-grid,
.image-cover-action,
.image-add {
  display: flex;
}

.image-head {
  justify-content: space-between;
  gap: 18rpx;
  margin-bottom: 14rpx;
}

.image-head text:first-child {
  margin-bottom: 0;
}

.image-head text:last-child {
  color: var(--sl-muted);
  font-size: 22rpx;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
}

.image-item,
.image-add {
  position: relative;
  height: 178rpx;
  overflow: hidden;
  border-radius: 18rpx;
  background: #f3f7f1;
}

.image-item image {
  width: 100%;
  height: 100%;
}

.media-preview-hit {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
}

.media-preview-hit--with-action {
  bottom: 56rpx;
}

.cover-badge {
  position: absolute;
  z-index: 6;
  top: 8rpx;
  left: 8rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: #2f7ef7;
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
}

.image-remove {
  position: absolute;
  z-index: 7;
  top: 2rpx;
  right: 2rpx;
  display: flex;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(15 35 28 / 66%);
}

.image-cover-action {
  position: absolute;
  z-index: 5;
  right: 0;
  bottom: 0;
  left: 0;
  height: 56rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: center;
  background: rgb(0 0 0 / 48%);
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
}

.image-add {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  color: var(--sl-brand);
  font-size: 24rpx;
  font-weight: 800;
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
  max-width: 440rpx;
  overflow: hidden;
  color: var(--sl-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14rpx;
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
