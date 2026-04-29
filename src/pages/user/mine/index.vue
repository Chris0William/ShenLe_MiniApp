<script setup lang="ts">
import { useShenleAuthStore } from '@/store/auth'

definePage({
  style: {
    navigationBarTitleText: '我的',
  },
})

const auth = useShenleAuthStore()

const menuList = [
  { title: '楼盘管理', icon: 'home', tone: 'green', url: '/pages/common/community-manage/index' },
  { title: '楼栋管理', icon: 'view-list', tone: 'green', url: '/pages/common/building-manage/index' },
  { title: '区域管理', icon: 'location', tone: 'gold', url: '/pages/common/region-manage/index' },
  { title: '标签管理', icon: 'discount', tone: 'green', url: '/pages/common/tag-manage/index' },
  { title: '销控表', icon: 'chart', tone: 'gold', url: '/pages/admin/sales-control/index' },
]

function go(url: string) {
  uni.navigateTo({ url })
}

async function logout() {
  await auth.signOut()
  uni.showToast({ title: '已退出', icon: 'success' })
}
</script>

<template>
  <view class="sl-page mine">
    <view class="profile sl-card">
      <image class="avatar" :src="auth.user?.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
      <view>
        <text class="name">{{ auth.displayName }}</text>
        <text class="meta">{{ auth.user?.orgName || (auth.isLogin ? '深乐租团队' : '登录后管理房源') }}</text>
      </view>
    </view>

    <view class="menu sl-card">
      <view class="menu-row" @tap="go('/pages/common/login/index')">
        <view class="menu-row__left">
          <view class="menu-icon menu-icon--gold">
            <wd-icon name="user" size="21px" color="#b46d08" />
          </view>
          <text>{{ auth.isLogin ? '切换账号' : '微信授权登录' }}</text>
        </view>
        <wd-icon name="arrow-right" size="18px" color="#8ea099" />
      </view>
      <view v-for="item in menuList" :key="item.url" class="menu-row" @tap="go(item.url)">
        <view class="menu-row__left">
          <view class="menu-icon" :class="`menu-icon--${item.tone}`">
            <wd-icon :name="item.icon" size="21px" :color="item.tone === 'gold' ? '#b46d08' : '#126b4f'" />
          </view>
          <text>{{ item.title }}</text>
        </view>
        <wd-icon name="arrow-right" size="18px" color="#8ea099" />
      </view>
    </view>

    <wd-button v-if="auth.isLogin" plain block type="danger" @click="logout">
      退出登录
    </wd-button>
  </view>
</template>

<style scoped lang="scss">
.mine {
  padding-top: 32rpx;
}

.profile {
  display: flex;
  align-items: center;
  gap: 22rpx;
  padding: 30rpx;
}

.avatar {
  width: 116rpx;
  height: 116rpx;
  border-radius: 999rpx;
  background: #edf2eb;
}

.name,
.meta {
  display: block;
}

.name {
  font-size: 34rpx;
  font-weight: 850;
}

.meta {
  margin-top: 8rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.menu {
  margin: 24rpx 0;
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
  width: 66rpx;
  height: 66rpx;
  flex: 0 0 66rpx;
  align-items: center;
  justify-content: center;
  border-radius: 20rpx;
}

.menu-icon--green {
  background: #ecf5ee;
}

.menu-icon--gold {
  background: #fff2d7;
}
</style>
