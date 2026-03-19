<script setup lang="ts">
import { provide, computed, reactive, watch, ref } from 'vue'
import { useAppStore, type TabKey } from '@/stores/app'
import { useUserStore } from '@/stores/user'

import UserHome from '@/pages/user/home/index.vue'
import UserMap from '@/pages/user/map/index.vue'
import UserMine from '@/pages/user/mine/index.vue'
import AdminMap from '@/pages/user/map/index.vue'
import AdminDashboard from '@/pages/admin/dashboard/index.vue'
import AdminPropertyList from '@/pages/admin/property-list/index.vue'
import AdminSalesControl from '@/pages/admin/sales-control/index.vue'
import AdminMine from '@/pages/admin/mine/index.vue'

// 通知所有嵌套的 sl-custom-tabbar 隐藏自身
provide('sl-hide-tabbar', true)

const appStore = useAppStore()
const userStore = useUserStore()

const userTabKeys: TabKey[] = ['user-home', 'user-map', 'user-mine']
const adminTabKeys: TabKey[] = ['admin-map', 'admin-property-list', 'admin-dashboard', 'admin-sales-control', 'admin-mine']

const currentTabKeys = computed(() =>
  appStore.mode === 'admin' ? adminTabKeys : userTabKeys,
)

const tabIndex = computed(() => {
  const idx = currentTabKeys.value.indexOf(appStore.currentTab)
  return idx >= 0 ? idx : 0
})

// 懒加载：仅首次访问时挂载组件，之后用 v-show 切换
const visited = reactive(new Set<string>([appStore.currentTab]))
watch(() => appStore.currentTab, (tab) => { visited.add(tab) })

function onTabChange(index: number) {
  appStore.switchTab(currentTabKeys.value[index])
}

// ─── 登录弹窗 ───
const popupLoading = ref(false)
const profileNickName = ref('')
const profileAvatarTemp = ref('')  // chooseAvatar 返回的临时文件路径

async function onPopupWxLogin() {
  if (popupLoading.value) return
  popupLoading.value = true
  try {
    const result = await userStore.wxLoginStep1()
    if (result === 'done') {
      uni.showToast({ title: '登录成功', icon: 'success' })
      appStore.loadMode()
      userStore.onPopupLoginDone(true)
    } else {
      // needProfile → 切换到完善资料步骤
      userStore.popupStep = 'profile'
    }
  } catch (e: any) {
    console.error('微信登录失败', e)
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  } finally {
    popupLoading.value = false
  }
}

function onChooseAvatar(e: any) {
  profileAvatarTemp.value = e.detail.avatarUrl
}

async function onProfileSubmit() {
  if (!profileNickName.value.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  if (!profileAvatarTemp.value) {
    uni.showToast({ title: '请选择头像', icon: 'none' })
    return
  }
  if (popupLoading.value) return
  popupLoading.value = true
  try {
    await userStore.wxLoginStep2(profileNickName.value.trim(), profileAvatarTemp.value)
    uni.showToast({ title: '注册成功', icon: 'success' })
    appStore.loadMode()
    userStore.onPopupLoginDone(true)
  } catch (e: any) {
    console.error('完善资料失败', e)
    uni.showToast({ title: '注册失败，请重试', icon: 'none' })
  } finally {
    popupLoading.value = false
  }
}
</script>

<template>
  <view class="shell">
    <!-- 用户端视图 -->
    <view v-if="visited.has('user-home')" v-show="appStore.currentTab === 'user-home'">
      <UserHome />
    </view>
    <view v-if="visited.has('user-map')" v-show="appStore.currentTab === 'user-map'">
      <UserMap />
    </view>
    <view v-if="visited.has('user-mine')" v-show="appStore.currentTab === 'user-mine'">
      <UserMine />
    </view>

    <!-- 管理端视图 -->
    <view v-if="visited.has('admin-map')" v-show="appStore.currentTab === 'admin-map'">
      <AdminMap />
    </view>
    <view v-if="visited.has('admin-dashboard')" v-show="appStore.currentTab === 'admin-dashboard'">
      <AdminDashboard />
    </view>
    <view v-if="visited.has('admin-property-list')" v-show="appStore.currentTab === 'admin-property-list'">
      <AdminPropertyList />
    </view>
    <view v-if="visited.has('admin-sales-control')" v-show="appStore.currentTab === 'admin-sales-control'">
      <AdminSalesControl />
    </view>
    <view v-if="visited.has('admin-mine')" v-show="appStore.currentTab === 'admin-mine'">
      <AdminMine />
    </view>

    <!-- Shell 自身的 tabbar (visible=true 覆盖 inject) -->
    <sl-custom-tabbar :current="tabIndex" :visible="true" @change="onTabChange" />

    <!-- 登录弹窗遮罩 -->
    <view v-if="userStore.showLoginPopup" class="login-overlay">
      <!-- 第一步：微信一键登录 -->
      <view v-if="userStore.popupStep === 'login'" class="login-modal">
        <view class="login-logo">
          <text class="login-logo-text">深乐租</text>
        </view>
        <text class="login-title">登录后继续使用</text>
        <button class="login-wx-btn" :disabled="popupLoading" @tap="onPopupWxLogin">
          <text class="login-wx-icon">W</text>
          <text>{{ popupLoading ? '登录中...' : '微信一键登录' }}</text>
        </button>
        <text class="login-tip">登录即表示同意《用户服务协议》和《隐私政策》</text>
      </view>

      <!-- 第二步：完善资料 -->
      <view v-if="userStore.popupStep === 'profile'" class="login-modal">
        <text class="login-title">完善个人资料</text>
        <text class="login-subtitle">设置头像和昵称后即可使用</text>

        <!-- 头像选择 -->
        <button class="avatar-chooser" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
          <image
            v-if="profileAvatarTemp"
            class="avatar-preview"
            :src="profileAvatarTemp"
            mode="aspectFill"
          />
          <view v-else class="avatar-placeholder">
            <text class="avatar-placeholder-icon">+</text>
            <text class="avatar-placeholder-text">选择头像</text>
          </view>
        </button>

        <!-- 昵称输入 -->
        <input
          class="nickname-input"
          type="nickname"
          v-model="profileNickName"
          placeholder="请输入昵称"
        />

        <!-- 提交按钮 -->
        <button class="login-wx-btn" :disabled="popupLoading" @tap="onProfileSubmit">
          <text>{{ popupLoading ? '提交中...' : '完成注册' }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.shell {
  min-height: 100vh;
  background-color: $sl-bg-page;
}

/* ─── 登录弹窗 ─── */
.login-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.login-modal {
  width: 600rpx;
  background-color: $sl-bg-card;
  border-radius: 24rpx;
  padding: 60rpx 48rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
}

.login-logo {
  width: 120rpx;
  height: 120rpx;
  border-radius: 24rpx;
  background-color: $sl-primary;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-logo-text {
  font-size: 32rpx;
  color: #ffffff;
  font-weight: 700;
}

.login-title {
  font-size: $sl-font-lg;
  color: $sl-text-primary;
  font-weight: 600;
}

.login-wx-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background-color: #07c160;
  color: #ffffff;
  font-size: $sl-font-md;
  font-weight: 600;
  border-radius: 44rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $sl-spacing-sm;

  &[disabled] {
    opacity: 0.6;
  }
}

.login-wx-icon {
  width: 40rpx;
  height: 40rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
}

.login-tip {
  font-size: $sl-font-xs;
  color: $sl-text-placeholder;
  text-align: center;
}

.login-subtitle {
  font-size: $sl-font-sm;
  color: $sl-text-secondary;
}

.avatar-chooser {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  padding: 0;
  margin: 0;
  background-color: transparent;
  border: none;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  &::after {
    border: none;
  }
}

.avatar-preview {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
}

.avatar-placeholder {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background-color: $sl-bg-page;
  border: 2rpx dashed $sl-border-color;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.avatar-placeholder-icon {
  font-size: 48rpx;
  color: $sl-text-placeholder;
  line-height: 1;
}

.avatar-placeholder-text {
  font-size: $sl-font-xs;
  color: $sl-text-placeholder;
}

.nickname-input {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid $sl-border-color;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  box-sizing: border-box;
}
</style>
