import { describe, expect, it } from 'vitest'
import { decorationText, depositRuleText, orientationText, rentalTypeText } from '../property-display'

describe('property display labels', () => {
  it('converts stored enum values to Chinese labels', () => {
    expect(orientationText('east')).toBe('东')
    expect(decorationText('fine')).toBe('精装')
    expect(rentalTypeText('whole')).toBe('整租')
    expect(depositRuleText('2-1')).toBe('押二付一')
  })

  it('preserves already localized legacy values', () => {
    expect(orientationText('南')).toBe('南')
    expect(depositRuleText('押一付一')).toBe('押一付一')
  })
})
