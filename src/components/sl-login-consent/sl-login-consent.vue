<script setup lang="ts">
import type { LoginRequestOptions, LoginRequestPayload } from '@/utils/login-flow'
import { onShow } from '@dcloudio/uni-app'
import { onMounted, onUnmounted, ref } from 'vue'
import { useShenleAuthStore } from '@/store/auth'
import { LOGIN_REQUEST_EVENT } from '@/utils/login-flow'

const auth = useShenleAuthStore()
const agreementVisible = ref(false)
const profileVisible = ref(false)
const phoneVisible = ref(false)
const loading = ref(false)
const currentRequest = ref<LoginRequestPayload | null>(null)
const profileNickName = ref('')
const profileAvatarTemp = ref('')
const ownerRoute = ref('')

function normalizeRoute(route?: string) {
  if (!route)
    return ''
  return route.startsWith('/') ? route : `/${route}`
}

function getActiveRoute() {
  const pages = getCurrentPages()
  return normalizeRoute(pages[pages.length - 1]?.route)
}

function refreshOwnerRoute() {
  ownerRoute.value = getActiveRoute()
}

function handleRequest(payload: LoginRequestPayload) {
  if (payload.hostRoute !== ownerRoute.value)
    return
  if (payload.handled)
    return
  payload.handled = true
  if (auth.isLogin) {
    payload.onSuccess?.()
    return
  }
  currentRequest.value = payload
  profileVisible.value = false
  phoneVisible.value = false
  agreementVisible.value = true
}

function open(options: LoginRequestOptions = {}) {
  handleRequest({
    ...options,
    handled: false,
    hostRoute: ownerRoute.value || getActiveRoute(),
    redirect: options.redirect || getActiveRoute(),
    onSuccess: options.onSuccess,
    onCancel: options.onCancel,
  })
}

function openAgreement(type: 'service' | 'privacy') {
  uni.navigateTo({ url: `/pages/common/agreement/index?type=${type}` })
}

function cancelAgreement() {
  if (loading.value)
    return
  agreementVisible.value = false
  currentRequest.value?.onCancel?.()
  currentRequest.value = null
}

function resetProfile() {
  profileNickName.value = ''
  profileAvatarTemp.value = ''
}

function finishLogin() {
  agreementVisible.value = false
  profileVisible.value = false
  phoneVisible.value = false
  const req = currentRequest.value
  currentRequest.value = null
  resetProfile()
  uni.showToast({ title: '登录成功', icon: 'success' })
  // 回调只做非跳转副作用（settle promise / setMode 等）
  req?.onSuccess?.()
  // 登录成功统一“大刷新”：reLaunch 回触发页，重建页面 → onLoad 按新身份重新拉取数据
  const target = req?.redirect || getActiveRoute()
  setTimeout(() => uni.reLaunch({ url: target }), 300)
}

async function agreeAndLogin() {
  if (loading.value)
    return
  loading.value = true
  try {
    const result = await auth.wxLoginStep1()
    if (result === 'needProfile') {
      agreementVisible.value = false
      profileVisible.value = true
      return
    }
    if (result === 'needPhone') {
      agreementVisible.value = false
      phoneVisible.value = true
      return
    }
    finishLogin()
  }
  catch (error) {
    console.error('微信登录失败', error)
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}

function onChooseAvatar(event: any) {
  profileAvatarTemp.value = event.detail?.avatarUrl || ''
}

function cancelProfile() {
  if (loading.value)
    return
  profileVisible.value = false
  currentRequest.value?.onCancel?.()
  currentRequest.value = null
  resetProfile()
}

function getPhoneCode(event: any) {
  const code = event.detail?.code as string | undefined
  if (!code)
    uni.showToast({ title: '需要授权手机号才能完成登录', icon: 'none' })
  return code || ''
}

function cancelPhone() {
  if (loading.value)
    return
  phoneVisible.value = false
  currentRequest.value?.onCancel?.()
  currentRequest.value = null
}

async function submitPhone(event: any) {
  const phoneCode = getPhoneCode(event)
  if (!phoneCode || loading.value)
    return
  loading.value = true
  try {
    await auth.wxLoginWithPhone(phoneCode)
    finishLogin()
  }
  catch (error) {
    console.error('手机号授权登录失败', error)
    uni.showToast({ title: '手机号授权失败，请重试', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}

async function submitProfile(event: any) {
  const nickName = profileNickName.value.trim()
  if (!profileAvatarTemp.value) {
    uni.showToast({ title: '请先选择头像', icon: 'none' })
    return
  }
  if (!nickName) {
    uni.showToast({ title: '请填写昵称', icon: 'none' })
    return
  }
  const phoneCode = getPhoneCode(event)
  if (!phoneCode)
    return
  if (loading.value)
    return
  loading.value = true
  try {
    await auth.wxLoginStep2(nickName, profileAvatarTemp.value, phoneCode)
    finishLogin()
  }
  catch (error) {
    console.error('完善资料失败', error)
    uni.showToast({ title: '资料提交失败，请重试', icon: 'none' })
  }
  finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshOwnerRoute()
  setTimeout(refreshOwnerRoute, 50)
  uni.$on(LOGIN_REQUEST_EVENT, handleRequest as any)
})

onShow(refreshOwnerRoute)

onUnmounted(() => {
  uni.$off(LOGIN_REQUEST_EVENT, handleRequest as any)
})

defineExpose({ open })
</script>

<template>
  <wd-popup v-model="agreementVisible" :z-index="3000" custom-style="border-radius: 28rpx; overflow: hidden; width: 650rpx;" @touchmove.stop.prevent>
    <view class="login-consent" @touchmove.stop.prevent>
      <view class="login-consent__mark">
        <wd-icon name="user" size="34px" color="#126b4f" />
      </view>
      <text class="login-consent__title">登录后继续使用</text>
      <text class="login-consent__desc">{{ currentRequest?.reason || '登录后可申请使用并查看完整房源服务。' }}</text>
      <view class="login-consent__agreement">
        <text>请先阅读并同意</text>
        <text class="login-consent__link" @tap.stop="openAgreement('service')">《用户服务协议》</text>
        <text>和</text>
        <text class="login-consent__link" @tap.stop="openAgreement('privacy')">《隐私政策》</text>
        <text>，同意后将使用当前微信身份登录。</text>
      </view>
      <view class="login-consent__actions">
        <wd-button plain block :disabled="loading" @click="cancelAgreement">
          取消
        </wd-button>
        <wd-button type="success" block :loading="loading" @click="agreeAndLogin">
          同意并登录
        </wd-button>
      </view>
    </view>
  </wd-popup>

  <wd-popup v-model="profileVisible" :z-index="3001" custom-style="border-radius: 28rpx; overflow: hidden; width: 650rpx;" @touchmove.stop.prevent>
    <view class="login-consent profile-consent" @touchmove.stop.prevent>
      <text class="login-consent__title">完善账号资料</text>
      <text class="login-consent__desc">首次登录需要选择头像、填写昵称并授权手机号，用于账号展示和业务联系。</text>
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
        placeholder="请输入昵称"
        placeholder-class="nickname-placeholder"
      >
      <view class="login-consent__actions">
        <wd-button plain block :disabled="loading" @click="cancelProfile">
          取消
        </wd-button>
        <button class="phone-auth-button" open-type="getPhoneNumber" :disabled="loading" @getphonenumber="submitProfile">
          {{ loading ? '正在登录...' : '授权手机号并登录' }}
        </button>
      </view>
    </view>
  </wd-popup>

  <wd-popup v-model="phoneVisible" :z-index="3002" custom-style="border-radius: 28rpx; overflow: hidden; width: 650rpx;" @touchmove.stop.prevent>
    <view class="login-consent" @touchmove.stop.prevent>
      <view class="login-consent__mark">
        <wd-icon name="phone" size="34px" color="#126b4f" />
      </view>
      <text class="login-consent__title">授权手机号</text>
      <text class="login-consent__desc">当前账号尚未绑定手机号，授权后即可继续登录。</text>
      <view class="login-consent__actions">
        <wd-button plain block :disabled="loading" @click="cancelPhone">
          取消
        </wd-button>
        <button class="phone-auth-button" open-type="getPhoneNumber" :disabled="loading" @getphonenumber="submitPhone">
          {{ loading ? '正在登录...' : '授权并登录' }}
        </button>
      </view>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.login-consent {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22rpx;
  padding: 42rpx 34rpx 34rpx;
  background: #fffdfa;
}

.login-consent__mark {
  display: flex;
  width: 112rpx;
  height: 112rpx;
  align-items: center;
  justify-content: center;
  border-radius: 34rpx;
  background: #ecf5ee;
}

.login-consent__title {
  color: var(--sl-ink);
  font-size: 34rpx;
  font-weight: 900;
}

.login-consent__desc {
  color: var(--sl-muted);
  font-size: 25rpx;
  line-height: 1.55;
  text-align: center;
}

.login-consent__agreement {
  padding: 20rpx 22rpx;
  border-radius: 22rpx;
  background: #f5f8f3;
  color: #5e756a;
  font-size: 23rpx;
  line-height: 1.7;
}

.login-consent__link {
  color: #126b4f;
  font-weight: 850;
}

.login-consent__actions {
  display: grid;
  width: 100%;
  grid-template-columns: 1fr 1fr;
  gap: 18rpx;
  margin-top: 6rpx;
}

.phone-auth-button {
  display: flex;
  height: 88rpx;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0 18rpx;
  border: 0;
  border-radius: 16rpx;
  background: #126b4f;
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1;
}

.phone-auth-button::after {
  border: 0;
}

.phone-auth-button[disabled] {
  background: #8eb5a7;
  color: rgba(255, 255, 255, 0.86);
}

.profile-consent {
  padding-top: 38rpx;
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
