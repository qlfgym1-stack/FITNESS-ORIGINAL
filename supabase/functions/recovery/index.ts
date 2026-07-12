import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function sha256(code: string): Promise<string> {
  const data = new TextEncoder().encode(code)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map(b => chars[b % chars.length])
    .join('')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body = await req.json()
    const { action, email, code, newPassword } = body

    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (action !== 'send_code' && action !== 'verify' && action !== 'reset') {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if ((action === 'verify' || action === 'reset') && !code) {
      return new Response(JSON.stringify({ error: 'Code is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // Find the user by email
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 })
    if (listError) throw listError

    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const userId = user.id

    if (action === 'send_code') {
      // Rate limiting check for code requests
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('recovery_code_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('success', false)
        .gte('attempted_at', since)
      if ((count ?? 0) >= 5) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      // Generate a new recovery code
      const newPlainCode = generateCode()
      const newCodeHash = await sha256(newPlainCode)

      await supabase.from('recovery_codes').upsert({
        user_id: userId,
        code_hash: newCodeHash,
        created_at: new Date().toISOString(),
        last_used_at: null,
      })

      return new Response(JSON.stringify({
        success: true,
        newCode: newPlainCode,
        message: 'Recovery code generated',
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (action === 'verify') {
      // Rate limiting check
      const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count } = await supabase
        .from('recovery_code_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('success', false)
        .gte('attempted_at', since)
      if ((count ?? 0) >= 5) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      const { data: recoveryData } = await supabase
        .from('recovery_codes')
        .select('code_hash')
        .eq('user_id', userId)
        .single()

      if (!recoveryData) {
        await supabase.from('recovery_code_logs').insert({
          user_id: userId,
          success: false,
        })
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      const codeHash = await sha256(code.toUpperCase())
      const validHashes = codeHash.length === recoveryData.code_hash.length &&
        recoveryData.code_hash.split('').reduce((acc, c, i) => acc && c === codeHash[i], true)
      if (!validHashes) {
        await supabase.from('recovery_code_logs').insert({
          user_id: userId,
          success: false,
        })
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      await supabase.from('recovery_code_logs').insert({
        user_id: userId,
        success: true,
      })

      await supabase
        .from('recovery_codes')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId)

      return new Response(JSON.stringify({ valid: true, userId }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (action === 'reset') {
      // Rate limiting check
      const sinceReset = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      const { count: resetCount } = await supabase
        .from('recovery_code_logs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('success', false)
        .gte('attempted_at', sinceReset)
      if ((resetCount ?? 0) >= 5) {
        return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      if (!newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: 'Invalid password' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      // Verify code again before allowing password reset
      const { data: recoveryData } = await supabase
        .from('recovery_codes')
        .select('code_hash')
        .eq('user_id', userId)
        .single()

      if (!recoveryData) {
        await supabase.from('recovery_code_logs').insert({
          user_id: userId,
          success: false,
        })
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      const codeHash = await sha256(code.toUpperCase())
      const validHashes = codeHash.length === recoveryData.code_hash.length &&
        recoveryData.code_hash.split('').reduce((acc, c, i) => acc && c === codeHash[i], true)
      if (!validHashes) {
        await supabase.from('recovery_code_logs').insert({
          user_id: userId,
          success: false,
        })
        return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      // Update password via Supabase Auth admin API
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      })
      if (updateError) throw updateError

      // Invalidate old code and generate new one
      const newPlainCode = generateCode()
      const newCodeHash = await sha256(newPlainCode)

      await supabase.from('recovery_codes').upsert({
        user_id: userId,
        code_hash: newCodeHash,
        created_at: new Date().toISOString(),
        last_used_at: null,
      })

      return new Response(JSON.stringify({
        success: true,
        newCode: newPlainCode,
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    console.error('Recovery error:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
