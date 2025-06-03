import { describe, it, expect } from 'vitest'
import { hashContent, valueIsInRange } from '../src/editor/utils'

// JUST DEMO TESTS; WE DID FOR CHECKING IF VITEST IS WORKING
// PLEASE IGNORE IF THIS TESTS FAIL; WE NEED TO REFACTOR ANYWAY

describe('Utils', () => {
  describe('hashContent', () => {
    it('should generate a consistent hash for the same string', () => {
      const testString = 'Hello, World!'
      const hash1 = hashContent(testString)
      const hash2 = hashContent(testString)

      expect(hash1).toBe(hash2)
      expect(hash1).toBeTypeOf('string')
      expect(hash1.length).toBeLessThanOrEqual(8)
    })

    it('should generate different hashes for different strings', () => {
      const hash1 = hashContent('Hello, World!')
      const hash2 = hashContent('Hello, Universe!')

      expect(hash1).not.toBe(hash2)
    })

    it('should handle empty string', () => {
      const hash = hashContent('')

      expect(hash).toBeTypeOf('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should handle special characters', () => {
      const hash = hashContent('!@#$%^&*()_+-=[]{}|;:,.<>?')

      expect(hash).toBeTypeOf('string')
      expect(hash.length).toBeGreaterThan(0)
    })
  })

  describe('valueIsInRange', () => {
    it('should return true when value is within range', () => {
      expect(valueIsInRange(5, 1, 10)).toBe(true)
      expect(valueIsInRange(1, 1, 10)).toBe(true) // boundary case
      expect(valueIsInRange(10, 1, 10)).toBe(true) // boundary case
    })

    it('should return false when value is outside range', () => {
      expect(valueIsInRange(0, 1, 10)).toBe(false)
      expect(valueIsInRange(11, 1, 10)).toBe(false)
      expect(valueIsInRange(-5, 1, 10)).toBe(false)
    })

    it('should handle negative ranges', () => {
      expect(valueIsInRange(-5, -10, -1)).toBe(true)
      expect(valueIsInRange(-15, -10, -1)).toBe(false)
      expect(valueIsInRange(0, -10, -1)).toBe(false)
    })

    it('should handle zero values', () => {
      expect(valueIsInRange(0, 0, 0)).toBe(true)
      expect(valueIsInRange(0, -5, 5)).toBe(true)
      expect(valueIsInRange(0, 1, 5)).toBe(false)
    })

    it('should handle decimal values', () => {
      expect(valueIsInRange(2.5, 1.0, 3.0)).toBe(true)
      expect(valueIsInRange(0.5, 1.0, 3.0)).toBe(false)
      expect(valueIsInRange(3.5, 1.0, 3.0)).toBe(false)
    })
  })
}) 