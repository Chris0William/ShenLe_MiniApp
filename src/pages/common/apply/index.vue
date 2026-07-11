<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { applyAccess, getMyAccess } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { tabbarStore } from '@/tabbar/store'

definePage({
  style: {
    navigationBarTitleText: '申请使用',
  },
})

const auth = useShenleAuthStore()
// 申请状态：0=未申请，1=待审核，3=已拒绝
const applyStatus = ref(0)
// 盘源对接人申请状态：0=未申请，1=待审核，3=已拒绝
const landlordApplyStatus = ref(0)
const loading = ref(false)
const submitting = ref(false)
const submittingLandlord = ref(false)

async function refresh() {
  if (loading.value)
    return
  loading.value = true
  try {
    const res = await getMyAccess()
    applyStatus.value = res.applyStatus
    landlordApplyStatus.value = res.landlordApplyStatus ?? 0
    // 已被通过（升到 777+）→ 刷新用户信息并进入 App
    if (res.accountType >= 777) {
      await auth.refreshUser(true).catch(() => {})
      enterApp()
    }
  }
  finally {
    loading.value = false
  }
}

function enterApp() {
  modeStore.setMode('user')
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' })
}

async function submitApply() {
  if (submitting.value)
    return
  submitting.value = true
  try {
    await applyAccess(0)
    applyStatus.value = 1
    uni.showToast({ title: '已提交申请', icon: 'success' })
  }
  catch {}
  finally {
    submitting.value = false
  }
}

async function submitLandlordApply() {
  if (submittingLandlord.value)
    return
  submittingLandlord.value = true
  try {
    await applyAccess(1)
    landlordApplyStatus.value = 1
    uni.showToast({ title: '已提交申请', icon: 'success' })
  }
  catch {}
  finally {
    submittingLandlord.value = false
  }
}

async function signOut() {
  await auth.signOut()
  uni.reLaunch({ url: '/pages/user/map/index' })
}

onShow(() => {
  // 已是普通用户及以上不该停在申请页，回首页
  if (auth.canUseApp) {
    enterApp()
    return
  }
  if (auth.isLogin)
    refresh()
})
</script>

<template>
  <view class="sl-page apply-page">
    <view class="hero">
      <view class="hero__icon">
        <wd-icon name="lock-on" size="46px" color="#126b4f" />
      </view>
      <text class="hero__title">深租宝典</text>
      <text class="hero__sub">需要管理员授权后才能使用</text>
    </view>

    <view class="card sl-card">
      <view class="profile">
        <image class="avatar" :src="auth.user?.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
        <view>
          <text class="name">{{ auth.displayName }}</text>
          <text class="meta">游客 · 待开通</text>
        </view>
      </view>

      <!-- 未申请 / 已拒绝 → 显示申请按钮 -->
      <view v-if="applyStatus !== 1" class="state">
        <text v-if="applyStatus === 3" class="state__rejected">你的申请未通过，可重新提交</text>
        <text v-else class="state__tip">提交申请后，等待管理员审核通过即可使用全部功能。</text>
        <wd-button block type="success" :loading="submitting" @click="submitApply">
          {{ applyStatus === 3 ? '重新申请' : '申请使用' }}
        </wd-button>
      </view>

      <!-- 待审核 -->
      <view v-else class="state state--pending">
        <wd-icon name="time" size="40px" color="#b46d08" />
        <text class="state__pending">申请已提交，等待管理员通过</text>
        <wd-button plain block type="success" :loading="loading" @click="refresh">
          刷新状态
        </wd-button>
      </view>

      <!-- 分隔线 -->
      <view class="divider" />

      <!-- 申请成为盘源对接人 -->
      <view class="state">
        <text class="state__tip">也可直接申请成为盘源对接人，享受更多功能。</text>
        <wd-button
          v-if="landlordApplyStatus !== 1"
          block
          type="warning"
          :loading="submittingLandlord"
          @click="submitLandlordApply"
        >
          {{ landlordApplyStatus === 3 ? '重新申请盘源对接人' : '申请成为盘源对接人' }}
        </wd-button>
        <wd-button v-else type="warning" plain disabled block>
          盘源对接人申请审核中
        </wd-button>
      </view>
    </view>

    <view class="foot" @tap="signOut">
      <text>退出登录</text>
    </view>
  </view>
</template>

<style scoped lang="scss">
.apply-page {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  padding-top: 60rpx;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
  margin-bottom: 40rpx;
}

.hero__icon {
  display: flex;
  width: 132rpx;
  height: 132rpx;
  align-items: center;
  justify-content: center;
  border-radius: 38rpx;
  background: rgb(18 107 79 / 10%);
}

.hero__title {
  font-size: 40rpx;
  font-weight: 900;
}

.hero__sub {
  color: var(--sl-muted);
  font-size: 25rpx;
}

.card {
  padding: 34rpx 28rpx;
}

.profile {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding-bottom: 26rpx;
  border-bottom: 1rpx solid var(--sl-line);
}

.avatar {
  width: 96rpx;
  height: 96rpx;
  border-radius: 999rpx;
  background: #edf2eb;
}

.name {
  display: block;
  font-size: 30rpx;
  font-weight: 850;
}

.meta {
  display: block;
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.state {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  padding-top: 28rpx;
}

.state--pending {
  align-items: center;
  text-align: center;
}

.state__tip,
.state__rejected,
.state__pending {
  color: var(--sl-muted);
  font-size: 25rpx;
  line-height: 1.6;
}

.state__rejected {
  color: var(--sl-danger);
}

.state__pending {
  color: var(--sl-ink);
  font-size: 28rpx;
  font-weight: 800;
}

.divider {
  margin-top: 28rpx;
  border-top: 1rpx solid var(--sl-line);
}

.foot {
  margin-top: auto;
  padding: 40rpx;
  color: var(--sl-muted);
  font-size: 25rpx;
  text-align: center;
}
</style>
