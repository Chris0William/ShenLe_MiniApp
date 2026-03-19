<script setup lang="ts">
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'

const userStore = useUserStore()
const appStore = useAppStore()

function onSwitchUser() {
  appStore.switchMode('user')
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
    <!-- 管理员信息 -->
    <view class="profile" :style="{ paddingTop: appStore.headerPaddingStyle(24) }">
      <view class="avatar">
        <image
          v-if="userStore.avatarUrl"
          class="avatar-img"
          :src="userStore.avatarUrl"
          mode="aspectFill"
        />
        <text v-else class="avatar-text">{{ userStore.nickName?.[0] || 'A' }}</text>
      </view>
      <view class="profile-info">
        <text class="name">{{ userStore.nickName || '管理员' }}</text>
        <text class="desc">管理端</text>
      </view>
    </view>

    <!-- 菜单列表 -->
    <view class="menu-group">
      <view class="menu-item" @tap="() => uni.navigateTo({ url: '/pages/common/region-manage/index' })">
        <text>区域管理</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @tap="() => uni.navigateTo({ url: '/pages/common/community-manage/index' })">
        <text>楼盘管理</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @tap="() => uni.navigateTo({ url: '/pages/common/building-manage/index' })">
        <text>楼栋管理</text>
        <text class="arrow">›</text>
      </view>
      <view class="menu-item" @tap="() => uni.navigateTo({ url: '/pages/common/tag-manage/index' })">
        <text>标签管理</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="menu-group">
      <view class="menu-item" @tap="onSwitchUser">
        <text>切换到用户端</text>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="menu-group" v-if="userStore.isLoggedIn">
      <view class="menu-item" @tap="onLogout">
        <text class="text-danger">退出登录</text>
      </view>
    </view>

    <sl-custom-tabbar :current="4" />
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
  background-color: $sl-primary;
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
