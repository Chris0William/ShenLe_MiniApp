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
import SlCommissionSettings from '@/components/sl-commission-settings/sl-commission-settings.vue'
import { PROPERTY_STATUS_OPTIONS } from '@/constants/shenle'
import { useSourceContactStore } from '@/store/source-contact'
import { COMMISSION_PERCENT_MAX, formatCommissionRange, normalizeCommissionPercent } from '@/utils/commission'
import { useSafeTopStyle } from '@/utils/safe-area'
import { idToQuery } from '@/utils/shenle'

type Screen = 'communities' | 'buildings' | 'rooms' | 'property-action' | 'community-config' | 'property-config' | 'batch-commission'

const COMMUNITY_RENDER_BATCH = 20

interface RoomRow extends SlPropertyListOutput {
  operation?: SlPropertyOperationConfigOutput
}

interface OperationDraft {
  managementFee: string
  networkFee: string
  networkFeeMode: 1 | 2 | null
  waterFee: string
  electricityFee: string
  commissionMode: SlCommissionMode | null
  commissionValue: string
  managementPackageMode: 1 | 2 | null
  networkPackageMode: 1 | 2 | 3 | 4 | null
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
const communityPage = ref(1)
const communityScrollTop = ref(0)
const communityConfigReturnScreen = ref<'communities' | 'buildings'>('communities')
const draft = reactive<OperationDraft>({
  managementFee: '',
  networkFee: '',
  networkFeeMode: null,
  waterFee: '',
  electricityFee: '',
  commissionMode: null,
  commissionValue: '',
  managementPackageMode: null,
  networkPackageMode: null,
  remark: '',
})

const title = computed(() => {
  if (screen.value === 'communities')
    return '楼盘信息'
  if (screen.value === 'buildings' || screen.value === 'community-config')
    return selectedCommunity.value?.name || '楼栋'
  if (screen.value === 'rooms' || screen.value === 'batch-commission')
    return selectedBuilding.value?.name || '房间'
  return activeRoom.value?.roomNo || activeRoom.value?.title || '房源'
})

const subtitle = computed(() => {
  if (screen.value === 'communities')
    return ''
  if (screen.value === 'buildings')
    return `${selectedCommunity.value?.propertyCount || 0} 套房源`
  if (screen.value === 'rooms')
    return `${rooms.value.length} 套房源 · 点击房间管理`
  if (screen.value === 'community-config')
    return '楼盘默认费用与佣金'
  if (screen.value === 'property-config')
    return '留空则继承楼盘默认值'
  if (screen.value === 'batch-commission')
    return `统一设置 ${selectedRoomIds.value.length} 套房源经营参数`
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
const propertyCommissionRange = ref<number[]>([0, 0])
const batchCommissionRange = ref<number[]>([0, 0])
const batchHalfYearEnabled = ref(false)
const batchOneYearEnabled = ref(false)
const batchManagementEnabled = ref(false)
const batchNetworkEnabled = ref(false)
const batchManagementMode = ref<1 | 2 | null>(null)
const batchNetworkMode = ref<1 | 2 | 3 | 4 | null>(null)
const batchHasChanges = computed(() => batchHalfYearEnabled.value || batchOneYearEnabled.value || batchManagementEnabled.value || batchNetworkEnabled.value)
const communityPageCount = computed(() => Math.max(1, Math.ceil(sourceContact.communities.length / COMMUNITY_RENDER_BATCH)))
const visibleCommunities = computed(() => {
  const start = (communityPage.value - 1) * COMMUNITY_RENDER_BATCH
  return sourceContact.communities.slice(start, start + COMMUNITY_RENDER_BATCH)
})

async function changeCommunityPage(nextPage: number) {
  const normalizedPage = Math.min(Math.max(1, nextPage), communityPageCount.value)
  if (normalizedPage === communityPage.value)
    return
  communityPage.value = normalizedPage
  communityScrollTop.value = 1
  await nextTick()
  communityScrollTop.value = 0
}

function moneyRange(item: SlSourceContactCommunityOutput) {
  const min = Number(item.minRentPrice || 0)
  const max = Number(item.maxRentPrice || 0)
  if (min > 0 && max > 0 && min !== max)
    return `¥${min}-${max}`
  if (min > 0)
    return `¥${min}起`
  return '租金待完善'
}

function moneyText(value?: number | null, unit = '元') {
  return value === null || value === undefined ? '未设置' : `${value}${unit}`
}

function percentText(value?: number | null) {
  return value === null || value === undefined ? '未设置' : `${value}%`
}

function networkFeeText(item: SlSourceContactCommunityOutput) {
  if (item.networkFeeMode === 2)
    return '自理'
  return moneyText(item.networkFee, '元/月')
}

function callCommunityContact(item: SlSourceContactCommunityOutput) {
  if (!item.contactPhone) {
    uni.showToast({ title: '该楼盘未设置联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: item.contactPhone })
}

function navigateToCommunity(item: SlSourceContactCommunityOutput) {
  const latitude = Number(item.lat)
  const longitude = Number(item.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || (latitude === 0 && longitude === 0)) {
    uni.showToast({ title: '该楼盘未设置有效位置', icon: 'none' })
    return
  }
  uni.openLocation({
    latitude,
    longitude,
    name: item.name,
    address: item.address || item.name,
    scale: 16,
  })
}

function statusClass(status: number) {
  return `room--status-${status}`
}

function statusLabel(status: number) {
  return PROPERTY_STATUS_OPTIONS.find(item => item.value === status)?.label || '未知'
}

function managementPackageText(value?: number | null) {
  if (value === 1)
    return '可包'
  if (value === 2)
    return '不可包'
  return '未设置'
}

function networkPackageText(value?: number | null) {
  if (value === 1)
    return '可包'
  if (value === 2)
    return '不可包'
  if (value === 3)
    return '自理'
  if (value === 4)
    return '必开'
  return '未设置'
}

async function openCommunity(item: SlSourceContactCommunityOutput) {
  selectedCommunity.value = item
  sourceContact.selectCommunity(item.id)
  selectedBuilding.value = null
  rooms.value = []
  screen.value = 'buildings'
  loading.value = true
  try {
    const nextBuildings = await getBuildingStats(item.id)
    buildings.value = nextBuildings
  }
  finally {
    loading.value = false
  }
}

async function openBuilding(item: SlBuildingStatsOutput) {
  if (!selectedCommunity.value)
    return
  selectedBuilding.value = item
  uni.navigateTo({
    url: `/pages/common/community-properties/index?communityId=${idToQuery(selectedCommunity.value.id)}&communityName=${encodeURIComponent(selectedCommunity.value.name)}&buildingId=${idToQuery(item.id)}&buildingName=${encodeURIComponent(item.name)}&buildingTotalFloors=${encodeURIComponent(String(item.totalFloors ?? ''))}`,
  })
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
    uni.showToast({ title: '房源状态已更新', icon: 'success' })
  }
  finally {
    saving.value = false
  }
}

function resetDraft(config?: SlCommunityOperationConfigOutput | SlPropertyOperationConfigOutput | null) {
  draft.managementFee = config?.managementFee?.toString() || ''
  draft.networkFee = config?.networkFee?.toString() || ''
  const networkFeeMode = 'networkFeeMode' in (config || {})
    ? (config as SlCommunityOperationConfigOutput).networkFeeMode
    : undefined
  draft.networkFeeMode = networkFeeMode || (config?.networkFee !== null && config?.networkFee !== undefined ? 1 : null)
  draft.waterFee = config?.waterFee?.toString() || ''
  draft.electricityFee = config?.electricityFee?.toString() || ''
  draft.commissionMode = config?.commissionMode || null
  draft.commissionValue = config?.commissionValue?.toString() || ''
  const propertyConfig = config && 'propertyId' in config ? config as SlPropertyOperationConfigOutput : null
  const communityConfigValue = config && !propertyConfig ? config as SlCommunityOperationConfigOutput : null
  propertyCommissionRange.value = [
    normalizeCommissionPercent(propertyConfig?.effectiveHalfYearCommissionPercent ?? propertyConfig?.halfYearCommissionPercent ?? communityConfigValue?.halfYearCommissionPercent),
    normalizeCommissionPercent(propertyConfig?.effectiveOneYearCommissionPercent ?? propertyConfig?.oneYearCommissionPercent ?? communityConfigValue?.oneYearCommissionPercent),
  ]
  draft.managementPackageMode = propertyConfig?.effectiveManagementPackageMode ?? propertyConfig?.managementPackageMode ?? communityConfigValue?.managementPackageMode ?? null
  draft.networkPackageMode = propertyConfig?.effectiveNetworkPackageMode ?? propertyConfig?.networkPackageMode ?? communityConfigValue?.networkPackageMode ?? null
  draft.remark = 'remark' in (config || {}) ? (config as SlCommunityOperationConfigOutput).remark || '' : ''
}

async function openCommunityConfig(item?: SlSourceContactCommunityOutput) {
  const target = item || selectedCommunity.value
  if (!target)
    return
  selectedCommunity.value = target
  sourceContact.selectCommunity(target.id)
  selectedBuilding.value = null
  communityConfigReturnScreen.value = item ? 'communities' : 'buildings'
  loading.value = true
  try {
    communityConfig.value = await getCommunityOperationConfig(target.id)
    resetDraft(communityConfig.value)
    screen.value = 'community-config'
  }
  catch (error) {
    screen.value = communityConfigReturnScreen.value
    uni.showToast({ title: error instanceof Error ? error.message : '楼盘费用加载失败', icon: 'none' })
  }
  finally {
    loading.value = false
  }
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
  batchCommissionRange.value = [0, 0]
  batchHalfYearEnabled.value = false
  batchOneYearEnabled.value = false
  batchManagementEnabled.value = false
  batchNetworkEnabled.value = false
  batchManagementMode.value = null
  batchNetworkMode.value = null
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
  const networkFee = screen.value === 'community-config' && draft.networkFeeMode === 2
    ? null
    : optionalNumber(draft.networkFee, '网络费')
  const input = {
    managementFee: optionalNumber(draft.managementFee, '管理费'),
    networkFee,
    waterFee: optionalNumber(draft.waterFee, '水费'),
    electricityFee: optionalNumber(draft.electricityFee, '电费'),
    commissionMode: draft.commissionMode,
    commissionValue,
  }
  const commissionFields = {
    halfYearCommissionPercent: boundedPercent(propertyCommissionRange.value[0], '半年佣金'),
    oneYearCommissionPercent: boundedPercent(propertyCommissionRange.value[1], '一年佣金'),
    managementPackageMode: draft.managementPackageMode,
    networkPackageMode: draft.networkPackageMode,
  }
  if (screen.value === 'property-config') {
    return {
      ...input,
      ...commissionFields,
    }
  }
  return { ...input, ...commissionFields, networkFeeMode: draft.networkFeeMode }
}

function confirmCommunitySync(): Promise<boolean> {
  return new Promise((resolve) => {
    uni.showModal({
      title: '同步房源经营参数',
      content: '是否将管理情况、网络情况和佣金同步到该楼盘的全部房源？',
      confirmText: '同步',
      cancelText: '仅保存楼盘',
      success: result => resolve(result.confirm),
      fail: () => resolve(false),
    })
  })
}

async function saveCommunityConfig() {
  if (!selectedCommunity.value || saving.value)
    return
  saving.value = true
  try {
    const values = buildOperationInput()
    const input: SaveSlCommunityOperationConfigInput = {
      communityId: selectedCommunity.value.id,
      ...values,
      applyToProperties: await confirmCommunitySync(),
      remark: draft.remark.trim() || null,
    }
    await saveCommunityOperationConfig(input)
    communityConfig.value = await getCommunityOperationConfig(selectedCommunity.value.id)
    sourceContact.invalidate()
    await sourceContact.load(true)
    screen.value = communityConfigReturnScreen.value
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
    if (!batchHasChanges.value)
      throw new Error('请至少启用一项经营参数')
    if (batchManagementEnabled.value && batchManagementMode.value === null)
      throw new Error('请选择管理情况')
    if (batchNetworkEnabled.value && batchNetworkMode.value === null)
      throw new Error('请选择网络情况')
    saving.value = true
    const input: {
      propertyIds: ShenLeId[]
      halfYearCommissionPercent?: number
      oneYearCommissionPercent?: number
      managementPackageMode?: 1 | 2
      networkPackageMode?: 1 | 2 | 3 | 4
    } = {
      propertyIds: selectedRoomIds.value,
    }
    if (batchHalfYearEnabled.value)
      input.halfYearCommissionPercent = boundedPercent(batchCommissionRange.value[0], '半年佣金')
    if (batchOneYearEnabled.value)
      input.oneYearCommissionPercent = boundedPercent(batchCommissionRange.value[1], '一年佣金')
    if (batchManagementEnabled.value)
      input.managementPackageMode = batchManagementMode.value!
    if (batchNetworkEnabled.value)
      input.networkPackageMode = batchNetworkMode.value!
    await batchSavePropertyCommission(input)
    await loadRooms()
    sourceContact.invalidate()
    selecting.value = false
    selectedRoomIds.value = []
    screen.value = 'rooms'
    uni.showToast({ title: '批量经营参数已保存', icon: 'success' })
  }
  catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : '保存失败', icon: 'none' })
  }
  finally {
    saving.value = false
  }
}

function boundedPercent(value: unknown, label: string) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0 || number > COMMISSION_PERCENT_MAX)
    throw new Error(`${label}必须在0到${COMMISSION_PERCENT_MAX}之间`)
  return number
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
    screen.value = communityConfigReturnScreen.value
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
  if (screen.value === 'communities') {
    communityPage.value = 1
    await sourceContact.load(true)
  }
  else if (screen.value === 'buildings' && selectedCommunity.value) {
    await openCommunity(selectedCommunity.value)
  }
  else if (selectedBuilding.value) {
    await loadRooms()
  }
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
      <scroll-view :scroll-top="communityScrollTop" scroll-y class="content-scroll" @scrolltolower="changeCommunityPage(communityPage + 1)">
        <view v-if="sourceContact.loading && !sourceContact.communities.length" class="empty-state">
          <wd-loading color="#126b4f" />
          <text>正在加载盘源</text>
        </view>
        <view v-else-if="!sourceContact.communities.length" class="empty-state">
          <wd-icon name="home" size="34px" color="#8fa098" />
          <text>暂未分配楼盘</text>
        </view>
        <view v-else class="community-list">
          <view v-for="item in visibleCommunities" :key="String(item.id)" class="community-row" @tap="openCommunity(item)">
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
              <view class="community-row__fees">
                <view class="community-row__fee">
                  <text>水费</text><text class="community-row__fee-value">{{ moneyText(item.waterFee, '元/吨') }}</text>
                </view>
                <view class="community-row__fee">
                  <text>电费</text><text class="community-row__fee-value">{{ moneyText(item.electricityFee, '元/度') }}</text>
                </view>
                <view class="community-row__fee">
                  <text>管理费</text><text class="community-row__fee-value">{{ moneyText(item.managementFee, '元/月') }}</text>
                </view>
                <view class="community-row__fee">
                  <text>网络费</text><text class="community-row__fee-value">{{ networkFeeText(item) }}</text>
                </view>
                <view class="community-row__fee community-row__fee--wide">
                  <text>佣金条件</text>
                  <text class="community-row__fee-value community-row__fee-value--commission">
                    半年 {{ formatCommissionRange(item.lowestHalfYearCommissionPercent, item.highestHalfYearCommissionPercent) }} · 一年 {{ formatCommissionRange(item.lowestOneYearCommissionPercent, item.highestOneYearCommissionPercent) }}
                  </text>
                </view>
              </view>
              <view class="community-row__foot" @tap.stop>
                <view v-if="item.contactName || item.contactPhone" class="community-row__contact" @tap="callCommunityContact(item)">
                  <wd-icon name="call" size="15px" color="#126b4f" />
                  <text>{{ item.contactName || '联系人' }}</text>
                  <text v-if="item.contactPhone">{{ item.contactPhone }}</text>
                </view>
                <view class="community-row__nav" @tap="navigateToCommunity(item)">
                  <wd-icon name="location" size="16px" color="#126b4f" />
                  <text>导航</text>
                </view>
                <wd-button size="small" plain icon="setting" @click.stop="openCommunityConfig(item)">
                  设置费用
                </wd-button>
              </view>
            </view>
            <wd-icon name="arrow-right" size="19px" color="#8fa098" />
          </view>
          <view class="community-pager">
            <view class="community-pager__action" :class="{ 'community-pager__action--disabled': communityPage <= 1 }" @tap="changeCommunityPage(communityPage - 1)">
              上一页
            </view>
            <text>{{ communityPage }} / {{ communityPageCount }}</text>
            <view class="community-pager__action" :class="{ 'community-pager__action--disabled': communityPage >= communityPageCount }" @tap="changeCommunityPage(communityPage + 1)">
              下一页
            </view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view v-else-if="screen === 'buildings'" class="content-area">
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
          {{ selecting ? '取消选择' : '批量经营参数' }}
        </wd-button>
      </view>
      <scroll-view scroll-y class="content-scroll">
        <view v-if="loading" class="empty-state">
          <wd-loading color="#126b4f" />
          <text>正在加载楼盘信息</text>
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
          设置经营参数
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
        房源状态
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
        <view class="effective-item">
          <text class="effective-item__label">半年佣金</text><text class="effective-item__value">{{ percentText(activeRoom.operation?.effectiveHalfYearCommissionPercent ?? activeRoom.operation?.halfYearCommissionPercent) }}</text>
        </view>
        <view class="effective-item">
          <text class="effective-item__label">一年佣金</text><text class="effective-item__value">{{ percentText(activeRoom.operation?.effectiveOneYearCommissionPercent ?? activeRoom.operation?.oneYearCommissionPercent) }}</text>
        </view>
        <view class="effective-item">
          <text class="effective-item__label">管理情况</text><text class="effective-item__value">{{ managementPackageText(activeRoom.operation?.effectiveManagementPackageMode ?? activeRoom.operation?.managementPackageMode) }}</text>
        </view>
        <view class="effective-item">
          <text class="effective-item__label">网络情况</text><text class="effective-item__value">{{ networkPackageText(activeRoom.operation?.effectiveNetworkPackageMode ?? activeRoom.operation?.networkPackageMode) }}</text>
        </view>
      </view>

      <view class="action-list">
        <view class="action-row" @tap="openPropertyConfig">
          <wd-icon name="setting" size="20px" color="#126b4f" />
          <text>设置本套经营参数</text>
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
          <text class="form-section__hint">{{ screen === 'property-config' ? '费用留空时继承楼盘默认值' : '作为名下房源的默认经营费用' }}</text>
          <view class="field-grid">
            <label class="field"><text>管理费</text><view class="field__input"><input v-model="draft.managementFee" class="field__control" type="digit" placeholder="未设置"><text>元/月</text></view></label>
            <view v-if="screen === 'community-config'" class="field field--network">
              <text>网络费</text>
              <view class="mode-grid mode-grid--two field__modes">
                <view
                  class="mode-option"
                  :class="{ 'mode-option--active': draft.networkFeeMode === 1 }"
                  @tap="draft.networkFeeMode = draft.networkFeeMode === 1 ? null : 1"
                >
                  固定金额
                </view>
                <view
                  class="mode-option"
                  :class="{ 'mode-option--active': draft.networkFeeMode === 2 }"
                  @tap="draft.networkFeeMode = draft.networkFeeMode === 2 ? null : 2"
                >
                  自理
                </view>
              </view>
              <view v-if="draft.networkFeeMode !== 2" class="field__input">
                <input v-model="draft.networkFee" class="field__control" type="digit" placeholder="未设置">
                <text>元/月</text>
              </view>
              <view v-else class="field__readonly">
                租客自理
              </view>
            </view>
            <label v-else class="field"><text>网络费</text><view class="field__input"><input v-model="draft.networkFee" class="field__control" type="digit" placeholder="未设置"><text>元/月</text></view></label>
            <label class="field"><text>水费</text><view class="field__input"><input v-model="draft.waterFee" class="field__control" type="digit" placeholder="未设置"><text>元/吨</text></view></label>
            <label class="field"><text>电费</text><view class="field__input"><input v-model="draft.electricityFee" class="field__control" type="digit" placeholder="未设置"><text>元/度</text></view></label>
          </view>
        </view>

        <view class="form-section">
          <text class="form-section__title">佣金设置</text>
          <sl-commission-settings v-model="propertyCommissionRange" />
        </view>

        <view class="form-section">
          <view class="setting-group">
            <text class="form-section__title">管理情况</text>
            <view class="mode-grid">
              <view
                class="mode-option"
                :class="{ 'mode-option--active': draft.managementPackageMode === 1 }"
                @tap="draft.managementPackageMode = draft.managementPackageMode === 1 ? null : 1"
              >
                可包
              </view>
              <view
                class="mode-option"
                :class="{ 'mode-option--active': draft.managementPackageMode === 2 }"
                @tap="draft.managementPackageMode = draft.managementPackageMode === 2 ? null : 2"
              >
                不可包
              </view>
            </view>
          </view>
          <view class="setting-group">
            <text class="form-section__title">网络情况</text>
            <view class="mode-grid mode-grid--four">
              <view
                class="mode-option"
                :class="{ 'mode-option--active': draft.networkPackageMode === 1 }"
                @tap="draft.networkPackageMode = draft.networkPackageMode === 1 ? null : 1"
              >
                可包
              </view>
              <view
                class="mode-option"
                :class="{ 'mode-option--active': draft.networkPackageMode === 2 }"
                @tap="draft.networkPackageMode = draft.networkPackageMode === 2 ? null : 2"
              >
                不可包
              </view>
              <view
                class="mode-option"
                :class="{ 'mode-option--active': draft.networkPackageMode === 3 }"
                @tap="draft.networkPackageMode = draft.networkPackageMode === 3 ? null : 3"
              >
                自理
              </view>
              <view
                class="mode-option"
                :class="{ 'mode-option--active': draft.networkPackageMode === 4 }"
                @tap="draft.networkPackageMode = draft.networkPackageMode === 4 ? null : 4"
              >
                必开
              </view>
            </view>
          </view>
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
          本次将覆盖已选择 {{ selectedRoomIds.length }} 套房源中已启用的经营参数，不修改其他费用和房源资料。
        </view>
        <view class="form-section">
          <text class="form-section__title">佣金设置</text>
          <sl-commission-settings
            v-model="batchCommissionRange"
            v-model:half-year-enabled="batchHalfYearEnabled"
            v-model:one-year-enabled="batchOneYearEnabled"
            :show-switch="true"
          />
        </view>
        <view class="form-section">
          <view class="batch-field-head">
            <text class="form-section__title">管理情况</text>
            <wd-switch v-model="batchManagementEnabled" size="22px" />
          </view>
          <view v-if="batchManagementEnabled" class="mode-grid">
            <view
              class="mode-option"
              :class="{ 'mode-option--active': batchManagementMode === 1 }"
              @tap="batchManagementMode = 1"
            >
              可包
            </view>
            <view
              class="mode-option"
              :class="{ 'mode-option--active': batchManagementMode === 2 }"
              @tap="batchManagementMode = 2"
            >
              不可包
            </view>
          </view>
        </view>
        <view class="form-section">
          <view class="batch-field-head">
            <text class="form-section__title">网络情况</text>
            <wd-switch v-model="batchNetworkEnabled" size="22px" />
          </view>
          <view v-if="batchNetworkEnabled" class="mode-grid mode-grid--four">
            <view
              class="mode-option"
              :class="{ 'mode-option--active': batchNetworkMode === 1 }"
              @tap="batchNetworkMode = 1"
            >
              可包
            </view>
            <view
              class="mode-option"
              :class="{ 'mode-option--active': batchNetworkMode === 2 }"
              @tap="batchNetworkMode = 2"
            >
              不可包
            </view>
            <view
              class="mode-option"
              :class="{ 'mode-option--active': batchNetworkMode === 3 }"
              @tap="batchNetworkMode = 3"
            >
              自理
            </view>
            <view
              class="mode-option"
              :class="{ 'mode-option--active': batchNetworkMode === 4 }"
              @tap="batchNetworkMode = 4"
            >
              必开
            </view>
          </view>
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

.community-pager {
  display: flex;
  min-height: 82rpx;
  align-items: center;
  justify-content: center;
  color: #8a9791;
  font-size: 21rpx;
  gap: 22rpx;
}

.community-pager__action {
  display: flex;
  min-width: 112rpx;
  min-height: 52rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid #dce5df;
  border-radius: 7rpx;
  background: #fff;
  color: #126b4f;
  font-weight: 700;
}

.community-pager__action--disabled {
  color: #a9b2ad;
  background: #f4f6f4;
}

.community-row,
.building-row,
.action-row,
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
  flex-wrap: wrap;
  margin-top: 13rpx;
  gap: 10rpx;
}

.community-row__fees {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10rpx;
  margin-top: 16rpx;
}

.community-row__fee {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 8rpx;
  padding: 12rpx 14rpx;
  border-radius: 7rpx;
  background: #f3f7f1;
  color: #65736c;
  font-size: 21rpx;
}

.community-row__fee--wide {
  grid-column: 1 / -1;
}

.community-row__fee-value {
  min-width: 0;
  overflow: hidden;
  color: #26362f;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-row__fee-value--commission {
  flex: 1;
  line-height: 1.45;
  text-align: right;
  white-space: normal;
}

.community-row__foot {
  display: flex;
  flex-wrap: wrap;
  min-height: 56rpx;
  align-items: center;
  justify-content: space-between;
  gap: 14rpx;
  margin-top: 16rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #edf1ee;
}

.community-row__foot :deep(.wd-button) {
  min-width: 132rpx;
  margin: 0;
}

.community-row__contact,
.community-row__nav {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7rpx;
  color: #126b4f;
  font-size: 22rpx;
  font-weight: 760;
}

.community-row__contact {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.community-row__nav {
  min-width: 96rpx;
  min-height: 48rpx;
  flex: 0 0 auto;
  justify-content: center;
  border: 1rpx solid rgb(18 107 79 / 18%);
  border-radius: 7rpx;
  background: #f4f8f5;
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

.mode-grid--four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.mode-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field__modes {
  margin-top: 8rpx;
}

.field__readonly {
  display: flex;
  height: 72rpx;
  align-items: center;
  margin-top: 8rpx;
  padding: 0 14rpx;
  border: 1rpx solid #dce5df;
  border-radius: 7rpx;
  background: #f1f5f2;
  color: #66756e;
  box-sizing: border-box;
  font-size: 22rpx;
}

.setting-group {
  margin-top: 22rpx;
  padding-top: 18rpx;
  border-top: 1rpx solid #edf1ee;
}

.setting-group + .setting-group {
  margin-top: 26rpx;
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

.field--network {
  grid-column: 1 / -1;
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
