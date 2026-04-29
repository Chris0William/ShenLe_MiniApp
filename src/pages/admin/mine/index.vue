<script setup lang="ts">
import { useShenleAuthStore } from '@/store/auth'

definePage({
  style: {
    navigationBarTitleText: '管理我的',
  },
})

const auth = useShenleAuthStore()

const menus = [
  { title: '楼盘管理', desc: '楼盘地址、坐标、楼栋入口', icon: 'home', tone: 'green', url: '/pages/common/community-manage/index' },
  { title: '楼栋管理', desc: '选择楼盘后维护楼栋', icon: 'view-list', tone: 'green', url: '/pages/common/building-manage/index' },
  { title: '区域管理', desc: '片区层级与地图中心点', icon: 'location', tone: 'gold', url: '/pages/common/region-manage/index' },
  { title: '标签管理', desc: '房源标签与配套设施字典', icon: 'discount', tone: 'green', url: '/pages/common/tag-manage/index' },
  { title: '销控表', desc: '区域 -> 楼盘 -> 楼栋 -> 房间', icon: 'chart', tone: 'gold', url: '/pages/admin/sales-control/index' },
]

function go(url: string) {
  uni.navigateTo({ url })
}

async function signOut() {
  await auth.signOut()
  uni.reLaunch({ url: '/pages/common/login/index' })
}
</script>

<template>
  <view class="sl-page mine-page">
    <view class="profile sl-card">
      <image class="avatar" :src="auth.user?.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
      <view class="profile-info">
        <text class="name">{{ auth.displayName }}</text>
        <text class="meta">{{ auth.isAdmin ? '管理端账号' : '普通账号' }} · {{ auth.openId ? '微信已绑定' : '未绑定微信' }}</text>
      </view>
    </view>

    <view class="sl-section-head">
      <text class="sl-section-title">管理入口</text>
      <text class="sl-section-extra">Admin</text>
    </view>

    <view class="menu-list">
      <view v-for="item in menus" :key="item.url" class="menu sl-card" @tap="go(item.url)">
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

    <wd-button plain block type="danger" custom-class="logout" @click="signOut">
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

.menu-icon {
  display: flex;
  width: 72rpx;
  height: 72rpx;
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

:deep(.logout) {
  margin-top: 34rpx;
}
</style>
