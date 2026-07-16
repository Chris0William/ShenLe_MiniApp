<script setup lang="ts">
import type { SlPendingUserOutput, SlUserOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { approveUser, deleteUser, getPendingUsers, getUserPage, rejectUser, setUserNickName, setUserRole } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { useSafeTopStyle } from '@/utils/safe-area'
import { resolveAssetUrl } from '@/utils/shenle'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '用户管理',
    enablePullDownRefresh: true,
  },
})

const safeTop = useSafeTopStyle()
const auth = useShenleAuthStore()

function goBack() {
  uni.navigateBack()
}
const keyword = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const items = ref<SlUserOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const finished = computed(() => total.value > 0 && items.value.length >= total.value)

// 待审申请
const pending = ref<SlPendingUserOutput[]>([])
const nicknameVisible = ref(false)
const nicknameDraft = ref('')
const nicknameTarget = ref<SlUserOutput | null>(null)
const nicknameSaving = ref(false)

function openUserNickname(item: SlUserOutput) {
  nicknameTarget.value = item
  nicknameDraft.value = item.nickName || ''
  nicknameVisible.value = true
}

async function submitUserNickname() {
  const nickName = nicknameDraft.value.trim()
  if (!nicknameTarget.value)
    return
  if (!nickName) {
    uni.showToast({ title: '昵称不能为空', icon: 'none' })
    return
  }
  if (nickName.length > 32) {
    uni.showToast({ title: '昵称不能超过32个字符', icon: 'none' })
    return
  }
  nicknameSaving.value = true
  try {
    await setUserNickName({ userId: nicknameTarget.value.userId, nickName })
    nicknameTarget.value.nickName = nickName
    nicknameVisible.value = false
    uni.showToast({ title: '已更新昵称', icon: 'success' })
  }
  finally {
    nicknameSaving.value = false
  }
}

async function loadPending() {
  pending.value = await getPendingUsers().catch(() => [])
}

async function approve(item: SlPendingUserOutput) {
  uni.showModal({
    title: '通过申请',
    content: `通过「${item.nickName || '该用户'}」的申请？将升级为普通用户，对方刷新或重登后即可使用。`,
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await approveUser(item.userId)
        pending.value = pending.value.filter(p => String(p.userId) !== String(item.userId))
        uni.showToast({ title: '已通过', icon: 'success' })
        load(true)
      }
      catch {}
    },
  })
}

async function reject(item: SlPendingUserOutput) {
  uni.showModal({
    title: '拒绝申请',
    content: `拒绝「${item.nickName || '该用户'}」的申请？对方仍是游客，可重新申请。`,
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await rejectUser(item.userId)
        pending.value = pending.value.filter(p => String(p.userId) !== String(item.userId))
        uni.showToast({ title: '已拒绝', icon: 'none' })
      }
      catch {}
    },
  })
}

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
    const result = await getUserPage({ page: page.value, pageSize, keyword: keyword.value.trim() || undefined })
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
    hasLoaded.value = true
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function roleTone(accountType: number) {
  if (accountType >= 999)
    return 'gold'
  if (accountType >= 888)
    return 'green'
  if (accountType >= 777)
    return 'blue'
  return 'gray'
}

const ROLE_OPTIONS = [
  { value: 888, label: '管理员' },
  { value: 777, label: '普通用户' },
  { value: 666, label: '游客' },
]

function changeRole(item: SlUserOutput, target: number) {
  if (item.accountType >= 999) {
    uni.showToast({ title: '超级管理员只能在后台调整', icon: 'none' })
    return
  }
  if (item.accountType === target)
    return
  const label = ROLE_OPTIONS.find(o => o.value === target)?.label || ''
  const extra = target === 666 ? '对方将退回游客，需重新申请。' : '对方刷新或重登后生效。'
  uni.showModal({
    title: '调整角色',
    content: `确定将「${item.nickName || '该用户'}」设为${label}？${extra}`,
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await setUserRole({ userId: item.userId, accountType: target })
        item.accountType = target
        item.accountTypeName = label
        uni.showToast({ title: '已调整', icon: 'success' })
      }
      catch {}
    },
  })
}

function removeUser(item: SlUserOutput) {
  uni.showModal({
    title: '注销用户',
    content: `确定注销「${item.nickName || '该用户'}」？该用户会立即下线、从列表移除；之后需用微信重新注册才能再次使用。此操作不可在小程序内撤销。`,
    confirmText: '注销',
    confirmColor: '#c94832',
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await deleteUser(item.userId)
        items.value = items.value.filter(u => String(u.userId) !== String(item.userId))
        total.value = Math.max(0, total.value - 1)
        uni.showToast({ title: '已注销', icon: 'success' })
      }
      catch {}
    },
  })
}

onLoad(() => {
  // 仅超级管理员可用；非超管或非管理模式拦回
  if (!auth.isSuperAdmin || modeStore.mode !== 'admin') {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  load(true)
  loadPending()
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
  <view class="sl-page user-page" :style="safeTop">
    <view class="head">
      <view class="head__back" @tap="goBack">
        <wd-icon name="arrow-left" size="20px" color="#126b4f" />
      </view>
      <view class="head__main">
        <text class="head__title">用户管理</text>
        <text class="head__desc">审批游客申请、设置用户角色</text>
      </view>
    </view>

    <!-- 待审申请 -->
    <view v-if="pending.length" class="pending-block sl-card">
      <view class="pending-head">
        <text class="pending-title">待申请</text>
        <view class="pending-badge">
          {{ pending.length }}
        </view>
      </view>
      <view v-for="item in pending" :key="String(item.userId)" class="pending-row">
        <image class="avatar avatar--sm" :src="resolveAssetUrl(item.avatar) || '/static/images/default-avatar.png'" mode="aspectFill" />
        <text class="pending-name">{{ item.nickName || '微信用户' }}</text>
        <view class="pending-actions">
          <view class="mini-btn mini-btn--reject" @tap="reject(item)">
            拒绝
          </view>
          <view class="mini-btn mini-btn--approve" @tap="approve(item)">
            通过
          </view>
        </view>
      </view>
    </view>

    <view class="search sl-card">
      <wd-icon name="search" size="20px" color="#7a8780" />
      <input v-model="keyword" class="search__input" placeholder="搜索昵称 / 账号" confirm-type="search" @confirm="load(true)">
      <wd-button size="small" type="primary" @click="load(true)">
        搜索
      </wd-button>
    </view>

    <view class="result-head">
      <text>{{ total }} 个用户</text>
    </view>

    <view class="list">
      <view v-for="item in items" :key="String(item.userId)" class="user sl-card">
        <image class="avatar" :src="resolveAssetUrl(item.avatar) || '/static/images/default-avatar.png'" mode="aspectFill" />
        <view class="user__body">
          <view class="user__top">
            <text class="user__name">{{ item.nickName || '微信用户' }}</text>
            <view class="role-tag" :class="`role-tag--${roleTone(item.accountType)}`">
              {{ item.accountTypeName }}
            </view>
          </view>
          <view class="user__actions">
            <view class="role-btn role-btn--nick" @tap="openUserNickname(item)">
              修改昵称
            </view>
            <template v-if="item.accountType < 999">
              <view
                v-for="opt in ROLE_OPTIONS"
                :key="opt.value"
                class="role-btn"
                :class="{ active: item.accountType === opt.value }"
                @tap="changeRole(item, opt.value)"
              >
                {{ opt.label }}
              </view>
              <view class="role-btn role-btn--danger" @tap="removeUser(item)">
                注销
              </view>
            </template>
          </view>
          <text v-if="item.accountType >= 999" class="user__hint">超级管理员（仅后台可调）</text>
        </view>
      </view>
    </view>

    <wd-popup v-model="nicknameVisible" :z-index="2000" custom-style="border-radius: 26rpx; overflow: hidden; width: 640rpx;" @touchmove.stop.prevent>
      <view class="nickname-popup" @touchmove.stop.prevent>
        <text class="nickname-popup__title">修改用户昵称</text>
        <wd-input v-model="nicknameDraft" placeholder="请输入昵称" clearable :maxlength="32" />
        <view class="nickname-popup__actions">
          <wd-button plain size="small" @click="nicknameVisible = false">
            取消
          </wd-button>
          <wd-button type="primary" size="small" :loading="nicknameSaving" @click="submitUserNickname">
            保存
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <view v-if="loading && !items.length" class="tip">
      加载中...
    </view>
    <view v-else-if="hasLoaded && !items.length" class="tip">
      暂无用户
    </view>
    <view v-else-if="finished && items.length" class="tip">
      已经到底了
    </view>
  </view>
</template>

<style scoped lang="scss">
.user-page {
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

.search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  margin-top: 14rpx;
  padding: 18rpx;
}

.search__input {
  min-width: 0;
  font-size: 27rpx;
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

.user {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx;
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  flex: 0 0 88rpx;
  border-radius: 999rpx;
  background: #edf2eb;
}

.user__body {
  min-width: 0;
  flex: 1;
}

.user__top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.user__name {
  overflow: hidden;
  font-size: 29rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.user__actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.role-btn {
  padding: 10rpx 22rpx;
  border: 1rpx solid rgb(18 107 79 / 18%);
  border-radius: 999rpx;
  color: #5e6c65;
  font-size: 23rpx;
  font-weight: 700;
}

.role-btn--danger {
  border-color: rgb(201 72 50 / 40%);
  color: #c94832;
}

/* 待审申请区块 */
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
  gap: 16rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--sl-line);
}

.pending-row:last-child {
  border-bottom: 0;
}

.avatar--sm {
  width: 64rpx;
  height: 64rpx;
  flex: 0 0 64rpx;
}

.pending-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  font-size: 27rpx;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.role-btn.active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--sl-brand, #126b4f), #24815f);
  color: #fff;
}

.user__hint {
  display: block;
  margin-top: 14rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.tip {
  padding: 30rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}
.role-btn--nick {
  border-color: rgb(180 109 8 / 28%);
  color: #9a6408;
}

.nickname-popup {
  padding: 30rpx;
  background: #fff;
}

.nickname-popup__title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 31rpx;
  font-weight: 850;
}

.nickname-popup__actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 24rpx;
}
</style>
