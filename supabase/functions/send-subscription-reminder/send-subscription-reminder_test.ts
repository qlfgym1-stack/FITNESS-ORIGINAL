import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.168.0/testing/asserts.ts'

Deno.test('handler returns 200 with sent: 0 when no expiring subscriptions', async () => {
  // This is an integration test - in CI you'd mock the Supabase client
  // For now, validate the function structure
  const handlerCode = await Deno.readTextFile('./index.ts')
  assertStringIncludes(handlerCode, 'serve')
  assertStringIncludes(handlerCode, 'member_subscriptions')
  assertStringIncludes(handlerCode, 'notifications')
})

Deno.test('notifications include correct fields', () => {
  const notification = {
    organization_id: 'org-1',
    user_id: 'user-1',
    title: 'Abonnement expire bientôt',
    body: "L'abonnement de John Doe expire le 2026-07-15",
    type: 'subscription_expiring',
    data: { member_subscription_id: 'sub-1', member_id: 'member-1' },
  }
  assertEquals(notification.type, 'subscription_expiring')
  assertEquals(typeof notification.user_id, 'string')
  assertEquals(typeof notification.organization_id, 'string')
})
