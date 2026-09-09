import { describe, expect, it } from 'vitest'
import { managementFeeText, networkFeeText, petPolicyText } from '../community-business'

describe('community business display', () => {
  it('formats package modes without repeating self-managed network text', () => {
    expect(managementFeeText({ managementFee: 50, managementPackageMode: 1 })).toBe('50元/月（可包）')
    expect(networkFeeText({ networkFee: 30, networkPackageMode: 4 })).toBe('30元/月（必开）')
    expect(networkFeeText({ networkFee: 30, networkFeeMode: 2, networkPackageMode: 3 })).toBe('自理')
  })

  it('maps all pet policy values', () => {
    expect(petPolicyText(1)).toBe('可养宠物')
    expect(petPolicyText(2)).toBe('不可养宠物')
    expect(petPolicyText(3)).toBe('可沟通养宠物')
  })
})
