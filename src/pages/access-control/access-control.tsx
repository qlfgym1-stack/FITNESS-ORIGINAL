import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/toast"
import { formatDateTime } from "@/lib/utils"
import {
  Shield, Plus, Search, Edit, Trash2, Wifi, WifiOff, AlertTriangle, UserCheck, Download,
} from "lucide-react"
import type { TurnstileStatus, AccessControl, ManualValidation, Member } from "@/types/supabase"

type TurnstileDashboard = {
  total_terminals: number
  online: number
  offline: number
  fault: number
  manual_validations_today: number
  manual_validations_total: number
}

export default function AccessControlPage() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const [search, setSearch] = useState("")
  const [editingDevice, setEditingDevice] = useState<AccessControl | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [historySearch, setHistorySearch] = useState("")
  const [form, setForm] = useState<{ name: string; type: "turnstile" | "door" | "barrier"; device_id: string; is_active: boolean }>({ name: "", type: "turnstile", device_id: "", is_active: true })

  const { data: dashboardStats } = useQuery({
    queryKey: ["turnstile-dashboard", orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { data } = await (supabase.rpc as any)("get_turnstile_dashboard", { p_organization_id: orgId })
      return data as TurnstileDashboard
    },
    enabled: !!orgId,
  })

  const { data: turnstileDevices } = useQuery({
    queryKey: ["turnstile-devices", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("turnstile_status")
        .select("*")
        .eq("organization_id", orgId)
        .order("terminal")
      return data as TurnstileStatus[]
    },
    enabled: !!orgId,
  })

  const { data: accessDevices } = useQuery({
    queryKey: ["access-devices", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("access_control")
        .select("*")
        .eq("organization_id", orgId)
        .order("name")
      return data as AccessControl[]
    },
    enabled: !!orgId,
  })

  const { data: manualValidations } = useQuery({
    queryKey: ["manual-validations", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("manual_validations")
        .select("*, member:members(first_name, last_name)")
        .eq("organization_id", orgId)
        .order("validated_at", { ascending: false })
      return data as (ManualValidation & { member: Pick<Member, "first_name" | "last_name"> | null })[]
    },
    enabled: !!orgId,
  })

  const upsertMutation = useMutation({
    mutationFn: async (device: { id?: string; name: string; type: string; device_id: string | null; is_active: boolean }) => {
      if (device.id) {
        const { error } = await supabase.from("access_control").update({
          name: device.name, type: device.type as any, device_id: device.device_id, is_active: device.is_active,
        }).eq("id", device.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("access_control").insert({
          organization_id: orgId!, name: device.name, type: device.type as any, device_id: device.device_id, is_active: device.is_active,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-devices"] })
      setDialogOpen(false)
      toast({ title: editingDevice ? t("common.updated") : t("common.created") })
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("access_control").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-devices"] })
      toast({ title: t("common.deleted") })
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" })
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("access_control").update({ is_active }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-devices"] })
    },
  })

  const heartbeatMutation = useMutation({
    mutationFn: async (params: { terminal: string; status: string }) => {
      const { data } = await (supabase.rpc as any)("turnstile_heartbeat", {
        p_organization_id: orgId,
        p_terminal: params.terminal,
        p_status: params.status,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turnstile-devices"] })
      queryClient.invalidateQueries({ queryKey: ["turnstile-dashboard"] })
      toast({ title: t("common.updated") })
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" })
    },
  })

  function openCreate() {
    setEditingDevice(null)
    setForm({ name: "", type: "turnstile", device_id: "", is_active: true })
    setDialogOpen(true)
  }

  function openEdit(d: AccessControl) {
    setEditingDevice(d)
    setForm({ name: d.name, type: d.type, device_id: d.device_id ?? "", is_active: d.is_active })
    setDialogOpen(true)
  }

  function save() {
    upsertMutation.mutate({ id: editingDevice?.id, ...form })
  }

  function remove(id: string) {
    deleteMutation.mutate(id)
  }

  function toggleDevice(id: string, current: boolean) {
    toggleMutation.mutate({ id, is_active: !current })
  }

  const filteredDevices = (accessDevices ?? []).filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.device_id ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const filteredHistory = (manualValidations ?? []).filter((v) =>
    !historySearch ||
    v.member?.first_name.toLowerCase().includes(historySearch.toLowerCase()) ||
    v.member?.last_name.toLowerCase().includes(historySearch.toLowerCase()) ||
    v.reason.includes(historySearch)
  )

  async function exportHistory() {
    if (!manualValidations || manualValidations.length === 0) return
    const { default: XLSX } = await import("xlsx")
    const ws = XLSX.utils.json_to_sheet(
      manualValidations.map((v) => ({
        member: v.member ? `${v.member.first_name} ${v.member.last_name}` : "—",
        reason: v.reason,
        detail: v.reason_detail ?? "",
        terminal: v.terminal ?? "",
        validated_at: v.validated_at,
      }))
    )
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "ManualValidations")
    XLSX.writeFile(wb, "manual-validations.xlsx")
  }

  return (
    <div>
      <PageHeader
        title={t("accessControl.title")}
        description={t("accessControl.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("accessControl.addDevice")}
          </Button>
        }
      />

      {/* Dashboard Stats */}
      {dashboardStats && dashboardStats.total_terminals > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <Wifi className="h-8 w-8 mx-auto mb-2 text-success" />
              <p className="text-3xl font-bold text-success">{dashboardStats.online}</p>
              <p className="text-sm text-muted-foreground">{t("accessControl.connected") || "Connecté"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <WifiOff className="h-8 w-8 mx-auto mb-2 text-warning" />
              <p className="text-3xl font-bold text-warning">{dashboardStats.offline}</p>
              <p className="text-sm text-muted-foreground">{t("accessControl.offline") || "Hors ligne"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
              <p className="text-3xl font-bold text-destructive">{dashboardStats.fault}</p>
              <p className="text-sm text-muted-foreground">{t("accessControl.fault") || "En panne"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <UserCheck className="h-8 w-8 mx-auto mb-2" />
              <p className="text-3xl font-bold">{dashboardStats.manual_validations_today}</p>
              <p className="text-sm text-muted-foreground">{t("accessControl.validationsToday") || "Validations manuelles ajd"}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs defaultValue="turnstiles">
        <TabsList className="mb-4">
          <TabsTrigger value="turnstiles">{t("accessControl.turnstiles") || "Tourniquets"}</TabsTrigger>
          <TabsTrigger value="devices">{t("accessControl.devices")}</TabsTrigger>
          <TabsTrigger value="history">{t("accessControl.history") || "Historique"}</TabsTrigger>
        </TabsList>

        <TabsContent value="turnstiles">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accessControl.terminal") || "Terminal"}</TableHead>
                  <TableHead>{t("accessControl.status") || "Statut"}</TableHead>
                  <TableHead>{t("accessControl.lastHeartbeat") || "Dernier battement"}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(turnstileDevices ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                ) : (turnstileDevices ?? []).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium font-mono">{d.terminal}</TableCell>
                    <TableCell>
                      <Badge variant={
                        d.status === "online" ? "default" :
                        d.status === "offline" ? "secondary" : "destructive"
                      }>
                        {d.status === "online" ? <Wifi className="h-3 w-3 mr-1" /> :
                         d.status === "offline" ? <WifiOff className="h-3 w-3 mr-1" /> :
                         <AlertTriangle className="h-3 w-3 mr-1" />}
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.last_heartbeat ? formatDateTime(d.last_heartbeat) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => heartbeatMutation.mutate({ terminal: d.terminal, status: "online" })}>
                          {t("accessControl.markOnline") || "Marquer en ligne"}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => heartbeatMutation.mutate({ terminal: d.terminal, status: "offline" })}>
                          {t("accessControl.markOffline") || "Marquer hors ligne"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="devices">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accessControl.deviceName")}</TableHead>
                  <TableHead>{t("accessControl.type")}</TableHead>
                  <TableHead>{t("accessControl.deviceId")}</TableHead>
                  <TableHead>{t("accessControl.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("common.noResults")}
                    </TableCell>
                  </TableRow>
                ) : filteredDevices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        {d.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.type}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{d.device_id ?? "—"}</TableCell>
                    <TableCell>
                      <Switch checked={d.is_active} onCheckedChange={() => toggleDevice(d.id, d.is_active)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder={t("common.search")} value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" onClick={exportHistory}>
              <Download className="mr-2 h-4 w-4" /> {t("common.export")}
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accessControl.member")}</TableHead>
                  <TableHead>{t("accessControl.reason") || "Motif"}</TableHead>
                  <TableHead>{t("accessControl.detail") || "Détail"}</TableHead>
                  <TableHead>{t("accessControl.terminal") || "Terminal"}</TableHead>
                  <TableHead>{t("accessControl.date") || "Date"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHistory.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {t("common.noData")}
                    </TableCell>
                  </TableRow>
                ) : filteredHistory.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      {v.member ? `${v.member.first_name} ${v.member.last_name}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.reason}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.reason_detail ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{v.terminal ?? "—"}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(v.validated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDevice ? t("accessControl.editDevice") : t("accessControl.addDevice")}</DialogTitle>
            <DialogDescription>{t("accessControl.deviceFormDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("accessControl.deviceName")}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("accessControl.type")}</Label>
                <Select value={form.type} onValueChange={(v: "turnstile" | "door" | "barrier") => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turnstile">Turnstile</SelectItem>
                    <SelectItem value="door">Door</SelectItem>
                    <SelectItem value="barrier">Barrier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("accessControl.deviceId")}</Label>
                <Input value={form.device_id} onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
