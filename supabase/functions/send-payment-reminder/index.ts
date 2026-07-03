import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: pendingPayments } = await supabase
      .from('member_subscriptions')
      .select(`
        *,
        members!inner(first_name, last_name, email, organization_id),
        subscription_types!inner(name, price)
      `)
      .eq('status', 'active')
      .lt('amount_paid', 'total_amount')

    if (!pendingPayments?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } })
    }

    const notifications = pendingPayments.map((sub: any) => ({
      organization_id: sub.members.organization_id,
      user_id: sub.members.email,
      title: 'Paiement en attente',
      body: `${sub.members.first_name} ${sub.members.last_name} a un solde de ${(sub.total_amount - sub.amount_paid).toFixed(2)} DA`,
      type: 'payment_pending',
      data: { member_subscription_id: sub.id, member_id: sub.member_id, balance: sub.total_amount - sub.amount_paid },
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
