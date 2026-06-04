<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useShenleAuthStore } from '@/store/auth'

definePage({
  style: {
    navigationBarTitleText: '微信授权登录',
  },
})

const auth = useShenleAuthStore()
const loading = ref(false)
const step = ref<'login' | 'profile'>('login')
const redirect = ref('/pages/admin/dashboard/index')
const profileNickName = ref('')
const profileAvatarTemp = ref('')
const canSubmitProfile = computed(() => !!profileNickName.value.trim() && !!profileAvatarTemp.value)

function goAfterLogin() {
  const target = redirect.value || '/pages/admin/dashboard/index'
  uni.reLaunch({ url: target })
}

async function onWxLogin() {
  if (loading.value)
    return

  loading.value = true
  try {
    const result = await auth.wxLoginStep1()
    if (result === 'needProfile') {
      step.value = 'profile'
      return
    }

    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(goAfterLogin, 300)
  }
  catch (error) {
    console.error('微信授权登录失败', error)
    uni.showToast({ title: '微信授权失败，请重试', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}

function onChooseAvatar(event: any) {
  profileAvatarTemp.value = event.detail?.avatarUrl || ''
}

async function onProfileSubmit() {
  if (!canSubmitProfile.value || loading.value) {
    uni.showToast({ title: '请先选择头像并填写昵称', icon: 'none' })
    return
  }

  loading.value = true
  try {
    await auth.wxLoginStep2(profileNickName.value.trim(), profileAvatarTemp.value)
    uni.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(goAfterLogin, 300)
  }
  catch (error) {
    console.error('完善微信资料失败', error)
    uni.showToast({ title: '资料提交失败，请重试', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}

onLoad((query) => {
  if (typeof query?.redirect === 'string' && query.redirect.startsWith('/pages/'))
    redirect.value = decodeURIComponent(query.redirect)

  if (auth.isLogin)
    setTimeout(goAfterLogin, 0)
})
</script>

<template>
  <view class="sl-page login-page">
    <view class="login-bg login-bg--one" />
    <view class="login-bg login-bg--two" />

    <view class="sl-hero login-hero">
      <text class="sl-title">管理端微信授权登录</text>
      <text class="sl-subtitle">使用当前微信身份进入深乐租管理工作台，不再提供账号密码登录入口。</text>
    </view>

    <view v-if="step === 'login'" class="login-card sl-card">
      <view class="wx-mark">
        <text>微</text>
      </view>
      <text class="card-title">授权后进入管理端</text>
      <text class="card-desc">小程序会先通过 wx.login 获取微信登录凭证，再按旧版流程换取 OpenId 与后端 Token。</text>

      <wd-button block type="success" :loading="loading" @click="onWxLogin">
        {{ loading ? '授权中...' : '微信授权登录' }}
      </wd-button>

      <view class="login-note">
        <wd-icon name="info-circle" size="16px" color="#5e756a" />
        <text>登录即表示同意《用户服务协议》和《隐私政策》</text>
      </view>
    </view>

    <view v-else class="login-card profile-card sl-card">
      <text class="card-title">完善微信资料</text>
      <text class="card-desc">首次登录需要选择头像并填写昵称，用于创建管理端用户资料。</text>

      <button class="avatar-chooser" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
        <image v-if="profileAvatarTemp" class="avatar-preview" :src="profileAvatarTemp" mode="aspectFill" />
        <view v-else class="avatar-placeholder">
          <wd-icon name="user" size="30px" color="#8ba095" />
          <text>选择头像</text>
        </view>
      </button>

      <input
        v-model="profileNickName"
        class="nickname-input"
        type="nickname"
        placeholder="请输入微信昵称"
        placeholder-class="nickname-placeholder"
      />

      <wd-button block type="success" :loading="loading" :disabled="!canSubmitProfile" @click="onProfileSubmit">
        {{ loading ? '提交中...' : '完成并登录' }}
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  padding-bottom: 56rpx;
}

.login-bg {
  position: absolute;
  z-index: 0;
  border-radius: 999rpx;
  filter: blur(6rpx);
  opacity: 0.72;
}

.login-bg--one {
  top: -120rpx;
  right: -140rpx;
  width: 360rpx;
  height: 360rpx;
  background: rgba(7, 193, 96, 0.18);
}

.login-bg--two {
  left: -180rpx;
  bottom: 120rpx;
  width: 420rpx;
  height: 420rpx;
  background: rgba(211, 169, 85, 0.16);
}

.login-hero,
.login-card {
  position: relative;
  z-index: 1;
}

.login-hero {
  margin-top: 28rpx;
}

.login-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  margin-top: 38rpx;
  padding: 42rpx 30rpx 34rpx;
}

.wx-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  border-radius: 34rpx;
  background: linear-gradient(135deg, #07c160 0%, #1d8f58 100%);
  box-shadow: 0 18rpx 42rpx rgba(7, 193, 96, 0.24);
}

.wx-mark text {
  color: #fff;
  font-size: 42rpx;
  font-weight: 900;
}

.card-title {
  color: var(--sl-ink);
  font-size: 34rpx;
  font-weight: 900;
}

.card-desc {
  max-width: 560rpx;
  color: var(--sl-muted);
  font-size: 25rpx;
  line-height: 1.55;
  text-align: center;
}

.login-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  color: #5e756a;
  font-size: 22rpx;
}

.profile-card {
  gap: 26rpx;
}

.avatar-chooser {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 168rpx;
  height: 168rpx;
  margin: 0;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 50%;
  background: transparent;
}

.avatar-chooser::after {
  border: 0;
}

.avatar-preview,
.avatar-placeholder {
  width: 168rpx;
  height: 168rpx;
  border-radius: 50%;
}

.avatar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border: 2rpx dashed rgba(18, 107, 79, 0.28);
  background: rgba(255, 255, 255, 0.7);
  color: #8ba095;
  font-size: 22rpx;
}

.nickname-input {
  width: 100%;
  height: 88rpx;
  box-sizing: border-box;
  padding: 0 26rpx;
  border: 1rpx solid rgba(18, 107, 79, 0.16);
  border-radius: 22rpx;
  background: rgba(255, 255, 255, 0.86);
  color: var(--sl-ink);
  font-size: 28rpx;
}

.nickname-placeholder {
  color: #9cac9f;
}
</style>
