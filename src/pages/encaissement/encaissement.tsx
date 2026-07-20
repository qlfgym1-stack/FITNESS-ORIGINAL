import { useState, useMemo, useCallback } from "react"
import { useQuery } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { formatCurrency, toUpper } from "@/lib/utils"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Pagination } from "@/components/ui/pagination"
import { Loader2, Wallet, Search, Download } from "lucide-react"
import { IS_MOCK } from "@/lib/config"

interface EncaissementRow {
  id: string
  type: "subscription" | "pos"
  amount: number
  date: string
  method: string
  status: string
  memberId: string | null
  memberName: string
}

export default function Encaissement() {
  const supabase = useSupabase()
  const t = useT()
  const { organization } = useAuth()
  const orgId = organization?.id

  const today = new Date().toISOString().split("T")[0]
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().split("T")[0]

  const [dateFrom, setDateFrom] = useState(monthStartStr)
  const [dateTo, setDateTo] = useState(today)
  const [methodFilter, setMethodFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [memberSearch, setMemberSearch] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const { data: members } = useQuery({
    queryKey: ["members_minimal"],
    queryFn: async () => {
      if (IS_MOCK || !orgId) return []
      const { data } = await supabase.from("members").select("id, first_name, last_name, phone, member_number").eq("organization_id", orgId).eq("status", "active").order("first_name")
      return data ?? []
    },
    enabled: !!orgId,
  })

  const filteredMembers = useMemo(() => {
    if (!members) return []
    return members.filter(m =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.phone && m.phone.includes(memberSearch))
    )
  }, [members, memberSearch])

  const { data: rawData, isLoading } = useQuery({
    queryKey: ["encaissement", orgId, dateFrom, dateTo],
    queryFn: async () => {
      if (IS_MOCK || !orgId) return []
      const [y, m, d] = dateTo.split("-").map(Number)
      const dateToEnd = new Date(y, m - 1, d + 1)
      const dateToEndStr = `${dateToEnd.getFullYear()}-${String(dateToEnd.getMonth() + 1).padStart(2, "0")}-${String(dateToEnd.getDate()).padStart(2, "0")}`
      const [paymentsRes, posRes] = await Promise.all([
        supabase.from("payments").select("id, amount, payment_date, payment_method, status, member_id, members(first_name, last_name)").eq("organization_id", orgId).eq("status", "completed").gte("payment_date", dateFrom).lt("payment_date", dateToEndStr).order("payment_date", { ascending: false }),
        supabase.from("pos_transactions").select("id, total, created_at, payment_method, payment_status, member_id, members(first_name, last_name)").eq("organization_id", orgId).eq("payment_status", "completed").gte("created_at", dateFrom).lt("created_at", dateToEndStr).order("created_at", { ascending: false }),
      ])
      if (paymentsRes.error) throw paymentsRes.error
      if (posRes.error) throw posRes.error
      const payments = paymentsRes.data
      const pos = posRes.data
      const subs: EncaissementRow[] = ((payments ?? []) as any[]).map(p => ({
        id: p.id,
        type: "subscription" as const,
        amount: Number(p.amount) || 0,
        date: p.payment_date,
        method: p.payment_method,
        status: p.status,
        memberId: p.member_id,
        memberName: p.members ? `${toUpper(p.members.first_name)} ${toUpper(p.members.last_name)}` : "-",
      }))
      const posRows: EncaissementRow[] = ((pos ?? []) as any[]).map(p => ({
        id: p.id,
        type: "pos" as const,
        amount: Number(p.total) || 0,
        date: p.created_at,
        method: p.payment_method ?? "cash",
        status: "completed",
        memberId: p.member_id,
        memberName: p.members ? `${toUpper(p.members.first_name)} ${toUpper(p.members.last_name)}` : "-",
      }))
      return [...subs, ...posRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    },
    enabled: !!orgId,
  })

  const filtered = useMemo(() => {
    if (!rawData) return []
    return rawData.filter(r => {
      if (methodFilter !== "all" && r.method !== methodFilter) return false
      if (typeFilter !== "all" && r.type !== typeFilter) return false
      if (selectedMemberId && r.memberId !== selectedMemberId) return false
      return true
    })
  }, [rawData, methodFilter, typeFilter, selectedMemberId])

  const { page, setPage, totalPages, paginatedData } = usePagination(filtered, 20)

  const periodTotals = useMemo(() => {
    const raw = rawData ?? []
    const now_ = new Date()
    const todayStr = now_.toISOString().split("T")[0]
    const weekStart_ = new Date(now_)
    weekStart_.setDate(now_.getDate() - ((now_.getDay() + 6) % 7))
    const monthStart_ = new Date(now_.getFullYear(), now_.getMonth(), 1)
    let todayTotal = 0, todayCount = 0, weekTotal = 0, weekCount = 0, monthTotal = 0, monthCount = 0
    for (const r of raw) {
      const d = new Date(r.date)
      if (d >= monthStart_) { monthTotal += r.amount; monthCount++ }
      if (d >= weekStart_) { weekTotal += r.amount; weekCount++ }
      if (d.toISOString().split("T")[0] === todayStr) { todayTotal += r.amount; todayCount++ }
    }
    return { todayTotal, todayCount, weekTotal, weekCount, monthTotal, monthCount }
  }, [rawData])

  const totals = useMemo(() => {
    return { total: filtered.reduce((s, r) => s + r.amount, 0), count: filtered.length }
  }, [filtered])

  const handleExport = useCallback(() => {
    const exportData = filtered.map(r => ({
      date: new Date(r.date).toLocaleDateString("fr-FR"),
      type: r.type === "subscription" ? (t("encaissement.subscription") || "Abonnement") : (t("encaissement.pos") || "Vente POS"),
      member: r.memberName,
      amount: r.amount,
      method: r.method,
      status: r.status === "completed" ? (t("encaissement.completed") || "Complété") : r.status === "pending" ? (t("encaissement.pending") || "En attente") : (t("encaissement.cancelled") || "Annulé"),
    }))
    return { exportData }
  }, [filtered, t])

  const { exportCsv } = useExportCsv<Record<string, unknown>>(
    handleExport().exportData as unknown as Record<string, unknown>[],
    "encaissements",
    [
      { key: "date", label: t("encaissement.date") || "Date" },
      { key: "type", label: t("encaissement.type") || "Type" },
      { key: "member", label: t("pos.member") || "Membre" },
      { key: "amount", label: t("payments.amount") || "Montant" },
      { key: "method", label: t("encaissement.method") || "Moyen" },
      { key: "status", label: t("encaissement.status") || "Statut" },
    ]
  )

  const methodBadge = (method: string) => {
    const map: Record<string, string> = {
      cash: "default", card: "secondary", transfer: "outline", other: "destructive",
    }
    return (
      <Badge variant={(map[method] as any) || "outline"}>
        {method === "cash" ? t("encaissement.cash") : method === "card" ? t("encaissement.card") : method === "transfer" ? t("encaissement.transfer") : t("encaissement.other")}
      </Badge>
    )
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "default", pending: "secondary", cancelled: "destructive",
    }
    return (
      <Badge variant={(map[status] as any) || "outline"}>
        {status === "completed" ? t("encaissement.completed") : status === "pending" ? t("encaissement.pending") : t("encaissement.cancelled")}
      </Badge>
    )
  }

  const KpiCard = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <Card className="border border-border/50 shadow-sm">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="rounded-lg p-2.5 shrink-0 bg-[#06b6d415]">
          <Wallet className="h-5 w-5" style={{ color: "#06b6d4" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold tabular-nums mt-0.5">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={t("encaissement.title") || "Encaissements"}
        description={t("encaissement.description") || "Suivi des encaissements et ventes"}
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            {t("encaissement.export") || "Exporter"}
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-3">
        <KpiCard label={t("encaissement.today") || "Aujourd'hui"} value={formatCurrency(periodTotals.todayTotal)} sub={`${periodTotals.todayCount} ${t("encaissement.transactionCount") || "transactions"}`} />
        <KpiCard label={t("encaissement.thisWeek") || "Cette semaine"} value={formatCurrency(periodTotals.weekTotal)} sub={`${periodTotals.weekCount} ${t("encaissement.transactionCount") || "transactions"}`} />
        <KpiCard label={t("encaissement.thisMonth") || "Ce mois"} value={formatCurrency(periodTotals.monthTotal)} sub={`${periodTotals.monthCount} ${t("encaissement.transactionCount") || "transactions"}`} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("encaissement.dateFrom") || "Du"}</label>
              <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0) }} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("encaissement.dateTo") || "Au"}</label>
              <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0) }} className="h-9" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("pos.member") || "Membre"}</label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("pos.searchMember") || "Rechercher..."}
                  value={memberSearch}
                  onChange={e => { setMemberSearch(e.target.value); setSelectedMemberId(null); setPage(0) }}
                  className="pl-7 h-9 text-sm"
                />
              </div>
              {memberSearch && !selectedMemberId && (
                <div className="absolute z-10 mt-1 w-[200px] max-h-[120px] overflow-y-auto border rounded-md bg-background shadow-md">
                  {filteredMembers.slice(0, 5).map(m => (
                    <div
                      key={m.id}
                      className="p-1.5 text-xs cursor-pointer hover:bg-accent truncate"
                      onClick={() => { setSelectedMemberId(m.id); setMemberSearch(`${toUpper(m.first_name)} ${toUpper(m.last_name)}`); setPage(0) }}
                    >
                      {toUpper(m.first_name)} {toUpper(m.last_name)}
                      {m.member_number && <span className="text-muted-foreground ml-1 text-[10px]">({m.member_number})</span>}
                    </div>
                  ))}
                </div>
              )}
              {selectedMemberId && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => { setSelectedMemberId(null); setMemberSearch(""); setPage(0) }}>
                  {t("common.clear") || "Effacer"}
                </Button>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("encaissement.method") || "Moyen"}</label>
              <Select value={methodFilter} onValueChange={v => { setMethodFilter(v); setPage(0) }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("encaissement.allMethods") || "Tous"}</SelectItem>
                  <SelectItem value="cash">{t("encaissement.cash") || "Espèces"}</SelectItem>
                  <SelectItem value="card">{t("encaissement.card") || "Carte"}</SelectItem>
                  <SelectItem value="transfer">{t("encaissement.transfer") || "Virement"}</SelectItem>
                  <SelectItem value="other">{t("encaissement.other") || "Autre"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{t("encaissement.type") || "Type"}</label>
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0) }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("encaissement.allTypes") || "Tous"}</SelectItem>
                  <SelectItem value="subscription">{t("encaissement.subscription") || "Abonnement"}</SelectItem>
                  <SelectItem value="pos">{t("encaissement.pos") || "Vente POS"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="default" size="sm" className="h-9" onClick={() => { setDateFrom(monthStartStr); setDateTo(today); setMethodFilter("all"); setTypeFilter("all"); setMemberSearch(""); setSelectedMemberId(null); setPage(0) }}>
              {t("common.reset") || "Réinitialiser"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">{t("encaissement.noData") || "Aucun encaissement trouvé"}</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left p-3 font-medium">{t("encaissement.date") || "Date"}</th>
                      <th className="text-left p-3 font-medium">{t("encaissement.type") || "Type"}</th>
                      <th className="text-left p-3 font-medium">{t("pos.member") || "Membre"}</th>
                      <th className="text-right p-3 font-medium">{t("payments.amount") || "Montant"}</th>
                      <th className="text-center p-3 font-medium">{t("encaissement.method") || "Moyen"}</th>
                      <th className="text-center p-3 font-medium">{t("encaissement.status") || "Statut"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedData.map(row => (
                      <tr key={`${row.type}-${row.id}`} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="p-3 whitespace-nowrap">{new Date(row.date).toLocaleDateString("fr-FR")}</td>
                        <td className="p-3 whitespace-nowrap">
                          <Badge variant={row.type === "subscription" ? "default" : "secondary"}>
                            {row.type === "subscription" ? (t("encaissement.subscription") || "Abonnement") : (t("encaissement.pos") || "Vente POS")}
                          </Badge>
                        </td>
                        <td className="p-3 whitespace-nowrap">{row.memberName}</td>
                        <td className="p-3 text-right whitespace-nowrap font-medium tabular-nums">{formatCurrency(row.amount)}</td>
                        <td className="p-3 text-center whitespace-nowrap">{methodBadge(row.method)}</td>
                        <td className="p-3 text-center whitespace-nowrap">{statusBadge(row.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Separator />
              <div className="flex items-center justify-between p-3 text-sm">
                <span className="text-muted-foreground">{t("encaissement.itemsCount")?.replace("{count}", String(filtered.length)) || `${filtered.length} encaissement(s)`}</span>
                <span className="font-semibold">{t("pos.total") || "Total"} : {formatCurrency(totals.total)}</span>
              </div>
              <div className="px-3 pb-3">
                <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
