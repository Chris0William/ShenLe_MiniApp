import { DECORATION_OPTIONS, DEPOSIT_RULE_OPTIONS, ORIENTATION_OPTIONS, RENTAL_TYPE_OPTIONS } from '@/constants/shenle'

function optionText(value: string | null | undefined, options: readonly { label: string, value: string }[]) {
  if (!value)
    return '待补充'
  return options.find(item => item.value === value || item.label === value)?.label || value
}

export function orientationText(value?: string | null) {
  return optionText(value, ORIENTATION_OPTIONS)
}

export function decorationText(value?: string | null) {
  return optionText(value, DECORATION_OPTIONS)
}

export function rentalTypeText(value?: string | null) {
  return optionText(value, RENTAL_TYPE_OPTIONS)
}

export function depositRuleText(value?: string | null) {
  return optionText(value, DEPOSIT_RULE_OPTIONS)
}
