<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { tabbarStore } from '@/tabbar/store'
import { requestLogin } from '@/utils/login-flow'

definePage({
  style: {
    navigationBarTitleText: '登录确认',
  },
})

const auth = useShenleAuthStore()
const loading = ref(false)
const denied = ref(false)
const redirect = ref('/pages/user/map/index')

function goAfterLogin(showToast = true) {
  modeStore.setMode('user')
  tabbarStore.setCurIdx(0)
  if (showToast)
    uni.showToast({ title: '登录成功', icon: 'success' })
  const target = redirect.value && !redirect.value.includes('/pages/common/login') ? redirect.value : '/pages/user/map/index'
  setTimeout(() => uni.reLaunch({ url: target }), showToast ? 300 : 0)
}

async function startLogin() {
  if (loading.value)
    return
  loading.value = true
  try {
    await requestLogin({
      reason: denied.value ? '当前账号暂无管理权限，可重新登录其他微信账号' : '登录后可申请使用并查看完整房源服务',
      redirect: redirect.value,
      onSuccess: () => modeStore.setMode('user'), // 跳转由 finishLogin 统一 reLaunch 处理
    })
  }
  finally {
    loading.value = false
  }
}

function goHome() {
  uni.reLaunch({ url: '/pages/user/map/index' })
}

onLoad(async (query) => {
  if (typeof query?.redirect === 'string' && query.redirect.startsWith('/pages/'))
    redirect.value = decodeURIComponent(query.redirect)

  denied.value = query?.denied === '1'

  if (auth.isLogin) {
    loading.value = true
    try {
      await auth.refreshUser(true).catch(() => {})
      goAfterLogin(false)
    }
    finally {
      loading.value = false
    }
  }
})
</script>

<template>
  <view class="sl-page login-page">
    <view class="login-card sl-card">
      <view class="login-mark" :class="{ 'login-mark--warn': denied }">
        <wd-icon :name="denied ? 'warn-bold' : 'user'" size="42px" :color="denied ? '#b46d08' : '#126b4f'" />
      </view>
      <text class="card-title">{{ denied ? '当前账号暂无管理权限' : '登录后继续' }}</text>
      <text class="card-desc">
        {{ denied ? '如需进入管理端，请使用已开通管理员权限的微信账号登录。' : '为了保护房源数据，查看完整信息或提交申请前需要先登录。' }}
      </text>
      <wd-button block type="success" :loading="loading" @click="startLogin">
        {{ denied ? '重新登录' : '登录' }}
      </wd-button>
      <wd-button plain block @click="goHome">
        先看看
      </wd-button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.login-page {
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
  padding-bottom: 80rpx;
}

.login-card {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 46rpx 32rpx 36rpx;
}

.login-mark {
  display: flex;
  width: 118rpx;
  height: 118rpx;
  align-items: center;
  justify-content: center;
  border-radius: 36rpx;
  background: #ecf5ee;
}

.login-mark--warn {
  background: #fff2d7;
}

.card-title {
  color: var(--sl-ink);
  font-size: 36rpx;
  font-weight: 900;
}

.card-desc {
  max-width: 560rpx;
  color: var(--sl-muted);
  font-size: 26rpx;
  line-height: 1.6;
  text-align: center;
}
</style>
