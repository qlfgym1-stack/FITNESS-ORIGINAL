import { describe, it, expect } from 'vitest'
import { cn, getInitials, getStatusColor, getDaysRemaining, toUpper, formatPhone, isValidDzPhone, displayPhone } from './utils'

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

describe('formatPhone', () => {
  it('formats simple 10-digit number', () => {
    expect(formatPhone('0555123456')).toBe('0555123456')
  })

  it('strips dashes from phone', () => {
    expect(formatPhone('0555-12-34-56')).toBe('0555123456')
  })

  it('strips spaces from phone', () => {
    expect(formatPhone('0555 12 34 56')).toBe('0555123456')
  })

  it('converts +213 prefix', () => {
    expect(formatPhone('+213555123456')).toBe('0555123456')
  })

  it('converts 00213 prefix', () => {
    expect(formatPhone('00213555123456')).toBe('0555123456')
  })

  it('converts 213 prefix without +', () => {
    expect(formatPhone('213555123456')).toBe('0555123456')
  })

  it('returns original for unknown format', () => {
    expect(formatPhone('+11234567890')).toBe('+11234567890')
  })

  it('returns empty string for null', () => {
    expect(formatPhone(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatPhone(undefined)).toBe('')
  })
})

describe('isValidDzPhone', () => {
  it('accepts 05xxxxxxxx', () => {
    expect(isValidDzPhone('0555123456')).toBe(true)
  })

  it('accepts 06xxxxxxxx', () => {
    expect(isValidDzPhone('0666123456')).toBe(true)
  })

  it('accepts 07xxxxxxxx', () => {
    expect(isValidDzPhone('0777123456')).toBe(true)
  })

  it('rejects 04xxxxxxxx', () => {
    expect(isValidDzPhone('0444123456')).toBe(false)
  })

  it('rejects short number', () => {
    expect(isValidDzPhone('055512345')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidDzPhone('')).toBe(false)
  })

  it('accepts formatted +213 number', () => {
    expect(isValidDzPhone('+213555123456')).toBe(true)
  })
})

describe('displayPhone', () => {
  it('formats phone for display', () => {
    expect(displayPhone('0555123456')).toBe('05 55 12 34 56')
  })

  it('formats with dashes', () => {
    expect(displayPhone('0555-12-34-56')).toBe('05 55 12 34 56')
  })

  it('returns dash for null', () => {
    expect(displayPhone(null)).toBe('-')
  })

  it('returns dash for undefined', () => {
    expect(displayPhone(undefined)).toBe('-')
  })
})
