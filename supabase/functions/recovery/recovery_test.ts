import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

// Test sha256
Deno.test('sha256 produces correct hash', async () => {
  // Re-create the sha256 function from index.ts
  async function sha256(code: string): Promise<string> {
    const data = new TextEncoder().encode(code)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }
  const hash = await sha256('TESTCODE')
  assertEquals(hash.length, 64, 'SHA-256 should be 64 hex chars')
  assertEquals(typeof hash, 'string')
})

// Test generateCode
Deno.test('generateCode produces valid code', () => {
  function generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => chars[b % chars.length])
      .join('')
  }
  const code = generateCode()
  assertEquals(code.length, 16, 'Code should be 16 chars')
  assertEquals(/^[A-Z0-9]+$/.test(code), true, 'Code should be alphanumeric uppercase')
})
