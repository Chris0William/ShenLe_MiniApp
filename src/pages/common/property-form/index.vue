<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { getCommunityList } from '@/api/community'
import { getBuildingList } from '@/api/building'
import { getTagList } from '@/api/tag'
import { addProperty, updateProperty, getPropertyDetail } from '@/api/property'
import { uploadFile, downloadFile } from '@/api/file'
import { ORIENTATIONS, DECORATIONS, RENTAL_TYPES, DEPOSIT_RULES } from '@/utils/constants'
import type { SlCommunitySelectOutput } from '@/types/community'
import type { SlBuildingOutput } from '@/types/building'
import type { SlTagOutput } from '@/types/tag'

const currentStep = ref(0)
const steps = ['选择位置', '填写信息', '上传图片']
const isEdit = ref(false)
const editId = ref('')
const submitting = ref(false)

// 步骤1：位置信息
const communities = ref<SlCommunitySelectOutput[]>([])
const buildings = ref<SlBuildingOutput[]>([])
const form = reactive({
  communityId: '',
  buildingId: '',
  floor: '',
  roomNumber: '',
  totalFloor: '',
  // 步骤2：基本信息
  title: '',
  bedrooms: 1,
  livingRooms: 1,
  bathrooms: 1,
  area: '',
  orientationIdx: -1,
  decorationIdx: -1,
  rentalTypeIdx: -1,
  monthlyRent: '',
  deposit: '',
  depositRuleIdx: -1,
  description: '',
  contactName: '',
  contactPhone: '',
  // 标签
  selectedTagIds: [] as string[],
  selectedFacilityIds: [] as string[],
  // 步骤3：图片
  imageIds: [] as string[],
  imageUrls: [] as string[],
  coverImageId: '',
})

// 标签数据
const houseTags = ref<SlTagOutput[]>([])
const facilityTags = ref<SlTagOutput[]>([])

async function loadCommunities() {
  try {
    communities.value = await getCommunityList({})
  } catch {}
}

async function loadBuildings(communityId: string) {
  if (!communityId) { buildings.value = []; return }
  try {
    buildings.value = await getBuildingList({ communityId })
  } catch {}
}

async function loadTags() {
  try {
    houseTags.value = await getTagList({ category: 'house' })
    facilityTags.value = await getTagList({ category: 'facility' })
  } catch {}
}

watch(() => form.communityId, (val) => {
  form.buildingId = ''
  loadBuildings(val)
})

// 社区选择
const communityPickerIdx = ref(0)
function onCommunityChange(e: any) {
  const idx = Number(e.detail.value)
  communityPickerIdx.value = idx
  form.communityId = communities.value[idx]?.id || ''
}

// 楼栋选择
const buildingPickerIdx = ref(0)
function onBuildingChange(e: any) {
  const idx = Number(e.detail.value)
  buildingPickerIdx.value = idx
  form.buildingId = buildings.value[idx]?.id || ''
  if (buildings.value[idx]?.totalFloors) {
    form.totalFloor = String(buildings.value[idx].totalFloors)
  }
}

// 标签切换
function toggleTag(id: string, list: string[]) {
  const idx = list.indexOf(id)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(id)
}

// 图片上传
async function onChooseImage() {
  uni.chooseImage({
    count: 9 - form.imageIds.length,
    success: async (res) => {
      for (const path of res.tempFilePaths) {
        try {
          const file = await uploadFile(path)
          form.imageIds.push(file.id)
          form.imageUrls.push(path) // 直接用本地临时路径
          if (!form.coverImageId) form.coverImageId = file.id
        } catch {}
      }
    },
  })
}

function removeImage(idx: number) {
  const removedId = form.imageIds[idx]
  form.imageIds.splice(idx, 1)
  form.imageUrls.splice(idx, 1)
  if (form.coverImageId === removedId) {
    form.coverImageId = form.imageIds[0] || ''
  }
}

function setCover(idx: number) {
  form.coverImageId = form.imageIds[idx]
}

// 步骤验证
function validateStep(): boolean {
  if (currentStep.value === 0) {
    if (!form.communityId) { uni.showToast({ title: '请选择楼盘', icon: 'none' }); return false }
    if (!form.buildingId) { uni.showToast({ title: '请选择楼栋', icon: 'none' }); return false }
    if (!form.floor) { uni.showToast({ title: '请填写楼层', icon: 'none' }); return false }
    return true
  }
  if (currentStep.value === 1) {
    if (!form.title.trim()) { uni.showToast({ title: '请填写标题', icon: 'none' }); return false }
    if (!form.monthlyRent) { uni.showToast({ title: '请填写月租金', icon: 'none' }); return false }
    return true
  }
  return true
}

function onNext() {
  if (!validateStep()) return
  currentStep.value++
}

async function onSubmit() {
  if (submitting.value) return
  submitting.value = true
  try {
    const data: any = {
      title: form.title,
      communityId: Number(form.communityId),
      buildingId: Number(form.buildingId),
      floor: Number(form.floor) || 0,
      totalFloors: Number(form.totalFloor) || 0,
      roomNo: form.roomNumber || undefined,
      area: Number(form.area) || 0,
      bedrooms: form.bedrooms,
      livingRooms: form.livingRooms,
      bathrooms: form.bathrooms,
      orientation: form.orientationIdx >= 0 ? ORIENTATIONS[form.orientationIdx] : undefined,
      decoration: form.decorationIdx >= 0 ? DECORATIONS[form.decorationIdx] : undefined,
      rentalType: form.rentalTypeIdx >= 0 ? RENTAL_TYPES[form.rentalTypeIdx] : undefined,
      rentPrice: Number(form.monthlyRent) || 0,
      deposit: Number(form.deposit) || 0,
      depositRule: form.depositRuleIdx >= 0 ? DEPOSIT_RULES[form.depositRuleIdx].label : undefined,
      description: form.description || undefined,
      landlordName: form.contactName || undefined,
      landlordPhone: form.contactPhone || undefined,
      status: 0,
      coverImageId: form.coverImageId ? Number(form.coverImageId) : undefined,
      tagIds: form.selectedTagIds.map(Number),
      facilityIds: form.selectedFacilityIds.map(Number),
      images: form.imageIds.map(id => ({ fileId: Number(id) })),
    }

    if (isEdit.value) {
      await updateProperty({ ...data, id: Number(editId.value) })
      uni.showToast({ title: '更新成功', icon: 'success' })
    } else {
      await addProperty(data)
      uni.showToast({ title: '发布成功', icon: 'success' })
    }
    setTimeout(() => uni.navigateBack(), 500)
  } catch {} finally {
    submitting.value = false
  }
}

onLoad(async (options) => {
  await Promise.all([loadCommunities(), loadTags()])
  if (options?.id) {
    isEdit.value = true
    editId.value = options.id
    try {
      const detail = await getPropertyDetail(options.id)
      form.communityId = detail.communityId
      await loadBuildings(detail.communityId)
      form.buildingId = detail.buildingId
      form.floor = String(detail.floor ?? '')
      form.totalFloor = String(detail.totalFloors ?? '')
      form.roomNumber = detail.roomNo ?? ''
      form.title = detail.title
      form.bedrooms = detail.bedrooms
      form.livingRooms = detail.livingRooms
      form.bathrooms = detail.bathrooms
      form.area = String(detail.area)
      form.orientationIdx = ORIENTATIONS.indexOf(detail.orientation)
      form.decorationIdx = DECORATIONS.indexOf(detail.decoration)
      form.rentalTypeIdx = RENTAL_TYPES.indexOf(detail.rentalType)
      form.monthlyRent = String(detail.rentPrice ?? '')
      form.deposit = String(detail.deposit || '')
      form.description = detail.description || ''
      form.contactName = detail.landlordName || ''
      form.contactPhone = detail.landlordPhone || ''
      form.selectedTagIds = detail.tags?.map(t => t.id) || []
      form.selectedFacilityIds = detail.facilities?.map(f => f.id) || []
      form.imageIds = detail.images?.map(i => i.id) || []
      // 带 token 下载图片到本地临时路径
      const urls: string[] = []
      for (const img of (detail.images || [])) {
        try { urls.push(await downloadFile(String(img.id))) } catch { urls.push('') }
      }
      form.imageUrls = urls
      form.coverImageId = detail.coverImageId || ''
      // 设置 picker 索引
      communityPickerIdx.value = communities.value.findIndex(c => c.id === detail.communityId)
      buildingPickerIdx.value = buildings.value.findIndex(b => b.id === detail.buildingId)
    } catch {}
  }
})
</script>

<template>
  <view class="page">
    <!-- 步骤条 -->
    <view class="steps">
      <view
        v-for="(step, i) in steps"
        :key="i"
        class="step"
        :class="{ active: i === currentStep, done: i < currentStep }"
      >
        <view class="step-dot">
          <text>{{ i < currentStep ? '✓' : i + 1 }}</text>
        </view>
        <text class="step-text">{{ step }}</text>
      </view>
    </view>

    <!-- 步骤1：选择位置 -->
    <view v-if="currentStep === 0" class="form-area">
      <view class="form-card">
        <view class="form-item">
          <text class="form-label">楼盘 *</text>
          <picker :range="communities.map(c => c.name)" :value="communityPickerIdx" @change="onCommunityChange">
            <view class="picker-value">
              {{ form.communityId ? communities[communityPickerIdx]?.name : '请选择楼盘' }}
            </view>
          </picker>
        </view>
        <view class="form-item">
          <text class="form-label">楼栋 *</text>
          <picker :range="buildings.map(b => b.name)" :value="buildingPickerIdx" @change="onBuildingChange" :disabled="!form.communityId">
            <view class="picker-value" :class="{ disabled: !form.communityId }">
              {{ form.buildingId ? buildings[buildingPickerIdx]?.name : (form.communityId ? '请选择楼栋' : '请先选择楼盘') }}
            </view>
          </picker>
        </view>
        <view class="form-row">
          <view class="form-item half">
            <text class="form-label">楼层 *</text>
            <input v-model="form.floor" class="form-input" type="number" placeholder="如 6" />
          </view>
          <view class="form-item half">
            <text class="form-label">房间号</text>
            <input v-model="form.roomNumber" class="form-input" placeholder="如 605" />
          </view>
        </view>
        <view class="form-item">
          <text class="form-label">总楼层</text>
          <input v-model="form.totalFloor" class="form-input" type="number" placeholder="如 12" />
        </view>
      </view>
    </view>

    <!-- 步骤2：房源信息 -->
    <scroll-view v-if="currentStep === 1" scroll-y class="form-area form-scroll">
      <view class="form-card">
        <view class="form-item">
          <text class="form-label">标题 *</text>
          <input v-model="form.title" class="form-input" placeholder="如：精装一房一厅 采光极佳" />
        </view>

        <view class="form-item">
          <text class="form-label">户型</text>
          <view class="stepper-row">
            <view class="stepper-group">
              <view class="stepper-btn" @tap="form.bedrooms = Math.max(0, form.bedrooms - 1)"><text>-</text></view>
              <text class="stepper-value">{{ form.bedrooms }}室</text>
              <view class="stepper-btn" @tap="form.bedrooms++"><text>+</text></view>
            </view>
            <view class="stepper-group">
              <view class="stepper-btn" @tap="form.livingRooms = Math.max(0, form.livingRooms - 1)"><text>-</text></view>
              <text class="stepper-value">{{ form.livingRooms }}厅</text>
              <view class="stepper-btn" @tap="form.livingRooms++"><text>+</text></view>
            </view>
            <view class="stepper-group">
              <view class="stepper-btn" @tap="form.bathrooms = Math.max(0, form.bathrooms - 1)"><text>-</text></view>
              <text class="stepper-value">{{ form.bathrooms }}卫</text>
              <view class="stepper-btn" @tap="form.bathrooms++"><text>+</text></view>
            </view>
          </view>
        </view>

        <view class="form-row">
          <view class="form-item half">
            <text class="form-label">面积(㎡)</text>
            <input v-model="form.area" class="form-input" type="digit" placeholder="如 45" />
          </view>
          <view class="form-item half">
            <text class="form-label">朝向</text>
            <picker :range="ORIENTATIONS" :value="form.orientationIdx" @change="(e: any) => form.orientationIdx = Number(e.detail.value)">
              <view class="picker-value">{{ form.orientationIdx >= 0 ? ORIENTATIONS[form.orientationIdx] : '请选择' }}</view>
            </picker>
          </view>
        </view>

        <view class="form-row">
          <view class="form-item half">
            <text class="form-label">装修</text>
            <picker :range="DECORATIONS" :value="form.decorationIdx" @change="(e: any) => form.decorationIdx = Number(e.detail.value)">
              <view class="picker-value">{{ form.decorationIdx >= 0 ? DECORATIONS[form.decorationIdx] : '请选择' }}</view>
            </picker>
          </view>
          <view class="form-item half">
            <text class="form-label">租赁方式</text>
            <picker :range="RENTAL_TYPES" :value="form.rentalTypeIdx" @change="(e: any) => form.rentalTypeIdx = Number(e.detail.value)">
              <view class="picker-value">{{ form.rentalTypeIdx >= 0 ? RENTAL_TYPES[form.rentalTypeIdx] : '请选择' }}</view>
            </picker>
          </view>
        </view>

        <view class="form-row">
          <view class="form-item half">
            <text class="form-label">月租金(元) *</text>
            <input v-model="form.monthlyRent" class="form-input" type="number" placeholder="1350" />
          </view>
          <view class="form-item half">
            <text class="form-label">押金(元)</text>
            <input v-model="form.deposit" class="form-input" type="number" placeholder="1350" />
          </view>
        </view>

        <view class="form-item">
          <text class="form-label">押付规则</text>
          <picker :range="DEPOSIT_RULES.map(r => r.label)" :value="form.depositRuleIdx" @change="(e: any) => form.depositRuleIdx = Number(e.detail.value)">
            <view class="picker-value">{{ form.depositRuleIdx >= 0 ? DEPOSIT_RULES[form.depositRuleIdx].label : '请选择' }}</view>
          </picker>
        </view>
      </view>

      <!-- 标签选择 -->
      <view class="form-card" v-if="houseTags.length > 0">
        <text class="form-label">房源标签</text>
        <view class="tag-grid">
          <view
            v-for="tag in houseTags"
            :key="tag.id"
            class="tag-item"
            :class="{ selected: form.selectedTagIds.includes(tag.id) }"
            @tap="toggleTag(tag.id, form.selectedTagIds)"
          >
            <text>{{ tag.name }}</text>
          </view>
        </view>
      </view>

      <view class="form-card" v-if="facilityTags.length > 0">
        <text class="form-label">配套设施</text>
        <view class="tag-grid">
          <view
            v-for="tag in facilityTags"
            :key="tag.id"
            class="tag-item"
            :class="{ selected: form.selectedFacilityIds.includes(tag.id) }"
            @tap="toggleTag(tag.id, form.selectedFacilityIds)"
          >
            <text>{{ tag.name }}</text>
          </view>
        </view>
      </view>

      <view class="form-card">
        <view class="form-item">
          <text class="form-label">描述</text>
          <textarea v-model="form.description" class="form-textarea" placeholder="描述房源详细情况" />
        </view>
        <view class="form-row">
          <view class="form-item half">
            <text class="form-label">联系人</text>
            <input v-model="form.contactName" class="form-input" placeholder="姓名" />
          </view>
          <view class="form-item half">
            <text class="form-label">联系电话</text>
            <input v-model="form.contactPhone" class="form-input" type="number" placeholder="手机号" />
          </view>
        </view>
      </view>
      <view style="height: 120rpx;" />
    </scroll-view>

    <!-- 步骤3：上传图片 -->
    <view v-if="currentStep === 2" class="form-area">
      <view class="form-card">
        <text class="form-label">房源图片（点击第一张设为封面）</text>
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
            <text class="add-text">添加图片</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部按钮 -->
    <view class="bottom-bar">
      <view v-if="currentStep > 0" class="btn btn-secondary" @tap="currentStep--">
        <text>上一步</text>
      </view>
      <view
        class="btn btn-primary"
        :class="{ disabled: submitting }"
        @tap="currentStep < 2 ? onNext() : onSubmit()"
      >
        <text>{{ currentStep < 2 ? '下一步' : (submitting ? '提交中...' : (isEdit ? '更新' : '发布')) }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $sl-bg-page;
  padding-bottom: 120rpx;
}

.steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $sl-spacing-lg;
  padding: $sl-spacing-lg $sl-spacing-md;
  background-color: $sl-bg-card;
  margin-bottom: $sl-spacing-sm;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.step-dot {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background-color: $sl-border-color;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
}

.step.active .step-dot {
  background-color: $sl-primary;
  color: #ffffff;
}

.step.done .step-dot {
  background-color: $sl-vacant;
  color: #ffffff;
}

.step-text {
  font-size: $sl-font-xs;
  color: $sl-text-secondary;
}

.step.active .step-text {
  color: $sl-primary;
  font-weight: 600;
}

.form-area {
  padding: $sl-spacing-sm $sl-spacing-md;
}

.form-scroll {
  height: calc(100vh - 220rpx);
}

.form-card {
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  padding: $sl-spacing-md;
  margin-bottom: $sl-spacing-sm;
}

.form-item {
  margin-bottom: $sl-spacing-md;

  &:last-child { margin-bottom: 0; }
}

.form-row {
  display: flex;
  gap: $sl-spacing-md;
}

.half {
  flex: 1;
}

.form-label {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  margin-bottom: $sl-spacing-xs;
  display: block;
}

.form-input {
  width: 100%;
  height: 72rpx;
  padding: 0 $sl-spacing-sm;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius-sm;
}

.form-textarea {
  width: 100%;
  min-height: 160rpx;
  padding: $sl-spacing-sm;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius-sm;
}

.picker-value {
  height: 72rpx;
  line-height: 72rpx;
  padding: 0 $sl-spacing-sm;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius-sm;

  &.disabled {
    color: $sl-text-placeholder;
  }
}

// Stepper
.stepper-row {
  display: flex;
  gap: $sl-spacing-md;
}

.stepper-group {
  display: flex;
  align-items: center;
  gap: $sl-spacing-xs;
}

.stepper-btn {
  width: 52rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius-sm;
  font-size: $sl-font-lg;
  color: $sl-text-primary;
}

.stepper-value {
  font-size: $sl-font-md;
  color: $sl-text-primary;
  min-width: 60rpx;
  text-align: center;
}

// Tags
.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-xs;
  margin-top: $sl-spacing-xs;
}

.tag-item {
  padding: $sl-spacing-xs $sl-spacing-md;
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
  background-color: $sl-bg-page;
  border-radius: 32rpx;
  border: 1rpx solid transparent;

  &.selected {
    color: $sl-primary;
    background-color: rgba($sl-primary, 0.08);
    border-color: $sl-primary;
  }
}

// Images
.image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: $sl-spacing-sm;
  margin-top: $sl-spacing-xs;
}

.image-item {
  width: 200rpx;
  height: 200rpx;
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
  font-size: $sl-font-xs;
  padding: 4rpx 12rpx;
  border-radius: 0 0 $sl-border-radius-sm 0;
}

.image-delete {
  position: absolute;
  right: 0;
  top: 0;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.5);
  color: #ffffff;
  font-size: $sl-font-md;
  border-radius: 0 0 0 $sl-border-radius-sm;
}

.image-add {
  width: 200rpx;
  height: 200rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius-sm;
  border: 2rpx dashed $sl-border-color;
}

.add-icon {
  font-size: 56rpx;
  color: $sl-text-placeholder;
  line-height: 1;
}

.add-text {
  font-size: $sl-font-xs;
  color: $sl-text-placeholder;
}

// Bottom bar
.bottom-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: $sl-spacing-sm;
  padding: $sl-spacing-sm $sl-spacing-lg;
  padding-bottom: calc(#{$sl-spacing-sm} + #{$sl-safe-bottom});
  background-color: $sl-bg-card;
  border-top: 1rpx solid $sl-border-color;
}

.btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: $sl-spacing-sm 0;
  border-radius: $sl-border-radius;
  font-size: $sl-font-md;
  font-weight: 600;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: $sl-text-primary;
}

.btn-primary {
  background-color: $sl-primary;
  color: #ffffff;

  &.disabled {
    opacity: 0.6;
  }
}
</style>
