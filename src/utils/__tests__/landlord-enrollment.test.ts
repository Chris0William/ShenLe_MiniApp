import { describe, expect, it } from 'vitest'
import { enrollmentDestination } from '../landlord-enrollment'

describe('landlord enrollment identity priority', () => {
  it.each([666, 777])('allows account type %i to apply', (accountType) => {
    expect(enrollmentDestination({ accountType })).toBe('apply')
  })
  it('opens the portal for an actual landlord', () => {
    expect(enrollmentDestination({ accountType: 777, isLandlord: true })).toBe('landlord')
  })
  it.each([888, 999])('blocks administrator %i even with landlord identity', (accountType) => {
    expect(enrollmentDestination({ accountType, isLandlord: true })).toBe('blocked')
  })
  it('blocks maintainers even with landlord identity', () => {
    expect(enrollmentDestination({ accountType: 777, isMaintainer: true, isLandlord: true })).toBe('blocked')
  })
})
