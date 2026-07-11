import { describe, it, expect } from 'vitest'
import { cn, getInitials, getStatusColor, getDaysRemaining, toUpper } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const result = cn('foo', false && 'bar', 'baz')
    expect(result).toBe('foo baz')
  })
})

describe('getInitials', () => {
  it('returns uppercase initials', () => {
    expect(getInitials('john', 'doe')).toBe('JD')
  })

  it('handles single character names', () => {
    expect(getInitials('a', 'b')).toBe('AB')
  })

  it('handles empty strings', () => {
    expect(getInitials('', '')).toBe('')
  })
})

describe('getStatusColor', () => {
  it('returns correct color for active status', () => {
    expect(getStatusColor('active')).toBe('bg-success/10 text-success')
  })

  it('returns default color for unknown status', () => {
    expect(getStatusColor('unknown')).toBe('bg-muted text-muted-foreground')
  })
})

describe('getDaysRemaining', () => {
  it('returns positive days for future date', () => {
    const future = new Date()
    future.setDate(future.getDate() + 10)
    expect(getDaysRemaining(future.toISOString())).toBe(10)
  })

  it('returns negative days for past date', () => {
    const past = new Date()
    past.setDate(past.getDate() - 5)
    expect(getDaysRemaining(past.toISOString())).toBe(-5)
  })
})

describe('toUpper', () => {
  it('converts string to uppercase', () => {
    expect(toUpper('hello')).toBe('HELLO')
  })

  it('returns empty string for empty input', () => {
    expect(toUpper('')).toBe('')
  })

  it('returns empty string for null input', () => {
    expect(toUpper(null)).toBe('')
  })

  it('returns empty string for undefined input', () => {
    expect(toUpper(undefined)).toBe('')
  })
})
