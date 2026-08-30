<script setup lang="ts">
import { computed } from 'vue'
import { COMMISSION_PERCENT_MAX, normalizeCommissionPercent } from '@/utils/commission'

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
  next[index] = normalize(Array.isArray(value) ? value[0] : value)
  emit('update:modelValue', next)
}
</script>

<template>
  <view class="commission-settings">
    <view class="commission-row" :class="{ 'commission-row--disabled': showSwitch && !halfYearEnabled }">
      <view class="commission-row__head">
        <text class="commission-row__label">半年佣金</text>
        <text class="commission-row__value">{{ halfYearValue }}%</text>
        <wd-switch
          v-if="showSwitch"
          :model-value="halfYearEnabled"
          size="22px"
          :disabled="disabled"
          @update:model-value="emit('update:halfYearEnabled', Boolean($event))"
        />
      </view>
      <wd-slider
        :model-value="halfYearValue"
        :min="0"
        :max="COMMISSION_PERCENT_MAX"
        :step="1"
        hide-label
        active-color="#126b4f"
        :disabled="disabled || (showSwitch && !halfYearEnabled)"
        @update:model-value="updateValue(0, $event)"
      />
    </view>

    <view class="commission-row" :class="{ 'commission-row--disabled': showSwitch && !oneYearEnabled }">
      <view class="commission-row__head">
        <text class="commission-row__label">一年佣金</text>
        <text class="commission-row__value">{{ oneYearValue }}%</text>
        <wd-switch
          v-if="showSwitch"
          :model-value="oneYearEnabled"
          size="22px"
          :disabled="disabled"
          @update:model-value="emit('update:oneYearEnabled', Boolean($event))"
        />
      </view>
      <wd-slider
        :model-value="oneYearValue"
        :min="0"
        :max="COMMISSION_PERCENT_MAX"
        :step="1"
        hide-label
        active-color="#126b4f"
        :disabled="disabled || (showSwitch && !oneYearEnabled)"
        @update:model-value="updateValue(1, $event)"
      />
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
  padding: 16rpx 18rpx 10rpx;
  border: 1rpx solid #e1e9e3;
  border-radius: 8rpx;
  background: #f8faf8;
}

.commission-row--disabled {
  opacity: 0.56;
}

.commission-row__head {
  display: flex;
  min-height: 44rpx;
  align-items: center;
  gap: 12rpx;
}

.commission-row__label {
  color: #53635c;
  font-size: 24rpx;
  font-weight: 700;
}

.commission-row__value {
  margin-left: auto;
  color: #126b4f;
  font-size: 27rpx;
  font-weight: 850;
}
</style>
