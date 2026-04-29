<script setup lang="ts">
import { useShenleAuthStore } from '@/store/auth'

definePage({
  style: {
    navigationBarTitleText: '我的',
  },
})

const auth = useShenleAuthStore()

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
      <view @tap="go('/pages/common/login/index')">
        <text>{{ auth.isLogin ? '切换账号' : '账号登录' }}</text>
        <wd-icon name="arrow-right" />
      </view>
      <view @tap="go('/pages/common/community-manage/index')">
        <text>楼盘管理</text>
        <wd-icon name="arrow-right" />
      </view>
      <view @tap="go('/pages/common/building-manage/index')">
        <text>楼栋管理</text>
        <wd-icon name="arrow-right" />
      </view>
      <view @tap="go('/pages/common/region-manage/index')">
        <text>区域管理</text>
        <wd-icon name="arrow-right" />
      </view>
      <view @tap="go('/pages/common/tag-manage/index')">
        <text>标签管理</text>
        <wd-icon name="arrow-right" />
      </view>
      <view @tap="go('/pages/admin/sales-control/index')">
        <text>销控表</text>
        <wd-icon name="arrow-right" />
      </view>
    </view>

    <wd-button v-if="auth.isLogin" block plain type="danger" @click="logout">
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

.menu view {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 0;
  border-bottom: 1rpx solid var(--sl-line);
  font-size: 28rpx;
}

.menu view:last-child {
  border-bottom: 0;
}
</style>
