<script setup lang="ts">
import type { SlUserOutput } from '@/types/shenle'
import { onLoad, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { getUserPage, setUserRole } from '@/api/user-manage'
import { useShenleAuthStore } from '@/store/auth'
import { modeStore } from '@/store/mode'
import { useSafeTopStyle } from '@/utils/safe-area'
import { resolveAssetUrl } from '@/utils/shenle'

definePage({
  style: {
    navigationStyle: 'custom',
    navigationBarTitleText: '用户管理',
    enablePullDownRefresh: true,
  },
})

const safeTop = useSafeTopStyle()
const auth = useShenleAuthStore()
const keyword = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)
const items = ref<SlUserOutput[]>([])
const loading = ref(false)
const hasLoaded = ref(false)
const finished = computed(() => total.value > 0 && items.value.length >= total.value)

async function load(reset = false) {
  if (loading.value)
    return
  if (reset) {
    page.value = 1
    items.value = []
    total.value = 0
  }
  loading.value = true
  try {
    const result = await getUserPage({ page: page.value, pageSize, keyword: keyword.value.trim() || undefined })
    total.value = result.total
    items.value = reset ? result.items : [...items.value, ...result.items]
    hasLoaded.value = true
  }
  finally {
    loading.value = false
    uni.stopPullDownRefresh()
  }
}

function roleTone(accountType: number) {
  if (accountType >= 999)
    return 'gold'
  if (accountType >= 888)
    return 'green'
  return 'gray'
}

function changeRole(item: SlUserOutput, target: number) {
  if (item.accountType >= 999) {
    uni.showToast({ title: '超级管理员只能在后台调整', icon: 'none' })
    return
  }
  if (item.accountType === target)
    return
  const label = target >= 888 ? '管理员' : '普通用户'
  uni.showModal({
    title: '调整角色',
    content: `确定将「${item.nickName || '该用户'}」设为${label}？对方需重新登录后生效。`,
    success: async (res) => {
      if (!res.confirm)
        return
      try {
        await setUserRole({ userId: item.userId, accountType: target })
        item.accountType = target
        item.accountTypeName = label
        uni.showToast({ title: '已调整', icon: 'success' })
      }
      catch {}
    },
  })
}

onLoad(() => {
  // 仅超级管理员可用；非超管或非管理模式拦回
  if (!auth.isSuperAdmin || modeStore.mode !== 'admin') {
    uni.showToast({ title: '无权限', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 600)
    return
  }
  load(true)
})
onPullDownRefresh(() => load(true))
onReachBottom(() => {
  if (!finished.value) {
    page.value += 1
    load()
  }
})
</script>

<template>
  <view class="sl-page user-page" :style="safeTop">
    <view class="head">
      <text class="head__title">用户管理</text>
      <text class="head__desc">设置小程序用户为管理员或普通用户</text>
    </view>

    <view class="search sl-card">
      <wd-icon name="search" size="20px" color="#7a8780" />
      <input v-model="keyword" class="search__input" placeholder="搜索昵称 / 账号" confirm-type="search" @confirm="load(true)">
      <wd-button size="small" type="primary" @click="load(true)">
        搜索
      </wd-button>
    </view>

    <view class="result-head">
      <text>{{ total }} 个用户</text>
    </view>

    <view class="list">
      <view v-for="item in items" :key="String(item.userId)" class="user sl-card">
        <image class="avatar" :src="resolveAssetUrl(item.avatar) || '/static/images/default-avatar.png'" mode="aspectFill" />
        <view class="user__body">
          <view class="user__top">
            <text class="user__name">{{ item.nickName || '微信用户' }}</text>
            <view class="role-tag" :class="`role-tag--${roleTone(item.accountType)}`">
              {{ item.accountTypeName }}
            </view>
          </view>
          <view v-if="item.accountType < 999" class="user__actions">
            <view class="role-btn" :class="{ active: item.accountType >= 888 }" @tap="changeRole(item, 888)">
              管理员
            </view>
            <view class="role-btn" :class="{ active: item.accountType < 888 }" @tap="changeRole(item, 666)">
              普通用户
            </view>
          </view>
          <text v-else class="user__hint">超级管理员（仅后台可调）</text>
        </view>
      </view>
    </view>

    <view v-if="loading && !items.length" class="tip">
      加载中...
    </view>
    <view v-else-if="hasLoaded && !items.length" class="tip">
      暂无用户
    </view>
    <view v-else-if="finished && items.length" class="tip">
      已经到底了
    </view>
  </view>
</template>

<style scoped lang="scss">
.user-page {
  padding-bottom: calc(60rpx + env(safe-area-inset-bottom));
}

.head {
  padding: 4rpx 2rpx 10rpx;
}

.head__title {
  display: block;
  font-size: 34rpx;
  font-weight: 850;
}

.head__desc {
  display: block;
  margin-top: 6rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}

.search {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14rpx;
  margin-top: 14rpx;
  padding: 18rpx;
}

.search__input {
  min-width: 0;
  font-size: 27rpx;
}

.result-head {
  margin: 26rpx 4rpx 14rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.user {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx;
}

.avatar {
  width: 88rpx;
  height: 88rpx;
  flex: 0 0 88rpx;
  border-radius: 999rpx;
  background: #edf2eb;
}

.user__body {
  min-width: 0;
  flex: 1;
}

.user__top {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.user__name {
  overflow: hidden;
  font-size: 29rpx;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-tag {
  flex: 0 0 auto;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  font-size: 21rpx;
  font-weight: 700;
}

.role-tag--gold {
  background: #fff2d7;
  color: #b46d08;
}

.role-tag--green {
  background: #ecf5ee;
  color: #126b4f;
}

.role-tag--gray {
  background: #f0f2f0;
  color: #6b7770;
}

.user__actions {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.role-btn {
  padding: 10rpx 26rpx;
  border: 1rpx solid rgb(18 107 79 / 18%);
  border-radius: 999rpx;
  color: #5e6c65;
  font-size: 24rpx;
  font-weight: 700;
}

.role-btn.active {
  border-color: transparent;
  background: linear-gradient(135deg, var(--sl-brand, #126b4f), #24815f);
  color: #fff;
}

.user__hint {
  display: block;
  margin-top: 14rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.tip {
  padding: 30rpx;
  color: var(--sl-muted);
  font-size: 24rpx;
  text-align: center;
}
</style>
