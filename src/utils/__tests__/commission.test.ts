import { describe, expect, it } from 'vitest'
import { formatCommissionRange, normalizeCommissionPercent } from '@/utils/commission'

describe('commission display helpers', () => {
  it('formats a single value without a redundant range', () => {
    expect(formatCommissionRange(20, 20)).toBe('20%')
    expect(formatCommissionRange(null, 30)).toBe('30%')
  })

  it('formats a range from the lowest and highest effective values', () => {
    expect(formatCommissionRange(20, 35)).toBe('20%-35%')
    expect(formatCommissionRange(35, 20)).toBe('20%-35%')
  })

  it('clamps slider values to the supported percentage range', () => {
    expect(normalizeCommissionPercent(-1)).toBe(0)
    expect(normalizeCommissionPercent(1000)).toBe(1000)
    expect(normalizeCommissionPercent(1001)).toBe(1000)
    expect(normalizeCommissionPercent(25.6)).toBe(26)
  })
})
