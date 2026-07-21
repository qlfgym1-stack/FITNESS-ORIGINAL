import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@/hooks/useQuery'
import { useAutoSave } from '@/hooks/useAutoSave'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toast'
import { Loader2, DollarSign, Check, X } from 'lucide-react'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('fr-DZ', { style: 'decimal', maximumFractionDigits: 0 }).format(amount) + ' DA'
}

export default function CoachPortalPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const [salary, setSalary] = useState('')
  const [rate, setRate] = useState('')
  const [loaded, setLoaded] = useState(false)
  const lastSavedSalaryRef = useRef('')
  const lastSavedRateRef = useRef('')

  const { isLoading } = useQuery({
    queryKey: ['org-coach-defaults', orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { data } = await supabase
        .from('organizations')
        .select('coach_default_salary, coach_default_rate_per_member')
        .eq('id', orgId)
        .single()
      if (data) {
        const s = data.coach_default_salary?.toString() ?? ''
        const r = data.coach_default_rate_per_member?.toString() ?? ''
        setSalary(s)
        setRate(r)
        lastSavedSalaryRef.current = s
        lastSavedRateRef.current = r
        setLoaded(true)
      }
      return data
    },
    enabled: !!orgId,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) return
      const numSalary = salary === '' ? 0 : Number(salary)
      const numRate = rate === '' ? 0 : Number(rate)
      const { error: orgError } = await supabase
        .from('organizations')
        .update({ coach_default_salary: numSalary, coach_default_rate_per_member: numRate })
        .eq('id', orgId)
      if (orgError) throw orgError
      const { error: staffError } = await supabase
        .from('staff')
        .update({ salary: numSalary, rate_per_member: numRate })
        .eq('organization_id', orgId)
        .eq('role', 'coach')
        .eq('is_active', true)
      if (staffError) throw staffError
    },
    onSuccess: () => {
      lastSavedSalaryRef.current = salary
      lastSavedRateRef.current = rate
      queryClient.invalidateQueries({ queryKey: ['org-coach-defaults'] })
      queryClient.invalidateQueries({ queryKey: ['coaches-with-count'] })
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  })

  const salaryDirty = salary !== lastSavedSalaryRef.current || rate !== lastSavedRateRef.current
  const { status: saveStatus } = useAutoSave({
    dirty: salaryDirty && loaded,
    onSave: () => saveMutation.mutateAsync(),
  })

  return (
    <div className="max-w-lg mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Paramètres salaire coach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading && !loaded ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Salaire fixe (DA)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={salary}
                  onChange={e => setSalary(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Prime par adhérent (DA)</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={rate}
                  onChange={e => setRate(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div className="pt-2 text-sm text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>Par mois par coach</span>
                  <span>Fixe {formatCurrency(Number(salary || 0))} × {formatCurrency(Number(rate || 0))}/adh</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <div>
                  {saveStatus === 'saving' && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Sauvegarde...
                    </span>
                  )}
                  {saveStatus === 'saved' && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Sauvegardé
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-xs text-destructive flex items-center gap-1">
                      <X className="h-3 w-3" /> Erreur
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}