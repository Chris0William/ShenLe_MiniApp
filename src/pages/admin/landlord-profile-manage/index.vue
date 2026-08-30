<script setup lang="ts">
import type {
  ShenLeId,
  SlLandlordCandidateOutput,
  SlLandlordCommunityAssignmentOutput,
  SlLandlordProfileOutput,
} from '@/types/shenle'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, ref } from 'vue'
import {
  batchAssignLandlordCommunities,
  batchSetLandlordProfiles,
  getLandlordCandidatePage,
  getLandlordCommunityAssignmentPage,
  getLandlordProfilePage,
  setLandlordContactDisplay,
  setLandlordMaintainers,
  setLandlordProfile,
} from '@/api/landlord'
import { useShenleAuthStore } from '@/store/auth'
import { useSafeTopStyle } from '@/utils/safe-area'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '房东端管理',
    enablePullDownRefresh: true,
  },
})

type Panel = 'candidates' | 'maintainers' | 'communities' | null
const ASSIGNMENT_PAGE_SIZE = 20

const auth = useShenleAuthStore()
const safeTop = useSafeTopStyle()

function goBack() {
  uni.navigateBack()
}

const keyword = ref('')
const items = ref<SlLandlordProfileOutput[]>([])
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const panel = ref<Panel>(null)
const target = ref<SlLandlordProfileOutput | null>(null)
const candidates = ref<SlLandlordCandidateOutput[]>([])
const candidateKeyword = ref('')
const selectedCandidateIds = ref<ShenLeId[]>([])
const selectedMaintainerIds = ref<ShenLeId[]>([])
const primaryMaintainerId = ref<ShenLeId | null>(null)
const assignments = ref<SlLandlordCommunityAssignmentOutput[]>([])
const assignmentKeyword = ref('')
const assignmentStatus = ref<0 | 1 | 2>(0)
const assignmentPage = ref(1)
const assignmentTotal = ref(0)
const assignmentLoading = ref(false)
const assignmentScrollTop = ref(0)
const assignmentChanges = ref<Record<string, { id: ShenLeId, assigned: boolean }>>({})

const filteredCandidates = computed(() => {
  const text = candidateKeyword.value.trim().toLowerCase()
  if (!text)
    return candidates.value
  return candidates.value.filter(item => `${item.nickName || ''} ${item.phone || ''}`.toLowerCase().includes(text))
})

const assignmentPageCount = computed(() => Math.max(1, Math.ceil(assignmentTotal.value / ASSIGNMENT_PAGE_SIZE)))

const assignmentDelta = computed(() => {
  const changes = Object.values(assignmentChanges.value)
  return {
    assign: changes.filter(item => item.assigned).map(item => item.id),
    unassign: changes.filter(item => !item.assigned).map(item => item.id),
  }
})

function sameId(left?: ShenLeId | null, right?: ShenLeId | null) {
  return String(left ?? '') === String(right ?? '')
}

function isSelected(list: ShenLeId[], id: ShenLeId) {
  return list.some(item => sameId(item, id))
}

function toggleId(list: typeof selectedCandidateIds, id: ShenLeId) {
  list.value = isSelected(list.value, id)
    ? list.value.filter(item => !sameId(item, id))
    : [...list.value, id]
}

function toggleCandidate(id: ShenLeId) {
  toggleId(selectedCandidateIds, id)
}

function isCommunitySelected(item: SlLandlordCommunityAssignmentOutput) {
  return assignmentChanges.value[String(item.id)]?.assigned ?? item.isAssigned
}

function toggleCommunity(item: SlLandlordCommunityAssignmentOutput) {
  const key = String(item.id)
  const assigned = !isCommunitySelected(item)
  const changes = { ...assignmentChanges.value }
  if (assigned === item.isAssigned)
    delete changes[key]
  else
    changes[key] = { id: item.id, assigned }
  assignmentChanges.value = changes
}

function assignmentStateText(item: SlLandlordCommunityAssignmentOutput) {
  const assigned = isCommunitySelected(item)
  if (item.isAssigned)
    return assigned ? '已分配' : '待移除'
  return assigned ? '待分配' : ''
}

function setAssignmentStatus(value: number) {
  assignmentStatus.value = value === 1 || value === 2 ? value : 0
  void loadAssignments(1)
}

function changeAssignmentPage(page: number) {
  if (page < 1 || page > assignmentPageCount.value || page === assignmentPage.value || assignmentLoading.value)
    return
  void loadAssignments(page)
}

async function load() {
  if (!auth.canManageLandlords) {
    uni.showToast({ title: '仅超级管理员可管理房东端', icon: 'none' })
    return
  }
  loading.value = true
  try {
    const result = await getLandlordProfilePage({ page: 1, pageSize: 200, keyword: keyword.value.trim() || undefined })
    items.value = result.items || []
    total.value = result.total || 0
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

async function loadCandidates() {
  const result = await getLandlordCandidatePage({ page: 1, pageSize: 500 })
  candidates.value = result.items || []
}

async function openCandidates() {
  target.value = null
  candidateKeyword.value = ''
  selectedCandidateIds.value = []
  panel.value = 'candidates'
  await loadCandidates()
}

async function openMaintainers(item: SlLandlordProfileOutput) {
  target.value = item
  candidateKeyword.value = ''
  selectedMaintainerIds.value = item.maintainers.map(row => row.userId)
  primaryMaintainerId.value = item.primaryMaintainerUserId || null
  panel.value = 'maintainers'
  await loadCandidates()
}

async function openAssignments(item: SlLandlordProfileOutput) {
  target.value = item
  assignmentKeyword.value = ''
  assignmentStatus.value = 0
  assignmentChanges.value = {}
  assignments.value = []
  assignmentPage.value = 1
  assignmentTotal.value = 0
  panel.value = 'communities'
  await loadAssignments(1)
}

async function loadAssignments(page = 1) {
  if (!target.value || assignmentLoading.value)
    return
  assignmentLoading.value = true
  try {
    const result = await getLandlordCommunityAssignmentPage({
      page,
      pageSize: ASSIGNMENT_PAGE_SIZE,
      landlordUserId: target.value.userId,
      keyword: assignmentKeyword.value.trim() || undefined,
      assignmentStatus: assignmentStatus.value,
    })
    assignments.value = result.items || []
    assignmentPage.value = result.page || page
    assignmentTotal.value = result.total || 0
    assignmentScrollTop.value = 1
    await nextTick()
    assignmentScrollTop.value = 0
  }
  finally {
    assignmentLoading.value = false
  }
}

function closePanel() {
  if (saving.value)
    return
  panel.value = null
  target.value = null
}

async function saveCandidates() {
  if (!selectedCandidateIds.value.length) {
    uni.showToast({ title: '请先选择用户', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await batchSetLandlordProfiles(selectedCandidateIds.value)
    panel.value = null
    target.value = null
    await load()
    uni.showToast({ title: '房东身份已设置', icon: 'success' })
  }
  finally {
    saving.value = false
  }
}

function toggleMaintainer(item: SlLandlordCandidateOutput) {
  if (target.value && sameId(item.userId, target.value.userId)) {
    uni.showToast({ title: '房东本人无需设为维护人', icon: 'none' })
    return
  }
  toggleId(selectedMaintainerIds, item.userId)
  if (!isSelected(selectedMaintainerIds.value, primaryMaintainerId.value || ''))
    primaryMaintainerId.value = selectedMaintainerIds.value[0] || null
}

function choosePrimary(id: ShenLeId) {
  if (!isSelected(selectedMaintainerIds.value, id))
    toggleId(selectedMaintainerIds, id)
  primaryMaintainerId.value = id
}

async function saveMaintainers() {
  if (!target.value)
    return
  if (selectedMaintainerIds.value.length && !primaryMaintainerId.value) {
    uni.showToast({ title: '请选择主维护人', icon: 'none' })
    return
  }
  saving.value = true
  try {
    await setLandlordMaintainers({
      landlordUserId: target.value.userId,
      maintainerUserIds: selectedMaintainerIds.value,
      primaryMaintainerUserId: primaryMaintainerId.value,
    })
    panel.value = null
    target.value = null
    await load()
    uni.showToast({ title: '维护人已更新', icon: 'success' })
  }
  finally {
    saving.value = false
  }
}

async function saveAssignments() {
  if (!target.value)
    return
  saving.value = true
  try {
    await batchAssignLandlordCommunities({
      landlordUserId: target.value.userId,
      assignCommunityIds: assignmentDelta.value.assign,
      unassignCommunityIds: assignmentDelta.value.unassign,
    })
    panel.value = null
    target.value = null
    await load()
    uni.showToast({ title: '楼盘归属已更新', icon: 'success' })
  }
  finally {
    saving.value = false
  }
}

async function changeContactMode(item: SlLandlordProfileOutput, mode: 1 | 2) {
  if (item.contactDisplayMode === mode)
    return
  if (mode === 2 && !item.primaryMaintainerUserId) {
    uni.showToast({ title: '请先设置主维护人', icon: 'none' })
    return
  }
  await setLandlordContactDisplay(item.userId, mode)
  item.contactDisplayMode = mode
  uni.showToast({ title: '联系电话显示已更新', icon: 'success' })
}

function removeLandlord(item: SlLandlordProfileOutput) {
  uni.showModal({
    title: '取消房东身份',
    content: `确定取消「${item.nickName || '该用户'}」的房东身份？名下楼盘归属和维护人关系会同步解除。`,
    confirmColor: '#c94832',
    success: async (result) => {
      if (!result.confirm)
        return
      await setLandlordProfile(item.userId, false)
      await load()
      uni.showToast({ title: '已取消房东身份', icon: 'success' })
    },
  })
}

onShow(() => void load())
onPullDownRefresh(() => void load())
</script>

<template>
  <view class="page" :style="safeTop">
    <view class="head">
      <view class="head__back" role="button" aria-label="返回" @tap="goBack">
        <wd-icon name="arrow-left" size="20px" color="#126b4f" />
      </view>
      <view class="head__main">
        <text class="head__title">房东端管理</text>
        <text class="head__meta">{{ total }} 位房东</text>
      </view>
      <wd-button type="primary" size="small" icon="add" @click="openCandidates">
        设置房东
      </wd-button>
    </view>

    <view class="search sl-card">
      <wd-icon name="search" size="18px" color="#839088" />
      <input v-model="keyword" class="search__input" placeholder="搜索昵称或手机号" confirm-type="search" @confirm="load">
      <wd-button size="small" type="primary" @click="load">
        查询
      </wd-button>
    </view>

    <view v-if="loading && !items.length" class="empty sl-card">
      <wd-loading color="#126b4f" />
      <text>正在加载房东</text>
    </view>
    <view v-else-if="!items.length" class="empty sl-card">
      <wd-icon name="usergroup" size="34px" color="#8fa098" />
      <text>暂无房东</text>
    </view>
    <view v-else class="list">
      <view v-for="item in items" :key="String(item.userId)" class="landlord sl-card">
        <view class="landlord__head">
          <view class="avatar">
            {{ (item.nickName || '房').slice(0, 1) }}
          </view>
          <view class="landlord__identity">
            <text class="landlord__name">{{ item.nickName || '未设置昵称' }}</text>
            <text class="landlord__phone">{{ item.phone || '未绑定手机号' }}</text>
          </view>
          <view class="count-badge">
            {{ item.communityCount }} 个楼盘
          </view>
        </view>

        <view class="maintainer-line">
          <text class="maintainer-line__label">维护人</text>
          <text class="maintainer-line__value">
            {{ item.maintainers.length ? item.maintainers.map(row => row.isPrimary ? `${row.nickName || '未命名'}（主）` : row.nickName || '未命名').join('、') : '未设置' }}
          </text>
        </view>

        <view class="contact-mode">
          <text class="contact-mode__label">联系电话显示</text>
          <view class="segmented">
            <view class="segmented__item" :class="{ active: item.contactDisplayMode === 1 }" @tap="changeContactMode(item, 1)">
              房东
            </view>
            <view class="segmented__item" :class="{ active: item.contactDisplayMode === 2 }" @tap="changeContactMode(item, 2)">
              主维护人
            </view>
          </view>
        </view>

        <view class="actions">
          <wd-button size="small" plain @click="openMaintainers(item)">
            维护人
          </wd-button>
          <wd-button size="small" plain @click="openAssignments(item)">
            分配楼盘
          </wd-button>
          <wd-button size="small" type="danger" plain @click="removeLandlord(item)">
            取消房东
          </wd-button>
        </view>
      </view>
    </view>

    <view v-if="panel" class="panel-mask" @tap="closePanel" @touchmove.stop.prevent />
    <view v-if="panel" class="panel" @touchmove.stop.prevent>
      <view class="panel__head">
        <view>
          <text class="panel__title">
            {{ panel === 'candidates' ? '设置房东' : panel === 'maintainers' ? `维护人 · ${target?.nickName || ''}` : `分配楼盘 · ${target?.nickName || ''}` }}
          </text>
          <text v-if="panel === 'communities'" class="panel__summary">新增 {{ assignmentDelta.assign.length }} 个 · 移除 {{ assignmentDelta.unassign.length }} 个</text>
        </view>
        <view class="panel__close" @tap="closePanel">
          <wd-icon name="close" size="19px" color="#66736c" />
        </view>
      </view>

      <view v-if="panel !== 'communities'" class="panel-search">
        <wd-icon name="search" size="17px" color="#8a9690" />
        <input v-model="candidateKeyword" placeholder="搜索昵称或手机号">
      </view>
      <template v-else>
        <view class="panel-search">
          <wd-icon name="search" size="17px" color="#8a9690" />
          <input v-model="assignmentKeyword" confirm-type="search" placeholder="搜索楼盘或区域" @confirm="loadAssignments(1)">
        </view>
        <view class="assignment-tabs">
          <view v-for="tab in [{ value: 0, label: '全部' }, { value: 1, label: '未分配' }, { value: 2, label: '已分配' }]" :key="tab.value" class="assignment-tab" :class="{ active: assignmentStatus === tab.value }" @tap="setAssignmentStatus(tab.value)">
            {{ tab.label }}
          </view>
        </view>
      </template>

      <scroll-view scroll-y class="panel__body" :scroll-top="panel === 'communities' ? assignmentScrollTop : undefined">
        <view v-if="panel === 'candidates'">
          <view v-for="item in filteredCandidates.filter(row => !row.isLandlord)" :key="String(item.userId)" class="choice" @tap="toggleCandidate(item.userId)">
            <view class="checkbox" :class="{ checked: isSelected(selectedCandidateIds, item.userId) }">
              <wd-icon v-if="isSelected(selectedCandidateIds, item.userId)" name="check" size="14px" color="#fff" />
            </view>
            <view class="choice__main">
              <text>{{ item.nickName || '未设置昵称' }}</text><text>{{ item.phone || '未绑定手机号' }}</text>
            </view>
          </view>
        </view>

        <view v-else-if="panel === 'maintainers'">
          <view v-for="item in filteredCandidates" :key="String(item.userId)" class="choice" :class="{ disabled: sameId(item.userId, target?.userId) }">
            <view class="checkbox" :class="{ checked: isSelected(selectedMaintainerIds, item.userId) }" @tap="toggleMaintainer(item)">
              <wd-icon v-if="isSelected(selectedMaintainerIds, item.userId)" name="check" size="14px" color="#fff" />
            </view>
            <view class="choice__main" @tap="toggleMaintainer(item)">
              <text>{{ item.nickName || '未设置昵称' }}</text><text>{{ item.phone || '未绑定手机号' }}</text>
            </view>
            <view v-if="!sameId(item.userId, target?.userId) && isSelected(selectedMaintainerIds, item.userId)" class="primary" :class="{ active: sameId(primaryMaintainerId, item.userId) }" @tap="choosePrimary(item.userId)">
              {{ sameId(primaryMaintainerId, item.userId) ? '主维护人' : '设为主维护人' }}
            </view>
          </view>
        </view>

        <view v-else-if="assignmentLoading" class="panel-empty">
          <wd-loading color="#126b4f" /><text>正在加载楼盘</text>
        </view>
        <view v-else-if="!assignments.length" class="panel-empty">
          <text>暂无符合条件的楼盘</text>
        </view>
        <view v-else>
          <view v-for="item in assignments" :key="String(item.id)" class="choice" @tap="toggleCommunity(item)">
            <view class="checkbox" :class="{ checked: isCommunitySelected(item) }">
              <wd-icon v-if="isCommunitySelected(item)" name="check" size="14px" color="#fff" />
            </view>
            <view class="choice__main">
              <text>{{ item.name }}</text><text>{{ item.regionName || '未设置区域' }} · {{ item.buildingCount }} 栋 · {{ item.propertyCount }} 套</text>
            </view>
            <text v-if="assignmentStateText(item)" class="assigned" :class="{ 'assigned--remove': item.isAssigned && !isCommunitySelected(item) }">{{ assignmentStateText(item) }}</text>
          </view>
        </view>
      </scroll-view>

      <view v-if="panel === 'communities' && assignmentPageCount > 1" class="assignment-pager">
        <view class="assignment-pager__action" :class="{ disabled: assignmentPage <= 1 || assignmentLoading }" @tap="changeAssignmentPage(assignmentPage - 1)">
          上一页
        </view>
        <text>{{ assignmentPage }} / {{ assignmentPageCount }}</text>
        <view class="assignment-pager__action" :class="{ disabled: assignmentPage >= assignmentPageCount || assignmentLoading }" @tap="changeAssignmentPage(assignmentPage + 1)">
          下一页
        </view>
      </view>

      <view class="panel__footer">
        <wd-button plain block @click="closePanel">
          取消
        </wd-button>
        <wd-button v-if="panel === 'candidates'" block type="primary" :loading="saving" @click="saveCandidates">
          确认设置 {{ selectedCandidateIds.length }} 人
        </wd-button>
        <wd-button v-else-if="panel === 'maintainers'" block type="primary" :loading="saving" @click="saveMaintainers">
          保存维护人
        </wd-button>
        <wd-button v-else block type="primary" :loading="saving" @click="saveAssignments">
          保存楼盘归属
        </wd-button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20rpx 24rpx 140rpx;
  background: #f4f7f2;
}
.head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 2rpx 20rpx;
}
.head__back {
  display: flex;
  width: 56rpx;
  height: 56rpx;
  flex: 0 0 56rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: rgb(18 107 79 / 8%);
}
.head__main {
  min-width: 0;
  flex: 1;
}
.head__title,
.head__meta,
.landlord__name,
.landlord__phone,
.maintainer-line__label,
.maintainer-line__value,
.panel__title,
.panel__summary,
.choice__main text {
  display: block;
}
.head__title {
  color: #1d2d25;
  font-size: 38rpx;
  font-weight: 900;
}
.head__meta {
  margin-top: 6rpx;
  color: #7c8982;
  font-size: 23rpx;
}
.search,
.panel-search {
  display: flex;
  align-items: center;
  gap: 14rpx;
}
.search {
  padding: 16rpx 18rpx;
}
.search__input,
.panel-search input {
  min-width: 0;
  flex: 1;
  font-size: 26rpx;
}
.list {
  display: flex;
  margin-top: 18rpx;
  flex-direction: column;
  gap: 16rpx;
}
.landlord {
  padding: 22rpx;
}
.landlord__head {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.avatar {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #e5f1ea;
  color: #126b4f;
  font-size: 28rpx;
  font-weight: 900;
}
.landlord__identity {
  min-width: 0;
  flex: 1;
}
.landlord__name {
  overflow: hidden;
  color: #1e3027;
  font-size: 28rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.landlord__phone {
  margin-top: 6rpx;
  color: #7c8982;
  font-size: 22rpx;
}
.count-badge,
.assigned {
  flex: none;
  padding: 7rpx 11rpx;
  border-radius: 6rpx;
  background: #eaf4ee;
  color: #126b4f;
  font-size: 20rpx;
  font-weight: 800;
}
.assigned--remove {
  background: #fff0ed;
  color: #ba4335;
}
.maintainer-line,
.contact-mode {
  display: flex;
  align-items: center;
  margin-top: 18rpx;
  gap: 14rpx;
}
.maintainer-line__label,
.contact-mode__label {
  flex: none;
  color: #7a8780;
  font-size: 22rpx;
}
.maintainer-line__value {
  min-width: 0;
  flex: 1;
  color: #34473e;
  font-size: 23rpx;
  line-height: 1.5;
}
.segmented {
  display: flex;
  overflow: hidden;
  flex: 1;
  border: 1rpx solid #dbe4de;
  border-radius: 7rpx;
}
.segmented__item {
  min-width: 0;
  flex: 1;
  padding: 13rpx 8rpx;
  color: #65736c;
  font-size: 21rpx;
  text-align: center;
}
.segmented__item.active {
  background: #126b4f;
  color: #fff;
  font-weight: 800;
}
.actions {
  display: flex;
  margin-top: 20rpx;
  justify-content: flex-end;
  gap: 10rpx;
}
.empty {
  display: flex;
  min-height: 320rpx;
  align-items: center;
  justify-content: center;
  margin-top: 18rpx;
  color: #7b8881;
  flex-direction: column;
  font-size: 24rpx;
  gap: 14rpx;
}
.panel-mask {
  position: fixed;
  z-index: 2000;
  inset: 0;
  background: rgb(17 29 23 / 48%);
}
.panel {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 2001;
  display: flex;
  overflow: hidden;
  height: 82vh;
  padding-bottom: env(safe-area-inset-bottom);
  border-radius: 18rpx 18rpx 0 0;
  background: #fff;
  flex-direction: column;
}
.panel__head {
  display: flex;
  min-height: 92rpx;
  box-sizing: border-box;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 26rpx;
  border-bottom: 1rpx solid #edf1ee;
}
.panel__title {
  color: #1c2d24;
  font-size: 30rpx;
  font-weight: 900;
}
.panel__summary {
  margin-top: 5rpx;
  color: #126b4f;
  font-size: 20rpx;
}
.panel__close {
  display: flex;
  width: 58rpx;
  height: 58rpx;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #f1f4f2;
}
.panel-search {
  min-height: 72rpx;
  margin: 16rpx 24rpx 8rpx;
  padding: 0 18rpx;
  border-radius: 8rpx;
  background: #f3f6f4;
}
.assignment-tabs {
  display: flex;
  margin: 6rpx 24rpx 10rpx;
  gap: 10rpx;
}
.assignment-tab {
  padding: 11rpx 18rpx;
  border-radius: 6rpx;
  background: #f1f4f2;
  color: #67756e;
  font-size: 21rpx;
}
.assignment-tab.active {
  background: #126b4f;
  color: #fff;
  font-weight: 800;
}
.panel__body {
  min-height: 0;
  flex: 1;
  box-sizing: border-box;
  padding: 0 24rpx 20rpx;
}
.panel-empty {
  display: flex;
  min-height: 260rpx;
  align-items: center;
  justify-content: center;
  color: #7b8881;
  flex-direction: column;
  font-size: 23rpx;
  gap: 14rpx;
}
.choice {
  display: flex;
  min-height: 98rpx;
  box-sizing: border-box;
  align-items: center;
  padding: 16rpx 6rpx;
  border-bottom: 1rpx solid #edf1ee;
  gap: 14rpx;
}
.choice.disabled {
  opacity: 0.45;
}
.checkbox {
  display: flex;
  width: 34rpx;
  height: 34rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #b8c3bd;
  border-radius: 5rpx;
}
.checkbox.checked {
  border-color: #126b4f;
  background: #126b4f;
}
.choice__main {
  min-width: 0;
  flex: 1;
}
.choice__main text:first-child {
  overflow: hidden;
  color: #26382f;
  font-size: 25rpx;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.choice__main text:last-child {
  margin-top: 6rpx;
  color: #7b8881;
  font-size: 21rpx;
}
.primary {
  flex: none;
  padding: 8rpx 10rpx;
  border-radius: 6rpx;
  background: #f1f4f2;
  color: #68766f;
  font-size: 19rpx;
}
.primary.active {
  background: #fff0d8;
  color: #9c620c;
  font-weight: 800;
}
.assignment-pager {
  display: grid;
  min-height: 72rpx;
  flex: none;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 24rpx;
  border-top: 1rpx solid #edf1ee;
  color: #65736c;
  font-size: 22rpx;
  text-align: center;
}
.assignment-pager__action {
  min-height: 64rpx;
  display: flex;
  align-items: center;
  color: #126b4f;
  font-weight: 800;
}
.assignment-pager__action:last-child {
  justify-content: flex-end;
}
.assignment-pager__action.disabled {
  color: #b5beb9;
}
.panel__footer {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 16rpx;
  padding: 16rpx 24rpx 20rpx;
  border-top: 1rpx solid #edf1ee;
  background: #fff;
}
</style>
