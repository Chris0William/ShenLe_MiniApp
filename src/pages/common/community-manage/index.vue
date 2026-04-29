<script setup lang="ts">
import type { AddSlCommunityInput, ShenLeId, SlCommunityOutput, SlRegionTreeOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { addCommunity, deleteCommunity, getCommunityDetail, getCommunityPage, updateCommunity } from '@/api/community'
import { downloadFile, uploadFile } from '@/api/file'
import { getRegionTree } from '@/api/region'
import { idToQuery, resolveAssetUrl } from '@/utils/shenle'

definePage({
  style: {
    navigationBarTitleText: '楼盘管理',
    enablePullDownRefresh: true,
  },
})

interface RegionOption {
  id: ShenLeId
  name: string
  level: number
}

interface CommunityForm {
  id: string
  name: string
  type: number
  regionId: string
  address: string
  lng: string
  lat: string
  orderNo: string
  status: number
  remark: string
  imageIds: ShenLeId[]
  imageUrls: string[]
  coverImageId: string
}

const page = ref(1)
const pageSize = 12
const total = ref(0)
const list = ref<SlCommunityOutput[]>([])
const coverMap = ref<Record<string, string>>({})
const keyword = ref('')
const activeType = ref<number | undefined>()
const regionTree = ref<SlRegionTreeOutput[]>([])
const filterRegionId = ref('')
const loading = ref(false)
const finished = ref(false)
const formVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const uploading = ref(false)

const form = reactive<CommunityForm>({
  id: '',
  name: '',
  type: 1,
  regionId: '',
  address: '',
  lng: '',
  lat: '',
  orderNo: '100',
  status: 0,
  remark: '',
  imageIds: [],
  imageUrls: [],
  coverImageId: '',
})

const typeOptions = [
  { value: undefined, label: '全部' },
  { value: 1, label: '小区' },
  { value: 2, label: '公寓' },
] as const

const statusOptions = [
  { value: 0, label: '正常' },
  { value: 1, label: '禁用' },
] as const

const regionOptions = computed<RegionOption[]>(() => {
  const result: RegionOption[] = []
  function walk(nodes: SlRegionTreeOutput[], depth = 0) {
    for (const node of nodes) {
      result.push({ id: node.id, name: `${'　'.repeat(depth)}${node.name}`, level: node.level })
      if (node.children?.length)
        walk(node.children, depth + 1)
    }
  }
  walk(regionTree.value)
  return result
})

const regionNames = computed(() => ['全部区域', ...regionOptions.value.map(item => item.name)])
const formRegionNames = computed(() => regionOptions.value.map(item => item.name))
const filterRegionIndex = computed(() => {
  if (!filterRegionId.value)
    return 0
  const idx = regionOptions.value.findIndex(item => sameId(item.id, filterRegionId.value))
  return idx >= 0 ? idx + 1 : 0
})
const formRegionIndex = computed(() => Math.max(0, regionOptions.value.findIndex(item => sameId(item.id, form.regionId))))
const showing = computed(() => list.value.length)

function sameId(left?: ShenLeId | string | null, right?: ShenLeId | string | null) {
  return left !== undefined && left !== null && right !== undefined && right !== null && String(left) === String(right)
}

function coverUrl(item: SlCommunityOutput) {
  const cached = coverMap.value[String(item.id)]
  if (cached)
    return cached
  const url = item.coverImage || item.images?.[0]?.url
  return url ? resolveAssetUrl(url) : ''
}

async function hydrateCoverImages(items: SlCommunityOutput[]) {
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

function toNumber(value: string, fallback?: number) {
  if (value === '')
    return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function regionName(id?: ShenLeId | null) {
  return regionOptions.value.find(item => sameId(item.id, id))?.name.trim() || '未分区'
}

function typeLabel(type?: number) {
  return type === 2 ? '公寓' : '小区'
}

function statusLabel(status?: number) {
  return status === 1 ? '禁用' : '正常'
}

async function loadRegions() {
  regionTree.value = await getRegionTree()
}

async function loadData(reset = false) {
  if (loading.value)
    return
  if (reset) {
    page.value = 1
    list.value = []
    coverMap.value = {}
    finished.value = false
  }
  if (finished.value)
    return

  loading.value = true
  try {
    const res = await getCommunityPage({
      page: page.value,
      pageSize,
      name: keyword.value.trim() || undefined,
      type: activeType.value,
      regionId: filterRegionId.value || undefined,
    })
    list.value = reset ? res.items : [...list.value, ...res.items]
    total.value = res.total
    finished.value = list.value.length >= res.total || res.items.length < pageSize
    page.value += 1
    void hydrateCoverImages(res.items)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function onFilterRegionChange(event: any) {
  const idx = Number(event.detail.value)
  filterRegionId.value = idx <= 0 ? '' : String(regionOptions.value[idx - 1]?.id || '')
  loadData(true)
}

function onFormRegionChange(event: any) {
  const idx = Number(event.detail.value)
  form.regionId = String(regionOptions.value[idx]?.id || '')
}

function resetForm(item?: SlCommunityOutput) {
  isEdit.value = !!item
  form.id = item ? String(item.id) : ''
  form.name = item?.name || ''
  form.type = item?.type || 1
  form.regionId = item?.regionId ? String(item.regionId) : ''
  form.address = item?.address || ''
  form.lng = item?.lng === null || item?.lng === undefined ? '' : String(item.lng)
  form.lat = item?.lat === null || item?.lat === undefined ? '' : String(item.lat)
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

async function loadFormImages(item: SlCommunityOutput) {
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
  resetForm()
  formVisible.value = true
}

async function openEdit(item: SlCommunityOutput) {
  resetForm(item)
  formVisible.value = true
  try {
    const detail = await getCommunityDetail(item.id)
    resetForm(detail)
    await loadFormImages(detail)
  }
  catch {
    formVisible.value = false
    uni.showToast({ title: '楼盘详情加载失败', icon: 'none' })
  }
}

async function chooseImages() {
  if (uploading.value)
    return
  const remain = 9 - form.imageIds.length
  if (remain <= 0) {
    uni.showToast({ title: '最多上传 9 张', icon: 'none' })
    return
  }
  uni.chooseImage({
    count: remain,
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
  if (sameId(form.coverImageId, removed))
    form.coverImageId = String(form.imageIds[0] || '')
}

function setCover(index: number) {
  form.coverImageId = String(form.imageIds[index] || '')
}

function previewImage(index: number) {
  if (!form.imageUrls.length)
    return
  uni.previewImage({
    current: form.imageUrls[index],
    urls: form.imageUrls,
  })
}

function chooseLocation() {
  uni.chooseLocation({
    latitude: toNumber(form.lat),
    longitude: toNumber(form.lng),
    success(res) {
      form.lng = String(res.longitude)
      form.lat = String(res.latitude)
      form.address = res.address || res.name || form.address
    },
  })
}

function buildPayload(): AddSlCommunityInput {
  return {
    name: form.name.trim(),
    type: form.type,
    regionId: form.regionId || undefined,
    address: form.address.trim() || undefined,
    lng: toNumber(form.lng),
    lat: toNumber(form.lat),
    orderNo: toNumber(form.orderNo, 100),
    status: form.status,
    remark: form.remark.trim() || undefined,
    coverImageId: form.coverImageId || undefined,
    imageIds: form.imageIds,
  }
}

async function submitForm() {
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入楼盘名称', icon: 'none' })
    return
  }
  if (!form.regionId) {
    uni.showToast({ title: '请选择所属区域', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value)
      await updateCommunity({ ...payload, id: form.id })
    else
      await addCommunity(payload)
    uni.showToast({ title: isEdit.value ? '更新成功' : '新增成功', icon: 'success' })
    formVisible.value = false
    await loadData(true)
  }
  finally {
    submitting.value = false
  }
}

function confirmDelete(item: SlCommunityOutput) {
  uni.showModal({
    title: '删除楼盘',
    content: `确定删除「${item.name}」？有楼栋或房源时后端会拦截。`,
    success: async (res) => {
      if (!res.confirm)
        return
      await deleteCommunity(item.id)
      uni.showToast({ title: '删除成功', icon: 'success' })
      await loadData(true)
    },
  })
}

function goBuildings(item: SlCommunityOutput) {
  uni.navigateTo({ url: `/pages/common/building-manage/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}` })
}

function goProperties(item: SlCommunityOutput) {
  uni.navigateTo({ url: `/pages/common/community-properties/index?communityId=${idToQuery(item.id)}&communityName=${encodeURIComponent(item.name)}` })
}

onLoad(async () => {
  await loadRegions()
  await loadData(true)
})
onPullDownRefresh(() => loadData(true))
onReachBottom(() => loadData())
</script>

<template>
  <view class="sl-page manage-page">
    <view class="sl-hero manage-hero">
      <text class="sl-eyebrow">Estate Library</text>
      <text class="sl-title">楼盘管理</text>
      <text class="sl-subtitle">维护区域、地址、坐标与楼栋入口，地图找房会直接使用这里的坐标。</text>
    </view>

    <view class="toolbar sl-card">
      <view class="search-row">
        <input v-model="keyword" class="search-input" placeholder="搜索楼盘名称" confirm-type="search" @confirm="loadData(true)">
        <wd-button size="small" type="primary" @click="loadData(true)">
          搜索
        </wd-button>
      </view>
      <view class="chip-row">
        <view
          v-for="item in typeOptions"
          :key="String(item.value)"
          class="chip"
          :class="{ active: activeType === item.value }"
          @tap="activeType = item.value; loadData(true)"
        >
          {{ item.label }}
        </view>
        <picker mode="selector" :value="filterRegionIndex" :range="regionNames" @change="onFilterRegionChange">
          <view class="chip chip--picker">
            {{ regionNames[filterRegionIndex] || '全部区域' }}
          </view>
        </picker>
      </view>
    </view>

    <view class="sl-section-head">
      <text class="sl-section-title">楼盘列表</text>
      <text class="sl-section-extra">{{ showing }}/{{ total }}</text>
    </view>

    <view v-if="!list.length && !loading" class="empty sl-card">
      <wd-icon name="home" size="38px" color="#8ea099" />
      <text>暂无楼盘数据</text>
    </view>

    <view class="community-list">
      <view v-for="item in list" :key="String(item.id)" class="community-card sl-card">
        <view class="community-card__main">
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
                <text class="card-sub">{{ regionName(item.regionId) }} · {{ typeLabel(item.type) }}</text>
              </view>
              <view class="metric">
                <text>{{ item.propertyCount || 0 }}</text>
                <text>房源</text>
              </view>
            </view>
            <text class="address">{{ item.address || '未维护详细地址' }}</text>
            <view class="meta-row">
              <text>{{ item.buildingCount || 0 }} 栋</text>
              <text>排序 {{ item.orderNo }}</text>
              <text v-if="item.lng && item.lat">坐标已维护</text>
              <text v-else>缺少坐标</text>
            </view>
            <view class="actions">
              <wd-button size="small" plain @click="goBuildings(item)">
                楼栋
              </wd-button>
              <wd-button size="small" plain @click="goProperties(item)">
                房源
              </wd-button>
              <wd-button size="small" type="primary" plain @click="openEdit(item)">
                编辑
              </wd-button>
              <wd-button size="small" type="danger" plain @click="confirmDelete(item)">
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
            <text class="sheet-title">{{ isEdit ? '编辑楼盘' : '新增楼盘' }}</text>
            <text class="sheet-sub">坐标会用于地图找房和附近排序</text>
          </view>
          <wd-icon name="close" size="22px" color="#72817b" @click="formVisible = false" />
        </view>

        <view class="form-body">
          <view class="form-row">
            <text>楼盘名称</text>
            <input v-model="form.name" placeholder="如：西田八巷8">
          </view>
          <view class="form-row">
            <text>楼盘类型</text>
            <view class="segmented">
              <view :class="{ active: form.type === 1 }" @tap="form.type = 1">
                小区
              </view>
              <view :class="{ active: form.type === 2 }" @tap="form.type = 2">
                公寓
              </view>
            </view>
          </view>
          <picker mode="selector" :value="formRegionIndex" :range="formRegionNames" @change="onFormRegionChange">
            <view class="form-row form-row--picker">
              <text>所属区域</text>
              <text>{{ form.regionId ? regionName(form.regionId) : '请选择' }}</text>
            </view>
          </picker>
          <view class="form-row">
            <text>详细地址</text>
            <input v-model="form.address" placeholder="街道门牌、楼盘位置">
          </view>
          <view class="coord-grid">
            <view class="form-row">
              <text>经度</text>
              <input v-model="form.lng" type="digit" placeholder="lng">
            </view>
            <view class="form-row">
              <text>纬度</text>
              <input v-model="form.lat" type="digit" placeholder="lat">
            </view>
          </view>
          <wd-button plain block @click="chooseLocation">
            从地图选择位置
          </wd-button>
          <view class="form-row form-row--images">
            <view class="image-head">
              <text>楼盘图片</text>
              <text>{{ form.imageIds.length }}/9</text>
            </view>
            <view class="image-grid">
              <view v-for="(url, index) in form.imageUrls" :key="`${url}-${index}`" class="image-item">
                <image :src="url" mode="aspectFill" @tap="previewImage(index)" />
                <text v-if="sameId(form.coverImageId, form.imageIds[index])" class="cover-badge">封面</text>
                <view class="image-actions">
                  <text @tap="setCover(index)">设封面</text>
                  <text @tap="removeImage(index)">删除</text>
                </view>
              </view>
              <view class="image-add" @tap="chooseImages">
                <wd-icon name="add" size="24px" color="#126b4f" />
                <text>{{ uploading ? '上传中' : '上传图片' }}</text>
              </view>
            </view>
          </view>
          <view class="coord-grid">
            <view class="form-row">
              <text>排序</text>
              <input v-model="form.orderNo" type="number">
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
.manage-page {
  padding-bottom: calc(150rpx + env(safe-area-inset-bottom));
}

.manage-hero {
  margin-top: 10rpx;
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

.chip-row,
.meta-row,
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.chip-row {
  margin-top: 18rpx;
}

.chip {
  padding: 12rpx 22rpx;
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 999rpx;
  background: #f7faf4;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.chip.active,
.chip--picker {
  background: var(--sl-brand);
  color: #fff;
}

.community-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.community-card {
  padding: 24rpx;
}

.community-card__main {
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

.card-head,
.title-line,
.image-head,
.sheet-head,
.sheet-actions {
  display: flex;
  align-items: center;
}

.card-head,
.image-head,
.sheet-head {
  justify-content: space-between;
  gap: 18rpx;
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
.address,
.sheet-sub,
.load-tip {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.card-sub,
.address {
  display: block;
  margin-top: 10rpx;
}

.metric {
  min-width: 92rpx;
  text-align: right;
}

.metric text:first-child {
  display: block;
  color: var(--sl-brand);
  font-size: 36rpx;
  font-weight: 900;
}

.metric text:last-child {
  color: var(--sl-muted);
  font-size: 22rpx;
}

.meta-row {
  margin-top: 16rpx;
}

.meta-row text {
  padding: 7rpx 14rpx;
  border-radius: 999rpx;
  background: #f2f6f0;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.actions {
  margin-top: 20rpx;
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
  max-height: 86vh;
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

.image-head {
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

.cover-badge {
  position: absolute;
  top: 8rpx;
  left: 8rpx;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
  background: var(--sl-brand);
  color: #fff;
  font-size: 20rpx;
}

.image-actions {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  justify-content: space-around;
  background: rgb(0 0 0 / 48%);
  color: #fff;
  font-size: 20rpx;
}

.image-actions text {
  padding: 8rpx 0;
}

.image-add {
  display: flex;
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

.coord-grid {
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
