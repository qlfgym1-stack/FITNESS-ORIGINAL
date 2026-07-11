import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

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
      return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    const orgIds = [...new Set(expiringSubs.map((sub: any) => sub.members.organization_id))]
    const { data: orgUsers } = await supabase
      .from('user_roles')
      .select('user_id, organization_id')
      .in('organization_id', orgIds)

    const usersByOrg: Record<string, string[]> = {}
    for (const role of orgUsers ?? []) {
      if (!usersByOrg[role.organization_id]) usersByOrg[role.organization_id] = []
      usersByOrg[role.organization_id].push(role.user_id)
    }

    const notifications: any[] = []
    for (const sub of expiringSubs) {
      for (const userId of usersByOrg[sub.members.organization_id] ?? []) {
        notifications.push({
          organization_id: sub.members.organization_id,
          user_id: userId,
          title: 'Abonnement expire bientôt',
          body: `L'abonnement de ${sub.members.first_name} ${sub.members.last_name} expire le ${sub.end_date}`,
          type: 'subscription_expiring',
          data: { member_subscription_id: sub.id, member_id: sub.member_id },
        })
      }
    }

    // Deduplicate: skip if notification already sent today for same subscription
    const { data: existing } = await supabase
      .from('notifications')
      .select('data')
      .eq('type', 'subscription_expiring')
      .gte('created_at', new Date().toISOString().split('T')[0])
    const existingIds = new Set(
      (existing ?? []).map((n: any) => n.data?.member_subscription_id).filter(Boolean)
    )
    const uniqueNotifications = notifications.filter(
      (n: any) => !existingIds.has(n.data.member_subscription_id)
    )

    if (!uniqueNotifications.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    const { error } = await supabase.from('notifications').insert(uniqueNotifications)
    if (error) throw error

    return new Response(JSON.stringify({ sent: uniqueNotifications.length }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), { status: 500, headers: { ...corsHeaders } })
  }
})
