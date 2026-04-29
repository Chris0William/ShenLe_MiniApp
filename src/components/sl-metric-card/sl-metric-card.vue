<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: 'green' | 'gold' | 'red' | 'ink'
}>()
</script>

<template>
  <view class="metric" :class="`metric--${tone || 'green'}`">
    <text class="metric__label">{{ label }}</text>
    <text class="metric__value">{{ value }}</text>
    <text v-if="hint" class="metric__hint">{{ hint }}</text>
  </view>
</template>

<style scoped lang="scss">
.metric {
  min-height: 150rpx;
  padding: 24rpx;
  border: 1rpx solid rgb(18 107 79 / 8%);
  border-radius: 22rpx;
  background: #fff;
  box-shadow: var(--sl-shadow);
}

.metric__label {
  display: block;
  color: var(--sl-muted);
  font-size: 24rpx;
}

.metric__value {
  display: block;
  margin-top: 12rpx;
  color: var(--sl-ink);
  font-size: 42rpx;
  font-weight: 850;
  line-height: 1;
}

.metric__hint {
  display: block;
  margin-top: 12rpx;
  color: var(--sl-muted);
  font-size: 22rpx;
}

.metric--gold .metric__value {
  color: #bf7412;
}

.metric--red .metric__value {
  color: var(--sl-danger);
}

.metric--ink .metric__value {
  color: #263a32;
}
</style>
