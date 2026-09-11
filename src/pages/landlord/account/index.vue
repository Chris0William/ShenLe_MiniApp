<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { setMyNickName } from '@/api/auth'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { useSourceContactStore } from '@/store/source-contact'
import { tabbarStore } from '@/tabbar/store'
import { useSafeTopStyle } from '@/utils/safe-area'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '房东端账户',
  },
})

const safeTop = useSafeTopStyle()
const auth = useShenleAuthStore()
const sourceContact = useSourceContactStore()
const nicknameVisible = ref(false)
const nicknameDraft = ref('')
const nicknameSaving = ref(false)

const stats = computed(() => [
  { label: '楼盘', value: sourceContact.profile?.communityCount || 0 },
  { label: '楼栋', value: sourceContact.profile?.buildingCount || 0 },
  { label: '房源', value: sourceContact.profile?.propertyCount || 0 },
  { label: '推广', value: sourceContact.profile?.promotedCount || 0 },
])

function goBack() {
  uni.navigateBack()
}

function openNicknameEditor() {
  nicknameDraft.value = auth.user?.nickName || sourceContact.profile?.nickName || ''
  nicknameVisible.value = true
}

async function saveNickname() {
  const nickName = nicknameDraft.value.trim()
  if (!nickName) {
    uni.showToast({ title: '昵称不能为空', icon: 'none' })
    return
  }
  nicknameSaving.value = true
  try {
    await setMyNickName(nickName)
    await auth.refreshUser(true)
    sourceContact.invalidate()
    await sourceContact.load(true)
    nicknameVisible.value = false
    uni.showToast({ title: '昵称已更新', icon: 'success' })
  }
  finally {
    nicknameSaving.value = false
  }
}

function callPhone(phone?: string | null) {
  if (!phone) {
    uni.showToast({ title: '暂未设置联系电话', icon: 'none' })
    return
  }
  uni.makePhoneCall({ phoneNumber: phone })
}

function switchMode(mode: 'user' | 'admin') {
  if (auth.isLandlordOnly)
    return
  modeStore.setMode(mode)
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' })
}

async function signOut() {
  const result = await new Promise<UniApp.ShowModalRes>((resolve) => {
    uni.showModal({ title: '退出登录', content: '确定退出当前账号？', success: resolve })
  })
  if (!result.confirm)
    return
  await auth.signOut()
  sourceContact.clear()
  tabbarStore.setCurIdx(0)
  uni.reLaunch({ url: '/pages/user/map/index' })
}

onShow(async () => {
  try {
    await auth.refreshAccess(true)
    if (auth.canEnterLandlordPortal)
      await sourceContact.load()
  }
  catch {
    uni.showToast({ title: '身份信息刷新失败，请重试', icon: 'none', duration: 3000 })
  }
})
</script>

<template>
  <view class="account-page" :style="safeTop">
    <view class="account-head">
      <view class="head-icon" @tap="goBack">
        <wd-icon name="arrow-left" size="21px" color="#126b4f" />
      </view>
      <text class="account-head__title">账户与支持</text>
      <view class="head-spacer" />
    </view>

    <scroll-view scroll-y class="account-scroll">
      <view class="profile-block">
        <image class="avatar" :src="auth.user?.avatar || '/static/images/default-avatar.png'" mode="aspectFill" />
        <view class="profile-block__main">
          <text class="profile-block__name">{{ sourceContact.profile?.nickName || auth.displayName }}</text>
          <text class="profile-block__role">房东</text>
          <text v-if="sourceContact.profile?.phone" class="profile-block__phone">{{ sourceContact.profile.phone }}</text>
        </view>
        <wd-button size="small" plain @click="openNicknameEditor">
          修改昵称
        </wd-button>
      </view>

      <view class="stats-grid">
        <view v-for="item in stats" :key="item.label" class="stats-item">
          <text class="stats-item__value">{{ item.value }}</text>
          <text class="stats-item__label">{{ item.label }}</text>
        </view>
      </view>

      <view class="section-title">
        主维护人
      </view>
      <view class="support-card" @tap="callPhone(sourceContact.profile?.supportUserPhone)">
        <view class="support-card__icon">
          <wd-icon name="service" size="23px" color="#126b4f" />
        </view>
        <view class="support-card__main">
          <text class="support-card__name">{{ sourceContact.profile?.supportUserName || '暂未分配' }}</text>
          <text class="support-card__desc">协助维护楼盘信息、资料及处理系统问题</text>
          <text v-if="sourceContact.profile?.supportUserPhone" class="support-card__phone">{{ sourceContact.profile.supportUserPhone }}</text>
        </view>
        <wd-icon v-if="sourceContact.profile?.supportUserPhone" name="phone" size="20px" color="#126b4f" />
      </view>

      <view v-if="!auth.isLandlordOnly" class="section-title">
        切换视图
      </view>
      <view v-if="!auth.isLandlordOnly" class="action-list">
        <view class="action-row" @tap="switchMode('user')">
          <wd-icon name="view" size="20px" color="#126b4f" />
          <text>切换到业务员端</text>
          <wd-icon name="arrow-right" size="18px" color="#8fa098" />
        </view>
        <view v-if="auth.canEnterAdmin" class="action-row" @tap="switchMode('admin')">
          <wd-icon name="setting" size="20px" color="#126b4f" />
          <text>切换到管理端</text>
          <wd-icon name="arrow-right" size="18px" color="#8fa098" />
        </view>
      </view>

      <wd-button plain block type="error" custom-class="logout-button" @click="signOut">
        退出登录
      </wd-button>
    </scroll-view>

    <wd-popup v-model="nicknameVisible" :z-index="2100" custom-style="border-radius: 8rpx; overflow: hidden; width: 640rpx;" @touchmove.stop.prevent>
      <view class="nickname-dialog">
        <text class="nickname-dialog__title">修改昵称</text>
        <wd-input v-model="nicknameDraft" placeholder="请输入昵称" clearable :maxlength="32" />
        <view class="nickname-dialog__actions">
          <wd-button plain @click="nicknameVisible = false">
            取消
          </wd-button>
          <wd-button type="primary" :loading="nicknameSaving" @click="saveNickname">
            保存
          </wd-button>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped lang="scss">
.account-page {
  display: flex;
  width: 100%;
  height: 100vh;
  padding: 0 24rpx 24rpx;
  box-sizing: border-box;
  overflow: hidden;
  flex-direction: column;
}

.account-head {
  display: flex;
  min-height: 76rpx;
  flex: none;
  align-items: center;
  justify-content: space-between;
}

.account-head__title {
  font-size: 32rpx;
  font-weight: 800;
}

.head-icon,
.head-spacer {
  width: 66rpx;
  height: 66rpx;
}

.head-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1rpx solid rgb(18 107 79 / 14%);
  border-radius: 8rpx;
  background: #fff;
}

.account-scroll {
  min-height: 0;
  flex: 1;
}

.profile-block,
.support-card,
.action-row,
.stats-grid {
  border: 1rpx solid rgb(18 107 79 / 10%);
  border-radius: 8rpx;
  background: #fff;
}

.profile-block {
  display: flex;
  min-height: 150rpx;
  align-items: center;
  margin-top: 14rpx;
  padding: 22rpx;
  gap: 18rpx;
}

.avatar {
  width: 92rpx;
  height: 92rpx;
  flex: none;
  border-radius: 50%;
  background: #e9efeb;
}

.profile-block__main,
.support-card__main {
  min-width: 0;
  flex: 1;
}

.profile-block__name,
.profile-block__role,
.profile-block__phone,
.support-card__name,
.support-card__desc,
.support-card__phone {
  display: block;
}

.profile-block__name,
.support-card__name {
  font-size: 28rpx;
  font-weight: 800;
}

.profile-block__role,
.profile-block__phone,
.support-card__desc {
  margin-top: 5rpx;
  color: #72817b;
  font-size: 21rpx;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 14rpx;
}

.stats-item {
  position: relative;
  display: flex;
  min-height: 92rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 5rpx;
}

.stats-item + .stats-item::before {
  position: absolute;
  top: 20rpx;
  bottom: 20rpx;
  left: 0;
  width: 1rpx;
  background: #e4eae6;
  content: '';
}

.stats-item__value {
  color: #126b4f;
  font-size: 28rpx;
  font-weight: 800;
}

.stats-item__label {
  color: #72817b;
  font-size: 20rpx;
}

.section-title {
  margin: 28rpx 2rpx 14rpx;
  font-size: 27rpx;
  font-weight: 800;
}

.support-card {
  display: flex;
  min-height: 128rpx;
  align-items: center;
  padding: 20rpx;
  gap: 16rpx;
}

.support-card__icon {
  display: flex;
  width: 66rpx;
  height: 66rpx;
  flex: none;
  align-items: center;
  justify-content: center;
  border-radius: 7rpx;
  background: #e9f4ee;
}

.support-card__phone {
  margin-top: 6rpx;
  color: #126b4f;
  font-size: 21rpx;
  font-weight: 700;
}

.action-row {
  display: grid;
  min-height: 88rpx;
  align-items: center;
  padding: 0 20rpx;
  grid-template-columns: 42rpx minmax(0, 1fr) 32rpx;
  font-size: 24rpx;
}

.action-row + .action-row {
  margin-top: 12rpx;
}

:deep(.logout-button) {
  margin-top: 32rpx;
}

.nickname-dialog {
  padding: 28rpx;
}

.nickname-dialog__title {
  display: block;
  margin-bottom: 20rpx;
  font-size: 29rpx;
  font-weight: 800;
}

.nickname-dialog__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 22rpx;
  gap: 12rpx;
}
</style>
