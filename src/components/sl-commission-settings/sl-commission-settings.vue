<script setup lang="ts">
import { computed } from 'vue'
import { normalizeCommissionPercent } from '@/utils/commission'

const props = withDefaults(defineProps<{
  modelValue?: number[]
  showSwitch?: boolean
  halfYearEnabled?: boolean
  oneYearEnabled?: boolean
  disabled?: boolean
}>(), {
  modelValue: () => [0, 0],
  showSwitch: false,
  halfYearEnabled: true,
  oneYearEnabled: true,
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
  'update:halfYearEnabled': [value: boolean]
  'update:oneYearEnabled': [value: boolean]
}>()

const halfYearValue = computed(() => normalize(props.modelValue?.[0]))
const oneYearValue = computed(() => normalize(props.modelValue?.[1]))

function normalize(value: unknown) {
  return normalizeCommissionPercent(value)
}

function updateValue(index: 0 | 1, value: unknown) {
  const next = [normalize(props.modelValue?.[0]), normalize(props.modelValue?.[1])]
  const inputValue = typeof value === 'object' && value !== null && 'detail' in value
    ? (value as { detail?: { value?: unknown } }).detail?.value
    : value
  next[index] = normalize(Array.isArray(inputValue) ? inputValue[0] : inputValue)
  emit('update:modelValue', next)
}
</script>

<template>
  <view class="commission-settings">
    <view class="commission-row" :class="{ 'commission-row--disabled': showSwitch && !halfYearEnabled }">
      <view class="commission-row__main">
        <text class="commission-row__label">半年佣金</text>
        <view class="commission-row__input-wrap">
          <input
            class="commission-row__input"
            type="number"
            :value="String(halfYearValue)"
            :disabled="disabled || (showSwitch && !halfYearEnabled)"
            :maxlength="4"
            placeholder="0-1000"
            @input="updateValue(0, $event)"
          >
          <text class="commission-row__unit">%</text>
        </view>
        <wd-switch
          v-if="showSwitch"
          :model-value="halfYearEnabled"
          size="22px"
          :disabled="disabled"
          @update:model-value="emit('update:halfYearEnabled', Boolean($event))"
        />
      </view>
    </view>

    <view class="commission-row" :class="{ 'commission-row--disabled': showSwitch && !oneYearEnabled }">
      <view class="commission-row__main">
        <text class="commission-row__label">一年佣金</text>
        <view class="commission-row__input-wrap">
          <input
            class="commission-row__input"
            type="number"
            :value="String(oneYearValue)"
            :disabled="disabled || (showSwitch && !oneYearEnabled)"
            :maxlength="4"
            placeholder="0-1000"
            @input="updateValue(1, $event)"
          >
          <text class="commission-row__unit">%</text>
        </view>
        <wd-switch
          v-if="showSwitch"
          :model-value="oneYearEnabled"
          size="22px"
          :disabled="disabled"
          @update:model-value="emit('update:oneYearEnabled', Boolean($event))"
        />
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.commission-settings {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}

.commission-row {
  padding: 14rpx 18rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 8rpx;
  background: #f8faf8;
}

.commission-row--disabled {
  opacity: 0.56;
}

.commission-row__main {
  display: flex;
  min-height: 68rpx;
  align-items: center;
  gap: 16rpx;
}

.commission-row__label {
  color: #53635c;
  font-size: 24rpx;
  font-weight: 700;
}

.commission-row__input-wrap {
  display: flex;
  width: 220rpx;
  height: 64rpx;
  box-sizing: border-box;
  align-items: center;
  margin-left: auto;
  padding: 0 18rpx;
  border: 1rpx solid #dce6df;
  border-radius: 8rpx;
  background: #fff;
}

.commission-row__input {
  min-width: 0;
  height: 100%;
  flex: 1;
  color: #126b4f;
  font-size: 28rpx;
  font-weight: 850;
  text-align: right;
}

.commission-row__unit {
  margin-left: 8rpx;
  color: #53635c;
  font-size: 24rpx;
}
</style>
