<script setup lang="ts">
import type { AddSlPropertyInput, ShenLeId, SlBuildingOutput, SlCommunitySelectOutput, SlPropertyOutput, SlTagOutput } from '@/types/shenle'
import { onLoad } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { getBuildingList } from '@/api/building'
import { getCommunityList } from '@/api/community'
import { downloadFile, uploadFile } from '@/api/file'
import { addProperty, getPropertyDetail, updateProperty } from '@/api/property'
import { getTagList } from '@/api/tag'
import {
  DECORATION_OPTIONS,
  DEPOSIT_RULE_OPTIONS,
  ORIENTATION_OPTIONS,
  PROPERTY_STATUS_OPTIONS,
  RENTAL_TYPE_OPTIONS,
} from '@/constants/shenle'
import { resolveAssetUrl } from '@/utils/shenle'

definePage({
  style: {
    navigationBarTitleText: '新增/编辑房源',
  },
})

interface FormState {
  communityId: string
  buildingId: string
  floor: string
  totalFloors: string
  roomNo: string
  title: string
  bedrooms: number
  livingRooms: number
  bathrooms: number
  area: string
  orientationIdx: number
  decorationIdx: number
  rentalTypeIdx: number
  rentPrice: string
  deposit: string
  depositRuleIdx: number
  minLease: string
  landlordName: string
  landlordPhone: string
  description: string
  remark: string
  status: number
  tagIds: ShenLeId[]
  facilityIds: ShenLeId[]
  imageIds: ShenLeId[]
  imageUrls: string[]
  coverImageId: string
}

const isEdit = ref(false)
const editId = ref('')
const submitting = ref(false)
const loading = ref(false)
const uploading = ref(false)
const communities = ref<SlCommunitySelectOutput[]>([])
const buildings = ref<SlBuildingOutput[]>([])
const houseTags = ref<SlTagOutput[]>([])
const facilityTags = ref<SlTagOutput[]>([])
const communityPickerIdx = ref(0)
const buildingPickerIdx = ref(0)

const form = reactive<FormState>({
  communityId: '',
  buildingId: '',
  floor: '',
  totalFloors: '',
  roomNo: '',
  title: '',
  bedrooms: 1,
  livingRooms: 0,
  bathrooms: 1,
  area: '',
  orientationIdx: -1,
  decorationIdx: -1,
  rentalTypeIdx: -1,
  rentPrice: '',
  deposit: '',
  depositRuleIdx: -1,
  minLease: '',
  landlordName: '',
  landlordPhone: '',
  description: '',
  remark: '',
  status: 0,
  tagIds: [],
  facilityIds: [],
  imageIds: [],
  imageUrls: [],
  coverImageId: '',
})

const communityNames = computed(() => communities.value.map(item => item.name))
const buildingNames = computed(() => buildings.value.map(item => item.name))
const selectedCommunity = computed(() => communities.value[communityPickerIdx.value])
const selectedBuilding = computed(() => buildings.value[buildingPickerIdx.value])

function toNumber(value: string, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function idEquals(left?: ShenLeId | string, right?: ShenLeId | string) {
  return left !== undefined && right !== undefined && String(left) === String(right)
}

function optionIndex(options: readonly { value: string, label: string }[], value?: string | null) {
  if (!value)
    return -1
  return options.findIndex(item => item.value === value || item.label === value)
}

async function loadCommunities() {
  communities.value = await getCommunityList({})
}

async function loadBuildings(communityId: string) {
  if (!communityId) {
    buildings.value = []
    buildingPickerIdx.value = 0
    return
  }
  buildings.value = await getBuildingList({ communityId })
  buildingPickerIdx.value = Math.max(0, buildings.value.findIndex(item => idEquals(item.id, form.buildingId)))
}

async function loadTags() {
  const [house, facility] = await Promise.allSettled([
    getTagList({ category: 'house', status: 0 }),
    getTagList({ category: 'facility', status: 0 }),
  ])
  if (house.status === 'fulfilled')
    houseTags.value = house.value
  if (facility.status === 'fulfilled')
    facilityTags.value = facility.value
}

async function onCommunityChange(event: any) {
  const idx = Number(event.detail.value)
  communityPickerIdx.value = idx
  form.communityId = String(communities.value[idx]?.id || '')
  form.buildingId = ''
  await loadBuildings(form.communityId)
}

function onBuildingChange(event: any) {
  const idx = Number(event.detail.value)
  buildingPickerIdx.value = idx
  const building = buildings.value[idx]
  form.buildingId = String(building?.id || '')
  if (building?.totalFloors)
    form.totalFloors = String(building.totalFloors)
}

function toggleId(list: ShenLeId[], id: ShenLeId) {
  const index = list.findIndex(item => idEquals(item, id))
  if (index >= 0)
    list.splice(index, 1)
  else
    list.push(id)
}

function hasId(list: ShenLeId[], id: ShenLeId) {
  return list.some(item => idEquals(item, id))
}

async function chooseImages() {
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
  if (idEquals(form.coverImageId, removed))
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

function validateForm() {
  if (!form.communityId) {
    uni.showToast({ title: '请选择楼盘', icon: 'none' })
    return false
  }
  if (!form.buildingId) {
    uni.showToast({ title: '请选择楼栋', icon: 'none' })
    return false
  }
  if (!form.floor) {
    uni.showToast({ title: '请输入楼层', icon: 'none' })
    return false
  }
  if (!form.title.trim()) {
    uni.showToast({ title: '请输入房源标题', icon: 'none' })
    return false
  }
  if (!form.rentPrice) {
    uni.showToast({ title: '请输入月租金', icon: 'none' })
    return false
  }
  return true
}

function cancel() {
  uni.navigateBack()
}

function buildSubmitData(): AddSlPropertyInput {
  return {
    title: form.title.trim(),
    communityId: form.communityId,
    buildingId: form.buildingId,
    roomNo: form.roomNo || undefined,
    floor: toNumber(form.floor),
    totalFloors: toNumber(form.totalFloors),
    area: toNumber(form.area),
    bedrooms: form.bedrooms,
    livingRooms: form.livingRooms,
    bathrooms: form.bathrooms,
    orientation: ORIENTATION_OPTIONS[form.orientationIdx]?.value,
    decoration: DECORATION_OPTIONS[form.decorationIdx]?.value,
    rentalType: RENTAL_TYPE_OPTIONS[form.rentalTypeIdx]?.value,
    rentPrice: toNumber(form.rentPrice),
    deposit: form.deposit ? toNumber(form.deposit) : undefined,
    depositRule: DEPOSIT_RULE_OPTIONS[form.depositRuleIdx]?.value,
    minLease: form.minLease ? toNumber(form.minLease) : undefined,
    landlordName: form.landlordName || undefined,
    landlordPhone: form.landlordPhone || undefined,
    description: form.description || undefined,
    remark: form.remark || undefined,
    status: form.status,
    coverImageId: form.coverImageId || undefined,
    tagIds: form.tagIds,
    facilityIds: form.facilityIds,
    images: form.imageIds.map(id => ({ fileId: id, fileType: 'image' })),
  }
}

async function submit() {
  if (!validateForm() || submitting.value)
    return
  submitting.value = true
  try {
    const data = buildSubmitData()
    if (isEdit.value) {
      await updateProperty({ ...data, id: editId.value })
      uni.showToast({ title: '更新成功', icon: 'success' })
    }
    else {
      await addProperty(data)
      uni.showToast({ title: '新增成功', icon: 'success' })
    }
    setTimeout(() => uni.navigateBack(), 700)
  }
  finally {
    submitting.value = false
  }
}

async function fillDetail(detail: SlPropertyOutput) {
  form.communityId = String(detail.communityId || '')
  form.buildingId = String(detail.buildingId || '')
  form.floor = detail.floor === null || detail.floor === undefined ? '' : String(detail.floor)
  form.totalFloors = detail.totalFloors === null || detail.totalFloors === undefined ? '' : String(detail.totalFloors)
  form.roomNo = detail.roomNo || ''
  form.title = detail.title || ''
  form.bedrooms = detail.bedrooms || 1
  form.livingRooms = detail.livingRooms || 0
  form.bathrooms = detail.bathrooms || 1
  form.area = detail.area === null || detail.area === undefined ? '' : String(detail.area)
  form.orientationIdx = optionIndex(ORIENTATION_OPTIONS, detail.orientation)
  form.decorationIdx = optionIndex(DECORATION_OPTIONS, detail.decoration)
  form.rentalTypeIdx = optionIndex(RENTAL_TYPE_OPTIONS, detail.rentalType)
  form.rentPrice = detail.rentPrice === null || detail.rentPrice === undefined ? '' : String(detail.rentPrice)
  form.deposit = detail.deposit ? String(detail.deposit) : ''
  form.depositRuleIdx = optionIndex(DEPOSIT_RULE_OPTIONS, detail.depositRule)
  form.minLease = detail.minLease ? String(detail.minLease) : ''
  form.landlordName = detail.landlordName || ''
  form.landlordPhone = detail.landlordPhone || ''
  form.description = detail.description || ''
  form.remark = detail.remark || ''
  form.status = detail.status ?? 0
  form.tagIds = detail.tags?.map(item => item.id) || []
  form.facilityIds = detail.facilities?.map(item => item.id) || []
  form.imageIds = detail.images?.map(item => item.id) || []
  form.imageUrls = await Promise.all((detail.images || []).map(async (image) => {
    try {
      return await downloadFile(image.id)
    }
    catch {
      return resolveAssetUrl(image.url)
    }
  }))
  if (!form.imageIds.length && detail.coverImageId && detail.coverImage) {
    form.imageIds = [detail.coverImageId]
    try {
      form.imageUrls = [await downloadFile(detail.coverImageId)]
    }
    catch {
      form.imageUrls = [resolveAssetUrl(detail.coverImage)]
    }
  }
  form.coverImageId = detail.coverImageId ? String(detail.coverImageId) : String(form.imageIds[0] || '')
}

onLoad(async (query) => {
  loading.value = true
  try {
    await Promise.all([loadCommunities(), loadTags()])
    if (query?.id) {
      isEdit.value = true
      editId.value = String(query.id)
      const detail = await getPropertyDetail(editId.value)
      await fillDetail(detail)
      communityPickerIdx.value = Math.max(0, communities.value.findIndex(item => idEquals(item.id, form.communityId)))
      await loadBuildings(form.communityId)
      buildingPickerIdx.value = Math.max(0, buildings.value.findIndex(item => idEquals(item.id, form.buildingId)))
      uni.setNavigationBarTitle({ title: '编辑房源' })
      return
    }

    if (query?.communityId) {
      form.communityId = String(query.communityId)
      communityPickerIdx.value = Math.max(0, communities.value.findIndex(item => idEquals(item.id, form.communityId)))
      await loadBuildings(form.communityId)
    }
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <view class="sl-page form-page">
    <view class="form-hero sl-card">
      <view>
        <text class="form-hero__eyebrow">{{ isEdit ? 'Edit Property' : 'Create Property' }}</text>
        <text class="form-hero__title">{{ form.title || '完善房源信息' }}</text>
        <text class="form-hero__desc">楼盘、房间、价格、图片和标签都在一页完成，保存后可进入销控表。</text>
      </view>
      <wd-tag :type="isEdit ? 'warning' : 'success'" plain>
        {{ isEdit ? '编辑' : '新增' }}
      </wd-tag>
    </view>

    <view class="quick-summary sl-card">
      <view class="summary-pill" :class="{ done: !!form.communityId && !!form.buildingId }">
        <text class="summary-dot">1</text>
        <text>归属</text>
      </view>
      <view class="summary-pill" :class="{ done: !!form.title && !!form.rentPrice }">
        <text class="summary-dot">2</text>
        <text>信息</text>
      </view>
      <view class="summary-pill" :class="{ done: form.imageIds.length > 0 }">
        <text class="summary-dot">3</text>
        <text>图片</text>
      </view>
    </view>

    <view v-if="loading" class="loading sl-card">
      房源加载中...
    </view>

    <view v-else class="form-content">
      <view class="form-card sl-card">
        <text class="form-card__title">位置归属</text>
        <view class="form-item">
          <text class="form-label">楼盘 *</text>
          <picker :range="communityNames" :value="communityPickerIdx" @change="onCommunityChange">
            <view class="picker-value">
              {{ selectedCommunity?.name || '请选择楼盘' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">楼栋 *</text>
          <picker :range="buildingNames" :value="buildingPickerIdx" :disabled="!form.communityId" @change="onBuildingChange">
            <view class="picker-value" :class="{ disabled: !form.communityId }">
              {{ selectedBuilding?.name || (form.communityId ? '请选择楼栋' : '请先选择楼盘') }}
            </view>
          </picker>
        </view>
        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">楼层 *</text>
            <input v-model="form.floor" class="form-input" type="number" placeholder="如 6">
          </view>
          <view class="form-item">
            <text class="form-label">总楼层</text>
            <input v-model="form.totalFloors" class="form-input" type="number" placeholder="如 12">
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">房间号</text>
          <input v-model="form.roomNo" class="form-input" placeholder="如 605 / A302">
        </view>
      </view>

      <view class="form-card sl-card">
        <text class="form-card__title">基础信息</text>
        <view class="form-item">
          <text class="form-label">标题 *</text>
          <input v-model="form.title" class="form-input" placeholder="如 精装一房 采光好">
        </view>
        <view class="counter-row">
          <view class="counter">
            <text>室</text>
            <view><text @tap="form.bedrooms = Math.max(0, form.bedrooms - 1)">-</text><text>{{ form.bedrooms }}</text><text @tap="form.bedrooms += 1">+</text></view>
          </view>
          <view class="counter">
            <text>厅</text>
            <view><text @tap="form.livingRooms = Math.max(0, form.livingRooms - 1)">-</text><text>{{ form.livingRooms }}</text><text @tap="form.livingRooms += 1">+</text></view>
          </view>
          <view class="counter">
            <text>卫</text>
            <view><text @tap="form.bathrooms = Math.max(0, form.bathrooms - 1)">-</text><text>{{ form.bathrooms }}</text><text @tap="form.bathrooms += 1">+</text></view>
          </view>
        </view>
        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">面积(㎡)</text>
            <input v-model="form.area" class="form-input" type="digit" placeholder="如 45">
          </view>
          <view class="form-item">
            <text class="form-label">月租金 *</text>
            <input v-model="form.rentPrice" class="form-input" type="digit" placeholder="如 1800">
          </view>
        </view>
        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">押金</text>
            <input v-model="form.deposit" class="form-input" type="digit" placeholder="如 1800">
          </view>
          <view class="form-item">
            <text class="form-label">最短租期(月)</text>
            <input v-model="form.minLease" class="form-input" type="number" placeholder="如 3">
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">朝向</text>
          <picker :range="ORIENTATION_OPTIONS.map(item => item.label)" :value="form.orientationIdx" @change="(event: any) => form.orientationIdx = Number(event.detail.value)">
            <view class="picker-value">
              {{ form.orientationIdx >= 0 ? ORIENTATION_OPTIONS[form.orientationIdx].label : '请选择' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">装修</text>
          <picker :range="DECORATION_OPTIONS.map(item => item.label)" :value="form.decorationIdx" @change="(event: any) => form.decorationIdx = Number(event.detail.value)">
            <view class="picker-value">
              {{ form.decorationIdx >= 0 ? DECORATION_OPTIONS[form.decorationIdx].label : '请选择' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">出租方式</text>
          <picker :range="RENTAL_TYPE_OPTIONS.map(item => item.label)" :value="form.rentalTypeIdx" @change="(event: any) => form.rentalTypeIdx = Number(event.detail.value)">
            <view class="picker-value">
              {{ form.rentalTypeIdx >= 0 ? RENTAL_TYPE_OPTIONS[form.rentalTypeIdx].label : '请选择' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">押付方式</text>
          <picker :range="DEPOSIT_RULE_OPTIONS.map(item => item.label)" :value="form.depositRuleIdx" @change="(event: any) => form.depositRuleIdx = Number(event.detail.value)">
            <view class="picker-value">
              {{ form.depositRuleIdx >= 0 ? DEPOSIT_RULE_OPTIONS[form.depositRuleIdx].label : '请选择' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">状态</text>
          <view class="status-row">
            <wd-tag v-for="item in PROPERTY_STATUS_OPTIONS" :key="item.value" :type="form.status === item.value ? item.tone as any : 'default'" @click="form.status = item.value">
              {{ item.label }}
            </wd-tag>
          </view>
        </view>
        <view class="form-grid">
          <view class="form-item">
            <text class="form-label">房东姓名</text>
            <input v-model="form.landlordName" class="form-input" placeholder="姓名/称呼">
          </view>
          <view class="form-item">
            <text class="form-label">房东电话</text>
            <input v-model="form.landlordPhone" class="form-input" type="number" placeholder="手机号">
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">描述</text>
          <textarea v-model="form.description" class="form-textarea" placeholder="填写采光、交通、家具等亮点" />
        </view>
      </view>

      <view class="form-card sl-card">
        <text class="form-card__title">图片与标签</text>
        <view class="image-grid">
          <view v-for="(url, index) in form.imageUrls" :key="`${url}-${index}`" class="image-item">
            <image :src="url" mode="aspectFill" @tap="previewImage(index)" />
            <text v-if="idEquals(form.coverImageId, form.imageIds[index])" class="cover-badge">封面</text>
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
        <view v-if="houseTags.length" class="tag-section">
          <text class="form-label">房源标签</text>
          <view class="tag-list">
            <wd-tag v-for="tag in houseTags" :key="String(tag.id)" :type="hasId(form.tagIds, tag.id) ? 'success' : 'default'" @click="toggleId(form.tagIds, tag.id)">
              {{ tag.name }}
            </wd-tag>
          </view>
        </view>
        <view v-if="facilityTags.length" class="tag-section">
          <text class="form-label">配套设施</text>
          <view class="tag-list">
            <wd-tag v-for="tag in facilityTags" :key="String(tag.id)" :type="hasId(form.facilityIds, tag.id) ? 'success' : 'default'" @click="toggleId(form.facilityIds, tag.id)">
              {{ tag.name }}
            </wd-tag>
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">内部备注</text>
          <textarea v-model="form.remark" class="form-textarea" placeholder="仅管理端可见" />
        </view>
      </view>
    </view>

    <view class="bottom-bar sl-safe-bottom">
      <wd-button plain type="default" @click="cancel">
        取消
      </wd-button>
      <wd-button block type="primary" :loading="submitting" @click="submit">
        {{ isEdit ? '保存修改' : '发布房源' }}
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.form-page {
  padding-bottom: calc(130rpx + env(safe-area-inset-bottom));
}

.form-hero,
.quick-summary,
.form-card,
.loading {
  padding: 26rpx;
}

.form-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18rpx;
}

.form-hero__eyebrow,
.form-hero__title,
.form-hero__desc {
  display: block;
}

.form-hero__eyebrow {
  color: var(--sl-muted);
  font-size: 23rpx;
}

.form-hero__title {
  margin-top: 8rpx;
  font-size: 36rpx;
  font-weight: 850;
}

.form-hero__desc {
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  line-height: 1.55;
}

.quick-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 20rpx;
}

.summary-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 12rpx 10rpx;
  border-radius: 999rpx;
  background: #edf4ea;
  color: var(--sl-muted);
  font-size: 24rpx;
  font-weight: 800;
}

.summary-pill.done {
  background: rgb(18 107 79 / 12%);
  color: var(--sl-brand);
}

.summary-dot {
  width: 34rpx;
  height: 34rpx;
  border-radius: 999rpx;
  background: #fff;
  line-height: 34rpx;
  text-align: center;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 20rpx;
}

.form-card__title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 31rpx;
  font-weight: 850;
}

.form-item {
  margin-top: 20rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
  color: #4d5e56;
  font-size: 25rpx;
  font-weight: 800;
}

.form-input,
.picker-value,
.form-textarea {
  width: 100%;
  box-sizing: border-box;
  border-radius: 18rpx;
  background: #f3f7f1;
  color: var(--sl-ink);
  font-size: 27rpx;
}

.form-input,
.picker-value {
  height: 76rpx;
  padding: 0 20rpx;
  line-height: 76rpx;
}

.picker-value.disabled {
  color: var(--sl-muted);
}

.form-textarea {
  min-height: 160rpx;
  padding: 18rpx 20rpx;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16rpx;
}

.counter-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 20rpx;
}

.counter {
  padding: 18rpx 12rpx;
  border-radius: 18rpx;
  background: #f3f7f1;
  text-align: center;
}

.counter > text {
  color: var(--sl-muted);
  font-size: 23rpx;
}

.counter view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: 30rpx;
  font-weight: 850;
}

.counter view text:first-child,
.counter view text:last-child {
  width: 42rpx;
  height: 42rpx;
  border-radius: 999rpx;
  background: #fff;
  color: var(--sl-brand);
  line-height: 42rpx;
}

.status-row,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
}

.image-item,
.image-add {
  position: relative;
  height: 180rpx;
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

.tag-section {
  margin-top: 24rpx;
}

.loading {
  margin-top: 20rpx;
  color: var(--sl-muted);
  text-align: center;
}

.bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  gap: 16rpx;
  padding: 18rpx 28rpx 24rpx;
  border-top: 1rpx solid rgb(18 107 79 / 10%);
  background: rgb(255 255 255 / 96%);
}
</style>
