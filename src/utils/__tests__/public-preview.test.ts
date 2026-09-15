import { describe, expect, it } from 'vitest'
import { hasPublicCoordinate } from '../public-preview'

describe('public preview coordinates', () => {
  it('accepts a valid nonzero region coordinate', () => {
    expect(hasPublicCoordinate({ latitude: 22.7, longitude: 113.9 })).toBe(true)
  })

  it('does not render a marker for missing or zero coordinates', () => {
    expect(hasPublicCoordinate({ latitude: 0, longitude: 0 })).toBe(false)
    expect(hasPublicCoordinate({ latitude: null, longitude: 113.9 })).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    expect(hasPublicCoordinate({ latitude: 91, longitude: 113.9 })).toBe(false)
    expect(hasPublicCoordinate({ latitude: Number.NaN, longitude: 113.9 })).toBe(false)
    expect(hasPublicCoordinate({ latitude: '', longitude: 113.9 })).toBe(false)
    expect(hasPublicCoordinate({ latitude: 22.7, longitude: Number.POSITIVE_INFINITY })).toBe(false)
  })
})
