import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: expiringSubs } = await supabase
      .from('member_subscriptions')
      .select(`
        *,
        members!inner(first_name, last_name, email, organization_id),
        subscription_types!inner(name)
      `)
      .eq('status', 'active')
      .lte('end_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .gte('end_date', new Date().toISOString().split('T')[0])

    if (!expiringSubs?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })
    }

    const notifications = expiringSubs.map((sub: any) => ({
      organization_id: sub.members.organization_id,
      user_id: sub.members.email,
      title: 'Abonnement expire bientôt',
      body: `L'abonnement de ${sub.members.first_name} ${sub.members.last_name} expire le ${sub.end_date}`,
      type: 'subscription_expiring',
      data: { member_subscription_id: sub.id, member_id: sub.member_id },
    }))

    const { error } = await supabase.from('notifications').insert(notifications)
    if (error) throw error

    return new Response(JSON.stringify({ sent: notifications.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
