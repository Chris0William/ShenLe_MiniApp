<script setup lang="ts">
import { API_ENV_LABEL, APP_CHANNEL, APP_VERSION } from '@/utils/app-info'

definePage({
  style: {
    navigationBarTitleText: '关于',
  },
})
</script>

<template>
  <view class="about-page">
    <view class="about-card sl-card">
      <view class="about-brand">
        <text class="about-brand__name">深乐租</text>
        <text class="about-brand__version">v{{ APP_VERSION }}</text>
      </view>
      <view class="about-row">
        <text class="about-row__label">版本号</text>
        <text class="about-row__value">{{ APP_VERSION }}</text>
      </view>
      <view class="about-row">
        <text class="about-row__label">运行渠道</text>
        <text class="about-row__value">{{ APP_CHANNEL }}</text>
      </view>
      <view class="about-row">
        <text class="about-row__label">接口环境</text>
        <text
          class="about-row__value"
          :class="{ 'about-row__value--test': API_ENV_LABEL === '测试环境' }"
        >{{ API_ENV_LABEL }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.about-page {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 24rpx;
  background: var(--sl-bg);
}

.about-card {
  padding: 40rpx 32rpx;
}

.about-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 24rpx 0 40rpx;
  border-bottom: 1rpx solid var(--sl-line);
}

.about-brand__name {
  font-size: 40rpx;
  font-weight: 700;
  color: var(--sl-brand);
}

.about-brand__version {
  font-size: 26rpx;
  color: var(--sl-muted);
}

.about-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 8rpx;

  & + .about-row {
    border-top: 1rpx solid var(--sl-line);
  }
}

.about-row__label {
  font-size: 28rpx;
  color: var(--sl-muted);
}

.about-row__value {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--sl-ink);

  &--test {
    color: var(--sl-brand-2);
  }
}
</style>
