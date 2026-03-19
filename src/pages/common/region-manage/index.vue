<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useAppStore } from '@/stores/app'
import { getRegionTree, addRegion, updateRegion, deleteRegion, saveBoundary } from '@/api/region'
import type { SlRegionTreeOutput } from '@/types/region'

const appStore = useAppStore()
const tree = ref<SlRegionTreeOutput[]>([])

// ---- Form ----
const showForm = ref(false)
const isEdit = ref(false)
const form = ref({ id: '', name: '', level: 1, parentId: '', orderNo: 0 })

// ---- Map ----
const mapCenter = ref({ lng: 113.93, lat: 22.75 })
const mapScale = ref(12)

// ---- Expand/Collapse ----
const expandedIds = ref<Set<number>>(new Set())

function toggleExpand(nodeId: number) {
  if (expandedIds.value.has(nodeId)) {
    expandedIds.value.delete(nodeId)
  } else {
    expandedIds.value.add(nodeId)
  }
  // 触发响应式更新
  expandedIds.value = new Set(expandedIds.value)
}

function isExpanded(nodeId: number): boolean {
  return expandedIds.value.has(nodeId)
}

// ---- Boundary edit ----
const editingRegion = ref<SlRegionTreeOutput | null>(null)
const editPoints = ref<{ longitude: number; latitude: number }[]>([])

// ---- Active locate highlight ----
const locatedId = ref<number | null>(null)

// ---- List panel collapse ----
const listCollapsed = ref(false)

// ---- Helpers ----
function parseBoundary(boundary: string): { longitude: number; latitude: number }[] {
  try {
    const arr = JSON.parse(boundary) as number[][]
    return arr.map(([lng, lat]) => ({ longitude: lng, latitude: lat }))
  } catch {
    return []
  }
}

function hasBoundary(node: SlRegionTreeOutput): boolean {
  if (!node.boundary) return false
  return parseBoundary(node.boundary).length >= 3
}

function calcCenter(points: { longitude: number; latitude: number }[]) {
  if (!points.length) return { lng: 113.93, lat: 22.75 }
  const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length
  const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length
  return { lng, lat }
}

function getNodeCenter(node: SlRegionTreeOutput): { lng: number; lat: number } | null {
  if (node.centerLng && node.centerLat) return { lng: node.centerLng, lat: node.centerLat }
  if (node.boundary) {
    const pts = parseBoundary(node.boundary)
    if (pts.length >= 3) return calcCenter(pts)
  }
  return null
}

// ---- Click region → locate on map ----
function locateRegion(node: SlRegionTreeOutput) {
  const center = getNodeCenter(node)
  if (!center) {
    uni.showToast({ title: '该区域暂无边界数据', icon: 'none' })
    return
  }
  mapCenter.value = center
  mapScale.value = node.level <= 1 ? 13 : 15
  locatedId.value = node.id
}

// ---- Polygons for map ----
const L1_COLORS = { fill: '#3B82F620', stroke: '#3B82F6' }
const L2_COLORS = { fill: '#10B98120', stroke: '#10B981' }
const EDIT_COLORS = { fill: '#EF444440', stroke: '#EF4444' }
const LOCATED_COLORS = { fill: '#F59E0B40', stroke: '#F59E0B' }

const polygons = computed(() => {
  const result: any[] = []

  function walk(nodes: SlRegionTreeOutput[], level: number) {
    for (const node of nodes) {
      if (node.boundary) {
        const points = parseBoundary(node.boundary)
        if (points.length >= 3) {
          const isEditing = editingRegion.value?.id === node.id
          const isLocated = locatedId.value === node.id && !isEditing
          const colors = isEditing ? EDIT_COLORS : isLocated ? LOCATED_COLORS : level <= 1 ? L1_COLORS : L2_COLORS
          result.push({
            points,
            fillColor: colors.fill,
            strokeColor: colors.stroke,
            strokeWidth: isEditing || isLocated ? 3 : 2,
            zIndex: isEditing ? 10 : isLocated ? 5 : level,
          })
        }
      }
      if (node.children?.length) walk(node.children, level + 1)
    }
  }
  walk(tree.value, 1)

  // 编辑中的临时多边形
  if (editPoints.value.length >= 3) {
    result.push({
      points: editPoints.value,
      fillColor: EDIT_COLORS.fill,
      strokeColor: EDIT_COLORS.stroke,
      strokeWidth: 3,
      zIndex: 100,
    })
  }

  return result
})

// 扁平化区域节点（用于 marker ID 映射）
const LABEL_ID_BASE = 1000
const flatRegionNodes = computed(() => {
  const result: { node: SlRegionTreeOutput; level: number; center: { lng: number; lat: number } }[] = []
  function walk(nodes: SlRegionTreeOutput[], level: number) {
    for (const node of nodes) {
      const center = getNodeCenter(node)
      if (center) result.push({ node, level, center })
      if (node.children?.length) walk(node.children, level + 1)
    }
  }
  walk(tree.value, 1)
  return result
})

// 地图 markers：区域名称标签 + 编辑点
const markers = computed(() => {
  const result: any[] = []

  // 区域名称标签（用 callout 显示）
  flatRegionNodes.value.forEach(({ node, level, center }, idx) => {
    const isLocated = locatedId.value === node.id
    result.push({
      id: LABEL_ID_BASE + idx,
      latitude: center.lat,
      longitude: center.lng,
      width: 1,
      height: 1,
      iconPath: '/static/images/dot-red.png',
      anchor: { x: 0.5, y: 0.5 },
      callout: {
        content: node.name,
        display: 'ALWAYS',
        fontSize: isLocated ? 13 : 11,
        borderRadius: 4,
        padding: 6,
        bgColor: isLocated ? '#F59E0B' : level <= 1 ? '#3B82F6' : '#10B981',
        color: '#fff',
        anchorY: 0,
      },
    })
  })

  // 编辑点 markers
  if (editingRegion.value) {
    editPoints.value.forEach((p, i) => {
      result.push({
        id: i + 1,
        latitude: p.latitude,
        longitude: p.longitude,
        width: 12,
        height: 12,
        anchor: { x: 0.5, y: 0.5 },
        iconPath: '/static/images/dot-red.png',
        callout: i === 0 ? { content: '起点', display: 'ALWAYS', fontSize: 10, borderRadius: 4, padding: 4, bgColor: '#EF4444', color: '#fff' } : undefined,
      })
    })
  }

  return result
})

// ---- 点击地图标签 → 选中列表区域 ----
function onMarkerTap(e: any) {
  const markerId = e.detail?.markerId ?? e.markerId
  if (markerId == null) return
  const idx = markerId - LABEL_ID_BASE
  const entry = flatRegionNodes.value[idx]
  if (!entry) return
  locateFromMap(entry.node)
}

function locateFromMap(node: SlRegionTreeOutput) {
  locatedId.value = node.id
  // 确保父级展开，让选中项可见
  if (node.pid) expandedIds.value.add(node.pid); expandedIds.value = new Set(expandedIds.value)
  // 如果列表收起则展开
  if (listCollapsed.value) listCollapsed.value = false
}

// ---- Data loading ----
async function loadData() {
  try {
    tree.value = await getRegionTree()
    // 默认展开所有有子级的节点
    const ids = new Set<number>()
    tree.value.forEach(n => { if (n.children?.length) ids.add(n.id) })
    expandedIds.value = ids
  } catch {}
}

// ---- Map tap ----
function onMapTap(e: any) {
  if (!editingRegion.value) return
  const { longitude, latitude } = e.detail || e
  if (!longitude || !latitude) return
  editPoints.value.push({ longitude, latitude })
}

// ---- Boundary edit actions ----
function startEditBoundary(node: SlRegionTreeOutput) {
  editingRegion.value = node
  // 加载已有边界点
  if (node.boundary) {
    editPoints.value = parseBoundary(node.boundary)
  } else {
    editPoints.value = []
  }
  // 移动地图到区域中心
  if (node.centerLng && node.centerLat) {
    mapCenter.value = { lng: node.centerLng, lat: node.centerLat }
    mapScale.value = 14
  }
}

function clearEditPoints() {
  editPoints.value = []
}

function undoLastPoint() {
  editPoints.value.pop()
}

function cancelEdit() {
  editingRegion.value = null
  editPoints.value = []
}

async function saveEditBoundary() {
  if (!editingRegion.value) return
  if (editPoints.value.length < 3) {
    uni.showToast({ title: '至少需要3个点', icon: 'none' })
    return
  }
  const boundary = JSON.stringify(editPoints.value.map(p => [p.longitude, p.latitude]))
  const center = calcCenter(editPoints.value)
  try {
    await saveBoundary({
      id: editingRegion.value.id,
      boundary,
      centerLng: center.lng,
      centerLat: center.lat,
    })
    uni.showToast({ title: '边界保存成功', icon: 'success' })
    editingRegion.value = null
    editPoints.value = []
    loadData()
  } catch {}
}

// ---- CRUD ----
function openAdd(parentId = '', level = 1) {
  isEdit.value = false
  form.value = { id: '', name: '', level, parentId, orderNo: 0 }
  showForm.value = true
}

function openEdit(node: SlRegionTreeOutput) {
  isEdit.value = true
  form.value = {
    id: String(node.id),
    name: node.name,
    level: node.level,
    parentId: String(node.pid || ''),
    orderNo: 0,
  }
  showForm.value = true
}

async function onSubmit() {
  if (!form.value.name.trim()) {
    uni.showToast({ title: '请输入区域名称', icon: 'none' })
    return
  }
  try {
    if (isEdit.value) {
      await updateRegion({
        id: Number(form.value.id),
        name: form.value.name,
        level: form.value.level,
        pid: form.value.parentId ? Number(form.value.parentId) : undefined,
        orderNo: form.value.orderNo,
      })
      uni.showToast({ title: '更新成功', icon: 'success' })
    } else {
      await addRegion({
        name: form.value.name,
        level: form.value.level,
        pid: form.value.parentId ? Number(form.value.parentId) : undefined,
        orderNo: form.value.orderNo,
      })
      uni.showToast({ title: '新增成功', icon: 'success' })
    }
    showForm.value = false
    loadData()
  } catch {}
}

function onDelete(node: SlRegionTreeOutput) {
  uni.showModal({
    title: '确认删除',
    content: `确定删除区域「${node.name}」？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await deleteRegion({ id: node.id })
        uni.showToast({ title: '删除成功', icon: 'success' })
        loadData()
      } catch {}
    },
  })
}

onShow(() => loadData())
</script>

<template>
  <view class="page">
    <view class="page-header" :style="{ paddingTop: appStore.headerPaddingStyle(12) }">
      <text class="page-title">区域管理</text>
    </view>

    <!-- 地图区域 -->
    <view class="map-section">
      <view v-if="editingRegion" class="edit-bar">
        <view class="edit-info">
          <text class="edit-hint">点击地图添加「{{ editingRegion.name }}」的边界点</text>
          <text class="edit-count">已添加 {{ editPoints.length }} 个点</text>
        </view>
        <view class="edit-actions">
          <text class="edit-btn" @tap="undoLastPoint">撤销</text>
          <text class="edit-btn" @tap="clearEditPoints">清除</text>
          <text class="edit-btn cancel" @tap="cancelEdit">取消</text>
          <text class="edit-btn save" @tap="saveEditBoundary">保存</text>
        </view>
      </view>
      <map
        id="regionMap"
        :longitude="mapCenter.lng"
        :latitude="mapCenter.lat"
        :scale="mapScale"
        :polygons="polygons"
        :markers="markers"
        :enable-zoom="true"
        :enable-scroll="true"
        :show-location="false"
        class="region-map"
        :class="{ expanded: listCollapsed }"
        @tap="onMapTap"
        @markertap="onMarkerTap"
        @callouttap="onMarkerTap"
      />
    </view>

    <!-- 拖拽把手：收起/展开列表 -->
    <view class="panel-handle" @tap="listCollapsed = !listCollapsed">
      <view class="handle-bar" />
      <text class="handle-arrow">{{ listCollapsed ? '&#9650;' : '&#9660;' }}</text>
      <text class="handle-text">{{ listCollapsed ? '展开列表' : '收起列表' }}</text>
    </view>

    <!-- 区域列表 -->
    <scroll-view v-show="!listCollapsed" scroll-y class="list-area">
      <view v-if="tree.length === 0" class="empty-wrap">
        <text class="empty-text">暂无区域数据</text>
      </view>
      <view v-else class="tree">
        <view v-for="node in tree" :key="node.id" class="tree-l1">
          <view class="tree-item" :class="{ located: locatedId === node.id }">
            <view class="item-left" @tap="locateRegion(node)">
              <!-- 展开/收起箭头 -->
              <view
                v-if="node.children?.length"
                class="expand-arrow"
                :class="{ expanded: isExpanded(node.id) }"
                @tap.stop="toggleExpand(node.id)"
              >
                <text class="arrow-icon">&#9654;</text>
              </view>
              <text class="item-name">{{ node.name }}</text>
              <view v-if="hasBoundary(node)" class="boundary-badge">已绘制</view>
            </view>
            <view class="item-actions">
              <text class="act-btn add" @tap="openAdd(String(node.id), node.level + 1)">+子级</text>
              <text class="act-btn boundary" :class="{ done: hasBoundary(node) }" @tap.stop="startEditBoundary(node)">边界</text>
              <text class="act-btn edit" @tap="openEdit(node)">编辑</text>
              <text class="act-btn del" @tap="onDelete(node)">删除</text>
            </view>
          </view>
          <view v-if="node.children?.length && isExpanded(node.id)" class="tree-children">
            <view v-for="child in node.children" :key="child.id" class="tree-item sub" :class="{ located: locatedId === child.id }">
              <view class="item-left" @tap="locateRegion(child)">
                <text class="item-name">{{ child.name }}</text>
                <view v-if="hasBoundary(child)" class="boundary-badge green">已绘制</view>
              </view>
              <view class="item-actions">
                <text class="act-btn boundary" :class="{ done: hasBoundary(child) }" @tap.stop="startEditBoundary(child)">边界</text>
                <text class="act-btn edit" @tap="openEdit(child)">编辑</text>
                <text class="act-btn del" @tap="onDelete(child)">删除</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- FAB -->
    <view class="fab" @tap="openAdd()">
      <text class="fab-icon">+</text>
    </view>

    <!-- Form Modal -->
    <view v-if="showForm" class="modal-mask" @tap="showForm = false">
      <view class="modal-panel" @tap.stop>
        <text class="modal-title">{{ isEdit ? '编辑区域' : '新增区域' }}</text>
        <view class="form-group">
          <text class="form-label">名称</text>
          <input v-model="form.name" class="form-input" placeholder="请输入区域名称" />
        </view>
        <view class="form-group">
          <text class="form-label">排序</text>
          <input v-model.number="form.orderNo" class="form-input" type="number" placeholder="0" />
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
  min-height: 100vh;
  background-color: $sl-bg-page;
  display: flex;
  flex-direction: column;
}

.page-header {
  padding: $sl-spacing-md $sl-spacing-lg;
  background-color: $sl-bg-card;
  border-bottom: 1rpx solid $sl-border-color;
}

.page-title {
  font-size: $sl-font-xl;
  font-weight: 700;
  color: $sl-text-primary;
}

// ---- Map ----
.map-section {
  position: relative;
  background-color: $sl-bg-card;
}

.region-map {
  width: 100%;
  height: 400rpx;

  &.expanded {
    height: calc(100vh - 200rpx);
  }
}

.edit-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 10;
  background-color: rgba(239, 68, 68, 0.95);
  padding: 16rpx 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.edit-info {
  flex: 1;
  min-width: 0;
}

.edit-hint {
  font-size: 24rpx;
  color: #fff;
  display: block;
}

.edit-count {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.8);
}

.edit-actions {
  display: flex;
  gap: 12rpx;
  flex-shrink: 0;
}

.edit-btn {
  font-size: 22rpx;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  color: #fff;
  background-color: rgba(255, 255, 255, 0.2);

  &.cancel {
    background-color: rgba(255, 255, 255, 0.15);
  }

  &.save {
    background-color: #fff;
    color: #EF4444;
    font-weight: 600;
  }
}

// ---- Panel handle ----
.panel-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 12rpx 0;
  background-color: $sl-bg-card;
  border-top: 1rpx solid $sl-border-color;
  border-bottom: 1rpx solid $sl-border-color;
}

.handle-bar {
  width: 60rpx;
  height: 6rpx;
  border-radius: 3rpx;
  background-color: $sl-border-color;
}

.handle-arrow {
  font-size: 18rpx;
  color: $sl-text-placeholder;
}

.handle-text {
  font-size: 22rpx;
  color: $sl-text-placeholder;
}

// ---- List ----
.list-area {
  flex: 1;
  padding: $sl-spacing-sm;
  padding-bottom: 200rpx;
}

.empty-wrap {
  padding: $sl-spacing-xl;
  text-align: center;
}

.empty-text {
  color: $sl-text-secondary;
  font-size: $sl-font-sm;
}

.tree-l1 {
  margin-bottom: $sl-spacing-sm;
}

.tree-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $sl-spacing-md;
  background-color: $sl-bg-card;
  border-radius: $sl-border-radius;
  transition: background-color 0.2s;

  &.sub {
    margin-left: $sl-spacing-lg;
    margin-top: $sl-spacing-xs;
    background-color: rgba(255, 255, 255, 0.8);
  }

  &.located {
    background-color: rgba(245, 158, 11, 0.08);
    box-shadow: inset 0 0 0 1rpx rgba(245, 158, 11, 0.3);
  }
}

.item-left {
  display: flex;
  align-items: center;
  gap: $sl-spacing-sm;
  min-width: 0;
  flex: 1;
}

.expand-arrow {
  width: 36rpx;
  height: 36rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s;

  &.expanded {
    transform: rotate(90deg);
  }
}

.arrow-icon {
  font-size: 20rpx;
  color: $sl-text-secondary;
}

.item-name {
  font-size: $sl-font-md;
  font-weight: 600;
  color: $sl-text-primary;
}

.boundary-badge {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 6rpx;
  background-color: rgba(59, 130, 246, 0.1);
  color: #3B82F6;
  flex-shrink: 0;

  &.green {
    background-color: rgba(16, 185, 129, 0.1);
    color: #10B981;
  }
}

.item-actions {
  display: flex;
  gap: $sl-spacing-xs;
  flex-shrink: 0;
}

.act-btn {
  font-size: $sl-font-xs;
  padding: $sl-spacing-xs $sl-spacing-sm;
  border-radius: 6rpx;

  &.add {
    color: $sl-primary;
    background-color: rgba(24, 144, 255, 0.1);
  }

  &.boundary {
    color: #8B5CF6;
    background-color: rgba(139, 92, 246, 0.1);

    &.done {
      color: #fff;
      background-color: #8B5CF6;
    }
  }

  &.edit {
    color: #faad14;
    background-color: rgba(250, 173, 20, 0.1);
  }

  &.del {
    color: $sl-danger;
    background-color: rgba(255, 77, 79, 0.1);
  }
}

.tree-children {
  padding-bottom: $sl-spacing-xs;
}

// ---- FAB ----
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

// ---- Modal ----
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
