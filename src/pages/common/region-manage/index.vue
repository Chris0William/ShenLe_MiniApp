<script setup lang="ts">
import type { AddSlRegionInput, ShenLeId, SlRegionTreeOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh } from '@dcloudio/uni-app'
import { computed, reactive, ref } from 'vue'
import { addRegion, deleteRegion, getRegionDetail, getRegionTree, updateRegion } from '@/api/region'

definePage({
  style: {
    navigationBarTitleText: '区域管理',
    enablePullDownRefresh: true,
  },
})

interface FlatRegion {
  id: ShenLeId
  pid: ShenLeId
  name: string
  rawName: string
  level: number
  depth: number
  boundary?: string | null
  centerLng?: number | null
  centerLat?: number | null
}

interface ParentOption {
  id: ShenLeId | '0'
  name: string
  level: number
}

interface RegionForm {
  id: string
  pid: string
  name: string
  level: number
  centerLng: string
  centerLat: string
  orderNo: string
  status: number
  remark: string
}

const DEFAULT_CENTER = { lng: 113.936, lat: 22.769 }
const tree = ref<SlRegionTreeOutput[]>([])
const loading = ref(false)
const formVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const locatedId = ref<string>('')
const mapCenter = reactive({ ...DEFAULT_CENTER })
const mapScale = ref(13)

const form = reactive<RegionForm>({
  id: '',
  pid: '0',
  name: '',
  level: 1,
  centerLng: '',
  centerLat: '',
  orderNo: '100',
  status: 0,
  remark: '',
})

const statusOptions = [
  { value: 0, label: '正常' },
  { value: 1, label: '禁用' },
] as const

const flatRegions = computed<FlatRegion[]>(() => {
  const result: FlatRegion[] = []
  function walk(nodes: SlRegionTreeOutput[], depth = 0) {
    for (const node of nodes) {
      result.push({
        id: node.id,
        pid: node.pid,
        name: `${'　'.repeat(depth)}${node.name}`,
        rawName: node.name,
        level: node.level,
        depth,
        boundary: node.boundary,
        centerLng: node.centerLng,
        centerLat: node.centerLat,
      })
      if (node.children?.length)
        walk(node.children, depth + 1)
    }
  }
  walk(tree.value)
  return result
})

const parentOptions = computed<ParentOption[]>(() => [
  { id: '0', name: '顶级区域', level: 0 },
  ...flatRegions.value
    .filter(item => !form.id || String(item.id) !== form.id)
    .map(item => ({ id: item.id, name: item.name, level: item.level })),
])
const parentNames = computed(() => parentOptions.value.map(item => item.name))
const parentIndex = computed(() => Math.max(0, parentOptions.value.findIndex(item => String(item.id) === String(form.pid))))
const markers = computed(() => flatRegions.value
  .map((item, index) => {
    const center = getCenter(item)
    if (!center)
      return null
    const active = String(item.id) === locatedId.value
    return {
      id: index + 1,
      latitude: center.lat,
      longitude: center.lng,
      iconPath: '/static/images/dot-red.png',
      width: active ? 28 : 20,
      height: active ? 28 : 20,
      callout: {
        content: item.rawName,
        display: 'ALWAYS',
        fontSize: active ? 13 : 11,
        padding: 6,
        borderRadius: 6,
        bgColor: active ? '#e4a11b' : '#126b4f',
        color: '#ffffff',
      },
    }
  })
  .filter(Boolean) as any[])
const polygons = computed(() => flatRegions.value
  .map((item) => {
    const points = parseBoundary(item.boundary)
    if (points.length < 3)
      return null
    const active = String(item.id) === locatedId.value
    return {
      points,
      fillColor: active ? '#e4a11b33' : '#126b4f22',
      strokeColor: active ? '#e4a11b' : '#126b4f',
      strokeWidth: active ? 3 : 2,
    }
  })
  .filter(Boolean) as any[])

function sameId(left?: ShenLeId | string | null, right?: ShenLeId | string | null) {
  return left !== undefined && left !== null && right !== undefined && right !== null && String(left) === String(right)
}

function toNumber(value: string, fallback?: number) {
  if (value === '')
    return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function parseBoundary(boundary?: string | null) {
  if (!boundary)
    return []
  try {
    const points = JSON.parse(boundary) as number[][]
    return points.map(([longitude, latitude]) => ({ longitude, latitude }))
  }
  catch {
    return []
  }
}

function calcCenter(points: { longitude: number, latitude: number }[]) {
  if (!points.length)
    return null
  const longitude = points.reduce((sum, item) => sum + item.longitude, 0) / points.length
  const latitude = points.reduce((sum, item) => sum + item.latitude, 0) / points.length
  return { lng: longitude, lat: latitude }
}

function getCenter(item: Pick<FlatRegion, 'centerLng' | 'centerLat' | 'boundary'>) {
  if (item.centerLng && item.centerLat)
    return { lng: Number(item.centerLng), lat: Number(item.centerLat) }
  return calcCenter(parseBoundary(item.boundary))
}

function statusLabel(status?: number) {
  return status === 1 ? '禁用' : '正常'
}

async function loadData() {
  loading.value = true
  try {
    tree.value = await getRegionTree()
    const first = flatRegions.value.find(item => getCenter(item))
    if (first)
      locateRegion(first, false)
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function locateRegion(item: FlatRegion, toast = true) {
  const center = getCenter(item)
  if (!center) {
    if (toast)
      uni.showToast({ title: '该区域暂无中心点或边界', icon: 'none' })
    return
  }
  locatedId.value = String(item.id)
  mapCenter.lng = center.lng
  mapCenter.lat = center.lat
  mapScale.value = item.level <= 1 ? 13 : 15
}

function onMarkerTap(event: any) {
  const markerId = Number(event.detail?.markerId ?? event.markerId)
  const item = flatRegions.value[markerId - 1]
  if (item)
    locateRegion(item)
}

function resetForm(item?: FlatRegion) {
  isEdit.value = !!item
  form.id = item ? String(item.id) : ''
  form.pid = item ? String(item.pid || '0') : '0'
  form.name = item?.rawName || ''
  form.level = item?.level || 1
  form.centerLng = item?.centerLng === null || item?.centerLng === undefined ? '' : String(item.centerLng)
  form.centerLat = item?.centerLat === null || item?.centerLat === undefined ? '' : String(item.centerLat)
  form.orderNo = '100'
  form.status = 0
  form.remark = ''
}

function openAdd(parent?: FlatRegion) {
  resetForm()
  if (parent) {
    form.pid = String(parent.id)
    form.level = parent.level + 1
  }
  formVisible.value = true
}

async function openEdit(item: FlatRegion) {
  resetForm(item)
  formVisible.value = true
  try {
    const detail = await getRegionDetail(item.id)
    form.orderNo = String(detail.orderNo ?? 100)
    form.status = detail.status ?? 0
    form.remark = detail.remark || ''
    form.centerLng = detail.centerLng === null || detail.centerLng === undefined ? form.centerLng : String(detail.centerLng)
    form.centerLat = detail.centerLat === null || detail.centerLat === undefined ? form.centerLat : String(detail.centerLat)
  }
  catch {}
}

function onParentChange(event: any) {
  const idx = Number(event.detail.value)
  const parent = parentOptions.value[idx]
  form.pid = String(parent?.id || '0')
  form.level = (parent?.level || 0) + 1
}

function chooseCenter() {
  uni.chooseLocation({
    latitude: toNumber(form.centerLat, DEFAULT_CENTER.lat),
    longitude: toNumber(form.centerLng, DEFAULT_CENTER.lng),
    success(res) {
      form.centerLng = String(res.longitude)
      form.centerLat = String(res.latitude)
    },
  })
}

function buildPayload(): AddSlRegionInput {
  return {
    pid: form.pid === '0' ? 0 : form.pid,
    name: form.name.trim(),
    level: form.level,
    centerLng: toNumber(form.centerLng),
    centerLat: toNumber(form.centerLat),
    orderNo: toNumber(form.orderNo, 100),
    status: form.status,
    remark: form.remark.trim() || undefined,
  }
}

async function submitForm() {
  if (!form.name.trim()) {
    uni.showToast({ title: '请输入区域名称', icon: 'none' })
    return
  }
  submitting.value = true
  try {
    const payload = buildPayload()
    if (isEdit.value)
      await updateRegion({ ...payload, id: form.id })
    else
      await addRegion(payload)
    uni.showToast({ title: isEdit.value ? '更新成功' : '新增成功', icon: 'success' })
    formVisible.value = false
    await loadData()
  }
  finally {
    submitting.value = false
  }
}

function confirmDelete(item: FlatRegion) {
  uni.showModal({
    title: '删除区域',
    content: `确定删除「${item.rawName}」？有下级区域或楼盘时后端会拦截。`,
    success: async (res) => {
      if (!res.confirm)
        return
      await deleteRegion(item.id)
      uni.showToast({ title: '删除成功', icon: 'success' })
      await loadData()
    },
  })
}

onLoad(loadData)
onPullDownRefresh(loadData)
</script>

<template>
  <view class="sl-page region-page">
    <view class="sl-hero">
      <text class="sl-eyebrow">Geo Boundary</text>
      <text class="sl-title">区域管理</text>
      <text class="sl-subtitle">维护片区层级与中心点，地图找房、楼盘归属和统计看板都会依赖这里。</text>
    </view>

    <view class="map-card sl-card">
      <map
        class="region-map"
        :latitude="mapCenter.lat"
        :longitude="mapCenter.lng"
        :markers="markers"
        :polygons="polygons"
        :scale="mapScale"
        @markertap="onMarkerTap"
      />
    </view>

    <view class="sl-section-head">
      <text class="sl-section-title">区域树</text>
      <wd-button size="small" type="primary" @click="openAdd()">新增区域</wd-button>
    </view>

    <view v-if="!flatRegions.length && !loading" class="empty sl-card">
      <wd-icon name="location" size="38px" color="#8ea099" />
      <text>暂无区域数据</text>
    </view>

    <view class="region-list">
      <view v-for="item in flatRegions" :key="String(item.id)" class="region-row sl-card">
        <view class="row-main" :style="{ paddingLeft: `${item.depth * 26}rpx` }">
          <view>
            <view class="title-line">
              <text class="region-name">{{ item.rawName }}</text>
              <wd-tag :type="item.centerLng && item.centerLat ? 'success' : 'default'" plain>
                {{ item.centerLng && item.centerLat ? '有坐标' : '缺坐标' }}
              </wd-tag>
            </view>
            <text class="region-meta">层级 {{ item.level }} · {{ statusLabel(0) }}</text>
          </view>
          <view class="row-actions">
            <wd-button size="small" plain @click="locateRegion(item)">定位</wd-button>
            <wd-button size="small" plain @click="openAdd(item)">下级</wd-button>
            <wd-button size="small" type="primary" plain @click="openEdit(item)">编辑</wd-button>
            <wd-button size="small" type="danger" plain @click="confirmDelete(item)">删除</wd-button>
          </view>
        </view>
      </view>
    </view>

    <view v-if="loading" class="load-tip">加载中...</view>

    <wd-popup v-model="formVisible" position="bottom" custom-style="border-radius: 30rpx 30rpx 0 0; overflow: hidden;" safe-area-inset-bottom>
      <view class="form-sheet">
        <view class="sheet-head">
          <view>
            <text class="sheet-title">{{ isEdit ? '编辑区域' : '新增区域' }}</text>
            <text class="sheet-sub">中心点可通过地图选择，边界数据继续沿用后端已有配置。</text>
          </view>
          <wd-icon name="close" size="22px" color="#72817b" @click="formVisible = false" />
        </view>

        <view class="form-body">
          <picker mode="selector" :value="parentIndex" :range="parentNames" @change="onParentChange">
            <view class="form-row form-row--picker">
              <text>上级区域</text>
              <text>{{ parentNames[parentIndex] || '顶级区域' }}</text>
            </view>
          </picker>
          <view class="grid-2">
            <view class="form-row">
              <text>区域名称</text>
              <input v-model="form.name" placeholder="如：西田" />
            </view>
            <view class="form-row">
              <text>层级</text>
              <input v-model="form.level" type="number" disabled />
            </view>
          </view>
          <view class="grid-2">
            <view class="form-row">
              <text>中心经度</text>
              <input v-model="form.centerLng" type="digit" placeholder="lng" />
            </view>
            <view class="form-row">
              <text>中心纬度</text>
              <input v-model="form.centerLat" type="digit" placeholder="lat" />
            </view>
          </view>
          <wd-button block plain @click="chooseCenter">从地图选择中心点</wd-button>
          <view class="grid-2">
            <view class="form-row">
              <text>排序</text>
              <input v-model="form.orderNo" type="number" />
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
          <wd-button block plain type="default" @click="formVisible = false">取消</wd-button>
          <wd-button block type="primary" :loading="submitting" @click="submitForm">保存</wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.region-page {
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.map-card {
  overflow: hidden;
  margin-top: 22rpx;
}

.region-map {
  width: 100%;
  height: 420rpx;
}

.region-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.region-row {
  padding: 20rpx;
}

.row-main,
.title-line,
.row-actions,
.sheet-head,
.sheet-actions {
  display: flex;
  align-items: center;
}

.row-main,
.sheet-head {
  justify-content: space-between;
  gap: 16rpx;
}

.title-line {
  gap: 10rpx;
}

.region-name,
.sheet-title {
  font-size: 30rpx;
  font-weight: 850;
}

.region-meta,
.sheet-sub,
.load-tip {
  color: var(--sl-muted);
  font-size: 24rpx;
}

.region-meta,
.sheet-sub {
  display: block;
  margin-top: 8rpx;
}

.row-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8rpx;
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

.form-sheet {
  padding: 28rpx 28rpx calc(28rpx + env(safe-area-inset-bottom));
  background: #fff;
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
  max-width: 430rpx;
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
