import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, type ReactNode } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import type { User } from '@supabase/supabase-js'
import type { Organization, UserRole } from '@/types/supabase'
import { IS_MOCK } from '@/lib/config'
import { generateRecoveryCode, storeRecoveryCode, setMockRecoveryData } from '@/lib/recovery'

interface Profile {
  id: string; email: string; full_name?: string | null; avatar_url?: string | null
}

interface AuthState {
  user: User | null; profile: Profile | null; organization: Organization | null
  roles: UserRole[]; isLoading: boolean; isAuthenticated: boolean; isSuperAdmin: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, orgData: { name: string; slug: string }) => Promise<{ error: Error | null; recoveryCode?: string }>
  signOut: () => Promise<void>
}



const MOCK_ADMIN: AuthState = {
  user: { id: 'mock-admin-id', email: 'admin@fitmanager.pro', app_metadata: {}, user_metadata: { full_name: 'Admin User' }, aud: 'authenticated', created_at: new Date().toISOString() } as any,
  profile: { id: 'mock-admin-id', email: 'admin@fitmanager.pro', full_name: 'Admin User' },
  organization: { id: 'mock-org-id', name: 'FitManager Pro Gym', slug: 'fitmanager-pro', logo_url: null, address: null, phone: null, email: 'admin@fitmanager.pro', created_at: new Date().toISOString() },
  roles: [{ id: 'mock-role-id', user_id: 'mock-admin-id', organization_id: 'mock-org-id', role: 'super_admin', created_at: new Date().toISOString() }],
  isLoading: false, isAuthenticated: true, isSuperAdmin: true,
}

const initialState: AuthState = {
  user: null, profile: null, organization: null, roles: [],
  isLoading: true, isAuthenticated: false, isSuperAdmin: false,
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabaseRef = useRef(useSupabase())
  const supabase = supabaseRef.current
  const [state, setState] = useState<AuthState>(initialState)

  const fetchSession = useCallback(async () => {
    if (IS_MOCK) { setState(MOCK_ADMIN); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setState(s => ({ ...s, isLoading: false })); return }
    const user = session.user
    const profile: Profile = { id: user.id, email: user.email ?? '', full_name: user.user_metadata?.full_name, avatar_url: user.user_metadata?.avatar_url }
    const { data: roles, error: rolesError } = await supabase.from('user_roles').select('*').eq('user_id', user.id)
    if (rolesError) console.error('Failed to fetch roles:', rolesError)
    const userRoles = roles ?? []
    const orgId = userRoles[0]?.organization_id
    let org: Organization | null = null
    if (orgId) {
      const { data: orgData } = await supabase.from('organizations').select('*').eq('id', orgId).single()
      org = orgData
    }
    setState({ user, profile, organization: org, roles: userRoles, isLoading: false, isAuthenticated: true, isSuperAdmin: userRoles.some(r => r.role === 'super_admin') })
  }, [])

  useEffect(() => {
    if (IS_MOCK) { setState(MOCK_ADMIN); return }
    fetchSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') fetchSession()
    })
    return () => subscription?.unsubscribe()
  }, [fetchSession])

  const signIn = useCallback(async (email: string, password: string) => {
    if (IS_MOCK) { setState(MOCK_ADMIN); return { error: null } }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [])

  const signUp = useCallback(async (email: string, password: string, orgData: { name: string; slug: string }) => {
    if (IS_MOCK) {
      const { plainText, hash } = await generateRecoveryCode();
      setMockRecoveryData({ userId: 'mock-admin-id', hash, created_at: new Date().toISOString(), last_used_at: null });
      setState(MOCK_ADMIN);
      return { error: null, recoveryCode: plainText };
    }
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) return { error: signUpError }
    let slug = orgData.slug
    let { error: orgError } = await supabase.from('organizations').insert({ name: orgData.name, slug })
    let maxRetries = 3
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (!orgError) break
      if (!orgError.message?.includes('duplicate key')) return { error: orgError }
      slug = `${orgData.slug}-${Math.random().toString(36).slice(2, 8)}`
      const result = await supabase.from('organizations').insert({ name: orgData.name, slug })
      orgError = result.error
      if (attempt === maxRetries - 1) return { error: orgError }
    }
    if (orgError) return { error: orgError }
    const { data: org } = await supabase.from('organizations').select('*').eq('slug', slug).single()
    if (!org) return { error: new Error('Failed to create organization') }
    // Role 'super_admin' is auto-assigned by the database trigger after_organization_insert
    const { plainText, hash } = await generateRecoveryCode();
    await storeRecoveryCode(data.user.id, hash);
    return { error: null, recoveryCode: plainText }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
    } finally {
      setState(s => ({ ...s, user: null, profile: null, organization: null, roles: [], isAuthenticated: false, isSuperAdmin: false }))
    }
  }, [])

  const ctxValue = useMemo(() => ({ ...state, signIn, signUp, signOut }), [state, signIn, signUp, signOut])
  return <AuthContext.Provider value={ctxValue}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
