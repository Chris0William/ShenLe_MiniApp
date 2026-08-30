<script setup lang="ts">
import { ref } from 'vue'
import { createLandlordShareCode } from '@/api/landlord-share'

const visible = ref(false)
const loading = ref(false)
const code = ref<{ qrPngBase64: string, ownerName: string, communityCount: number, expiresAt: string } | null>(null)

async function loadCode() {
  if (loading.value)
    return
  loading.value = true
  try {
    code.value = await createLandlordShareCode()
  }
  finally {
    loading.value = false
  }
}

async function open() {
  visible.value = true
  if (!code.value)
    await loadCode()
}

function close() {
  visible.value = false
}

defineExpose({ open, close })
</script>

<template>
  <wd-popup v-model="visible" position="center" :z-index="2500" custom-style="width: 620rpx; border-radius: 18rpx; overflow: hidden;">
    <view class="sheet">
      <view class="sheet__head">
        <text class="sheet__title">分享我的楼盘</text>
        <view class="sheet__close" role="button" aria-label="关闭" @tap="close">
          <wd-icon name="close" size="20px" color="#72817b" />
        </view>
      </view>
      <view v-if="loading && !code" class="loading">
        <wd-loading color="#126b4f" />
        <text>正在生成二维码</text>
      </view>
      <template v-else-if="code">
        <text class="sheet__owner">{{ code.ownerName }} · {{ code.communityCount }} 个楼盘</text>
        <image class="qr" :src="code.qrPngBase64" mode="aspectFit" show-menu-by-longpress />
        <text class="sheet__hint">扫码后可查看我的楼盘房源</text>
        <wd-button plain block type="success" :loading="loading" @click="loadCode">
          刷新二维码
        </wd-button>
      </template>
    </view>
  </wd-popup>
</template>

<style scoped lang="scss">
.sheet {
  padding: 30rpx 28rpx 34rpx;
  background: #fff;
  text-align: center;
}
.sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet__title {
  color: var(--sl-ink);
  font-size: 31rpx;
  font-weight: 850;
}
.sheet__close {
  display: flex;
  width: 52rpx;
  height: 52rpx;
  align-items: center;
  justify-content: center;
  border-radius: 999rpx;
  background: #f2f6f3;
}
.sheet__owner {
  display: block;
  margin-top: 18rpx;
  color: var(--sl-muted);
  font-size: 23rpx;
}
.qr {
  display: block;
  width: 440rpx;
  height: 440rpx;
  margin: 22rpx auto 12rpx;
}
.sheet__hint,
.loading {
  color: var(--sl-muted);
  font-size: 22rpx;
}
.sheet__hint {
  display: block;
  margin-bottom: 22rpx;
}
.loading {
  display: flex;
  min-height: 500rpx;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14rpx;
}
</style>
