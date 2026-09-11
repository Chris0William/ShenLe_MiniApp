<script setup lang="ts">
import { onReady, onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getEnrollmentStatus, submitEnrollment } from '@/api/landlord-enrollment'
import { getMyAccess } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { useLandlordShareStore } from '@/store/landlord-share'
import { modeStore } from '@/store/mode'
import { tabbarStore } from '@/tabbar/store'
import { enrollmentDestination, LANDLORD_ENROLLMENT_BLOCKED, LANDLORD_ENROLLMENT_PATH } from '@/utils/landlord-enrollment'
import { requestLogin } from '@/utils/login-flow'

definePage({ style: { navigationBarTitleText: '申请成为房东' } })
const auth = useShenleAuthStore()
const loading = ref(false)
const ready = ref(false)
const state = ref<'login' | 'blocked' | 'apply' | 'error'>('login')
const status = ref(0)
const error = ref('')
const saving = ref(false)

async function check() {
  if (loading.value)
    return
  if (!auth.isLogin) {
    state.value = 'login'
    return
  }
  loading.value = true
  try {
    const access = await getMyAccess()
    const destination = enrollmentDestination(access)
    if (destination === 'blocked') {
      state.value = 'blocked'
      return
    }
    if (destination === 'landlord') {
      await auth.refreshUser(true)
      modeStore.setMode('landlord')
      tabbarStore.setCurIdx(1)
      uni.reLaunch({ url: '/pages/admin/sales-control/index' })
      return
    }
    status.value = await getEnrollmentStatus()
    state.value = 'apply'
  }
  catch (e) {
    state.value = auth.isLogin ? 'error' : 'login'
    error.value = e instanceof Error ? e.message : '读取申请状态失败'
  }
  finally {
    loading.value = false
  }
}

function login() {
  return requestLogin({ reason: '登录后申请成为房东', redirect: LANDLORD_ENROLLMENT_PATH })
}

function goHome() {
  uni.reLaunch({ url: '/pages/user/map/index' })
}

async function submit() {
  if (saving.value)
    return
  saving.value = true
  try {
    await submitEnrollment()
    status.value = 1
  }
  finally {
    saving.value = false
  }
}

onReady(async () => {
  ready.value = true
  useLandlordShareStore().clear()
  await check()
  if (state.value === 'login')
    void login()
})
onShow(() => {
  if (ready.value)
    void check()
})
</script>

<template>
  <view class="sl-page enrollment-page">
    <wd-loading v-if="loading" color="#126b4f" />
    <template v-else>
      <text class="enrollment-title">申请成为房东</text>
      <template v-if="state === 'login'">
        <wd-button block type="success" @click="login">
          微信注册 / 登录
        </wd-button>
      </template>
      <text v-else-if="state === 'blocked'" class="enrollment-message">{{ LANDLORD_ENROLLMENT_BLOCKED }}</text>
      <template v-else-if="state === 'error'">
        <text class="enrollment-message">{{ error }}</text>
        <wd-button plain block @click="check">
          重试
        </wd-button>
      </template>
      <template v-else>
        <text class="enrollment-name">{{ auth.displayName }}</text>
        <text v-if="status === 1" class="enrollment-message">申请已提交，等待审核</text>
        <template v-else>
          <text v-if="status === 3" class="enrollment-message">申请未通过，可重新申请</text>
          <wd-button block type="success" :loading="saving" @click="submit">
            {{ status === 3 ? '重新申请' : '提交申请' }}
          </wd-button>
        </template>
      </template>
      <wd-button plain block @click="goHome">
        返回首页
      </wd-button>
    </template>
    <sl-login-consent />
  </view>
</template>

<style scoped>
.enrollment-page {
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.enrollment-title {
  font-size: 36rpx;
  font-weight: 700;
  color: var(--sl-ink);
}
.enrollment-name {
  font-size: 30rpx;
}
.enrollment-message {
  font-size: 28rpx;
  line-height: 1.7;
  color: var(--sl-muted);
}
</style>
