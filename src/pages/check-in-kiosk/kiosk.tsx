import { useState, useEffect, useCallback, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { getInitials, formatDateTime } from "@/lib/utils"
import {
  Search, CheckCircle2, XCircle, Clock, Loader2, UserCheck,
  CreditCard, ShieldAlert, Wifi, WifiOff, AlertTriangle,
} from "lucide-react"
import type { RfidReadLog, Member, ManualValidation } from "@/types/supabase"

type ScanResult = {
  result: "granted" | "denied" | "pending"
  reason?: string
  member_id?: string
  attendance_id?: string
}

type TurnstileDashboard = {
  total_terminals: number
  online: number
  offline: number
  fault: number
  manual_validations_today: number
  manual_validations_total: number
}

const KIOSK_TERMINAL = "kiosk-01"

export default function KioskPage() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization, user, roles } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id
  const userId = user?.id
  const inputRef = useRef<HTMLInputElement>(null)

  const [cardUid, setCardUid] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [memberSearch, setMemberSearch] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [manualReason, setManualReason] = useState("")
  const [manualDetail, setManualDetail] = useState("")
  const [showManualDialog, setShowManualDialog] = useState(false)

  const canManualValidate = roles?.some(r => r.role === "admin" || r.role === "super_admin" || r.role === "staff")

  const { data: turnstileStats } = useQuery({
    queryKey: ["turnstile-dashboard", orgId],
    queryFn: async () => {
      if (!orgId) return null
      const { data } = await (supabase.rpc as any)("get_turnstile_dashboard", { p_organization_id: orgId })
      return data as TurnstileDashboard
    },
    enabled: !!orgId,
  })

  const { data: recentLogs } = useQuery({
    queryKey: ["rfid-recent-logs", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("rfid_read_logs")
        .select("*, member:members(first_name, last_name, photo_url)")
        .order("read_at", { ascending: false })
        .limit(10)
      return data as (RfidReadLog & { member: Pick<Member, "first_name" | "last_name" | "photo_url"> | null })[]
    },
    enabled: !!orgId,
  })

  const { data: members } = useQuery({
    queryKey: ["members-search", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("members")
        .select("id, first_name, last_name, photo_url")
        .eq("organization_id", orgId)
        .eq("status", "active")
        .order("first_name")
      return data as Pick<Member, "id" | "first_name" | "last_name" | "photo_url">[]
    },
    enabled: !!orgId,
  })

  const rfidCheckInMutation = useMutation({
    mutationFn: async (uid: string) => {
      const { data } = await (supabase.rpc as any)("rfid_check_in", {
        p_card_uid: uid,
        p_terminal: KIOSK_TERMINAL,
      })
      return data as ScanResult
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rfid-recent-logs"] })
      queryClient.invalidateQueries({ queryKey: ["turnstile-dashboard"] })
      if (data.result === "granted") {
        toast({ title: t("kiosk.granted") || "Accès autorisé", variant: "default" })
      } else if (data.result === "denied") {
        toast({ title: t("kiosk.denied") || "Accès refusé", description: data.reason, variant: "destructive" })
      } else {
        toast({ title: t("kiosk.pending") || "En attente", description: data.reason })
      }
    },
    onError: (err: Error) => {
      toast({ title: t("common.error") || "Error", description: err.message, variant: "destructive" })
    },
  })

  const rfidCheckOutMutation = useMutation({
    mutationFn: async (uid: string) => {
      const { data } = await (supabase.rpc as any)("rfid_check_out", {
        p_card_uid: uid,
        p_terminal: KIOSK_TERMINAL,
      })
      return data as ScanResult
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rfid-recent-logs"] })
      if (data.result === "granted") {
        toast({ title: t("kiosk.checkOutSuccess") || "Check-out effectué" })
      } else {
        toast({ title: t("kiosk.denied") || "Accès refusé", description: data.reason, variant: "destructive" })
      }
    },
    onError: (err: Error) => {
      toast({ title: t("common.error") || "Error", description: err.message, variant: "destructive" })
    },
  })

  const manualCheckInMutation = useMutation({
    mutationFn: async (params: { member_id: string; user_id: string; reason: string; terminal?: string; reason_detail?: string }) => {
      const { data } = await (supabase.rpc as any)("manual_check_in", params)
      return data as ScanResult
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rfid-recent-logs"] })
      queryClient.invalidateQueries({ queryKey: ["turnstile-dashboard"] })
      setShowManualDialog(false)
      setSelectedMemberId(null)
      setManualReason("")
      setManualDetail("")
      if (data.result === "granted") {
        toast({ title: t("kiosk.manualSuccess") || "Validation manuelle effectuée" })
      } else {
        toast({ title: t("kiosk.denied") || "Accès refusé", description: data.reason, variant: "destructive" })
      }
    },
    onError: (err: Error) => {
      toast({ title: t("common.error") || "Error", description: err.message, variant: "destructive" })
    },
  })

  const handleScan = useCallback(async () => {
    const uid = cardUid.trim()
    if (!uid) return
    setIsScanning(true)
    setScanResult(null)
    await rfidCheckInMutation.mutateAsync(uid)
    setScanResult(rfidCheckInMutation.data ?? null)
    setCardUid("")
    setIsScanning(false)
    inputRef.current?.focus()
  }, [cardUid, rfidCheckInMutation])

  const handleCheckOut = useCallback(async () => {
    const uid = cardUid.trim()
    if (!uid) return
    setIsScanning(true)
    await rfidCheckOutMutation.mutateAsync(uid)
    setCardUid("")
    setIsScanning(false)
    inputRef.current?.focus()
  }, [cardUid, rfidCheckOutMutation])

  const handleManualValidate = useCallback(() => {
    if (!selectedMemberId || !manualReason || !userId) return
    manualCheckInMutation.mutate({
      member_id: selectedMemberId,
      user_id: userId,
      reason: manualReason,
      terminal: KIOSK_TERMINAL,
      reason_detail: manualDetail || undefined,
    })
  }, [selectedMemberId, manualReason, userId, manualDetail, manualCheckInMutation])

  useEffect(() => {
    if (scanResult && scanResult.result === "granted") {
      const timer = setTimeout(() => setScanResult(null), 4000)
      return () => clearTimeout(timer)
    }
  }, [scanResult])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const filteredMembers = (members ?? []).filter((m) =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const turnstileStatusIcon = () => {
    if (!turnstileStats || turnstileStats.total_terminals === 0) return <WifiOff className="h-5 w-5 text-muted-foreground" />
    if (turnstileStats.fault > 0) return <AlertTriangle className="h-5 w-5 text-destructive" />
    if (turnstileStats.offline > 0) return <WifiOff className="h-5 w-5 text-warning" />
    return <Wifi className="h-5 w-5 text-success" />
  }

  const turnstileStatusLabel = () => {
    if (!turnstileStats || turnstileStats.total_terminals === 0) return t("kiosk.noTerminals") || "Aucun tourniquet"
    if (turnstileStats.fault > 0) return t("kiosk.turnstileFault") || "Tourniquet en panne"
    if (turnstileStats.offline > 0) return t("kiosk.turnstileOffline") || "Tourniquet hors ligne"
    return t("kiosk.turnstileOnline") || "Tourniquet connecté"
  }

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">{t("kiosk.title") || "Check-in Kiosk"}</h1>
          <p className="text-muted-foreground">{t("kiosk.subtitle") || "Scanner le badge RFID"}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            {turnstileStatusIcon()}
            <span>{turnstileStatusLabel()}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Input
                      ref={inputRef}
                      placeholder={t("kiosk.rfidPlaceholder") || "Scanner le badge RFID..."}
                      value={cardUid}
                      onChange={(e) => setCardUid(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleScan()
                      }}
                      className="h-14 text-lg"
                      autoFocus
                    />
                  </div>
                  <Button
                    size="lg"
                    onClick={handleScan}
                    disabled={!cardUid.trim() || isScanning}
                    className="h-14 px-6"
                  >
                    {isScanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                    {t("kiosk.scan") || "Scan"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleCheckOut}
                    disabled={!cardUid.trim() || isScanning}
                    className="h-14 px-6"
                  >
                    {t("kiosk.checkOut") || "Sortie"}
                  </Button>
                </div>

                {scanResult && (
                  <div className={`mt-4 p-4 rounded-lg border flex items-center gap-3 ${
                    scanResult.result === "granted" ? "bg-success/10 border-success" :
                    scanResult.result === "denied" ? "bg-destructive/10 border-destructive" :
                    "bg-warning/10 border-warning"
                  }`}>
                    {scanResult.result === "granted" ? <CheckCircle2 className="h-8 w-8 text-success" /> :
                     scanResult.result === "denied" ? <XCircle className="h-8 w-8 text-destructive" /> :
                     <Clock className="h-8 w-8 text-warning" />}
                    <div>
                      <p className="font-semibold text-lg">
                        {scanResult.result === "granted" ? (t("kiosk.granted") || "Accès autorisé") :
                         scanResult.result === "denied" ? (t("kiosk.denied") || "Accès refusé") :
                         (t("kiosk.pending") || "En attente")}
                      </p>
                      {scanResult.reason && <p className="text-sm text-muted-foreground">{scanResult.reason}</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  {t("kiosk.searchMember") || "Rechercher un adhérent"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  placeholder={t("kiosk.searchMember") || "Rechercher un adhérent..."}
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="mb-4"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {filteredMembers.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedMemberId(m.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors text-left ${
                          selectedMemberId === m.id ? "ring-2 ring-primary" : ""
                        }`}
                      >
                        <Avatar className="h-10 w-10">
                          {m.photo_url ? <AvatarImage src={m.photo_url} /> : null}
                          <AvatarFallback>{getInitials(m.first_name, m.last_name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{m.first_name} {m.last_name}</span>
                      </button>
                    ))}
                    {filteredMembers.length === 0 && memberSearch && (
                      <p className="text-center text-muted-foreground py-8">{t("common.noResults") || "Aucun résultat"}</p>
                    )}
                  </div>
                </ScrollArea>

                {canManualValidate && (
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="secondary"
                      className="w-full gap-2"
                      disabled={!selectedMemberId}
                      onClick={() => setShowManualDialog(true)}
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {t("kiosk.manualValidation") || "VALIDATION MANUELLE"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  {t("kiosk.recentReads") || "Lectures récentes"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {recentLogs && recentLogs.length > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {recentLogs.map((log) => (
                        <div key={log.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card text-sm">
                          {log.result === "granted" ? <UserCheck className="h-4 w-4 text-success shrink-0" /> :
                           log.result === "denied" ? <XCircle className="h-4 w-4 text-destructive shrink-0" /> :
                           <Clock className="h-4 w-4 text-warning shrink-0" />}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {log.member ? `${log.member.first_name} ${log.member.last_name}` : "—"}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{log.reason}</p>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDateTime(log.read_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    {t("kiosk.noRecentReads") || "Aucune lecture récente"}
                  </p>
                )}
              </CardContent>
            </Card>

            {turnstileStats && turnstileStats.total_terminals > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {t("kiosk.turnstileStatus") || "État du tourniquet"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="p-2 rounded bg-success/10 text-center">
                      <p className="text-2xl font-bold text-success">{turnstileStats.online}</p>
                      <p className="text-muted-foreground text-xs">{t("kiosk.turnstileOnline") || "Connecté"}</p>
                    </div>
                    <div className="p-2 rounded bg-warning/10 text-center">
                      <p className="text-2xl font-bold text-warning">{turnstileStats.offline}</p>
                      <p className="text-muted-foreground text-xs">{t("kiosk.turnstileOffline") || "Hors ligne"}</p>
                    </div>
                    <div className="p-2 rounded bg-destructive/10 text-center">
                      <p className="text-2xl font-bold text-destructive">{turnstileStats.fault}</p>
                      <p className="text-muted-foreground text-xs">{t("kiosk.turnstileFault") || "En panne"}</p>
                    </div>
                    <div className="p-2 rounded bg-secondary/10 text-center">
                      <p className="text-2xl font-bold">{turnstileStats.manual_validations_today}</p>
                      <p className="text-muted-foreground text-xs">{t("kiosk.manualToday") || "Man. ajd"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("kiosk.manualValidation") || "VALIDATION MANUELLE"}</DialogTitle>
            <DialogDescription>
              {t("kiosk.manualConfirm") || "Confirmer la validation manuelle"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("kiosk.selectReason") || "Motif"}</Label>
              <Select value={manualReason} onValueChange={setManualReason}>
                <SelectTrigger>
                  <SelectValue placeholder={t("kiosk.selectReason") || "Sélectionner un motif"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakdown">{t("kiosk.manualBreakdown") || "Panne"}</SelectItem>
                  <SelectItem value="maintenance">{t("kiosk.manualMaintenance") || "Maintenance"}</SelectItem>
                  <SelectItem value="emergency">{t("kiosk.manualEmergency") || "Urgence"}</SelectItem>
                  <SelectItem value="test">{t("kiosk.manualTest") || "Test"}</SelectItem>
                  <SelectItem value="other">{t("kiosk.manualOther") || "Autre"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("kiosk.manualDetail") || "Détail (optionnel)"}</Label>
              <Input
                value={manualDetail}
                onChange={(e) => setManualDetail(e.target.value)}
                placeholder={t("kiosk.manualDetail") || "Détail (optionnel)"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>
              {t("common.cancel") || "Annuler"}
            </Button>
            <Button
              onClick={handleManualValidate}
              disabled={!selectedMemberId || !manualReason || manualCheckInMutation.isPending}
            >
              {manualCheckInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("common.confirm") || "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="border-t p-4 text-center text-sm text-muted-foreground">
        {t("kiosk.footer") || "Badgez votre carte RFID pour entrer"}
      </div>
    </div>
  )
}
