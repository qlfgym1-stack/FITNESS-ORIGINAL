import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const allowedOrigins = [
  'https://qlfgym.vercel.app',
  'https://qlfgym1-stack.github.io',
  'http://localhost:5173',
  'http://localhost:3000',
]

function getCorsHeaders(request: Request) {
  const origin = request.headers.get('origin') || ''
  const corsOrigin = allowedOrigins.includes(origin) ? origin : 'null'
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !supabaseKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      })
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      })
    }

    const jwt = authHeader.replace('Bearer ', '')
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      })
    }

    const { data: roles } = await userClient
      .from('user_roles')
      .select('organization_id')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle()

    if (!roles) {
      return new Response(JSON.stringify({ error: 'Forbidden: super_admin required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)
    const body = await req.json()
    const { action, ...params } = body

    switch (action) {
      case 'list': {
        const page = params.page || 1
        const perPage = params.perPage || 100
        const { data: users, error } = await supabase.auth.admin.listUsers({ page, perPage })
        if (error) throw error

        const userIds = users.users.map((u: any) => u.id)
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('user_id, organization_id, role')
          .in('user_id', userIds)

        const enriched = users.users.map((u: any) => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          createdAt: u.created_at,
          lastSignIn: u.last_sign_in_at,
          confirmed: u.email_confirmed_at !== null,
          roles: (userRoles || []).filter((r: any) => r.user_id === u.id),
        }))

        return new Response(JSON.stringify({ users: enriched, total: users.total ?? enriched.length }), {
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
        })
      }

      case 'create': {
        const { email, password, first_name, last_name, phone } = params
        if (!email || !password) {
          return new Response(JSON.stringify({ error: 'email and password required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
          })
        }

        const userData: Record<string, unknown> = {
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: [first_name, last_name].filter(Boolean).join(' ') || email },
        }
        if (phone) userData.phone = phone

        const { data: newUser, error: createError } = await supabase.auth.admin.createUser(userData)
        if (createError) throw createError

        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: newUser.user.id,
          organization_id: params.organization_id || roles.organization_id,
          role: params.role || 'staff',
        })
        if (roleError) throw roleError

        return new Response(JSON.stringify({
          user: { id: newUser.user.id, email: newUser.user.email },
          password,
        }), {
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
        })
      }

      case 'reset-password': {
        const { user_id, new_password } = params
        if (!user_id) {
          return new Response(JSON.stringify({ error: 'user_id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
          })
        }

        if (new_password) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, { password: new_password })
          if (updateError) throw updateError
          return new Response(JSON.stringify({ success: true, message: 'Password updated' }), {
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
          })
        }

        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: params.email,
        })
        if (linkError) throw linkError

        return new Response(JSON.stringify({
          success: true,
          recoveryLink: linkData?.properties?.action_link,
          message: 'Recovery link generated',
        }), {
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
        })
      }

      case 'update': {
        const { user_id, email, phone, role, organization_id } = params
        if (!user_id) {
          return new Response(JSON.stringify({ error: 'user_id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
          })
        }

        if (email || phone) {
          const updateData: Record<string, unknown> = {}
          if (email) updateData.email = email
          if (phone) updateData.phone = phone
          const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, updateData)
          if (updateError) throw updateError
        }

        if (role && organization_id) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .update({ role })
            .eq('user_id', user_id)
            .eq('organization_id', organization_id)
          if (roleError) throw roleError
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
        })
      }

      case 'delete': {
        const { user_id } = params
        if (!user_id) {
          return new Response(JSON.stringify({ error: 'user_id required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
          })
        }

        const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id)
        if (deleteError) throw deleteError

        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
        })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
        })
    }
  } catch (err) {
    console.error('admin-manage-users error:', err)
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    })
  }
})
