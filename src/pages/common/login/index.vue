<script setup lang="ts">
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'

const userStore = useUserStore()
const appStore = useAppStore()

const loading = ref(false)
const showAccountForm = ref(false)
const account = ref('')
const password = ref('')

// 两步微信登录
const step = ref<'login' | 'profile'>('login')
const profileNickName = ref('')
const profileAvatarTemp = ref('')

/** 微信一键登录（第一步） */
async function onWxLogin() {
  if (loading.value) return
  loading.value = true
  try {
    const result = await userStore.wxLoginStep1()
    if (result === 'done') {
      uni.showToast({ title: '登录成功', icon: 'success' })
      appStore.loadMode()
      setTimeout(() => uni.reLaunch({ url: '/pages/shell/index' }), 500)
    } else {
      step.value = 'profile'
    }
  } catch (e: any) {
    console.error('微信登录失败', e)
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function onChooseAvatar(e: any) {
  profileAvatarTemp.value = e.detail.avatarUrl
}

/** 完善资料提交（第二步） */
async function onProfileSubmit() {
  if (!profileNickName.value.trim()) {
    uni.showToast({ title: '请输入昵称', icon: 'none' })
    return
  }
  if (!profileAvatarTemp.value) {
    uni.showToast({ title: '请选择头像', icon: 'none' })
    return
  }
  if (loading.value) return
  loading.value = true
  try {
    await userStore.wxLoginStep2(profileNickName.value.trim(), profileAvatarTemp.value)
    uni.showToast({ title: '注册成功', icon: 'success' })
    appStore.loadMode()
    setTimeout(() => uni.reLaunch({ url: '/pages/shell/index' }), 500)
  } catch (e: any) {
    console.error('完善资料失败', e)
    uni.showToast({ title: '注册失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}

/** 账号密码登录 */
async function onAccountLogin() {
  if (!account.value.trim()) {
    uni.showToast({ title: '请输入账号', icon: 'none' })
    return
  }
  if (!password.value.trim()) {
    uni.showToast({ title: '请输入密码', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await userStore.login({ account: account.value.trim(), password: password.value })
    uni.showToast({ title: '登录成功', icon: 'success' })
    appStore.loadMode()
    setTimeout(() => {
      uni.reLaunch({ url: '/pages/shell/index' })
    }, 500)
  } catch {
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="logo-area">
      <view class="logo">
        <text class="logo-text">深乐租</text>
      </view>
      <text class="slogan">让租房更简单</text>
    </view>

    <!-- 微信一键登录 (主操作) -->
    <view v-if="!showAccountForm && step === 'login'" class="wx-area">
      <button class="wx-btn" :disabled="loading" @tap="onWxLogin">
        <text class="wx-icon">W</text>
        <text>{{ loading ? '登录中...' : '微信一键登录' }}</text>
      </button>
      <view class="divider">
        <view class="divider-line" />
        <text class="divider-text">或</text>
        <view class="divider-line" />
      </view>
      <text class="switch-link" @tap="showAccountForm = true">使用账号密码登录</text>
    </view>

    <!-- 完善资料（微信新用户第二步） -->
    <view v-if="step === 'profile'" class="wx-area">
      <text class="profile-title">完善个人资料</text>
      <text class="profile-subtitle">设置头像和昵称后即可使用</text>
      <button class="avatar-chooser" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image v-if="profileAvatarTemp" class="avatar-preview" :src="profileAvatarTemp" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <text class="avatar-placeholder-icon">+</text>
          <text class="avatar-placeholder-text">选择头像</text>
        </view>
      </button>
      <input class="nickname-input" type="nickname" v-model="profileNickName" placeholder="请输入昵称" />
      <button class="wx-btn" :disabled="loading" @tap="onProfileSubmit">
        <text>{{ loading ? '提交中...' : '完成注册' }}</text>
      </button>
    </view>

    <!-- 账号密码表单 (次要操作) -->
    <view v-else class="form">
      <view class="input-group">
        <input
          v-model="account"
          class="input"
          placeholder="请输入账号"
          placeholder-class="input-placeholder"
          type="text"
        />
      </view>
      <view class="input-group">
        <input
          v-model="password"
          class="input"
          placeholder="请输入密码"
          placeholder-class="input-placeholder"
          password
        />
      </view>
      <button class="login-btn" :disabled="loading" @tap="onAccountLogin">
        {{ loading ? '登录中...' : '登录' }}
      </button>
      <text class="switch-link" @tap="showAccountForm = false">返回微信登录</text>
    </view>

    <text class="tip">登录即表示同意《用户服务协议》和《隐私政策》</text>
  </view>
</template>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
  background-color: $sl-bg-card;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: $sl-spacing-xl;
}

.logo-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 80rpx;
}

.logo {
  width: 160rpx;
  height: 160rpx;
  border-radius: 32rpx;
  background-color: $sl-primary;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: $sl-spacing-md;
}

.logo-text {
  font-size: $sl-font-xl;
  color: #ffffff;
  font-weight: 700;
}

.slogan {
  font-size: $sl-font-lg;
  color: $sl-text-secondary;
}

// 微信登录区域
.wx-area {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sl-spacing-lg;
}

.wx-btn {
  width: 100%;
  height: 96rpx;
  line-height: 96rpx;
  background-color: #07c160;
  color: #ffffff;
  font-size: $sl-font-lg;
  font-weight: 600;
  border-radius: 48rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $sl-spacing-sm;

  &[disabled] {
    opacity: 0.6;
  }
}

.wx-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $sl-font-md;
  font-weight: 700;
}

.divider {
  width: 100%;
  display: flex;
  align-items: center;
  gap: $sl-spacing-md;
}

.divider-line {
  flex: 1;
  height: 1rpx;
  background-color: $sl-border-color;
}

.divider-text {
  font-size: $sl-font-sm;
  color: $sl-text-placeholder;
}

.switch-link {
  font-size: $sl-font-sm;
  color: $sl-primary;
}

// 账号密码表单
.form {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: $sl-spacing-md;
}

.input-group {
  width: 100%;
  background-color: $sl-bg-page;
  border-radius: $sl-border-radius;
  padding: 0 $sl-spacing-lg;
  height: 96rpx;
  display: flex;
  align-items: center;
}

.input {
  width: 100%;
  height: 96rpx;
  font-size: $sl-font-md;
  color: $sl-text-primary;
}

.input-placeholder {
  color: $sl-text-placeholder;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background-color: $sl-primary;
  color: #ffffff;
  font-size: $sl-font-lg;
  font-weight: 600;
  border-radius: 44rpx;
  border: none;

  &[disabled] {
    opacity: 0.6;
  }
}

.tip {
  font-size: $sl-font-xs;
  color: $sl-text-placeholder;
  text-align: center;
  margin-top: 60rpx;
}

// 完善资料步骤
.profile-title {
  font-size: $sl-font-lg;
  color: $sl-text-primary;
  font-weight: 600;
}

.profile-subtitle {
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
  border-radius: $sl-border-radius;
  padding: 0 24rpx;
  font-size: $sl-font-md;
  color: $sl-text-primary;
  box-sizing: border-box;
}
</style>
