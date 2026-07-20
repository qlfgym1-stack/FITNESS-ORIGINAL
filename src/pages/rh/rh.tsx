import { useState, useMemo } from 'react'
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
import { getInitials, toUpper, formatPhone } from '@/lib/utils'
import { Search, Users, Loader2, UserCheck, DollarSign, History, Calendar, Wallet, X, Plus, Save } from 'lucide-react'

interface StaffRow {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  role: string | null
  salary: number | null
  rate_per_member: number | null
  is_active: boolean
}

interface StaffLeaveRow {
  id: string
  start_date: string
  end_date: string
  type: string
  status: string
  reason: string | null
}

interface SalaryPayment {
  id: string
  amount: number
  payment_date: string
  payment_method: string
  period: string
  notes: string | null
  created_at: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-DZ', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' DA'
}

function formatDate(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(date: string): string {
  return new Date(date).toLocaleDateString('fr-DZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function RhPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization, user } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const [search, setSearch] = useState('')
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null)
  const [tab, setTab] = useState<'salary' | 'payments' | 'leaves'>('salary')
  const [salary, setSalary] = useState('')
  const [rate, setRate] = useState('')
  const [loaded, setLoaded] = useState(false)

  const [paymentDialog, setPaymentDialog] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer' | 'check'>('cash')
  const [payPeriod, setPayPeriod] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [payNotes, setPayNotes] = useState('')

  const { data: staffList = [], isLoading: staffLoading } = useQuery({
    queryKey: ['rh-staff-list', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from('staff')
        .select('id, first_name, last_name, email, phone, role, salary, rate_per_member, is_active')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('first_name')
      return (data ?? []) as StaffRow[]
    },
    enabled: !!orgId,
  })

  const selectedStaffData = useMemo(() => {
    return staffList.find(s => s.id === selectedStaff) ?? null
  }, [staffList, selectedStaff])

  const isCoach = selectedStaffData?.role === 'coach'

  const { data: payments = [] } = useQuery({
    queryKey: ['staff-payments', selectedStaff],
    queryFn: async () => {
      if (!selectedStaff) return []
      const { data } = await supabase
        .from('staff_salary_payments')
        .select('*')
        .eq('staff_id', selectedStaff)
        .order('payment_date', { ascending: false })
      return (data ?? []) as SalaryPayment[]
    },
    enabled: !!selectedStaff,
  })

  const { data: leaves = [] } = useQuery({
    queryKey: ['staff-leaves-rh', selectedStaff],
    queryFn: async () => {
      if (!selectedStaff) return []
      const { data } = await supabase
        .from('staff_leaves')
        .select('*')
        .eq('staff_id', selectedStaff)
        .order('start_date', { ascending: false })
      return (data ?? []) as StaffLeaveRow[]
    },
    enabled: !!selectedStaff,
  })

  const updateSalaryMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStaff) return
      const numSalary = salary === '' ? 0 : Number(salary)
      const numRate = rate === '' ? 0 : Number(rate)
      const { error } = await supabase
        .from('staff')
        .update({ salary: numSalary, ...(isCoach ? { rate_per_member: numRate } : {}) })
        .eq('id', selectedStaff)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rh-staff-list'] })
      toast({ title: 'Salaire mis à jour' })
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  })

  const addPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!orgId || !selectedStaff) return
      const { error } = await supabase.from('staff_salary_payments').insert({
        organization_id: orgId,
        staff_id: selectedStaff,
        amount: Number(payAmount),
        payment_date: payDate,
        payment_method: payMethod,
        period: payPeriod,
        notes: payNotes || null,
        created_by: user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-payments'] })
      toast({ title: 'Paiement enregistré' })
      setPaymentDialog(false)
      setPayAmount('')
      setPayNotes('')
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  })

  const filteredStaff = staffList.filter(s =>
    `${s.first_name} ${s.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const totalPaid = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amount, 0)
  }, [payments])

  const loadStaffData = (staff: StaffRow) => {
    setSelectedStaff(staff.id)
    setSalary(staff.salary?.toString() ?? '')
    setRate(staff.rate_per_member?.toString() ?? '')
    setLoaded(true)
    setTab('salary')
  }

  const roleLabel = (role: string | null) => {
    const labels: Record<string, string> = { coach: 'Coach', staff: 'Staff', receptionist: 'Réceptionniste', cleaner: 'Ménage', manager: 'Manager', trainer: 'Entraîneur' }
    return labels[role ?? ''] ?? role ?? ''
  }

  const typeLabel = (type: string) => {
    const labels: Record<string, string> = { vacation: 'Congé', sick: 'Maladie', personal: 'Personnel' }
    return labels[type] ?? type
  }

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = { approved: 'outline', pending: 'secondary', rejected: 'destructive' }
    return <Badge variant={(variants[status] as any) ?? 'secondary'} className="text-[10px] px-1.5 py-0 h-4">{status === 'approved' ? 'Approuvé' : status === 'pending' ? 'En attente' : 'Refusé'}</Badge>
  }

  const methodLabel = (method: string) => {
    const labels: Record<string, string> = { cash: 'Espèces', transfer: 'Virement', check: 'Chèque' }
    return labels[method] ?? method
  }

  return (
    <div className="flex h-full gap-6">
      <div className="w-72 shrink-0 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {staffLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-2">
              {filteredStaff.map(s => (
                <Card
                  key={s.id}
                  className={`cursor-pointer transition-colors hover:bg-accent ${selectedStaff === s.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => loadStaffData(s)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">{getInitials(s.first_name, s.last_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{toUpper(s.first_name)} {toUpper(s.last_name)}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">{roleLabel(s.role)}</Badge>
                          <span className="text-xs text-muted-foreground">{formatCurrency(s.salary ?? 0)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredStaff.length === 0 && (
                <div className="text-center py-8 text-sm text-muted-foreground">Aucun employé</div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      <div className="flex-1">
        {selectedStaff && selectedStaffData ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{toUpper(selectedStaffData.first_name)} {toUpper(selectedStaffData.last_name)}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  {selectedStaffData.email}
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">{roleLabel(selectedStaffData.role)}</Badge>
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setTab('salary')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === 'salary' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                  <DollarSign className="h-4 w-4 inline mr-1" />Salaire
                </button>
                <button onClick={() => setTab('payments')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === 'payments' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Wallet className="h-4 w-4 inline mr-1" />Paiements
                </button>
                <button onClick={() => setTab('leaves')} className={`px-3 py-1.5 text-sm rounded-md transition-colors ${tab === 'leaves' ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Calendar className="h-4 w-4 inline mr-1" />Congés
                </button>
              </div>
            </div>

            {tab === 'salary' && (
              <div className="max-w-md space-y-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Configuration salaire
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Salaire fixe (DA)</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={salary}
                        onChange={e => setSalary(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                    {isCoach && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Prime par adhérent (DA)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={rate}
                          onChange={e => setRate(e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                    )}
                    <Button className="w-full" onClick={() => updateSalaryMutation.mutate()} disabled={updateSalaryMutation.isPending}>
                      {updateSalaryMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Save className="h-4 w-4 mr-2" />Enregistrer
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {tab === 'payments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Total versé : <span className="font-semibold text-foreground">{formatCurrency(totalPaid)}</span>
                  </p>
                  <Button size="sm" onClick={() => {
                    setPayAmount('')
                    setPayDate(new Date().toISOString().slice(0, 10))
                    setPayMethod('cash')
                    const d = new Date()
                    setPayPeriod(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
                    setPayNotes('')
                    setPaymentDialog(true)
                  }}>
                    <Plus className="h-4 w-4 mr-1" />Nouveau paiement
                  </Button>
                </div>
                {payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Wallet className="h-12 w-12 mb-4" />
                    <p>Aucun paiement enregistré</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    {payments.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{formatCurrency(p.amount)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(p.payment_date)}</span>
                            <span>·</span>
                            <span>{methodLabel(p.payment_method)}</span>
                            <span>·</span>
                            <span>Période {p.period}</span>
                          </div>
                          {p.notes && <p className="text-xs text-muted-foreground mt-0.5">{p.notes}</p>}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatDateTime(p.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'leaves' && (
              <div>
                {leaves.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Calendar className="h-12 w-12 mb-4" />
                    <p>Aucun congé</p>
                  </div>
                ) : (
                  <div className="rounded-md border">
                    {leaves.map(l => (
                      <div key={l.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{typeLabel(l.type)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{formatDate(l.start_date)} → {formatDate(l.end_date)}</span>
                          </div>
                          {l.reason && <p className="text-xs text-muted-foreground mt-0.5">{l.reason}</p>}
                        </div>
                        {statusBadge(l.status)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Sélectionnez un employé</p>
            </div>
          </div>
        )}
      </div>

      {paymentDialog && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setPaymentDialog(false)}>
          <div className="bg-background rounded-lg shadow-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Nouveau paiement</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Montant (DA)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Méthode</label>
                <div className="flex gap-2">
                  {(['cash', 'transfer', 'check'] as const).map(m => (
                    <Button
                      key={m}
                      variant={payMethod === m ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPayMethod(m)}
                    >
                      {methodLabel(m)}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Période</label>
                <Input
                  type="month"
                  value={payPeriod}
                  onChange={e => setPayPeriod(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Notes (optionnel)</label>
                <Input
                  type="text"
                  value={payNotes}
                  onChange={e => setPayNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPaymentDialog(false)}>Annuler</Button>
                <Button
                  onClick={() => addPaymentMutation.mutate()}
                  disabled={!payAmount || Number(payAmount) <= 0 || addPaymentMutation.isPending}
                >
                  {addPaymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}