<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: 'green' | 'gold' | 'red' | 'ink'
}>()

// 数值型 value 播放 count-up；字符串（如 ¥1,200、3/5）直接显示
const displayed = ref<string | number>(props.value)
const animating = ref(false)

watch(() => props.value, (next) => {
  if (typeof next !== 'number') {
    displayed.value = next
    return
  }
  const from = typeof displayed.value === 'number' ? displayed.value : 0
  const to = next
  const duration = 600
  const startAt = Date.now()
  animating.value = true
  const tick = () => {
    const t = Math.min(1, (Date.now() - startAt) / duration)
    // ease-out cubic
    const eased = 1 - Math.pow(1 - t, 3)
    displayed.value = Math.round(from + (to - from) * eased)
    if (t < 1)
      setTimeout(tick, 16)
    else
      animating.value = false
  }
  tick()
}, { immediate: true })
</script>

<template>
  <view class="metric" :class="`metric--${tone || 'green'}`">
    <text class="metric__label">{{ label }}</text>
    <text class="metric__value" :class="{ 'metric__value--counting': animating }">{{ displayed }}</text>
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
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.metric__value--counting {
  opacity: 0.85;
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
