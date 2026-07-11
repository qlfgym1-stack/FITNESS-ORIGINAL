import { describe, it, expect } from 'vitest'
import { generateRecoveryCode, verifyCode } from './recovery'

describe('generateRecoveryCode', () => {
  it('generates a 16-character code', async () => {
    const { plainText } = await generateRecoveryCode()
    expect(plainText.length).toBe(16)
  })

  it('generates alphanumeric uppercase code', async () => {
    const { plainText } = await generateRecoveryCode()
    expect(/^[A-Z0-9]+$/.test(plainText)).toBe(true)
  })

  it('generates hash that can verify the code', async () => {
    const { plainText, hash } = await generateRecoveryCode()
    const isValid = await verifyCode(plainText, hash)
    expect(isValid).toBe(true)
  })

  it('rejects wrong code', async () => {
    const { hash } = await generateRecoveryCode()
    const isValid = await verifyCode('WRONG', hash)
    expect(isValid).toBe(false)
  })
})
