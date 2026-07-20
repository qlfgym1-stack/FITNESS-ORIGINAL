import { useState, useMemo } from 'react'
import { Link } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/components/ui/toast'
import { useT } from '@/i18n'
import { getInitials, toUpper, formatPhone } from '@/lib/utils'
import { Search, Users, UserCheck, Loader2, X, Plus, UserPlus, DollarSign, ChevronLeft, ChevronRight, History } from 'lucide-react'

interface Coach {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  salary: number | null
  rate_per_member: number | null
  member_count: number
}

interface MemberRow {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  photo_url: string | null
  status: string
}

interface SalaryHistory {
  id: string
  period: string
  fixed_salary: number
  rate_per_member: number
  member_count: number
  variable_amount: number
  total_amount: number
  created_at: string
}

function formatMonth(date: Date): string {
  const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
  return `${months[date.getMonth()]} ${date.getFullYear()}`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-DZ', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' DA'
}

function toPeriodStart(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1)
  return d.toISOString().slice(0, 10)
}

export default function CoachModePage() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization, user, roles } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const isCoach = roles?.some(r => r.role === 'coach')
  const isAdmin = roles?.some(r => r.role === 'admin' || r.role === 'super_admin')
  const [search, setSearch] = useState('')
  const [selectedCoach, setSelectedCoach] = useState<string | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [selectedAddMember, setSelectedAddMember] = useState('')
  const [tab, setTab] = useState<'members' | 'salary'>('members')
  const [currentMonth, setCurrentMonth] = useState(new Date())


  const { data: coaches = [], isLoading: coachesLoading } = useQuery({
    queryKey: ['coaches-with-count', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data: staffList } = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, phone, salary, rate_per_member')
        .eq('organization_id', orgId)
        .eq('role', 'coach')
        .eq('is_active', true)
        .order('first_name')
      if (!staffList) return []
      const { data: counts } = await supabase
        .from('members')
        .select('coach_id')
        .eq('organization_id', orgId)
        .not('coach_id', 'is', null)
      const countMap: Record<string, number> = {}
      for (const m of counts ?? []) {
        if (m.coach_id) countMap[m.coach_id] = (countMap[m.coach_id] ?? 0) + 1
      }
      return (staffList ?? []).map(s => ({
        ...s,
        member_count: countMap[s.id] ?? 0,
      })) as Coach[]
    },
    enabled: !!orgId,
  })

  const currentUserStaff = useMemo(() => {
    if (!isCoach || !user) return null
    const found = coaches.find(c => c.email === user.email)
    return found?.id ?? null
  }, [isCoach, user, coaches])

  const effectiveSelectedCoach = isCoach && currentUserStaff ? currentUserStaff : selectedCoach

  const { data: assignedMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['coach-members', orgId, effectiveSelectedCoach],
    queryFn: async () => {
      if (!orgId || !effectiveSelectedCoach) return []
      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, phone, photo_url, status')
        .eq('organization_id', orgId)
        .eq('coach_id', effectiveSelectedCoach)
        .order('first_name')
      return (data ?? []) as MemberRow[]
    },
    enabled: !!orgId && !!effectiveSelectedCoach,
  })

  const { data: unassignedMembers = [] } = useQuery({
    queryKey: ['unassigned-members', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from('members')
        .select('id, first_name, last_name, phone')
        .eq('organization_id', orgId)
        .is('coach_id', null)
        .eq('status', 'active')
        .order('first_name')
      return (data ?? []) as MemberRow[]
    },
    enabled: !!orgId && addMemberOpen,
  })

  const activeMemberCount = useMemo(() => {
    if (!effectiveSelectedCoach) return 0
    return assignedMembers.filter(m => m.status === 'active').length
  }, [assignedMembers, effectiveSelectedCoach])

  const selectedCoachData = useMemo(() => {
    return coaches.find(c => c.id === effectiveSelectedCoach) ?? null
  }, [coaches, effectiveSelectedCoach])

  const variableAmount = useMemo(() => {
    if (!selectedCoachData) return 0
    return (selectedCoachData.rate_per_member ?? 0) * activeMemberCount
  }, [selectedCoachData, activeMemberCount])

  const totalSalary = useMemo(() => {
    if (!selectedCoachData) return 0
    return (selectedCoachData.salary ?? 0) + variableAmount
  }, [selectedCoachData, variableAmount])

  const { data: salaryHistory = [] } = useQuery({
    queryKey: ['coach-salary-history', effectiveSelectedCoach],
    queryFn: async () => {
      if (!orgId || !effectiveSelectedCoach) return []
      const { data } = await supabase
        .from('coach_salary_history')
        .select('*')
        .eq('coach_id', effectiveSelectedCoach)
        .order('period', { ascending: false })
      return (data ?? []) as SalaryHistory[]
    },
    enabled: !!orgId && !!effectiveSelectedCoach,
  })

  const saveSnapshotMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !effectiveSelectedCoach) return
      const period = toPeriodStart(currentMonth)
      const { error } = await supabase
        .from('coach_salary_history')
        .upsert({
          organization_id: orgId,
          coach_id: effectiveSelectedCoach,
          period,
          fixed_salary: selectedCoachData?.salary ?? 0,
          rate_per_member: selectedCoachData?.rate_per_member ?? 0,
          member_count: activeMemberCount,
          variable_amount: variableAmount,
          total_amount: totalSalary,
        }, { onConflict: 'coach_id, period' })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-salary-history'] })
      toast({ title: 'Snapchat enregistré pour ' + formatMonth(currentMonth) })
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  })

  const assignMember = useMutation({
    mutationFn: async ({ memberId, coachId }: { memberId: string; coachId: string }) => {
      const { error } = await supabase.from('members').update({ coach_id: coachId }).eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-members'] })
      queryClient.invalidateQueries({ queryKey: ['coaches-with-count'] })
      queryClient.invalidateQueries({ queryKey: ['unassigned-members'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast({ title: 'Adhérent assigné au coach' })
      setAddMemberOpen(false)
      setSelectedAddMember('')
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  })

  const unassignMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('members').update({ coach_id: null }).eq('id', memberId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-members'] })
      queryClient.invalidateQueries({ queryKey: ['coaches-with-count'] })
      queryClient.invalidateQueries({ queryKey: ['unassigned-members'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
      toast({ title: 'Adhérent retiré du coach' })
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  })

  const filteredCoaches = coaches.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const displayCoaches = isCoach && currentUserStaff
    ? coaches.filter(c => c.id === currentUserStaff)
    : filteredCoaches

  const filteredMembers = assignedMembers.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const filteredUnassigned = unassignedMembers.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const currentSnapshot = useMemo(() => {
    const period = toPeriodStart(currentMonth)
    return salaryHistory.find(h => h.period === period) ?? null
  }, [salaryHistory, currentMonth])

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleSaveSnapshot = () => {
    if (!effectiveSelectedCoach) return
    saveSnapshotMutation.mutate()
  }

  return (
    <div className="flex h-full gap-6">
      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={isCoach ? t('common.search') || 'Rechercher' : t('common.search') || 'Rechercher un coach'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
            disabled={isCoach}
          />
        </div>
        {coachesLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {displayCoaches.map(c => (
                <Card
                  key={c.id}
                  className={`cursor-pointer transition-colors hover:bg-accent ${effectiveSelectedCoach === c.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => {
                    if (!isCoach) setSelectedCoach(c.id)
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs">{getInitials(c.first_name, c.last_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm">{toUpper(c.first_name)} {toUpper(c.last_name)}</p>
                          {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                        </div>
                      </div>
                      <Badge variant="secondary" className="ml-2 shrink-0">
                        <Users className="h-3 w-3 mr-1" />
                        {c.member_count}
                      </Badge>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border/50 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Fixe {formatCurrency(c.salary ?? 0)}</span>
                        <span>×{c.member_count} adh</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Prime {formatCurrency(c.rate_per_member ?? 0)}/adh</span>
                        <span>Variable {formatCurrency((c.rate_per_member ?? 0) * c.member_count)}</span>
                      </div>
                      <div className="flex justify-between font-semibold text-foreground mt-1 pt-1 border-t border-border/30">
                        <span>Total</span>
                        <span>{formatCurrency((c.salary ?? 0) + (c.rate_per_member ?? 0) * c.member_count)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {displayCoaches.length === 0 && (
                <div className="text-center py-8 px-4">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-1">Aucun coach</p>
                  <p className="text-xs text-muted-foreground/70">
                    Créez un employé avec le rôle "Coach" dans la page{' '}
                    <Link to="/staff" className="text-primary underline underline-offset-2">Staff</Link>
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="flex-1">
        {effectiveSelectedCoach ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  {(() => {
                    const coach = coaches.find(c => c.id === effectiveSelectedCoach)
                    return coach ? `${toUpper(coach.first_name)} ${toUpper(coach.last_name)}` : ''
                  })()}
                </h2>
                <p className="text-sm text-muted-foreground">
                  <span className="inline-flex gap-2">
                    <button
                      onClick={() => setTab('members')}
                      className={tab === 'members' ? 'font-semibold text-foreground' : 'hover:text-foreground'}
                    >
                      {assignedMembers.length} adhérent{assignedMembers.length !== 1 ? 's' : ''} assigné{assignedMembers.length !== 1 ? 's' : ''}
                    </button>
                    <span>·</span>
                    <button
                      onClick={() => setTab('salary')}
                      className={tab === 'salary' ? 'font-semibold text-foreground' : 'hover:text-foreground'}
                    >
                      Salaire
                    </button>
                  </span>
                </p>
              </div>
              {isAdmin && tab === 'members' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher un adhérent"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      className="pl-9 h-9 w-56"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setAddMemberOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Assigner
                  </Button>
                </div>
              )}
              {isAdmin && tab === 'salary' && (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSaveSnapshot} disabled={saveSnapshotMutation.isPending}>
                    {saveSnapshotMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    <History className="h-4 w-4 mr-1" />
                    Enregistrer ce mois
                  </Button>
                </div>
              )}
            </div>

            {tab === 'members' && (
              membersLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : filteredMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Users className="h-12 w-12 mb-4" />
                  <p>{memberSearch ? 'Aucun résultat' : 'Aucun adhérent assigné'}</p>
                </div>
              ) : (
                <div className="rounded-md border">
                  {filteredMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {m.photo_url && <AvatarImage src={m.photo_url} />}
                          <AvatarFallback className="text-xs">{getInitials(m.first_name, m.last_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{toUpper(m.first_name)} {toUpper(m.last_name)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {m.phone && <span>{formatPhone(m.phone)}</span>}
                            <Badge variant={m.status === 'active' ? 'outline' : 'secondary'} className="text-[10px] px-1.5 py-0 h-4">
                              {m.status === 'active' ? 'Actif' : 'Inactif'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => unassignMember.mutate(m.id)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'salary' && selectedCoachData && (
              <div className="space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Salaire — {formatMonth(currentMonth)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium px-2">{formatMonth(currentMonth)}</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextMonth}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                      {currentSnapshot && (
                        <Badge variant="outline" className="text-xs">
                          Snapchat enregistré
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Salaire fixe (DA)</label>
                        <p className="text-lg font-semibold">{formatCurrency(selectedCoachData.salary ?? 0)}</p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs text-muted-foreground">Prime par adhérent (DA)</label>
                        <p className="text-lg font-semibold">{formatCurrency(selectedCoachData.rate_per_member ?? 0)}</p>
                      </div>
                    </div>

                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Adhérents actifs</span>
                        <span className="font-medium">{activeMemberCount}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Variable ({formatCurrency(selectedCoachData.rate_per_member ?? 0)} × {activeMemberCount})</span>
                        <span className="font-medium">{formatCurrency(variableAmount)}</span>
                      </div>
                      <div className="flex justify-between text-base font-bold border-t pt-2">
                        <span>Salaire total</span>
                        <span>{formatCurrency(totalSalary)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {salaryHistory.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Historique des salaires
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left p-3 font-medium">Période</th>
                              <th className="text-right p-3 font-medium">Fixe</th>
                              <th className="text-right p-3 font-medium">Prime/adh</th>
                              <th className="text-right p-3 font-medium">Membres</th>
                              <th className="text-right p-3 font-medium">Variable</th>
                              <th className="text-right p-3 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {salaryHistory.map(h => (
                              <tr key={h.id} className="border-b last:border-0 hover:bg-muted/50">
                                <td className="p-3">
                                  {(() => {
                                    const d = new Date(h.period + 'T00:00:00')
                                    return formatMonth(d)
                                  })()}
                                </td>
                                <td className="p-3 text-right">{formatCurrency(h.fixed_salary)}</td>
                                <td className="p-3 text-right">{formatCurrency(h.rate_per_member)}</td>
                                <td className="p-3 text-right">{h.member_count}</td>
                                <td className="p-3 text-right">{formatCurrency(h.variable_amount)}</td>
                                <td className="p-3 text-right font-semibold">{formatCurrency(h.total_amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{isCoach ? 'Vos adhérents assignés' : 'Sélectionnez un coach'}</p>
            </div>
          </div>
        )}
      </div>

      {addMemberOpen && effectiveSelectedCoach && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setAddMemberOpen(false)}>
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Assigner un adhérent</h3>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un adhérent..."
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="max-h-60">
                <div className="space-y-1">
                  {filteredUnassigned.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Aucun adhérent disponible</p>
                  ) : (
                    filteredUnassigned.map(m => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-accent ${selectedAddMember === m.id ? 'bg-accent ring-1 ring-primary' : ''}`}
                        onClick={() => setSelectedAddMember(m.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">{getInitials(m.first_name, m.last_name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{toUpper(m.first_name)} {toUpper(m.last_name)}</span>
                        </div>
                        {m.phone && <span className="text-xs text-muted-foreground">{formatPhone(m.phone)}</span>}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setAddMemberOpen(false)}>Annuler</Button>
                <Button
                  onClick={() => {
                    if (selectedAddMember && effectiveSelectedCoach) {
                      assignMember.mutate({ memberId: selectedAddMember, coachId: effectiveSelectedCoach })
                    }
                  }}
                  disabled={!selectedAddMember || assignMember.isPending}
                >
                  {assignMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Assigner
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
