import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { email, role, organization_id } = await req.json()
    if (!email || !role || !organization_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, role, organization_id' }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const token = crypto.randomUUID()
    const { data: invitation, error } = await supabase
      .from('staff_invitations')
      .insert({ email, role, organization_id, token })
      .select()
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: 'Failed to create invitation', details: error.message }), {
        status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const inviteUrl = `${supabaseUrl.replace('.supabase.co', '')}/auth/v1/verify?token=${token}&type=invite&redirect_to=${encodeURIComponent('/auth/accept-invite')}`

    return new Response(JSON.stringify({
      token,
      invitation,
      invite_url: inviteUrl,
      message: `Invitation sent to ${email}. In production, an email would be sent.`,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error', details: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
