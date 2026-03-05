<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'

const userStore = useUserStore()
const appStore = useAppStore()

function onProfileTap() {
  if (!userStore.isLoggedIn) {
    userStore.popupStep = 'login'
  }
}

function onSwitchAdmin() {
  appStore.switchMode('admin')
}

function onLogout() {
  uni.showModal({
    title: '提示',
    content: '确定退出登录吗？',
    success(res) {
      if (res.confirm) userStore.logout()
    },
  })
}
</script>

<template>
  <view class="page">
    <!-- 头像区域 -->
    <view class="profile" :style="{ paddingTop: appStore.headerPaddingStyle(24) }" @tap="onProfileTap">
      <view class="avatar">
        <image
          v-if="userStore.avatarUrl"
          class="avatar-img"
          :src="userStore.avatarUrl"
          mode="aspectFill"
        />
        <text v-else class="avatar-text">{{ userStore.nickName?.[0] || '?' }}</text>
      </view>
      <view class="profile-info">
        <text class="name">{{ userStore.isLoggedIn ? userStore.nickName : '点击登录' }}</text>
        <text class="desc">{{ userStore.isLoggedIn ? '欢迎回来' : '登录后享受更多服务' }}</text>
      </view>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-group">
      <view v-if="userStore.isAdmin" class="menu-item" @tap="onSwitchAdmin">
        <text>切换到管理端</text>
        <text class="arrow">&#x203A;</text>
      </view>
      <view class="menu-item">
        <text>我的收藏</text>
        <text class="arrow">&#x203A;</text>
      </view>
      <view class="menu-item">
        <text>浏览记录</text>
        <text class="arrow">&#x203A;</text>
      </view>
      <view class="menu-item">
        <text>意见反馈</text>
        <text class="arrow">&#x203A;</text>
      </view>
    </view>

    <view v-if="userStore.isLoggedIn" class="menu-group">
      <view class="menu-item" @tap="onLogout">
        <text class="text-danger">退出登录</text>
      </view>
    </view>

    <view style="height: 120rpx" />
    <sl-custom-tabbar :current="2" />
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $sl-bg-page;
}

.profile {
  display: flex;
  align-items: center;
  gap: $sl-spacing-md;
  padding: $sl-spacing-xl $sl-spacing-lg;
  // padding-top 由 :style 动态设置
  background-color: $sl-primary;
  margin-bottom: $sl-spacing-sm;
}

.avatar {
  width: 120rpx;
  height: 120rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-img {
  width: 100%;
  height: 100%;
}

.avatar-text {
  font-size: $sl-font-xxl;
  color: #ffffff;
  font-weight: 600;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.name {
  font-size: $sl-font-xl;
  font-weight: 600;
  color: #ffffff;
}

.desc {
  font-size: $sl-font-sm;
  color: rgba(255, 255, 255, 0.8);
}

.menu-group {
  background-color: $sl-bg-card;
  margin-bottom: $sl-spacing-sm;
}

.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $sl-spacing-md $sl-spacing-lg;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  border-bottom: 1rpx solid $sl-border-color;

  &:last-child {
    border-bottom: none;
  }
}

.arrow {
  font-size: $sl-font-lg;
  color: $sl-text-placeholder;
}

.text-danger {
  color: $sl-danger;
}
</style>
