import { useState, useMemo } from 'react'
import { useQuery } from '@/hooks/useQuery'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { IS_MOCK } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, History, Inbox } from 'lucide-react'
import { formatDateTime, formatCurrency, formatDate } from '@/lib/utils'

type HistoryModule = 'subscription' | 'payment' | 'attendance' | 'pos' | 'rfid' | 'audit'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

interface HistoryEntry {
  id: string
  module: HistoryModule
  timestamp: string
  label: string
  detail: string
  badgeVariant: BadgeVariant
}

interface MemberHistoryDialogProps {
  memberId: string
  memberName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MODULES: HistoryModule[] = ['subscription', 'payment', 'attendance', 'pos', 'rfid', 'audit']

const MODULE_BADGE_VARIANT: Record<HistoryModule, BadgeVariant> = {
  subscription: 'default',
  payment: 'secondary',
  attendance: 'outline',
  pos: 'outline',
  rfid: 'destructive',
  audit: 'outline',
}

const MODULE_COLORS: Record<HistoryModule, string> = {
  subscription: 'bg-primary/10 text-primary border-primary/30',
  payment: 'bg-success/10 text-success border-success/30',
  attendance: 'bg-accent/10 text-accent border-accent/30',
  pos: 'bg-secondary/10 text-secondary border-secondary/30',
  rfid: 'bg-warning/10 text-warning border-warning/30',
  audit: 'bg-muted text-muted-foreground border-muted-foreground/30',
}

export function MemberHistoryDialog({ memberId, memberName, open, onOpenChange }: MemberHistoryDialogProps) {
  const t = useT()
  const supabase = useSupabase()
  const { organization } = useAuth()
  const orgId = organization?.id
  const [moduleFilter, setModuleFilter] = useState<'all' | HistoryModule>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const moduleLabel = (m: HistoryModule) => {
    const labels: Record<HistoryModule, string> = {
      subscription: t('members.history.module.subscription') || 'Abonnement',
      payment: t('members.history.module.payment') || 'Paiement',
      attendance: t('members.history.module.attendance') || 'Présence',
      pos: t('members.history.module.pos') || 'POS',
      rfid: t('members.history.module.rfid') || 'Badge',
      audit: t('members.history.module.audit') || 'Audit',
    }
    return labels[m]
  }

  const { data: entries, isLoading } = useQuery({
    queryKey: ['member-history', memberId],
    queryFn: async () => {
      if (IS_MOCK) return []
      const [subs, payments, attendance, pos, rfid, audit] = await Promise.all([
        supabase
          .from('member_subscriptions')
          .select('id, subscription_type_id, subscription_types!inner(name), start_date, end_date, total_amount, status, created_at')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false }),
        supabase
          .from('payments')
          .select('id, amount, payment_date, payment_method, status, created_at')
          .eq('member_id', memberId)
          .order('payment_date', { ascending: false }),
        supabase
          .from('attendance')
          .select('id, check_in, check_out, type, source, created_at')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false }),
        supabase
          .from('pos_transactions')
          .select('id, total, payment_method, payment_status, created_at')
          .eq('member_id', memberId)
          .order('created_at', { ascending: false }),
        (async () => {
          try {
            const { data } = await supabase
              .from('rfid_audit_log')
              .select('id, action, reason, notes, created_at')
              .eq('member_id', memberId)
              .order('created_at', { ascending: false })
            return data ?? []
          } catch {
            return []
          }
        })(),
        (async () => {
          try {
            const { data } = await supabase
              .from('audit_logs')
              .select('id, action, created_at')
              .eq('entity_type', 'members')
              .eq('entity_id', memberId)
              .order('created_at', { ascending: false })
            return data ?? []
          } catch {
            return []
          }
        })(),
      ])

      const result: HistoryEntry[] = []
      for (const s of (subs.data ?? []) as any[]) {
        result.push({
          id: s.id,
          module: 'subscription',
          timestamp: s.created_at || s.start_date,
          label: `${t('members.history.subscription') || 'Abonnement'} — ${s.subscription_types?.name || '—'}`,
          detail: `${t('members.history.from') || 'Du'} ${formatDate(s.start_date)} ${t('members.history.to') || 'au'} ${formatDate(s.end_date)} · ${s.status} · ${formatCurrency(s.total_amount)}`,
          badgeVariant: MODULE_BADGE_VARIANT.subscription,
        })
      }
      for (const p of (payments.data ?? []) as any[]) {
        result.push({
          id: p.id,
          module: 'payment',
          timestamp: p.payment_date || p.created_at,
          label: `${t('members.history.payment') || 'Paiement'} ${formatCurrency(p.amount)}`,
          detail: `${formatDateTime(p.payment_date || p.created_at)} · ${p.payment_method || '—'} · ${p.status || '—'}`,
          badgeVariant: MODULE_BADGE_VARIANT.payment,
        })
      }
      for (const a of (attendance.data ?? []) as any[]) {
        result.push({
          id: a.id,
          module: 'attendance',
          timestamp: a.check_in || a.created_at,
          label: t('members.history.attendance') || 'Entrée/Sortie',
          detail: `${t('members.history.in') || 'In'} ${a.check_in ? formatDateTime(a.check_in) : '—'} · ${t('members.history.out') || 'Out'} ${a.check_out ? formatDateTime(a.check_out) : '—'} · ${a.source || '—'}`,
          badgeVariant: MODULE_BADGE_VARIANT.attendance,
        })
      }
      for (const p of (pos.data ?? []) as any[]) {
        result.push({
          id: p.id,
          module: 'pos',
          timestamp: p.created_at,
          label: `${t('members.history.posSale') || 'Vente POS'} ${formatCurrency(p.total)}`,
          detail: `${formatDateTime(p.created_at)} · ${p.payment_method || '—'} · ${p.payment_status || '—'}`,
          badgeVariant: MODULE_BADGE_VARIANT.pos,
        })
      }
      for (const r of (rfid ?? []) as any[]) {
        result.push({
          id: r.id,
          module: 'rfid',
          timestamp: r.created_at,
          label: `${t('members.history.rfid') || 'Badge'} ${r.action || '—'}`,
          detail: [r.reason, r.notes].filter(Boolean).join(' · ') || (t('members.history.noDetails') || 'Aucun détail'),
          badgeVariant: MODULE_BADGE_VARIANT.rfid,
        })
      }
      for (const a of (audit ?? []) as any[]) {
        result.push({
          id: a.id,
          module: 'audit',
          timestamp: a.created_at,
          label: `${t('members.history.audit') || 'Action'} ${a.action || '—'}`,
          detail: formatDateTime(a.created_at),
          badgeVariant: MODULE_BADGE_VARIANT.audit,
        })
      }
      return result.sort((x, y) => new Date(y.timestamp).getTime() - new Date(x.timestamp).getTime())
    },
    enabled: !!orgId && !!memberId && open,
  })

  const filtered = useMemo(() => {
    const list = entries ?? []
    return list.filter((e: HistoryEntry) => {
      if (moduleFilter !== 'all' && e.module !== moduleFilter) return false
      const ts = new Date(e.timestamp).getTime()
      if (dateFrom && ts < new Date(`${dateFrom}T00:00:00`).getTime()) return false
      if (dateTo && ts > new Date(`${dateTo}T23:59:59.999`).getTime()) return false
      return true
    })
  }, [entries, moduleFilter, dateFrom, dateTo])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            {t('members.history.title') || 'Historique'} — {memberName}
          </DialogTitle>
          <DialogDescription>
            {t('members.history.description') || `Activité complète de ${memberName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 grid grid-cols-1 sm:grid-cols-3 gap-3 pb-4 border-b border-border/50">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
              {t('members.history.moduleFilter') || 'Module'}
            </label>
            <Select value={moduleFilter} onValueChange={(v) => setModuleFilter(v as 'all' | HistoryModule)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={t('members.history.all') || 'Tous'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('members.history.all') || 'Tous'}</SelectItem>
                {MODULES.map((m) => (
                  <SelectItem key={m} value={m}>{moduleLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
              {t('members.history.dateFrom') || 'Du'}
            </label>
            <Input type="date" className="h-9" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
              {t('members.history.dateTo') || 'Au'}
            </label>
            <Input type="date" className="h-9" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0 -mx-6 px-6 space-y-2 pb-2">
          {isLoading && (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">{t('members.history.empty') || 'Aucune activité'}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('members.history.emptyHint') || 'Aucun événement ne correspond aux critères'}</p>
            </div>
          )}
          {!isLoading && filtered.map((entry: HistoryEntry) => (
            <Card key={`${entry.module}-${entry.id}`} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={entry.badgeVariant} className={`shrink-0 ${MODULE_COLORS[entry.module]}`}>{moduleLabel(entry.module)}</Badge>
                  <p className="text-sm font-medium truncate">{entry.label}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDateTime(entry.timestamp)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{entry.detail}</p>
            </Card>
          ))}
        </div>

        <div className="shrink-0 flex justify-end border-t border-border/50 pt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>{t('common.close') || 'Fermer'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
