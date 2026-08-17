<script setup lang="ts">
import type {
  SaveSlCommunityOperationConfigInput,
  SaveSlPropertyOperationConfigInput,
  ShenLeId,
  SlBuildingStatsOutput,
  SlCommissionMode,
  SlCommunityOperationConfigOutput,
  SlPropertyListOutput,
  SlPropertyOperationConfigOutput,
  SlSourceContactCommunityOutput,
} from '@/types/shenle'
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { getBuildingStats } from '@/api/building'
import { getPropertyList, updatePropertyStatus } from '@/api/property'
import {
  batchSavePropertyCommission,
  getCommunityOperationConfig,
  getPropertyOperationConfigList,
  saveCommunityOperationConfig,
  savePropertyOperationConfig,
} from '@/api/source-contact-portal'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { useSourceContactStore } from '@/store/source-contact'
import { useSafeTopStyle } from '@/utils/safe-area'
import { idToQuery } from '@/utils/shenle'

type Screen = 'communities' | 'buildings' | 'rooms' | 'property-action' | 'community-config' | 'property-config' | 'batch-commission'

interface RoomRow extends SlPropertyListOutput {
  operation?: SlPropertyOperationConfigOutput
}

interface OperationDraft {
  managementFee: string
  networkFee: string
  waterFee: string
  electricityFee: string
  commissionMode: SlCommissionMode | null
  commissionValue: string
  remark: string
}

const safeTop = useSafeTopStyle()
const sourceContact = useSourceContactStore()
const screen = ref<Screen>('communities')
const selectedCommunity = ref<SlSourceContactCommunityOutput | null>(null)
const selectedBuilding = ref<SlBuildingStatsOutput | null>(null)
const activeRoom = ref<RoomRow | null>(null)
const buildings = ref<SlBuildingStatsOutput[]>([])
const rooms = ref<RoomRow[]>([])
const communityConfig = ref<SlCommunityOperationConfigOutput | null>(null)
const loading = ref(false)
const saving = ref(false)
const selecting = ref(false)
const selectedRoomIds = ref<ShenLeId[]>([])
const draft = reactive<OperationDraft>({
  managementFee: '',
  networkFee: '',
  waterFee: '',
  electricityFee: '',
  commissionMode: null,
  commissionValue: '',
  remark: '',
})

const commissionModes: Array<{ value: SlCommissionMode, label: string, unit: string }> = [
  { value: 1, label: '固定金额', unit: '元' },
  { value: 2, label: '租金比例', unit: '%' },
  { value: 3, label: '月租倍数', unit: '倍' },
]

const title = computed(() => {
  if (screen.value === 'communities')
    return '房态管理'
  if (screen.value === 'buildings' || screen.value === 'community-config')
    return selectedCommunity.value?.name || '楼栋'
  if (screen.value === 'rooms' || screen.value === 'batch-commission')
    return selectedBuilding.value?.name || '房间'
  return activeRoom.value?.roomNo || activeRoom.value?.title || '房源'
})

const subtitle = computed(() => {
  if (screen.value === 'communities')
    return '按楼盘、楼栋逐层查看实时房态'
  if (screen.value === 'buildings')
    return `${selectedCommunity.value?.propertyCount || 0} 套房源`
  if (screen.value === 'rooms')
    return `${rooms.value.length} 套房源 · 点击房间管理`
  if (screen.value === 'community-config')
    return '楼盘默认费用与佣金'
  if (screen.value === 'property-config')
    return '留空则继承楼盘默认值'
  if (screen.value === 'batch-commission')
    return `统一设置 ${selectedRoomIds.value.length} 套房源佣金`
  return selectedCommunity.value?.name || ''
})

const floorGroups = computed(() => {
  const groups = new Map<number, RoomRow[]>()
  for (const room of rooms.value) {
    const floor = Number(room.floor || 0)
    if (!groups.has(floor))
      groups.set(floor, [])
    groups.get(floor)!.push(room)
  }
  return [...groups.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([floor, items]) => ({
      floor,
      label: floor ? `${floor}F` : '未分层',
      rooms: items.sort((a, b) => String(a.roomNo || a.title).localeCompare(String(b.roomNo || b.title), 'zh-CN', { numeric: true })),
    }))
})

const selectedAll = computed(() => rooms.value.length > 0 && selectedRoomIds.value.length === rooms.value.length)
const commissionUnit = computed(() => commissionModes.find(item => item.value === draft.commissionMode)?.unit || '')

function moneyRange(item: SlSourceContactCommunityOutput) {
  const min = Number(item.minRentPrice || 0)
  const max = Number(item.maxRentPrice || 0)
  if (min > 0 && max > 0 && min !== max)
    return `¥${min}-${max}`
  if (min > 0)
    return `¥${min}起`
  return '租金待完善'
}

function statusClass(status: number) {
  return `room--status-${status}`
}

function statusLabel(status: number) {
  return PROPERTY_STATUS_OPTIONS.find(item => item.value === status)?.label || '未知'
}

function commissionText(mode?: SlCommissionMode | null, value?: number | null) {
  if (!mode || !value)
    return '未设置'
  if (mode === 1)
    return `${value} 元`
  if (mode === 2)
    return `${value}% 租金`
  return `${value} 倍月租`
}

async function openCommunity(item: SlSourceContactCommunityOutput) {
  selectedCommunity.value = item
  sourceContact.selectCommunity(item.id)
  selectedBuilding.value = null
  rooms.value = []
  screen.value = 'buildings'
  loading.value = true
  try {
    const [nextBuildings, nextConfig] = await Promise.all([
      getBuildingStats(item.id),
      getCommunityOperationConfig(item.id),
    ])
    buildings.value = nextBuildings
    communityConfig.value = nextConfig
  }
  finally {
    loading.value = false
  }
}

async function openBuilding(item: SlBuildingStatsOutput) {
  selectedBuilding.value = item
  screen.value = 'rooms'
  selecting.value = false
  selectedRoomIds.value = []
  await loadRooms()
}

async function loadRooms() {
  if (!selectedBuilding.value)
    return
  loading.value = true
  try {
    const [propertyItems, operationItems] = await Promise.all([
      getPropertyList({ buildingId: selectedBuilding.value.id }),
      getPropertyOperationConfigList(selectedBuilding.value.id),
    ])
    const operationMap = new Map(operationItems.map(item => [String(item.propertyId), item]))
    rooms.value = propertyItems.map(item => ({ ...item, operation: operationMap.get(String(item.id)) }))
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function openRoom(item: RoomRow) {
  if (selecting.value) {
    toggleRoom(item.id)
    return
  }
  activeRoom.value = item
  screen.value = 'property-action'
}

function toggleRoom(id: ShenLeId) {
  const exists = selectedRoomIds.value.some(item => String(item) === String(id))
  selectedRoomIds.value = exists
    ? selectedRoomIds.value.filter(item => String(item) !== String(id))
    : [...selectedRoomIds.value, id]
}

function toggleSelectMode() {
  selecting.value = !selecting.value
  selectedRoomIds.value = []
}

function toggleAll() {
  selectedRoomIds.value = selectedAll.value ? [] : rooms.value.map(item => item.id)
}

async function changeStatus(status: number) {
  if (!activeRoom.value || saving.value)
    return
  saving.value = true
  try {
    await updatePropertyStatus({ id: activeRoom.value.id, status })
    activeRoom.value.status = status
    activeRoom.value.statusName = statusLabel(status)
    const room = rooms.value.find(item => String(item.id) === String(activeRoom.value?.id))
    if (room) {
      room.status = status
      room.statusName = statusLabel(status)
    }
    sourceContact.invalidate()
    uni.showToast({ title: '房态已更新', icon: 'success' })
  }
  finally {
    saving.value = false
  }
}

function resetDraft(config?: SlCommunityOperationConfigOutput | SlPropertyOperationConfigOutput | null) {
  draft.managementFee = config?.managementFee?.toString() || ''
  draft.networkFee = config?.networkFee?.toString() || ''
  draft.waterFee = config?.waterFee?.toString() || ''
  draft.electricityFee = config?.electricityFee?.toString() || ''
  draft.commissionMode = config?.commissionMode || null
  draft.commissionValue = config?.commissionValue?.toString() || ''
  draft.remark = 'remark' in (config || {}) ? (config as SlCommunityOperationConfigOutput).remark || '' : ''
}

function openCommunityConfig() {
  resetDraft(communityConfig.value)
  screen.value = 'community-config'
}

function openPropertyConfig() {
  resetDraft(activeRoom.value?.operation)
  screen.value = 'property-config'
}

function openBatchCommission() {
  if (!selectedRoomIds.value.length) {
    uni.showToast({ title: '请先选择房源', icon: 'none' })
    return
  }
  resetDraft(null)
  screen.value = 'batch-commission'
}

function optionalNumber(value: string, label: string) {
  const text = value.trim()
  if (!text)
    return null
  const number = Number(text)
  if (!Number.isFinite(number) || number < 0)
    throw new Error(`${label}格式不正确`)
  return number
}

function buildOperationInput() {
  const commissionValue = optionalNumber(draft.commissionValue, '佣金')
  if ((draft.commissionMode && !commissionValue) || (!draft.commissionMode && commissionValue !== null))
    throw new Error('请完整填写佣金方式和数值')
  return {
    managementFee: optionalNumber(draft.managementFee, '管理费'),
    networkFee: optionalNumber(draft.networkFee, '网络费'),
    waterFee: optionalNumber(draft.waterFee, '水费'),
    electricityFee: optionalNumber(draft.electricityFee, '电费'),
    commissionMode: draft.commissionMode,
    commissionValue,
  }
}

async function saveCommunityConfig() {
  if (!selectedCommunity.value || saving.value)
    return
  try {
    const values = buildOperationInput()
    saving.value = true
    const input: SaveSlCommunityOperationConfigInput = {
      communityId: selectedCommunity.value.id,
      ...values,
      remark: draft.remark.trim() || null,
    }
    await saveCommunityOperationConfig(input)
    communityConfig.value = await getCommunityOperationConfig(selectedCommunity.value.id)
    sourceContact.invalidate()
    screen.value = 'buildings'
    uni.showToast({ title: '楼盘经营设置已保存', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

async function savePropertyConfig() {
  if (!activeRoom.value || saving.value)
    return
  try {
    const values = buildOperationInput()
    saving.value = true
    const input: SaveSlPropertyOperationConfigInput = { propertyId: activeRoom.value.id, ...values }
    await savePropertyOperationConfig(input)
    await loadRooms()
    sourceContact.invalidate()
    activeRoom.value = rooms.value.find(item => String(item.id) === String(input.propertyId)) || activeRoom.value
    screen.value = 'property-action'
    uni.showToast({ title: '房源经营设置已保存', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

async function saveBatchCommission() {
  if (!selectedRoomIds.value.length || saving.value)
    return
  try {
    const commissionValue = optionalNumber(draft.commissionValue, '佣金')
    if (!draft.commissionMode || !commissionValue)
      throw new Error('请选择佣金方式并填写大于 0 的数值')
    saving.value = true
    await batchSavePropertyCommission({
      propertyIds: selectedRoomIds.value,
      commissionMode: draft.commissionMode,
      commissionValue,
    })
    await loadRooms()
    sourceContact.invalidate()
    selecting.value = false
    selectedRoomIds.value = []
    screen.value = 'rooms'
    uni.showToast({ title: '批量佣金已保存', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

function goDetail() {
  if (activeRoom.value)
    uni.navigateTo({ url: `/pages/common/property-detail/index?id=${idToQuery(activeRoom.value.id)}` })
}

function goEdit() {
  if (activeRoom.value)
    uni.navigateTo({ url: `/pages/common/property-form/index?id=${idToQuery(activeRoom.value.id)}` })
}

function goBack() {
  if (screen.value === 'buildings') {
    screen.value = 'communities'
    selectedCommunity.value = null
    sourceContact.selectCommunity(null)
    return
  }
  if (screen.value === 'rooms') {
    screen.value = 'buildings'
    selectedBuilding.value = null
    rooms.value = []
    selecting.value = false
    selectedRoomIds.value = []
    return
  }
  if (screen.value === 'community-config') {
    screen.value = 'buildings'
    return
  }
  if (screen.value === 'batch-commission') {
    screen.value = 'rooms'
    return
  }
  if (screen.value === 'property-config') {
    screen.value = 'property-action'
    return
  }
  if (screen.value === 'property-action') {
    screen.value = 'rooms'
    activeRoom.value = null
  }
}

async function refresh() {
  if (screen.value === 'communities')
    await sourceContact.load(true)
  else if (screen.value === 'buildings' && selectedCommunity.value)
    await openCommunity(selectedCommunity.value)
  else if (selectedBuilding.value)
    await loadRooms()
  uni.stopPullDownRefresh()
}

async function activate() {
  await sourceContact.load()
  const activeId = sourceContact.activeCommunityId
  if (!activeId)
    return
  if (selectedCommunity.value && String(selectedCommunity.value.id) === String(activeId))
    return
  const community = sourceContact.communities.find(item => String(item.id) === String(activeId))
  if (community)
    await openCommunity(community)
}

onMounted(async () => {
  await sourceContact.load()
  await nextTick()
  await activate()
})

defineExpose({ refresh, activate })
</script>

<template>
  <view class="room-state-page" :style="safeTop">
    <sl-source-contact-header :title="title" :subtitle="subtitle" :back="screen !== 'communities'" @back="goBack" />

    <view v-if="screen === 'communities'" class="content-area">
      <scroll-view scroll-y class="content-scroll">
        <view v-if="sourceContact.loading && !sourceContact.communities.length" class="empty-state">
          <wd-loading color="#126b4f" />
          <text>正在加载盘源</text>
        </view>
        <view v-else-if="!sourceContact.communities.length" class="empty-state">
          <wd-icon name="home" size="34px" color="#8fa098" />
          <text>暂未分配楼盘</text>
        </view>
        <view v-else class="community-list">
          <view v-for="item in sourceContact.communities" :key="String(item.id)" class="community-row" @tap="openCommunity(item)">
            <view class="community-row__main">
              <view class="community-row__title-line">
                <text class="community-row__name">{{ item.name }}</text>
                <text class="community-row__rent">{{ moneyRange(item) }}</text>
              </view>
              <text class="community-row__meta">{{ item.buildingCount }} 栋 · {{ item.propertyCount }} 套房源</text>
              <view class="community-row__stats">
                <text class="stat stat--vacant">可用 {{ item.availableCount }}</text>
                <text class="stat stat--rented">已租 {{ item.rentedCount }}</text>
                <text v-if="item.promotedCount" class="stat stat--promotion">推广 {{ item.promotedCount }}</text>
              </view>
            </view>
            <wd-icon name="arrow-right" size="19px" color="#8fa098" />
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-else-if="screen === 'buildings'" class="content-area">
      <view class="context-toolbar">
        <view>
          <text class="context-toolbar__label">楼盘经营默认值</text>
          <text class="context-toolbar__value">佣金 {{ commissionText(communityConfig?.commissionMode, communityConfig?.commissionValue) }}</text>
        </view>
        <wd-button size="small" plain @click="openCommunityConfig">
          费用与佣金
        </wd-button>
      </view>
      <scroll-view scroll-y class="content-scroll">
        <view v-if="loading" class="empty-state">
          <wd-loading color="#126b4f" />
          <text>正在加载楼栋</text>
        </view>
        <view v-else-if="!buildings.length" class="empty-state">
          <wd-icon name="view-list" size="34px" color="#8fa098" />
          <text>该楼盘暂无楼栋</text>
        </view>
        <view v-else class="building-list">
          <view v-for="item in buildings" :key="String(item.id)" class="building-row" @tap="openBuilding(item)">
            <view class="building-row__icon">
              <wd-icon name="home" size="24px" color="#126b4f" />
            </view>
            <view class="building-row__body">
              <text class="building-row__name">{{ item.name }}</text>
              <text class="building-row__meta">{{ item.totalFloors || '-' }} 层 · {{ item.propertyCount }} 套</text>
            </view>
            <view class="building-row__counts">
              <text>{{ item.availableCount }} 可用</text>
              <text>{{ item.rentedCount }} 已租</text>
            </view>
            <wd-icon name="arrow-right" size="18px" color="#8fa098" />
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-else-if="screen === 'rooms'" class="content-area">
      <view class="room-toolbar">
        <view v-if="selecting" class="select-all" @tap="toggleAll">
          <view class="check-box" :class="{ 'check-box--active': selectedAll }">
            <wd-icon v-if="selectedAll" name="check" size="15px" color="#fff" />
          </view>
          <text>全选本栋</text>
        </view>
        <text v-else class="room-toolbar__summary">点击房间可修改状态和经营参数</text>
        <wd-button size="small" :plain="!selecting" @click="toggleSelectMode">
          {{ selecting ? '取消选择' : '批量佣金' }}
        </wd-button>
      </view>
      <scroll-view scroll-y class="content-scroll">
        <view v-if="loading" class="empty-state">
          <wd-loading color="#126b4f" />
          <text>正在加载房态</text>
        </view>
        <view v-else-if="!rooms.length" class="empty-state">
          <wd-icon name="view-module" size="34px" color="#8fa098" />
          <text>该楼栋暂无房源</text>
        </view>
        <view v-else class="floor-list">
          <view v-for="floor in floorGroups" :key="floor.label" class="floor-row">
            <view class="floor-label">
              {{ floor.label }}
            </view>
            <view class="room-grid">
              <view
                v-for="room in floor.rooms"
                :key="String(room.id)"
                class="room"
                :class="[statusClass(room.status), { 'room--selected': selectedRoomIds.some(id => String(id) === String(room.id)) }]"
                @tap="openRoom(room)"
              >
                <view v-if="selecting" class="room__check">
                  <wd-icon v-if="selectedRoomIds.some(id => String(id) === String(room.id))" name="check" size="13px" color="#fff" />
                </view>
                <text class="room__no">{{ room.roomNo || room.title }}</text>
                <text class="room__price">¥{{ room.rentPrice || 0 }}</text>
                <text class="room__status">{{ statusLabel(room.status) }}</text>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>
      <view v-if="selecting" class="selection-footer">
        <text>已选择 {{ selectedRoomIds.length }} 套</text>
        <wd-button type="primary" size="small" :disabled="!selectedRoomIds.length" @click="openBatchCommission">
          设置佣金
        </wd-button>
      </view>
    </view>

    <scroll-view v-else-if="screen === 'property-action' && activeRoom" scroll-y class="editor-scroll">
      <view class="room-summary">
        <view>
          <text class="room-summary__name">{{ activeRoom.roomNo || activeRoom.title }}</text>
          <text class="room-summary__path">{{ selectedCommunity?.name }} / {{ selectedBuilding?.name }}</text>
        </view>
        <text class="room-summary__price">¥{{ activeRoom.rentPrice }}/月</text>
      </view>

      <view class="section-title">
        房态
      </view>
      <view class="status-grid">
        <view
          v-for="item in PROPERTY_STATUS_OPTIONS"
          :key="item.value"
          class="status-option"
          :class="{ 'status-option--active': activeRoom.status === item.value }"
          @tap="changeStatus(item.value)"
        >
          <view class="status-option__dot" :class="`status-option__dot--${item.value}`" />
          <text>{{ item.label }}</text>
        </view>
      </view>

      <view class="section-title">
        当前经营参数
      </view>
      <view class="effective-grid">
        <view class="effective-item">
          <text class="effective-item__label">管理费</text><text class="effective-item__value">{{ activeRoom.operation?.effectiveManagementFee ?? '-' }} 元/月</text>
        </view>
        <view class="effective-item">
          <text class="effective-item__label">网络费</text><text class="effective-item__value">{{ activeRoom.operation?.effectiveNetworkFee ?? '-' }} 元/月</text>
        </view>
        <view class="effective-item">
          <text class="effective-item__label">水费</text><text class="effective-item__value">{{ activeRoom.operation?.effectiveWaterFee ?? '-' }} 元/吨</text>
        </view>
        <view class="effective-item">
          <text class="effective-item__label">电费</text><text class="effective-item__value">{{ activeRoom.operation?.effectiveElectricityFee ?? '-' }} 元/度</text>
        </view>
        <view class="effective-item effective-item--wide">
          <text class="effective-item__label">标准佣金</text><text class="effective-item__value">{{ commissionText(activeRoom.operation?.effectiveCommissionMode, activeRoom.operation?.effectiveCommissionValue) }}</text>
        </view>
      </view>

      <view class="action-list">
        <view class="action-row" @tap="openPropertyConfig">
          <wd-icon name="setting" size="20px" color="#126b4f" />
          <text>设置本套费用与佣金</text>
          <wd-icon name="arrow-right" size="18px" color="#8fa098" />
        </view>
        <view class="action-row" @tap="goEdit">
          <wd-icon name="edit" size="20px" color="#126b4f" />
          <text>编辑房源资料</text>
          <wd-icon name="arrow-right" size="18px" color="#8fa098" />
        </view>
        <view class="action-row" @tap="goDetail">
          <wd-icon name="view" size="20px" color="#126b4f" />
          <text>查看房源详情</text>
          <wd-icon name="arrow-right" size="18px" color="#8fa098" />
        </view>
      </view>
    </scroll-view>

    <view v-else-if="screen === 'community-config' || screen === 'property-config'" class="editor-page">
      <scroll-view scroll-y class="editor-scroll">
        <view class="form-section">
          <text class="form-section__title">费用设置</text>
          <text class="form-section__hint">{{ screen === 'property-config' ? '单套留空时继承楼盘默认值' : '作为名下房源的默认经营费用' }}</text>
          <view class="field-grid">
            <label class="field"><text>管理费</text><view class="field__input"><input v-model="draft.managementFee" class="field__control" type="digit" placeholder="未设置"><text>元/月</text></view></label>
            <label class="field"><text>网络费</text><view class="field__input"><input v-model="draft.networkFee" class="field__control" type="digit" placeholder="未设置"><text>元/月</text></view></label>
            <label class="field"><text>水费</text><view class="field__input"><input v-model="draft.waterFee" class="field__control" type="digit" placeholder="未设置"><text>元/吨</text></view></label>
            <label class="field"><text>电费</text><view class="field__input"><input v-model="draft.electricityFee" class="field__control" type="digit" placeholder="未设置"><text>元/度</text></view></label>
          </view>
        </view>

        <view class="form-section">
          <text class="form-section__title">标准佣金</text>
          <view class="mode-grid">
            <view v-for="item in commissionModes" :key="item.value" class="mode-option" :class="{ 'mode-option--active': draft.commissionMode === item.value }" @tap="draft.commissionMode = draft.commissionMode === item.value ? null : item.value">
              {{ item.label }}
            </view>
          </view>
          <label class="field field--full">
            <text>佣金数值</text>
            <view class="field__input"><input v-model="draft.commissionValue" class="field__control" type="digit" placeholder="未设置"><text>{{ commissionUnit }}</text></view>
          </label>
        </view>

        <view v-if="screen === 'community-config'" class="form-section">
          <text class="form-section__title">备注</text>
          <textarea v-model="draft.remark" class="remark-input" :maxlength="500" placeholder="经营规则、结算说明等内部备注" />
        </view>
      </scroll-view>
      <view class="editor-footer">
        <wd-button block type="primary" :loading="saving" @click="screen === 'community-config' ? saveCommunityConfig() : savePropertyConfig()">
          保存设置
        </wd-button>
      </view>
    </view>

    <view v-else-if="screen === 'batch-commission'" class="editor-page">
      <scroll-view scroll-y class="editor-scroll">
        <view class="batch-notice">
          本次将覆盖已选择 {{ selectedRoomIds.length }} 套房源的标准佣金，不修改其他费用和房源资料。
        </view>
        <view class="form-section">
          <text class="form-section__title">佣金方式</text>
          <view class="mode-grid">
            <view v-for="item in commissionModes" :key="item.value" class="mode-option" :class="{ 'mode-option--active': draft.commissionMode === item.value }" @tap="draft.commissionMode = item.value">
              {{ item.label }}
            </view>
          </view>
          <label class="field field--full">
            <text>佣金数值</text>
            <view class="field__input"><input v-model="draft.commissionValue" type="digit" placeholder="请输入"><text>{{ commissionUnit }}</text></view>
          </label>
        </view>
      </scroll-view>
      <view class="editor-footer">
        <wd-button block type="primary" :loading="saving" @click="saveBatchCommission">
          保存 {{ selectedRoomIds.length }} 套房源
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.room-state-page {
  display: flex;
  width: 100%;
  height: 100vh;
  padding-right: 22rpx;
  padding-bottom: calc(126rpx + env(safe-area-inset-bottom));
  padding-left: 22rpx;
  box-sizing: border-box;
  overflow: hidden;
  flex-direction: column;
}

.content-area,
.editor-page {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.content-scroll,
.editor-scroll {
  min-height: 0;
  flex: 1;
}

.community-list,
.building-list,
.floor-list,
.action-list {
  padding: 16rpx 0 24rpx;
}

.community-row,
.building-row,
.action-row,
.context-toolbar,
.room-toolbar,
.room-summary,
.form-section,
.batch-notice {
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 8rpx;
  background: #fff;
}

.community-row {
  display: flex;
  min-height: 154rpx;
  align-items: center;
  padding: 22rpx;
  gap: 16rpx;
}

.community-row + .community-row,
.building-row + .building-row,
.action-row + .action-row {
  margin-top: 14rpx;
}

.community-row__main,
.building-row__body {
  min-width: 0;
  flex: 1;
}

.community-row__title-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.community-row__name,
.building-row__name,
.room-summary__name {
  overflow: hidden;
  font-size: 29rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-row__rent,
.room-summary__price {
  flex: none;
  color: #bd6417;
  font-size: 24rpx;
  font-weight: 800;
}

.community-row__meta,
.building-row__meta,
.room-summary__path {
  display: block;
  margin-top: 8rpx;
  color: #72817b;
  font-size: 22rpx;
}

.community-row__stats {
  display: flex;
  margin-top: 13rpx;
  gap: 10rpx;
}

.stat {
  padding: 5rpx 10rpx;
  border-radius: 5rpx;
  font-size: 20rpx;
}

.stat--vacant {
  color: #126b4f;
  background: #e8f5ee;
}
.stat--rented {
  color: #53635c;
  background: #eef1ef;
}
.stat--promotion {
  color: #9a5c08;
  background: #fff2d8;
}

.context-toolbar,
.room-toolbar {
  display: flex;
  flex: none;
  min-height: 84rpx;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
  padding: 14rpx 18rpx;
  gap: 16rpx;
}

.context-toolbar__label,
.context-toolbar__value {
  display: block;
}

.context-toolbar__label {
  font-size: 23rpx;
  font-weight: 700;
}

.context-toolbar__value,
.room-toolbar__summary {
  margin-top: 4rpx;
  color: #72817b;
  font-size: 20rpx;
}

.building-row {
  display: flex;
  min-height: 116rpx;
  align-items: center;
  padding: 18rpx;
  gap: 16rpx;
}

.building-row__icon {
  display: flex;
  width: 68rpx;
  height: 68rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 7rpx;
  background: #eaf3ed;
}

.building-row__counts {
  display: flex;
  flex: none;
  color: #66756e;
  flex-direction: column;
  font-size: 20rpx;
  gap: 5rpx;
  text-align: right;
}

.select-all {
  display: flex;
  align-items: center;
  color: #53635c;
  font-size: 23rpx;
  gap: 10rpx;
}

.check-box {
  display: flex;
  width: 34rpx;
  height: 34rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #b5c0ba;
  border-radius: 5rpx;
}

.check-box--active {
  border-color: #126b4f;
  background: #126b4f;
}

.floor-row {
  display: grid;
  grid-template-columns: 68rpx minmax(0, 1fr);
  gap: 14rpx;
}

.floor-row + .floor-row {
  margin-top: 18rpx;
}

.floor-label {
  padding-top: 18rpx;
  color: #126b4f;
  font-size: 23rpx;
  font-weight: 800;
  text-align: center;
}

.room-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12rpx;
}

.room {
  position: relative;
  display: flex;
  height: 126rpx;
  padding: 14rpx 8rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid transparent;
  border-radius: 7rpx;
  box-sizing: border-box;
  flex-direction: column;
}

.room--status-0 {
  color: #126b4f;
  background: #e8f5ee;
}
.room--status-1 {
  color: #9a5c08;
  background: #fff2d8;
}
.room--status-2 {
  color: #445b6b;
  background: #e8eff3;
}
.room--status-3 {
  color: #7e4339;
  background: #f5e9e6;
}
.room--selected {
  border-color: #126b4f;
}

.room__check {
  position: absolute;
  top: 7rpx;
  right: 7rpx;
  display: flex;
  width: 28rpx;
  height: 28rpx;
  align-items: center;
  justify-content: center;
  border-radius: 4rpx;
  background: #126b4f;
}

.room__no {
  max-width: 100%;
  overflow: hidden;
  font-size: 25rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.room__price,
.room__status {
  margin-top: 4rpx;
  font-size: 18rpx;
}

.selection-footer,
.editor-footer {
  display: flex;
  flex: none;
  min-height: 92rpx;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 2rpx 0;
  color: #53635c;
  font-size: 23rpx;
}

.room-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
  padding: 22rpx;
  gap: 18rpx;
}

.section-title {
  margin: 28rpx 2rpx 14rpx;
  font-size: 27rpx;
  font-weight: 800;
}

.status-grid,
.mode-grid,
.effective-grid,
.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12rpx;
}

.status-option,
.mode-option {
  display: flex;
  min-height: 78rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #dce5df;
  border-radius: 7rpx;
  background: #fff;
  color: #53635c;
  font-size: 23rpx;
  gap: 10rpx;
}

.status-option--active,
.mode-option--active {
  border-color: #126b4f;
  background: #eaf4ee;
  color: #126b4f;
  font-weight: 700;
}

.status-option__dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 999rpx;
}

.status-option__dot--0 {
  background: #1d8b64;
}
.status-option__dot--1 {
  background: #d38b19;
}
.status-option__dot--2 {
  background: #577489;
}
.status-option__dot--3 {
  background: #a65344;
}

.effective-item {
  display: flex;
  min-height: 86rpx;
  padding: 14rpx 16rpx;
  justify-content: center;
  border: 1rpx solid #e1e8e3;
  border-radius: 7rpx;
  background: #fff;
  flex-direction: column;
  gap: 6rpx;
}

.effective-item__label {
  color: #7a8780;
  font-size: 20rpx;
}

.effective-item__value {
  font-size: 23rpx;
  font-weight: 700;
}

.effective-item--wide {
  grid-column: 1 / -1;
}

.action-row {
  display: grid;
  min-height: 88rpx;
  padding: 0 18rpx;
  align-items: center;
  grid-template-columns: 42rpx minmax(0, 1fr) 32rpx;
  font-size: 24rpx;
}

.form-section {
  margin-top: 16rpx;
  padding: 22rpx;
}

.form-section__title,
.form-section__hint {
  display: block;
}

.form-section__title {
  font-size: 27rpx;
  font-weight: 800;
}

.form-section__hint {
  margin-top: 6rpx;
  color: #7a8780;
  font-size: 21rpx;
}

.field-grid,
.mode-grid {
  margin-top: 18rpx;
}

.field {
  display: block;
  color: #53635c;
  font-size: 22rpx;
}

.field--full {
  margin-top: 18rpx;
}

.field__input {
  display: flex;
  height: 72rpx;
  align-items: center;
  margin-top: 8rpx;
  padding: 0 14rpx;
  border: 1rpx solid #dce5df;
  border-radius: 7rpx;
  background: #f9fbf9;
  color: #7a8780;
  font-size: 20rpx;
  gap: 8rpx;
}

.field__control {
  min-width: 0;
  flex: 1;
  color: #1e2f27;
  font-size: 24rpx;
}

.remark-input {
  width: 100%;
  height: 180rpx;
  margin-top: 16rpx;
  padding: 16rpx;
  border: 1rpx solid #dce5df;
  border-radius: 7rpx;
  background: #f9fbf9;
  box-sizing: border-box;
  font-size: 23rpx;
}

.batch-notice {
  margin-top: 16rpx;
  padding: 18rpx;
  background: #fff7e7;
  color: #80520f;
  font-size: 22rpx;
  line-height: 1.55;
}

.empty-state {
  display: flex;
  min-height: 420rpx;
  align-items: center;
  justify-content: center;
  color: #7a8780;
  flex-direction: column;
  font-size: 24rpx;
  gap: 14rpx;
}
</style>
