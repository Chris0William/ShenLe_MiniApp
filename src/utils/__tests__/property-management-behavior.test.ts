import { describe, expect, it } from 'vitest'
import {
  PROPERTY_MEDIA_SOURCE_ACTIONS,
  canManagePropertyWrites,
  resolvePropertyMediaSource,
  toOptionalNumber,
} from '../property-management'

describe('canManagePropertyWrites', () => {
  it('allows administrators only in admin mode', () => {
    expect(canManagePropertyWrites({ isAdmin: true, isLandlord: false, mode: 'admin' })).toBe(true)
    expect(canManagePropertyWrites({ isAdmin: true, isLandlord: false, mode: 'user' })).toBe(false)
  })

  it('allows landlords in landlord mode without requiring administrator status', () => {
    expect(canManagePropertyWrites({ isAdmin: false, isLandlord: true, mode: 'landlord' })).toBe(true)
    expect(canManagePropertyWrites({ isAdmin: false, isLandlord: true, mode: 'user' })).toBe(false)
  })

  it('rejects regular users in every management mode', () => {
    expect(canManagePropertyWrites({ isAdmin: false, isLandlord: false, mode: 'admin' })).toBe(false)
    expect(canManagePropertyWrites({ isAdmin: false, isLandlord: false, mode: 'landlord' })).toBe(false)
  })
})

describe('toOptionalNumber', () => {
  it.each(['', '   ', null, undefined])('keeps empty input %s absent', (value) => {
    expect(toOptionalNumber(value)).toBeUndefined()
  })

  it('preserves valid zero and finite numbers', () => {
    expect(toOptionalNumber('0')).toBe(0)
    expect(toOptionalNumber('12')).toBe(12)
    expect(toOptionalNumber(7)).toBe(7)
  })

  it('rejects invalid and non-finite numbers', () => {
    expect(toOptionalNumber('not-a-number')).toBeUndefined()
    expect(toOptionalNumber(Number.NaN)).toBeUndefined()
    expect(toOptionalNumber(Number.POSITIVE_INFINITY)).toBeUndefined()
  })
})

describe('property media source actions', () => {
  it('exposes stable values for community selection and upload', () => {
    expect(PROPERTY_MEDIA_SOURCE_ACTIONS.map(action => action.value)).toEqual(['community', 'upload'])
  })

  it('resolves known values and ignores unknown actions', () => {
    expect(resolvePropertyMediaSource('community')).toBe('community')
    expect(resolvePropertyMediaSource('upload')).toBe('upload')
    expect(resolvePropertyMediaSource('unexpected')).toBeNull()
    expect(resolvePropertyMediaSource(undefined)).toBeNull()
  })
})
