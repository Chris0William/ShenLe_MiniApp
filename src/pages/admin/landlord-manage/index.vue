<script setup lang="ts">
import type { SlCommunityOutput, SlLandlordOutput, SlUserOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getCommunityPage } from '@/api/community'
import { assignOwner, getLandlordPage, setLandlord, unassignOwner } from '@/api/landlord'
import { getUserPage } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { useSafeTopStyle } from '@/utils/safe-area'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '房东管理',
    enablePullDownRefresh: true,
  },
})

const safeTop = useSafeTopStyle()
const auth = useShenleAuthStore()

// ── 房东列表 ────────────────────────────────────────────────────────────────
const keyword = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const items = ref<SlLandlordOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const finished = computed(() => total.value > 0 && items.value.length >= total.value)

async function load(reset = false) {
  if (loading.value)
    return
  if (reset) {
    page.value = 1
    items.value = []
    total.value = 0
  }
  loading.value = true
  try {
    const result = await getLandlordPage({ page: page.value, pageSize, keyword: keyword.value.trim() || undefined })
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
    hasLoaded.value = true
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function cancelLandlord(item: SlLandlordOutput) {
  uni.showModal({
    title: '取消房东',
    content: `确定取消「${item.nickName || '该用户'}」的房东资格？`,
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await setLandlord(item.userId, false)
        uni.showToast({ title: '已取消房东', icon: 'success' })
        load(true)
      }
      catch {}
    },
  })
}

// ── 设为房东弹窗（用户选择）────────────────────────────────────────────────
const setLandlordVisible = ref(false)
const userKeyword = ref('')
const userPage = ref(1)
const userPageSize = 20
const userTotal = ref(0)
const userItems = ref<SlUserOutput[]>([])
const userLoading = ref(false)
const userFinished = computed(() => userTotal.value > 0 && userItems.value.length >= userTotal.value)

function openSetLandlord() {
  userKeyword.value = ''
  userPage.value = 1
  userTotal.value = 0
  userItems.value = []
  setLandlordVisible.value = true
  loadUsers(true)
}

async function loadUsers(reset = false) {
  if (userLoading.value)
    return
  if (reset) {
    userPage.value = 1
    userItems.value = []
    userTotal.value = 0
  }
  userLoading.value = true
  try {
    const result = await getUserPage({ page: userPage.value, pageSize: userPageSize, keyword: userKeyword.value.trim() || undefined })
    userTotal.value = result.total
    userItems.value = reset ? result.items : [...userItems.value, ...result.items]
  }
  finally {
    userLoading.value = false
  }
}

function onUserSearch() {
  loadUsers(true)
}

async function confirmSetLandlord(user: SlUserOutput) {
  try {
    await setLandlord(user.userId, true)
    uni.showToast({ title: `已将「${user.nickName || '该用户'}」设为房东`, icon: 'success' })
    setLandlordVisible.value = false
    load(true)
  }
  catch {}
}

function onUserListReachBottom() {
  if (!userFinished.value) {
    userPage.value += 1
    loadUsers()
  }
}

// ── 分配楼盘弹窗（楼盘选择）────────────────────────────────────────────────
const assignVisible = ref(false)
const assignTarget = ref<SlLandlordOutput | null>(null)
const communityKeyword = ref('')
const communityPage = ref(1)
const communityPageSize = 20
const communityTotal = ref(0)
const communityItems = ref<SlCommunityOutput[]>([])
const communityLoading = ref(false)
const communityFinished = computed(() => communityTotal.value > 0 && communityItems.value.length >= communityTotal.value)

function openAssign(item: SlLandlordOutput) {
  assignTarget.value = item
  communityKeyword.value = ''
  communityPage.value = 1
  communityTotal.value = 0
  communityItems.value = []
  assignVisible.value = true
  loadCommunities(true)
}

async function loadCommunities(reset = false) {
  if (communityLoading.value)
    return
  if (reset) {
    communityPage.value = 1
    communityItems.value = []
    communityTotal.value = 0
  }
  communityLoading.value = true
  try {
    const result = await getCommunityPage({ page: communityPage.value, pageSize: communityPageSize, name: communityKeyword.value.trim() || undefined })
    communityTotal.value = result.total
    communityItems.value = reset ? result.items : [...communityItems.value, ...result.items]
  }
  finally {
    communityLoading.value = false
  }
}

function onCommunitySearch() {
  loadCommunities(true)
}

async function confirmAssign(community: SlCommunityOutput) {
  if (!assignTarget.value)
    return
  try {
    await assignOwner(community.id, assignTarget.value.userId)
    uni.showToast({ title: `已将「${community.name}」分配给${assignTarget.value.nickName || '该房东'}`, icon: 'success' })
    assignVisible.value = false
    load(true)
  }
  catch {}
}

async function confirmUnassign(community: SlCommunityOutput) {
  uni.showModal({
    title: '取消分配',
    content: `确定将「${community.name}」从当前房东移除？`,
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await unassignOwner(community.id)
        uni.showToast({ title: '已取消分配', icon: 'success' })
        assignVisible.value = false
        load(true)
      }
      catch {}
    },
  })
}

function onCommunityListReachBottom() {
  if (!communityFinished.value) {
    communityPage.value += 1
    loadCommunities()
  }
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
onLoad(() => {
  if (!auth.isAdmin || modeStore.mode !== 'admin') {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  load(true)
})
onPullDownRefresh(() => load(true))
onReachBottom(() => {
  if (!finished.value) {
    page.value += 1
    load()
  }
})
</script>

<template>
  <view class="sl-page landlord-page" :style="safeTop">
    <view class="head">
      <text class="head__title">房东管理</text>
      <text class="head__desc">设置房东资格、分配楼盘</text>
    </view>

    <!-- 搜索 + 设为房东 -->
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
        <text>设为房东</text>
      </view>
    </view>

    <view class="result-head">
      <text>{{ total }} 位房东</text>
    </view>

    <!-- 房东列表 -->
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
            取消房东
          </view>
        </view>
      </view>
    </view>

    <view v-if="loading && !items.length" class="tip">
      加载中...
    </view>
    <view v-else-if="hasLoaded && !items.length" class="tip">
      暂无房东
    </view>
    <view v-else-if="finished && items.length" class="tip">
      已经到底了
    </view>

    <!-- ── 设为房东 弹窗 ── -->
    <wd-popup v-model="setLandlordVisible" position="bottom" :z-index="2000" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden; max-height: 80vh;">
      <view class="picker-popup">
        <view class="picker-popup__head">
          <text class="picker-popup__title">选择用户设为房东</text>
          <view class="picker-popup__close" @tap="setLandlordVisible = false">
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
          <view v-for="user in userItems" :key="String(user.userId)" class="picker-row" @tap="confirmSetLandlord(user)">
            <view class="picker-row__info">
              <text class="picker-row__name">{{ user.nickName || '未设置昵称' }}</text>
              <view class="role-tag role-tag--sm" :class="`role-tag--${roleTone(user.accountType)}`">
                {{ user.accountTypeName }}
              </view>
            </view>
            <wd-icon name="arrow-right" size="18px" color="#8ea099" />
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
      </view>
    </wd-popup>

    <!-- ── 分配楼盘 弹窗 ── -->
    <wd-popup v-model="assignVisible" position="bottom" :z-index="2000" custom-style="border-radius: 28rpx 28rpx 0 0; overflow: hidden; max-height: 80vh;">
      <view class="picker-popup">
        <view class="picker-popup__head">
          <text class="picker-popup__title">分配楼盘给「{{ assignTarget?.nickName || '房东' }}」</text>
          <view class="picker-popup__close" @tap="assignVisible = false">
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
        <scroll-view class="picker-scroll" scroll-y @scrolltolower="onCommunityListReachBottom">
          <view v-for="community in communityItems" :key="String(community.id)" class="picker-row">
            <view class="picker-row__info">
              <text class="picker-row__name">{{ community.name }}</text>
              <text class="picker-row__sub">{{ community.buildingCount }} 栋 · {{ community.propertyCount }} 套</text>
            </view>
            <view class="picker-row__btns">
              <view class="action-btn action-btn--assign action-btn--sm" @tap="confirmAssign(community)">
                分配
              </view>
              <view class="action-btn action-btn--cancel action-btn--sm" @tap="confirmUnassign(community)">
                移除
              </view>
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
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.landlord-page {
  padding-bottom: calc(60rpx + env(safe-area-inset-bottom));
}

.head {
  padding: 4rpx 2rpx 10rpx;
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

.picker-row__info {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 6rpx;
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

.picker-row__btns {
  display: flex;
  flex: 0 0 auto;
  gap: 12rpx;
}

.picker-tip {
  padding: 28rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
