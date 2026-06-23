<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { setMyNickName } from '@/api/auth'
import { getPendingUsers } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { tabbarStore } from '@/tabbar/store'
import { requestLogin } from '@/utils/login-flow'

definePage({
  style: {
    navigationBarTitleText: '我的',
  },
})

const auth = useShenleAuthStore()
const isAdminView = computed(() => modeStore.mode === 'admin')
const isLandlordView = computed(() => modeStore.mode === 'landlord')
const pendingCount = ref(0)
const nicknameVisible = ref(false)
const nicknameDraft = ref('')
const nicknameSaving = ref(false)
const loginConsentRef = ref<{ open: (options?: Parameters<typeof requestLogin>[0]) => void } | null>(null)

const adminMenus = computed(() => {
  const base = [
    { title: '楼盘管理', desc: '楼盘地址、坐标、楼栋入口', icon: 'home', tone: 'green', url: '/pages/common/community-manage/index', badge: 0 },
    { title: '楼栋管理', desc: '选择楼盘后维护楼栋', icon: 'view-list', tone: 'green', url: '/pages/common/building-manage/index', badge: 0 },
    { title: '区域管理', desc: '片区层级与地图中心点', icon: 'location', tone: 'gold', url: '/pages/common/region-manage/index', badge: 0 },
    { title: '标签管理', desc: '房源标签与配套设施字典', icon: 'discount', tone: 'green', url: '/pages/common/tag-manage/index', badge: 0 },
    { title: '销控表', desc: '楼盘 -> 楼栋 -> 房间', icon: 'chart', tone: 'gold', url: '/pages/admin/sales-control/index', badge: 0 },
    { title: '房东管理', desc: '设置房东、分配楼盘', icon: 'usergroup', tone: 'gold', url: '/pages/admin/landlord-manage/index', badge: 0 },
  ]
  // 用户管理仅超级管理员(999)可见，带待审红点
  if (auth.isSuperAdmin)
    base.push({ title: '用户管理', desc: '审批申请、设置用户角色', icon: 'usergroup', tone: 'gold', url: '/pages/admin/user-manage/index', badge: pendingCount.value })
  return base
})

function openNicknameEditor() {
  if (!auth.isLogin)
    return
  nicknameDraft.value = auth.user?.nickName || ''
  nicknameVisible.value = true
}

function handleProfileTap() {
  if (auth.isLogin)
    return
  loginConsentRef.value?.open({
    reason: '登录后可申请使用并查看完整房源服务',
    redirect: '/pages/user/map/index', // 登录成功后由 finishLogin 统一 reLaunch 到地图
    onSuccess: () => modeStore.setMode('user'),
  })
}

async function submitNickname() {
  const nickName = nicknameDraft.value.trim()
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
    await setMyNickName(nickName)
    await auth.refreshUser(true)
    nicknameVisible.value = false
    uni.showToast({ title: '已更新昵称', icon: 'success' })
  }
  finally {
    nicknameSaving.value = false
  }
}

function go(url: string) {
  uni.navigateTo({ url })
}

onShow(() => {
  if (isAdminView.value && auth.isSuperAdmin)
    getPendingUsers().then((list) => { pendingCount.value = list.length }).catch(() => {})
})

function toLandlord() {
  if (!auth.isLogin) {
    requestLogin({ reason: '登录账号后可切换房东端', redirect: '/pages/user/map/index' })
    return
  }
  if (!auth.isLandlord) {
    uni.showToast({ title: '仅房东可使用房东端', icon: 'none' })
    return
  }
  modeStore.setMode('landlord')
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' })
}

// 切到管理端：未登录先授权；已登录且 888 才进
function toAdmin() {
  if (!auth.isLogin) {
    requestLogin({ reason: '登录管理员账号后可切换管理端', redirect: '/pages/user/map/index' })
    return
  }
  if (!auth.isAdmin) {
    uni.showToast({ title: '仅管理员可使用管理端', icon: 'none' })
    return
  }
  modeStore.setMode('admin')
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' }) // 管理端首 tab 也是地图
}

function toUser() {
  modeStore.setMode('user')
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' })
}

async function signOut() {
  await auth.signOut() // 内部已 setMode('user')
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' })
}
</script>

<template>
  <view class="sl-page mine-page">
    <view class="profile sl-card" :class="{ 'profile--clickable': !auth.isLogin }" @tap="handleProfileTap">
      <image class="avatar" :src="auth.user?.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
      <view class="profile-info">
        <text class="name">{{ auth.isLogin ? auth.displayName : '未登录' }}</text>
        <text class="meta">
          {{ isAdminView ? '管理端' : isLandlordView ? '房东端' : '用户端' }} ·
          {{ auth.isLogin ? (auth.isAdmin ? '管理员账号' : '普通账号') : '登录后可进入管理端' }}
        </text>
        <text v-if="auth.isLogin" class="nickname-edit" @tap="openNicknameEditor">修改昵称</text>
      </view>
    </view>

    <!-- 管理模式视图 -->
    <template v-if="isAdminView">
      <view class="sl-section-head">
        <text class="sl-section-title">管理入口</text>
        <text class="sl-section-extra">Admin</text>
      </view>
      <view class="menu-list">
        <view v-for="item in adminMenus" :key="item.url" class="menu sl-card" @tap="go(item.url)">
          <view class="menu-icon" :class="`menu-icon--${item.tone}`">
            <wd-icon :name="item.icon" size="23px" :color="item.tone === 'gold' ? '#b46d08' : '#126b4f'" />
          </view>
          <view class="menu-text">
            <text>{{ item.title }}</text>
            <text>{{ item.desc }}</text>
          </view>
          <view v-if="item.badge" class="menu-badge">
            {{ item.badge }}
          </view>
          <wd-icon name="arrow-right" size="18px" color="#8ea099" />
        </view>
      </view>

      <view class="switch-card sl-card" @tap="toUser">
        <view class="switch-card__main">
          <wd-icon name="swap" size="22px" color="#126b4f" />
          <text>切换到用户端</text>
        </view>
        <wd-icon name="arrow-right" size="18px" color="#8ea099" />
      </view>
    </template>

    <!-- 房东模式视图 -->
    <template v-else-if="isLandlordView">
      <view class="sl-section-head">
        <text class="sl-section-title">房东中心</text>
      </view>
      <view class="menu sl-card user-menu">
        <view class="menu-row" @tap="go('/pages/landlord/my-communities/index')">
          <view class="menu-row__left">
            <view class="menu-icon menu-icon--green">
              <wd-icon name="home" size="21px" color="#126b4f" />
            </view>
            <text>我的楼盘</text>
          </view>
          <wd-icon name="arrow-right" size="18px" color="#8ea099" />
        </view>
      </view>

      <view class="switch-card sl-card" @tap="toUser">
        <view class="switch-card__main">
          <wd-icon name="swap" size="22px" color="#126b4f" />
          <text>切换到用户端</text>
        </view>
        <wd-icon name="arrow-right" size="18px" color="#8ea099" />
      </view>
      <view v-if="auth.isAdmin" class="switch-card sl-card" style="margin-top: 16rpx;" @tap="toAdmin">
        <view class="switch-card__main">
          <wd-icon name="setting" size="22px" color="#126b4f" />
          <text>切换到管理端</text>
        </view>
        <wd-icon name="arrow-right" size="18px" color="#8ea099" />
      </view>
    </template>

    <!-- 用户模式视图 -->
    <template v-else>
      <view v-if="auth.isAdmin || auth.isLandlord" class="menu sl-card user-menu">
        <view v-if="auth.isAdmin" class="menu-row" @tap="toAdmin">
          <view class="menu-row__left">
            <view class="menu-icon menu-icon--green">
              <wd-icon name="setting" size="21px" color="#126b4f" />
            </view>
            <text>切换到管理端</text>
          </view>
          <wd-icon name="arrow-right" size="18px" color="#8ea099" />
        </view>
        <view v-if="auth.isLandlord" class="menu-row" @tap="toLandlord">
          <view class="menu-row__left">
            <view class="menu-icon menu-icon--green">
              <wd-icon name="home" size="21px" color="#126b4f" />
            </view>
            <text>切换到房东端</text>
          </view>
          <wd-icon name="arrow-right" size="18px" color="#8ea099" />
        </view>
      </view>

      <view v-if="!auth.isAdmin && !auth.isLandlord" class="hint">
        {{ auth.isLogin ? '管理员可在此切换到管理端' : '点击上方头像卡片登录或申请使用' }}
      </view>
    </template>

    <wd-popup v-model="nicknameVisible" :z-index="2000" custom-style="border-radius: 26rpx; overflow: hidden; width: 640rpx;">
      <view class="nickname-popup">
        <text class="nickname-popup__title">修改昵称</text>
        <wd-input v-model="nicknameDraft" placeholder="请输入昵称" clearable :maxlength="32" />
        <view class="nickname-popup__actions">
          <wd-button plain size="small" @click="nicknameVisible = false">
            取消
          </wd-button>
          <wd-button type="primary" size="small" :loading="nicknameSaving" @click="submitNickname">
            保存
          </wd-button>
        </view>
      </view>
    </wd-popup>

    <wd-button v-if="auth.isLogin" plain block type="danger" custom-class="logout" @click="signOut">
      退出登录
    </wd-button>
    <sl-login-consent ref="loginConsentRef" />
  </view>
</template>

<style scoped lang="scss">
.mine-page {
  padding-bottom: calc(120rpx + env(safe-area-inset-bottom));
}

.profile {
  display: flex;
  align-items: center;
  gap: 22rpx;
  margin-top: 18rpx;
  padding: 28rpx;
  background: radial-gradient(circle at 90% -10%, rgb(228 161 27 / 20%), transparent 220rpx), #fff;
}

.profile--clickable {
  position: relative;
}

.profile--clickable::after {
  content: '点击登录';
  position: absolute;
  right: 26rpx;
  bottom: 24rpx;
  color: #126b4f;
  font-size: 23rpx;
  font-weight: 800;
}

.avatar {
  width: 112rpx;
  height: 112rpx;
  border: 6rpx solid #fff;
  border-radius: 999rpx;
  box-shadow: 0 12rpx 26rpx rgb(18 107 79 / 15%);
}

.profile-info {
  min-width: 0;
  flex: 1;
}

.name,
.meta {
  display: block;
}

.name {
  font-size: 34rpx;
  font-weight: 900;
}

.meta {
  margin-top: 10rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.menu-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.menu {
  display: flex;
  align-items: center;
  gap: 18rpx;
  padding: 24rpx;
}

.user-menu {
  display: block;
  margin-top: 24rpx;
  padding: 4rpx 26rpx;
}

.menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--sl-line);
  font-size: 28rpx;
  font-weight: 720;
}

.menu-row:last-child {
  border-bottom: 0;
}

.menu-row__left {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 18rpx;
}

.menu-icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
  flex: 0 0 72rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
  background: #ecf5ee;
}

.menu-icon--gold {
  background: #fff2d7;
}

.menu-icon--green {
  background: #ecf5ee;
}

.menu-badge {
  display: flex;
  min-width: 34rpx;
  height: 34rpx;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0 8rpx;
  margin-right: 8rpx;
  border-radius: 999rpx;
  background: #f5594e;
  color: #fff;
  font-size: 20rpx;
  font-weight: 800;
}

.menu-text {
  min-width: 0;
  flex: 1;
}

.menu-text text:first-child {
  display: block;
  font-size: 29rpx;
  font-weight: 850;
}

.menu-text text:last-child {
  display: block;
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.switch-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 20rpx;
  padding: 26rpx;
}

.switch-card__main {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 29rpx;
  font-weight: 850;
}

.hint {
  margin: 20rpx 4rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
  text-align: center;
}

:deep(.logout) {
  margin-top: 34rpx;
}
.nickname-edit {
  display: inline-block;
  margin-top: 12rpx;
  color: #126b4f;
  font-size: 24rpx;
  font-weight: 750;
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
