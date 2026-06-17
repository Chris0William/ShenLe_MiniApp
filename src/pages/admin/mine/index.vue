<script setup lang="ts">
import { computed } from 'vue'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { tabbarStore } from '@/tabbar/store'

definePage({
  style: {
    navigationBarTitleText: '我的',
  },
})

const auth = useShenleAuthStore()
const isAdminView = computed(() => modeStore.mode === 'admin')

const adminMenus = computed(() => {
  const base = [
    { title: '楼盘管理', desc: '楼盘地址、坐标、楼栋入口', icon: 'home', tone: 'green', url: '/pages/common/community-manage/index' },
    { title: '楼栋管理', desc: '选择楼盘后维护楼栋', icon: 'view-list', tone: 'green', url: '/pages/common/building-manage/index' },
    { title: '区域管理', desc: '片区层级与地图中心点', icon: 'location', tone: 'gold', url: '/pages/common/region-manage/index' },
    { title: '标签管理', desc: '房源标签与配套设施字典', icon: 'discount', tone: 'green', url: '/pages/common/tag-manage/index' },
    { title: '销控表', desc: '楼盘 -> 楼栋 -> 房间', icon: 'chart', tone: 'gold', url: '/pages/admin/sales-control/index' },
  ]
  // 用户管理仅超级管理员(999)可见
  if (auth.isSuperAdmin)
    base.push({ title: '用户管理', desc: '设置用户为管理员/普通用户', icon: 'usergroup', tone: 'gold', url: '/pages/admin/user-manage/index' })
  return base
})

function go(url: string) {
  uni.navigateTo({ url })
}

// 切到管理端：未登录先授权；已登录且 888 才进
function toAdmin() {
  if (!auth.isLogin) {
    uni.navigateTo({ url: `/pages/common/login/index?redirect=${encodeURIComponent('/pages/admin/dashboard/index')}` })
    return
  }
  if (!auth.isAdmin) {
    uni.showToast({ title: '仅管理员可使用管理端', icon: 'none' })
    return
  }
  modeStore.setMode('admin')
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/admin/dashboard/index' })
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
    <view class="profile sl-card">
      <image class="avatar" :src="auth.user?.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
      <view class="profile-info">
        <text class="name">{{ auth.isLogin ? auth.displayName : '未登录' }}</text>
        <text class="meta">
          {{ isAdminView ? '管理端' : '用户端' }} ·
          {{ auth.isLogin ? (auth.isAdmin ? '管理员账号' : '普通账号') : '登录后可进入管理端' }}
        </text>
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

    <!-- 用户模式视图 -->
    <template v-else>
      <view class="menu sl-card user-menu">
        <view class="menu-row" @tap="go('/pages/common/login/index')">
          <view class="menu-row__left">
            <view class="menu-icon menu-icon--gold">
              <wd-icon name="user" size="21px" color="#b46d08" />
            </view>
            <text>{{ auth.isLogin ? '切换账号' : '微信授权登录' }}</text>
          </view>
          <wd-icon name="arrow-right" size="18px" color="#8ea099" />
        </view>
        <view v-if="auth.isAdmin" class="menu-row" @tap="toAdmin">
          <view class="menu-row__left">
            <view class="menu-icon menu-icon--green">
              <wd-icon name="setting" size="21px" color="#126b4f" />
            </view>
            <text>切换到管理端</text>
          </view>
          <wd-icon name="arrow-right" size="18px" color="#8ea099" />
        </view>
      </view>

      <view v-if="!auth.isAdmin" class="hint">
        管理员可在此切换到管理端
      </view>
    </template>

    <wd-button v-if="auth.isLogin" plain block type="danger" custom-class="logout" @click="signOut">
      退出登录
    </wd-button>
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
</style>
