<script setup lang="ts">
import { computed } from 'vue'
import { petPolicyText } from '@/utils/community-business'

const props = defineProps<{
  value?: number | null
}>()

const label = computed(() => petPolicyText(props.value))
const toneClass = computed(() => {
  if (props.value === 1)
    return 'pet-policy--allowed'
  if (props.value === 2)
    return 'pet-policy--denied'
  if (props.value === 3)
    return 'pet-policy--negotiable'
  return ''
})
</script>

<template>
  <text v-if="label" class="pet-policy" :class="toneClass">{{ label }}</text>
</template>

<style scoped lang="scss">
.pet-policy {
  display: inline;
  font-size: inherit;
  line-height: inherit;
}

.pet-policy--allowed {
  color: #bd8117;
  font-weight: 800;
}

.pet-policy--denied {
  color: #1f2924;
  font-weight: 900;
}

.pet-policy--negotiable {
  color: #d0a75a;
  font-weight: 750;
}
</style>
