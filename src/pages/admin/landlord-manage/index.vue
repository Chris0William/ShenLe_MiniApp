<script setup lang="ts">
import type { CommunityAssignmentOutput, ShenLeId, SlLandlordApplyOutput, SlLandlordOutput, SlUserOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom, onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { approveLandlord, batchAssignOwner, batchSetLandlords, getCommunityAssignmentPage, getLandlordPage, getLandlordPending, rejectLandlord, setLandlord } from '@/api/landlord'
import { getUserPage } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { assignmentState, buildAssignmentDelta, toggleCommunityAssignment, toggleUserSelection } from '@/utils/landlord-batch'
import { useSafeTopStyle } from '@/utils/safe-area'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '盘源对接人管理',
    enablePullDownRefresh: true,
  },
})

const safeTop = useSafeTopStyle()

function goBack() {
  uni.navigateBack()
}
const auth = useShenleAuthStore()

// ── 待审申请 ─────────────────────────────────────────────────────────────────
const pending = ref<SlLandlordApplyOutput[]>([])

async function loadPending() {
  pending.value = await getLandlordPending().catch(() => [])
}

async function approvePending(item: SlLandlordApplyOutput) {
  uni.showModal({
    title: '通过申请',
    content: `通过「${item.nickName || '该用户'}」的盘源对接人申请？`,
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await approveLandlord(item.userId)
        pending.value = pending.value.filter(p => String(p.userId) !== String(item.userId))
        uni.showToast({ title: '已通过', icon: 'success' })
        load(true)
      }
      catch {}
    },
  })
}

async function rejectPending(item: SlLandlordApplyOutput) {
  uni.showModal({
    title: '拒绝申请',
    content: `拒绝「${item.nickName || '该用户'}」的盘源对接人申请？对方可重新申请。`,
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await rejectLandlord(item.userId)
        pending.value = pending.value.filter(p => String(p.userId) !== String(item.userId))
        uni.showToast({ title: '已拒绝', icon: 'none' })
      }
      catch {}
    },
  })
}

// ── 盘源对接人列表 ────────────────────────────────────────────────────────────────
const keyword = ref('')
const page = ref(0)
const pageSize = 20
const total = ref(0)
const items = ref<SlLandlordOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const finished = computed(() => total.value > 0 && items.value.length >= total.value)
let landlordRequestId = 0

async function load(reset = false) {
  if (!reset && loading.value)
    return
  const requestId = ++landlordRequestId
  const requestPage = reset ? 1 : page.value + 1
  const requestKeyword = keyword.value.trim() || undefined
  if (reset) {
    page.value = 0
    items.value = []
    total.value = 0
  }
  loading.value = true
  try {
    const result = await getLandlordPage({ page: requestPage, pageSize, keyword: requestKeyword })
    if (requestId !== landlordRequestId)
      return
    page.value = requestPage
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
    hasLoaded.value = true
  }
  finally {
    if (requestId === landlordRequestId) {
      loading.value = false
      uni.stopPullDownRefresh()
    }
  }
}

function cancelLandlord(item: SlLandlordOutput) {
  uni.showModal({
    title: '取消盘源对接人',
    content: `确定取消「${item.nickName || '该用户'}」的盘源对接人资格？`,
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await setLandlord(item.userId, false)
        uni.showToast({ title: '已取消盘源对接人', icon: 'success' })
        load(true)
      }
      catch {}
    },
  })
}

// ── 设为盘源对接人弹窗（用户选择）────────────────────────────────────────────────
const setLandlordVisible = ref(false)
const userKeyword = ref('')
const userPage = ref(0)
const userPageSize = 20
const userTotal = ref(0)
const userItems = ref<SlUserOutput[]>([])
const userLoading = ref(false)
const userSubmitting = ref(false)
const selectedUserIds = ref<ShenLeId[]>([])
const userFinished = computed(() => userTotal.value > 0 && userItems.value.length >= userTotal.value)
let userRequestId = 0

function openSetLandlord() {
  if (userSubmitting.value)
    return
  userKeyword.value = ''
  userPage.value = 0
  userTotal.value = 0
  userItems.value = []
  selectedUserIds.value = []
  setLandlordVisible.value = true
  loadUsers(true)
}

async function loadUsers(reset = false) {
  if (!reset && userLoading.value)
    return
  const requestId = ++userRequestId
  const requestPage = reset ? 1 : userPage.value + 1
  const requestKeyword = userKeyword.value.trim() || undefined
  if (reset) {
    userPage.value = 0
    userItems.value = []
    userTotal.value = 0
  }
  userLoading.value = true
  try {
    const result = await getUserPage({ page: requestPage, pageSize: userPageSize, keyword: requestKeyword })
    if (requestId !== userRequestId)
      return
    userPage.value = requestPage
    userTotal.value = result.total
    userItems.value = reset ? result.items : [...userItems.value, ...result.items]
  }
  finally {
    if (requestId === userRequestId)
      userLoading.value = false
  }
}

function onUserSearch() {
  loadUsers(true)
}

function isUserSelected(userId: ShenLeId) {
  return selectedUserIds.value.some(id => String(id) === String(userId))
}

function toggleUser(user: SlUserOutput) {
  if (userSubmitting.value)
    return
  selectedUserIds.value = toggleUserSelection(selectedUserIds.value, user.userId, Boolean(user.isLandlord))
}

function closeSetLandlord() {
  if (!userSubmitting.value)
    setLandlordVisible.value = false
}

function confirmBatchSetLandlords() {
  if (!selectedUserIds.value.length || userSubmitting.value)
    return
  const submittedUserIds = [...selectedUserIds.value]
  const submittedSelection = selectedUserIds.value
  uni.showModal({
    title: '批量设置盘源对接人',
    content: `确定将已选择的 ${submittedUserIds.length} 位用户设为盘源对接人？`,
    success: async (res) => {
      if (!res.confirm)
        return
      userSubmitting.value = true
      try {
        const count = await batchSetLandlords(submittedUserIds)
        uni.showToast({ title: `已设置 ${count} 人`, icon: 'success' })
        if (selectedUserIds.value === submittedSelection)
          setLandlordVisible.value = false
        await load(true)
      }
      finally {
        userSubmitting.value = false
      }
    },
  })
}

function onUserListReachBottom() {
  if (!userFinished.value)
    loadUsers()
}

// ── 分配楼盘弹窗（楼盘选择）────────────────────────────────────────────────
const assignVisible = ref(false)
const assignTarget = ref<SlLandlordOutput | null>(null)
const communityKeyword = ref('')
const communityPage = ref(0)
const communityPageSize = 20
const communityTotal = ref(0)
const communityItems = ref<CommunityAssignmentOutput[]>([])
const communityLoading = ref(false)
const communitySubmitting = ref(false)
const assignmentStatus = ref(0)
const assignmentChanges = ref<Record<string, { id: ShenLeId, initial: boolean, desired: boolean }>>({})
const communityFinished = computed(() => communityTotal.value > 0 && communityItems.value.length >= communityTotal.value)
const assignmentDelta = computed(() => buildAssignmentDelta(assignmentChanges.value))
const assignmentChangeCount = computed(() => assignmentDelta.value.assignCommunityIds.length + assignmentDelta.value.unassignCommunityIds.length)
let communityRequestId = 0

function openAssign(item: SlLandlordOutput) {
  assignTarget.value = item
  communityKeyword.value = ''
  communityPage.value = 0
  communityTotal.value = 0
  communityItems.value = []
  assignmentStatus.value = 0
  assignmentChanges.value = {}
  assignVisible.value = true
  loadCommunities(true)
}

async function loadCommunities(reset = false) {
  const targetUserId = assignTarget.value?.userId
  if (!targetUserId || (!reset && communityLoading.value))
    return
  const requestId = ++communityRequestId
  const requestPage = reset ? 1 : communityPage.value + 1
  const requestKeyword = communityKeyword.value.trim() || undefined
  const requestStatus = assignmentStatus.value
  if (reset) {
    communityPage.value = 0
    communityItems.value = []
    communityTotal.value = 0
  }
  communityLoading.value = true
  try {
    const result = await getCommunityAssignmentPage({
      ownerUserId: targetUserId,
      page: requestPage,
      pageSize: communityPageSize,
      keyword: requestKeyword,
      assignmentStatus: requestStatus,
    })
    if (requestId !== communityRequestId || String(assignTarget.value?.userId) !== String(targetUserId))
      return
    communityPage.value = requestPage
    communityTotal.value = result.total
    communityItems.value = reset ? result.items : [...communityItems.value, ...result.items]
  }
  finally {
    if (requestId === communityRequestId)
      communityLoading.value = false
  }
}

function onCommunitySearch() {
  loadCommunities(true)
}

function changeAssignmentStatus(status: number) {
  if (assignmentStatus.value === status)
    return
  assignmentStatus.value = status
  loadCommunities(true)
}

function isCommunityAssigned(community: CommunityAssignmentOutput) {
  return assignmentState(assignmentChanges.value, community.id, community.isAssigned)
}

function toggleCommunity(community: CommunityAssignmentOutput) {
  if (communitySubmitting.value)
    return
  assignmentChanges.value = toggleCommunityAssignment(assignmentChanges.value, community.id, community.isAssigned)
}

function closeAssign() {
  if (!communitySubmitting.value)
    assignVisible.value = false
}

function saveCommunityAssignments() {
  if (!assignTarget.value || !assignmentChangeCount.value || communitySubmitting.value)
    return
  const submittedTargetUserId = assignTarget.value.userId
  const submittedChanges = assignmentChanges.value
  const delta = buildAssignmentDelta(submittedChanges)
  uni.showModal({
    title: '保存楼盘分配',
    content: `新增分配 ${delta.assignCommunityIds.length} 个，移除 ${delta.unassignCommunityIds.length} 个，确认保存？`,
    success: async (res) => {
      if (!res.confirm)
        return
      communitySubmitting.value = true
      try {
        await batchAssignOwner({
          ownerUserId: submittedTargetUserId,
          assignCommunityIds: delta.assignCommunityIds,
          unassignCommunityIds: delta.unassignCommunityIds,
        })
        uni.showToast({ title: '楼盘分配已更新', icon: 'success' })
        if (String(assignTarget.value?.userId) === String(submittedTargetUserId) && assignmentChanges.value === submittedChanges) {
          assignmentChanges.value = {}
          await loadCommunities(true)
        }
        await load(true)
      }
      finally {
        communitySubmitting.value = false
      }
    },
  })
}

function onCommunityListReachBottom() {
  if (!communityFinished.value)
    loadCommunities()
}

// ── 角色标签颜色 ─────────────────────────────────────────────────────────────
function roleTone(accountType: number) {
  if (accountType >= 999)
    return 'gold'
  if (accountType >= 888)
    return 'green'
  if (accountType >= 777)
    return 'blue'
  return 'gray'
}

function roleLabel(accountType: number) {
  if (accountType >= 999)
    return '超管'
  if (accountType >= 888)
    return '管理员'
  if (accountType >= 777)
    return '用户'
  return '游客'
}

// ── 生命周期 ─────────────────────────────────────────────────────────────────
let initialized = false

onLoad(() => {
  if (!auth.isSuperAdmin || modeStore.mode !== 'admin') {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  initialized = true
  load(true)
  loadPending()
})

onShow(() => {
  if (initialized) {
    loadPending()
  }
})

onPullDownRefresh(() => {
  load(true)
  loadPending()
})
onReachBottom(() => {
  if (!finished.value)
    load()
})
</script>

<template>
  <view class="sl-page landlord-page" :style="safeTop">
    <view class="head">
      <view class="head__back" @tap="goBack">
        <wd-icon name="arrow-left" size="20px" color="#126b4f" />
      </view>
      <view class="head__main">
        <text class="head__title">盘源对接人管理</text>
        <text class="head__desc">审批盘源对接人申请、分配楼盘</text>
      </view>
    </view>

    <!-- 待审申请 -->
    <view v-if="pending.length" class="pending-block sl-card">
      <view class="pending-head">
        <text class="pending-title">待审申请</text>
        <view class="pending-badge">
          {{ pending.length }}
        </view>
      </view>
      <view v-for="item in pending" :key="String(item.userId)" class="pending-row">
        <view class="pending-info">
          <text class="pending-name">{{ item.nickName || '微信用户' }}</text>
          <text v-if="item.applyTime" class="pending-time">{{ item.applyTime }}</text>
        </view>
        <view class="pending-actions">
          <view class="mini-btn mini-btn--reject" @tap="rejectPending(item)">
            拒绝
          </view>
          <view class="mini-btn mini-btn--approve" @tap="approvePending(item)">
            通过
          </view>
        </view>
      </view>
    </view>

    <!-- 搜索 + 批量设置盘源对接人 -->
    <view class="toolbar sl-card">
      <view class="toolbar__search">
        <wd-icon name="search" size="20px" color="#7a8780" />
        <input v-model="keyword" class="toolbar__input" placeholder="搜索昵称" confirm-type="search" @confirm="load(true)">
        <wd-button size="small" type="primary" @click="load(true)">
          搜索
        </wd-button>
      </view>
      <view class="toolbar__divider" />
      <view class="set-btn" @tap="openSetLandlord">
        <wd-icon name="add" size="20px" color="#126b4f" />
        <text>批量设置盘源对接人</text>
      </view>
    </view>

    <view class="result-head">
      <text>{{ total }} 位盘源对接人</text>
    </view>

    <!-- 盘源对接人列表 -->
    <view class="list">
      <view v-for="item in items" :key="String(item.userId)" class="landlord sl-card">
        <view class="landlord__body">
          <view class="landlord__top">
            <text class="landlord__name">{{ item.nickName || '未设置昵称' }}</text>
            <view class="role-tag" :class="`role-tag--${roleTone(item.accountType)}`">
              {{ roleLabel(item.accountType) }}
            </view>
          </view>
          <text class="landlord__count">名下 {{ item.communityCount }} 个楼盘</text>
        </view>
        <view class="landlord__actions">
          <view class="action-btn action-btn--assign" @tap="openAssign(item)">
            分配楼盘
          </view>
          <view class="action-btn action-btn--cancel" @tap="cancelLandlord(item)">
            取消盘源对接人
          </view>
        </view>
      </view>
    </view>

    <view v-if="loading && !items.length" class="tip">
      加载中...
    </view>
    <view v-else-if="hasLoaded && !items.length" class="tip">
      暂无盘源对接人
    </view>
    <view v-else-if="finished && items.length" class="tip">
      已经到底了
    </view>

    <!-- ── 批量设置盘源对接人 弹窗 ── -->
    <wd-popup v-model="setLandlordVisible" position="bottom" :z-index="2000" :close-on-click-modal="!userSubmitting" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden; max-height: 80vh;">
      <view class="picker-popup">
        <view class="picker-popup__head">
          <text class="picker-popup__title">批量设置盘源对接人</text>
          <view class="picker-popup__close" @tap="closeSetLandlord">
            <wd-icon name="close" size="22px" color="#6b7770" />
          </view>
        </view>
        <view class="picker-search">
          <wd-icon name="search" size="18px" color="#7a8780" />
          <input v-model="userKeyword" class="picker-search__input" placeholder="搜索用户昵称" confirm-type="search" @confirm="onUserSearch">
          <wd-button size="small" type="primary" @click="onUserSearch">
            搜索
          </wd-button>
        </view>
        <scroll-view class="picker-scroll" scroll-y @scrolltolower="onUserListReachBottom">
          <view
            v-for="user in userItems"
            :key="String(user.userId)"
            class="picker-row"
            :class="{ 'picker-row--disabled': user.isLandlord }"
            @tap="toggleUser(user)"
          >
            <view class="picker-row__info">
              <view class="picker-row__title-line">
                <text class="picker-row__name">{{ user.nickName || '未设置昵称' }}</text>
                <view v-if="user.isLandlord" class="assignment-tag assignment-tag--assigned">
                  已设置
                </view>
              </view>
              <text class="picker-row__sub">{{ user.accountTypeName }}</text>
            </view>
            <view class="selection-box" :class="{ 'selection-box--checked': user.isLandlord || isUserSelected(user.userId), 'selection-box--disabled': user.isLandlord }">
              <wd-icon v-if="user.isLandlord || isUserSelected(user.userId)" name="check" size="16px" color="#fff" />
            </view>
          </view>
          <view v-if="userLoading" class="picker-tip">
            加载中...
          </view>
          <view v-else-if="userItems.length === 0" class="picker-tip">
            暂无用户
          </view>
          <view v-else-if="userFinished" class="picker-tip">
            已经到底了
          </view>
        </scroll-view>
        <view class="picker-footer sl-safe-bottom">
          <text class="picker-footer__summary">已选择 {{ selectedUserIds.length }} 人</text>
          <wd-button
            type="primary"
            size="small"
            :disabled="selectedUserIds.length === 0"
            :loading="userSubmitting"
            @click="confirmBatchSetLandlords"
          >
            确认设置
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <!-- ── 分配楼盘 弹窗 ── -->
    <wd-popup v-model="assignVisible" position="bottom" :z-index="2000" :close-on-click-modal="!communitySubmitting" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden; max-height: 80vh;">
      <view class="picker-popup">
        <view class="picker-popup__head">
          <text class="picker-popup__title">分配楼盘给「{{ assignTarget?.nickName || '盘源对接人' }}」</text>
          <view class="picker-popup__close" @tap="closeAssign">
            <wd-icon name="close" size="22px" color="#6b7770" />
          </view>
        </view>
        <view class="picker-search">
          <wd-icon name="search" size="18px" color="#7a8780" />
          <input v-model="communityKeyword" class="picker-search__input" placeholder="搜索楼盘名称" confirm-type="search" @confirm="onCommunitySearch">
          <wd-button size="small" type="primary" @click="onCommunitySearch">
            搜索
          </wd-button>
        </view>
        <view class="assignment-tabs">
          <view :class="{ 'assignment-tab--active': assignmentStatus === 0 }" class="assignment-tab" @tap="changeAssignmentStatus(0)">
            全部
          </view>
          <view :class="{ 'assignment-tab--active': assignmentStatus === 1 }" class="assignment-tab" @tap="changeAssignmentStatus(1)">
            未分配
          </view>
          <view :class="{ 'assignment-tab--active': assignmentStatus === 2 }" class="assignment-tab" @tap="changeAssignmentStatus(2)">
            已分配给他
          </view>
        </view>
        <scroll-view class="picker-scroll" scroll-y @scrolltolower="onCommunityListReachBottom">
          <view v-for="community in communityItems" :key="String(community.id)" class="picker-row" @tap="toggleCommunity(community)">
            <view class="picker-row__info">
              <view class="picker-row__title-line">
                <text class="picker-row__name">{{ community.name }}</text>
                <view class="assignment-tag" :class="isCommunityAssigned(community) ? 'assignment-tag--assigned' : 'assignment-tag--free'">
                  {{ isCommunityAssigned(community) ? '已分配给此人' : '未分配' }}
                </view>
              </view>
              <text class="picker-row__sub">{{ community.buildingCount }} 栋 · {{ community.propertyCount }} 套</text>
            </view>
            <view class="selection-box" :class="{ 'selection-box--checked': isCommunityAssigned(community) }">
              <wd-icon v-if="isCommunityAssigned(community)" name="check" size="16px" color="#fff" />
            </view>
          </view>
          <view v-if="communityLoading" class="picker-tip">
            加载中...
          </view>
          <view v-else-if="communityItems.length === 0" class="picker-tip">
            暂无楼盘
          </view>
          <view v-else-if="communityFinished" class="picker-tip">
            已经到底了
          </view>
        </scroll-view>
        <view class="picker-footer sl-safe-bottom">
          <view class="picker-footer__summary picker-footer__summary--stacked">
            <text>新增分配 {{ assignmentDelta.assignCommunityIds.length }} 个</text>
            <text>移除 {{ assignmentDelta.unassignCommunityIds.length }} 个</text>
          </view>
          <wd-button
            type="primary"
            size="small"
            :disabled="assignmentChangeCount === 0"
            :loading="communitySubmitting"
            @click="saveCommunityAssignments"
          >
            保存
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.landlord-page {
  padding-bottom: calc(60rpx + env(safe-area-inset-bottom));
}

.head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 4rpx 2rpx 10rpx;
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
}

.head__title {
  display: block;
  font-size: 34rpx;
  font-weight: 850;
}

.head__desc {
  display: block;
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

/* ── 待审申请区块 ── */
.pending-block {
  margin-top: 14rpx;
  padding: 22rpx;
}

.pending-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.pending-title {
  font-size: 28rpx;
  font-weight: 850;
}

.pending-badge {
  display: flex;
  min-width: 34rpx;
  height: 34rpx;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
  border-radius: 999rpx;
  background: #f5594e;
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
}

.pending-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--sl-line);
}

.pending-row:last-child {
  border-bottom: 0;
}

.pending-info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
}

.pending-name {
  overflow: hidden;
  font-size: 27rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pending-time {
  color: var(--sl-muted);
  font-size: 21rpx;
}

.pending-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 12rpx;
}

.mini-btn {
  padding: 10rpx 24rpx;
  border-radius: 999rpx;
  font-size: 23rpx;
  font-weight: 800;
}

.mini-btn--approve {
  background: linear-gradient(135deg, var(--sl-brand, #126b4f), #24815f);
  color: #fff;
}

.mini-btn--reject {
  border: 1rpx solid rgb(201 72 50 / 40%);
  color: #c94832;
}

.toolbar {
  margin-top: 14rpx;
  padding: 18rpx;
}

.toolbar__search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
}

.toolbar__input {
  min-width: 0;
  font-size: 27rpx;
}

.toolbar__divider {
  margin: 16rpx 0;
  border-top: 1rpx solid var(--sl-line);
}

.set-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 16rpx 0;
  border-radius: 12rpx;
  background: #ecf5ee;
  color: #126b4f;
  font-size: 27rpx;
  font-weight: 800;
}

.result-head {
  margin: 26rpx 4rpx 14rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.landlord {
  padding: 22rpx;
}

.landlord__body {
  min-width: 0;
  flex: 1;
}

.landlord__top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.landlord__name {
  overflow: hidden;
  font-size: 29rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.landlord__count {
  display: block;
  margin-top: 10rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.landlord__actions {
  display: flex;
  gap: 14rpx;
  margin-top: 18rpx;
}

.role-tag {
  flex: 0 0 auto;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 700;
}

.role-tag--gold {
  background: #fff2d7;
  color: #b46d08;
}

.role-tag--green {
  background: #ecf5ee;
  color: #126b4f;
}

.role-tag--blue {
  background: #e7f0ff;
  color: #2f66ee;
}

.role-tag--gray {
  background: #f0f2f0;
  color: #6b7770;
}

.role-tag--sm {
  font-size: 19rpx;
  padding: 2rpx 10rpx;
}

.action-btn {
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  font-size: 23rpx;
  font-weight: 800;
}

.action-btn--assign {
  background: linear-gradient(135deg, var(--sl-brand, #126b4f), #24815f);
  color: #fff;
}

.action-btn--cancel {
  border: 1rpx solid rgb(201 72 50 / 40%);
  color: #c94832;
}

.action-btn--sm {
  padding: 8rpx 18rpx;
  font-size: 21rpx;
}

.tip {
  padding: 30rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}

/* ── 弹窗通用 ── */
.picker-popup {
  display: flex;
  flex-direction: column;
  height: 78vh;
  background: #fff;
}

.picker-popup__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 30rpx 16rpx;
}

.picker-popup__title {
  font-size: 30rpx;
  font-weight: 850;
}

.picker-popup__close {
  padding: 8rpx;
}

.picker-search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12rpx;
  padding: 0 30rpx 18rpx;
}

.picker-search__input {
  min-width: 0;
  padding: 12rpx 16rpx;
  border: 1rpx solid var(--sl-line);
  border-radius: 999rpx;
  font-size: 26rpx;
}

.picker-scroll {
  flex: 1;
  overflow: hidden;
}

.picker-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx 30rpx;
  border-bottom: 1rpx solid var(--sl-line);
}

.picker-row--disabled {
  background: #f7f8f7;
  color: #8b948f;
}

.picker-row__info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
}

.picker-row__title-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12rpx;
}

.picker-row__name {
  overflow: hidden;
  font-size: 28rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-row__sub {
  color: var(--sl-muted);
  font-size: 22rpx;
}

.selection-box {
  display: flex;
  width: 42rpx;
  height: 42rpx;
  flex: 0 0 42rpx;
  align-items: center;
  justify-content: center;
  border: 2rpx solid #b9c5bf;
  border-radius: 10rpx;
  background: #fff;
}

.selection-box--checked {
  border-color: #126b4f;
  background: #126b4f;
}

.selection-box--disabled {
  border-color: #8ca79a;
  background: #8ca79a;
}

.assignment-tag {
  flex: 0 0 auto;
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  font-size: 19rpx;
  font-weight: 760;
}

.assignment-tag--assigned {
  background: #e7f0ff;
  color: #2f66ee;
}

.assignment-tag--free {
  background: #f0f2f0;
  color: #6b7770;
}

.assignment-tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8rpx;
  padding: 0 30rpx 18rpx;
}

.assignment-tab {
  display: flex;
  min-height: 58rpx;
  align-items: center;
  justify-content: center;
  border: 1rpx solid var(--sl-line);
  border-radius: 10rpx;
  color: #64716b;
  font-size: 23rpx;
  font-weight: 720;
}

.assignment-tab--active {
  border-color: rgb(18 107 79 / 30%);
  background: #ecf5ee;
  color: #126b4f;
}

.picker-footer {
  display: flex;
  min-height: 92rpx;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 16rpx 30rpx;
  border-top: 1rpx solid var(--sl-line);
  background: #fff;
}

.picker-footer__summary {
  min-width: 0;
  flex: 1;
  color: #385347;
  font-size: 24rpx;
  font-weight: 760;
}

.picker-footer__summary--stacked {
  display: flex;
  flex-wrap: wrap;
  gap: 6rpx 18rpx;
}

.picker-tip {
  padding: 28rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
