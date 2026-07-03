import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useSupabase } from '@/hooks/useSupabase'
import type { User } from '@supabase/supabase-js'
import type { Organization, UserRole } from '@/types/supabase'

interface Profile {
  id: string; email: string; full_name?: string | null; avatar_url?: string | null
}

interface AuthState {
  user: User | null; profile: Profile | null; organization: Organization | null
  roles: UserRole[]; isLoading: boolean; isAuthenticated: boolean; isSuperAdmin: boolean
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, orgData: { name: string; slug: string }) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
}

const IS_MOCK = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL === 'https://your-project.supabase.co'

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
  const supabase = useSupabase()
  const [state, setState] = useState<AuthState>(initialState)

  const fetchSession = useCallback(async () => {
    if (IS_MOCK) { setState(MOCK_ADMIN); return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { setState(s => ({ ...s, isLoading: false })); return }
    const user = session.user
    const profile: Profile = { id: user.id, email: user.email ?? '', full_name: user.user_metadata?.full_name, avatar_url: user.user_metadata?.avatar_url }
    const { data: roles } = await supabase.from('user_roles').select('*').eq('user_id', user.id)
    const userRoles = roles ?? []
    const orgId = userRoles[0]?.organization_id
    let org: Organization | null = null
    if (orgId) {
      const { data: orgData } = await supabase.from('organizations').select('*').eq('id', orgId).single()
      org = orgData
    }
    setState({ user, profile, organization: org, roles: userRoles, isLoading: false, isAuthenticated: true, isSuperAdmin: userRoles.some(r => r.role === 'super_admin') })
  }, [supabase])

  useEffect(() => {
    fetchSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => fetchSession())
    return () => subscription?.unsubscribe()
  }, [supabase, fetchSession])

  const signIn = useCallback(async (email: string, password: string) => {
    if (IS_MOCK) { setState(MOCK_ADMIN); return { error: null } }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }, [supabase])

  const signUp = useCallback(async (email: string, password: string, orgData: { name: string; slug: string }) => {
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) return { error: signUpError }
    const { error: orgError } = await supabase.from('organizations').insert({ name: orgData.name, slug: orgData.slug })
    if (orgError) return { error: orgError }
    const { data: org } = await supabase.from('organizations').select('*').eq('slug', orgData.slug).single()
    if (org) await supabase.from('user_roles').insert({ user_id: data.user.id, organization_id: org.id, role: 'super_admin' })
    return { error: null }
  }, [supabase])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setState(s => ({ ...s, user: null, profile: null, organization: null, roles: [], isAuthenticated: false, isSuperAdmin: false }))
  }, [supabase])

  return <AuthContext.Provider value={{ ...state, signIn, signUp, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
