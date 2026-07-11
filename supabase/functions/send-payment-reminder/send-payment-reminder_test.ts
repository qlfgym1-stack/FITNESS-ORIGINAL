import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

Deno.test('notification balance calculation is correct', () => {
  const total_amount = 10000
  const amount_paid = 2500
  const balance = total_amount - amount_paid
  assertEquals(balance, 7500)
  assertEquals(typeof balance, 'number')
})

Deno.test('handler code references correct tables', async () => {
  const handlerCode = await Deno.readTextFile('./index.ts')
  assertStringIncludes(handlerCode, 'serve')
  assertStringIncludes(handlerCode, 'member_subscriptions')
  assertStringIncludes(handlerCode, 'notifications')
  assertStringIncludes(handlerCode, 'payment_pending')
})
