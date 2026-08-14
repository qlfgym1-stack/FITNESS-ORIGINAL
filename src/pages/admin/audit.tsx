import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@/hooks/useQuery"
import { useAuth } from "@/stores/auth"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { PageHeader } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Pagination } from "@/components/ui/pagination"
import { usePagination } from "@/hooks/usePagination"
import { formatDateTime, formatDate } from "@/lib/utils"
import { IS_MOCK } from "@/lib/config"
import type { AuditLog, Json } from "@/types/supabase"
import { Loader2, Search, FilterX } from "lucide-react"

interface Change {
  key: string
  oldValue: Json | null | undefined
  newValue: Json | null | undefined
}

const IGNORED_KEYS = new Set(["created_at", "updated_at"])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isEmpty(value: Json | null | undefined): boolean {
  return value === null || value === undefined
}

function fieldLabel(key: string, t: (k: string) => string): string {
  const value = t(`admin.audit.fieldLabels.${key}`)
  return value && !value.startsWith("admin.audit.fieldLabels.") ? value : key
}

function formatValue(key: string, value: Json | null | undefined, t: (k: string) => string): string {
  if (isEmpty(value)) return "∅"
  if (typeof value === "boolean") return value ? t("admin.audit.yes") || "Oui" : t("admin.audit.no") || "Non"
  if (typeof value === "object") return JSON.stringify(value)
  const s = String(value)
  const isDateKey = /date|_at$|_on$/i.test(key)
  if (isDateKey && !Number.isNaN(Date.parse(s))) return formatDate(s)
  if (UUID_RE.test(s)) return shorten(s, 12)
  return shorten(s, 30)
}

function pick(data: Json | null | undefined, keys: string[]): Json | undefined {
  if (!data || typeof data !== "object" || Array.isArray(data)) return undefined
  const obj = data as Record<string, Json | undefined>
  for (const k of keys) {
    const v = obj[k]
    if (v !== null && v !== undefined) return v
  }
  return undefined
}

function entityName(log: AuditLog, t: (k: string) => string): string {
  const data = log.new_data ?? log.old_data
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, Json | null | undefined>
    const first = obj.first_name
    const last = obj.last_name
    if (typeof first === "string" || typeof last === "string") {
      const name = `${typeof first === "string" ? first : ""} ${typeof last === "string" ? last : ""}`.trim()
      if (name) return name
    }
    for (const k of ["name", "title", "description", "category"]) {
      const v = obj[k]
      if (typeof v === "string" && v.trim()) return shorten(v.trim(), 30)
    }
    if (log.entity_type === "payments" && !isEmpty(obj.amount)) {
      return `${shorten(log.entity_id, 8)} · ${formatValue("amount", obj.amount, t)}`
    }
    const sub = pick(data, ["subscription_id", "formula_id"])
    if (log.entity_type === "member_subscriptions" && typeof sub === "string") return shorten(sub, 12)
  }
  return shorten(log.entity_id, 12)
}

function actionLabel(action: AuditLog["action"], t: (key: string) => string): string {
  switch (action) {
    case "INSERT":
      return t("admin.audit.insert") || "Création"
    case "UPDATE":
      return t("admin.audit.update") || "Modification"
    case "DELETE":
      return t("admin.audit.delete") || "Suppression"
  }
}

function entityLabel(entityType: string, t: (key: string) => string): string {
  const key = `admin.audit.entityTypes.${entityType}`
  const value = t(key)
  return value && !value.startsWith("admin.audit.entityTypes.") ? value : entityType
}

function toDisplay(value: Json | undefined | null): string {
  if (value === null || value === undefined) return "∅"
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function objectEntries(value: Json | null | undefined): [string, Json | undefined][] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return []
  return Object.entries(value)
}

function computeChanges(action: AuditLog["action"], oldData: Json | null, newData: Json | null): Change[] {
  if (action === "INSERT") {
    return objectEntries(newData)
      .filter(([key]) => !IGNORED_KEYS.has(key))
      .map(([key, value]) => ({ key, oldValue: null, newValue: value }))
  }
  if (action === "DELETE") {
    return objectEntries(oldData)
      .filter(([key]) => !IGNORED_KEYS.has(key))
      .map(([key, value]) => ({ key, oldValue: value, newValue: null }))
  }
  const oldEntries = new Map(objectEntries(oldData))
  const newEntries = new Map(objectEntries(newData))
  const keys = new Set([...oldEntries.keys(), ...newEntries.keys()])
  const changes: Change[] = []
  for (const key of keys) {
    if (IGNORED_KEYS.has(key)) continue
    const oldValue = oldEntries.get(key)
    const newValue = newEntries.get(key)
    if (toDisplay(oldValue) !== toDisplay(newValue)) {
      changes.push({ key, oldValue, newValue })
    }
  }
  return changes
}

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

function ChangesCell({ log, t }: { log: AuditLog; t: (key: string) => string }) {
  const changes = useMemo(() => computeChanges(log.action, log.old_data, log.new_data), [log])
  const visible = changes.slice(0, 4)
  const hidden = changes.length - visible.length
  return (
    <div className="max-w-[320px] space-y-0.5">
      {visible.map((c) => (
        <div key={c.key} className="flex items-baseline gap-1 text-xs leading-tight">
          <span className="font-medium text-foreground shrink-0">{fieldLabel(c.key, t)}</span>
          <span className="text-muted-foreground">:</span>
          {!isEmpty(c.oldValue) && (
            <span className="line-through text-muted-foreground truncate">{formatValue(c.key, c.oldValue, t)}</span>
          )}
          {!isEmpty(c.oldValue) && !isEmpty(c.newValue) && <span className="text-muted-foreground shrink-0">→</span>}
          {!isEmpty(c.newValue) && (
            <span className="text-foreground truncate">{formatValue(c.key, c.newValue, t)}</span>
          )}
        </div>
      ))}
      {hidden > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("admin.audit.changedFields")?.replace("{n}", String(hidden)) || `+${hidden} champ(s)`}
        </p>
      )}
      {changes.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
    </div>
  )
}

const ACTION_OPTIONS = ["INSERT", "UPDATE", "DELETE"] as const

export default function AuditPage() {
  const t = useT()
  const { organization, user } = useAuth()
  const supabase = useSupabase()
  const orgId = organization?.id

  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [entityType, setEntityType] = useState("all")
  const [action, setAction] = useState("all")
  const [search, setSearch] = useState("")

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", orgId],
    queryFn: async () => {
      if (IS_MOCK) return []
      if (!orgId) return []
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(2000)
      return (data ?? []) as AuditLog[]
    },
    enabled: !!orgId && !IS_MOCK,
  })

  const { data: staffData } = useQuery({
    queryKey: ["audit-staff", orgId],
    queryFn: async () => {
      if (IS_MOCK) return []
      if (!orgId) return []
      const { data } = await supabase
        .from("staff")
        .select("user_id, first_name, last_name")
        .eq("organization_id", orgId)
      return (data ?? []) as { user_id: string | null; first_name: string; last_name: string }[]
    },
    enabled: !!orgId && !IS_MOCK,
  })

  const staffMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of staffData ?? []) {
      if (s.user_id) map.set(s.user_id, `${s.first_name} ${s.last_name}`.trim())
    }
    return map
  }, [staffData])

  const logs = data ?? []

  const entityTypes = useMemo(() => {
    const set = new Set<string>()
    for (const log of logs) set.add(log.entity_type)
    return Array.from(set).sort()
  }, [logs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return logs.filter((log: AuditLog) => {
      if (action !== "all" && log.action !== action) return false
      if (entityType !== "all" && log.entity_type !== entityType) return false
      if (q) {
        const id = (log.entity_id ?? "").toLowerCase()
        const et = (log.entity_type ?? "").toLowerCase()
        if (!id.includes(q) && !et.includes(q)) return false
      }
      if (dateFrom && new Date(log.created_at) < new Date(`${dateFrom}T00:00:00`)) return false
      if (dateTo && new Date(log.created_at) > new Date(`${dateTo}T23:59:59.999`)) return false
      return true
    })
  }, [logs, action, entityType, search, dateFrom, dateTo])

  const { page, setPage, totalPages, paginatedData, totalItems } = usePagination(filtered, 25)

  useEffect(() => {
    setPage(0)
  }, [dateFrom, dateTo, entityType, action, search, setPage])

  const resolveUser = (userId: string | null): string => {
    if (!userId) return t("admin.audit.system") || "Système"
    if (user?.id && userId === user.id) return t("admin.audit.you") || "Vous"
    return staffMap.get(userId) ?? shorten(userId, 12)
  }

  const resetFilters = () => {
    setDateFrom("")
    setDateTo("")
    setEntityType("all")
    setAction("all")
    setSearch("")
  }

  const hasFilters = dateFrom !== "" || dateTo !== "" || entityType !== "all" || action !== "all" || search !== ""

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.audit.title") || "Journal d'audit"}
        description={t("admin.audit.description") || "Historique des actions effectuées sur les données de l'organisation"}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <CardTitle className="text-lg font-semibold">
              {t("admin.audit.listTitle") || "Journal d'audit"} ({totalItems})
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("admin.audit.searchEntity") || "Rechercher une entité…"}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("admin.audit.from") || "Du"}
              </label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("admin.audit.to") || "Au"}
              </label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("admin.audit.entityType") || "Module"}
              </label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.audit.all") || "Tous"}</SelectItem>
                  {entityTypes.map((et) => (
                    <SelectItem key={et} value={et}>{entityLabel(et, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("admin.audit.action") || "Action"}
              </label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.audit.all") || "Tous"}</SelectItem>
                  {ACTION_OPTIONS.map((a) => (
                    <SelectItem key={a} value={a}>{actionLabel(a, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <Button variant="outline" onClick={resetFilters} className="h-9">
                <FilterX className="h-4 w-4 mr-2" />
                {t("admin.audit.reset") || "Réinitialiser"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("admin.audit.empty") || "Aucun journal d'audit disponible."}
            </p>
          ) : paginatedData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("admin.audit.noResults") || "Aucun résultat pour ces filtres."}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-40">{t("admin.audit.date") || "Date / Heure"}</TableHead>
                    <TableHead className="w-24">{t("admin.audit.action") || "Action"}</TableHead>
                    <TableHead className="w-36">{t("admin.audit.entityType") || "Module"}</TableHead>
                    <TableHead className="w-32">{t("admin.audit.entity") || "Entité"}</TableHead>
                    <TableHead className="w-36">{t("admin.audit.user") || "Utilisateur"}</TableHead>
                    <TableHead>{t("admin.audit.changes") || "Changements"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.action === "DELETE" ? "destructive" : log.action === "UPDATE" ? "secondary" : "default"}
                          className="text-xs"
                        >
                          {actionLabel(log.action, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{entityLabel(log.entity_type, t)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground font-mono" title={log.entity_id}>
                        {entityName(log, t)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" title={log.user_id ?? undefined}>
                        {resolveUser(log.user_id)}
                      </TableCell>
                      <TableCell>
                        <ChangesCell log={log} t={t} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={25}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
