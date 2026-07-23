import { useState, useMemo, useRef, useEffect } from "react"
import { useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { useSupabase } from "@/hooks/useSupabase"
import { useQuery, useMutation } from "@/hooks/useQuery"
import { useRealtime } from "@/hooks/useRealtime"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Pagination } from "@/components/ui/pagination"
import {
  Clock, UserCheck, CalendarDays,
  Download, Upload, CheckCircle2, XCircle, Loader2,
  CreditCard, QrCode, Camera, History, Settings, X,
  Phone, Search,
} from "lucide-react"
import { CameraCapture } from "@/components/ui/camera-capture"
import { PageHeader } from "@/components/layout"
import { getInitials, toUpper } from "@/lib/utils"

const PAGE_TERMINAL = "pointage"

type AttendanceRow = {
  id: string
  member_id: string
  check_in: string | null
  check_out: string | null
  member: { first_name: string; last_name: string; photo_url: string | null } | null
}

type PhoneMember = {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  photo_url: string | null
}

function formatTime(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
}

function computeStay(a: { check_in: string | null; check_out: string | null }) {
  if (!a.check_in || !a.check_out) return null
  const diff = new Date(a.check_out).getTime() - new Date(a.check_in).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} min`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}min`
}

export default function PointagePage() {
  const t = useT()
  const supabase = useSupabase()
  const { organization, user, roles } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id
  const userId = user?.id

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const dateLabel = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
  const dateFormatted = today.toLocaleDateString("fr-FR")

  const canManualValidate = roles?.some(r => r.role === "admin" || r.role === "super_admin" || r.role === "staff")

  useRealtime({ table: "attendance", queryKey: ["pointage-today", orgId ?? "", todayStr], filter: orgId ? `organization_id=eq.${orgId}` : undefined })

  const [searchQuery, setSearchQuery] = useState("")
  const [rfidInput, setRfidInput] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ result: "granted" | "denied"; reason?: string; action?: string; memberName?: string } | null>(null)

  const [birthDate, setBirthDate] = useState("")
  const [codeRfid, setCodeRfid] = useState("")
  const [phone, setPhone] = useState("")
  const [checkedInMemberId, setCheckedInMemberId] = useState<string | null>(null)
  const [qrCameraActive, setQrCameraActive] = useState(false)
  const qrVideoRef = useRef<HTMLVideoElement>(null)
  const qrStreamRef = useRef<MediaStream | null>(null)

  const [activeCheckinTab, setActiveCheckinTab] = useState<"manual" | "phone">("manual")
  const [phoneQuery, setPhoneQuery] = useState("")

  const rfidInputRef = useRef<HTMLInputElement>(null)

  const { data: todayAttendance } = useQuery({
    queryKey: ["pointage-today", orgId, todayStr],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("attendance")
        .select("id, member_id, check_in, check_out, member:members!inner(first_name, last_name, photo_url)")
        .eq("organization_id", orgId)
        .gte("check_in", todayStr)
        .order("check_in", { ascending: false })
        .returns<AttendanceRow[]>()
      return data ?? []
    },
    enabled: !!orgId,
  })

  const { data: phoneMembers, isFetching: isSearchingPhone } = useQuery({
    queryKey: ["pointage-phone", orgId, phoneQuery],
    queryFn: async () => {
      if (!orgId || !phoneQuery.trim()) return []
      const { data } = await supabase
        .from("members")
        .select("id, first_name, last_name, phone, photo_url")
        .eq("organization_id", orgId)
        .ilike("phone", `%${phoneQuery.trim()}%`)
        .limit(8)
        .returns<PhoneMember[]>()
      return data ?? []
    },
    enabled: !!orgId && phoneQuery.trim().length >= 2,
  })

  const checkedInToday = todayAttendance ?? []
  const entryCount = checkedInToday.filter(a => a.check_in).length
  const checkedOutCount = checkedInToday.filter(a => a.check_out).length
  const insideCount = checkedInToday.filter(a => a.check_in && !a.check_out).length

  const peakAffluence = useMemo(() => {
    if (checkedInToday.length === 0) return null
    const hourly: Record<number, number> = {}
    checkedInToday.forEach(a => {
      if (a.check_in) {
        const h = new Date(a.check_in).getHours()
        hourly[h] = (hourly[h] || 0) + 1
      }
    })
    const peak = Object.entries(hourly).sort((a, b) => b[1] - a[1])[0]
    return peak ? { hour: `${peak[0]}h`, count: peak[1] } : null
  }, [checkedInToday])

  const avgStay = useMemo(() => {
    const stays = checkedInToday.map(a => computeStay(a)).filter(Boolean) as string[]
    if (stays.length === 0) return null
    const totalMins = stays.reduce((sum, s) => {
      const parts = s.split(/[h ]/)
      let mins = 0
      if (parts.length >= 3) mins = parseInt(parts[0]) * 60 + parseInt(parts[1])
      else if (s.includes("min")) mins = parseInt(s)
      return sum + mins
    }, 0)
    const avg = Math.round(totalMins / stays.length)
    if (avg < 60) return `${avg} min`
    return `${Math.floor(avg / 60)}h ${avg % 60}min`
  }, [checkedInToday])

  const occupancyRate = useMemo(() => {
    if (!checkedInToday.length) return null
    return `${Math.round((checkedInToday.length / 100) * 100)}%`
  }, [checkedInToday])

  const filteredToday = checkedInToday.filter(a =>
    `${a.member?.first_name ?? ""} ${a.member?.last_name ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const { page, setPage, totalPages, paginatedData: paginatedAttendance } = usePagination(filteredToday, 20)

  const { exportCsv } = useExportCsv(
    filteredToday.map(a => ({
      name: `${a.member?.first_name ?? ""} ${a.member?.last_name ?? ""}`,
      check_in: a.check_in ?? '',
      check_out: a.check_out ?? '',
      stay: computeStay(a) ?? '',
    })),
    'attendance-today',
    [
      { key: 'name', label: t('common.name') || 'Name' },
      { key: 'check_in', label: t('pointage.checkIn') || 'Check-in' },
      { key: 'check_out', label: t('pointage.checkOut') || 'Check-out' },
      { key: 'stay', label: t('pointage.stay') || 'Stay' },
    ]
  )

  const rfidMutation = useMutation({
    mutationFn: async (uid: string) => {
      const { data } = await (supabase.rpc as any)("rfid_check_in", {
        p_card_uid: uid,
        p_terminal: PAGE_TERMINAL,
      })
      return data as { result: string; reason?: string; member_id?: string }
    },
    onSuccess: (data) => {
      setScanResult({ result: data.result === "granted" ? "granted" : "denied", reason: data.reason })
      setIsScanning(false)
      setRfidInput("")
      if (data.result === "granted") {
        setCheckedInMemberId(data.member_id ?? null)
        toast({ title: "Accès autorisé" })
      } else {
        toast({ title: "Accès refusé", description: data.reason, variant: "destructive" })
      }
      setTimeout(() => setScanResult(null), 3000)
    },
    onError: (err: Error) => {
      setIsScanning(false)
      toast({ title: "Erreur", description: err.message, variant: "destructive" })
    },
  })

  const phoneCheckInMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { data } = await (supabase.rpc as any)("phone_check_in", {
        p_phone: phoneMembers?.find(m => m.id === memberId)?.phone ?? "",
        p_org_id: orgId,
      })
      return data as { result: string; reason?: string; member_id?: string; member_name?: string; action?: string }
    },
    onSuccess: (data) => {
      if (data.result === "granted") {
        setCheckedInMemberId(data.member_id ?? null)
        const actionLabel = data.action === "check_out" ? "Check-out effectué" : "Check-in effectué"
        toast({ title: actionLabel, description: data.member_name })
      } else {
        toast({ title: "Accès refusé", description: data.reason, variant: "destructive" })
      }
    },
    onError: (err: Error) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" })
    },
  })

  const handleRfidValidate = () => {
    const uid = rfidInput.trim()
    if (!uid) return
    setIsScanning(true)
    rfidMutation.mutate(uid)
  }

  const handleFormValidate = () => {
    if (!codeRfid && !phone && !birthDate) {
      toast({ title: "Remplissez au moins un champ", variant: "destructive" })
      return
    }
    const uid = codeRfid.trim()
    if (uid) rfidMutation.mutate(uid)
    else toast({ title: "Code RFID requis pour le check-in", variant: "destructive" })
  }

  const handlePhoneCheckIn = (memberId: string) => {
    phoneCheckInMutation.mutate(memberId)
  }

  function stopQrCamera() {
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(t => t.stop())
      qrStreamRef.current = null
    }
  }

  useEffect(() => {
    return () => { stopQrCamera() }
  }, [])

  useEffect(() => {
    if (qrCameraActive && qrVideoRef.current && qrStreamRef.current) {
      qrVideoRef.current.srcObject = qrStreamRef.current
    }
  }, [qrCameraActive])

  async function startQrCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      qrStreamRef.current = stream
      setQrCameraActive(true)
    } catch (e) {
      toast({ title: "Erreur caméra", description: e instanceof Error ? e.message : "Impossible d'accéder à la caméra", variant: "destructive" })
    }
  }

  function handleQrCameraClose() {
    stopQrCamera()
    setQrCameraActive(false)
  }

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault()
        rfidInputRef.current?.focus()
      }
    }
    window.addEventListener("keydown", handleGlobalKey)
    return () => window.removeEventListener("keydown", handleGlobalKey)
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.pointage')}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm bg-muted rounded-lg px-3 py-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{dateFormatted}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{dateFormatted}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportCsv()}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" size="sm" onClick={qrCameraActive ? handleQrCameraClose : startQrCamera}>
              <QrCode className="mr-2 h-4 w-4" />
              QR Code
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Scanner badge RFID
              </Label>
              <div className="flex gap-2">
                <Input
                  ref={rfidInputRef}
                  placeholder="QLF:123 ou QLF-..."
                  value={rfidInput}
                  onChange={e => setRfidInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRfidValidate() }}
                  className="font-mono text-lg h-12"
                  autoFocus
                />
                <Button
                  onClick={handleRfidValidate}
                  disabled={!rfidInput.trim() || isScanning}
                  className="h-12 px-6"
                >
                  {isScanning ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            {scanResult && (
              <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
                scanResult.result === "granted" ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"
              }`}>
                {scanResult.result === "granted" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {scanResult.result === "granted" ? "Accès autorisé" : "Accès refusé" + (scanResult.reason ? ` : ${scanResult.reason}` : "")}
              </div>
            )}

            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Camera className="h-3 w-3" />
                Check-ins du jour : {insideCount}
              </p>
              {checkedInMemberId ? (
                <CameraCapture orgId={orgId!} memberId={checkedInMemberId} onPhotoUploaded={() => toast({ title: "Photo enregistrée" })} />
              ) : (
                <p className="text-xs text-muted-foreground">Effectuez un check-in pour prendre une photo</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex border-b">
              <button
                className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeCheckinTab === "manual"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveCheckinTab("manual")}
              >
                Manuel
              </button>
              <button
                className={`flex-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeCheckinTab === "phone"
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveCheckinTab("phone")}
              >
                <Phone className="inline h-3.5 w-3.5 mr-1" />
                Par téléphone
              </button>
            </div>

            {activeCheckinTab === "manual" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date naissance</Label>
                  <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Code RFID</Label>
                  <Input placeholder="QLF:123 ou QLF-..." value={codeRfid} onChange={e => setCodeRfid(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleFormValidate() }} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Téléphone</Label>
                  <Input placeholder="05XX XX XX XX" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleFormValidate() }} />
                </div>
                <Button className="w-full" onClick={handleFormValidate} disabled={isScanning}>
                  {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
                  VALIDER
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Saisissez le numéro de téléphone du membre (recherche partielle)
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Ex: 0678, 0551, 06..."
                    value={phoneQuery}
                    onChange={e => setPhoneQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && phoneMembers && phoneMembers.length === 1) {
                        handlePhoneCheckIn(phoneMembers[0].id)
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPhoneQuery("")}
                    disabled={!phoneQuery}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {isSearchingPhone && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {phoneMembers && phoneMembers.length > 0 && (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {phoneMembers.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <Avatar className="h-9 w-9">
                          {m.photo_url ? <AvatarImage src={m.photo_url} /> : null}
                          <AvatarFallback>{getInitials(m.first_name, m.last_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{toUpper(`${m.first_name} ${m.last_name}`)}</p>
                          <p className="text-xs text-muted-foreground">{m.phone}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handlePhoneCheckIn(m.id)}
                          disabled={phoneCheckInMutation.isPending}
                        >
                          {phoneCheckInMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                          )}
                          Check-in
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {phoneQuery.trim().length >= 2 && !isSearchingPhone && phoneMembers && phoneMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    Aucun membre trouvé avec ce numéro
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {qrCameraActive && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Scanner QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-black">
              <video ref={qrVideoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
            </div>
            <p className="text-xs text-muted-foreground">
              Problème de caméra ? Saisissez le code QR manuellement :
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="IGC:123 ou INF-..."
                value={rfidInput}
                onChange={e => setRfidInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRfidValidate() }}
              />
              <Button onClick={handleRfidValidate} disabled={!rfidInput.trim() || isScanning}>
                {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Pointages du Jour
            </CardTitle>
            <span className="text-sm text-muted-foreground capitalize">{dateLabel}</span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-success/10 border border-success/20">
              <p className="text-3xl font-bold text-success">{entryCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Entrées</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-3xl font-bold text-destructive">{checkedOutCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Sorties</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-3xl font-bold text-primary">{insideCount}</p>
              <p className="text-xs text-muted-foreground mt-1">En salle</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Pic d&apos;affluence</p>
              <p className="text-lg font-semibold">{peakAffluence ? `${peakAffluence.hour} (${peakAffluence.count})` : "—"}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Séjour moyen</p>
              <p className="text-lg font-semibold">{avgStay ?? "—"}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Taux occupation</p>
              <p className="text-lg font-semibold">{occupancyRate ?? "—"}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <Input
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            {searchQuery && (
              <Button variant="outline" size="icon" onClick={() => { setSearchQuery(""); setPage(1) }} title="Reset filters">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {filteredToday.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Aucun pointage aujourd&apos;hui</p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedAttendance.map(a => (
                <div key={a.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                  <Avatar className="h-9 w-9">
                    {a.member?.photo_url ? <AvatarImage src={a.member.photo_url} /> : null}
                    <AvatarFallback>{getInitials(a.member?.first_name ?? "", a.member?.last_name ?? "")}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{toUpper(`${a.member?.first_name ?? ""} ${a.member?.last_name ?? ""}`)}</p>
                    <p className="text-xs text-muted-foreground">
                      Arrivée: {formatTime(a.check_in)} · Départ: {formatTime(a.check_out)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant={a.check_out ? "secondary" : "default"} className="text-[10px]">
                      {a.check_out ? "Terminé" : "En cours"}
                    </Badge>
                    {computeStay(a) && (
                      <p className="text-xs text-muted-foreground mt-1">{computeStay(a)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <Pagination page={page} totalPages={totalPages} totalItems={filteredToday.length} pageSize={20} onPageChange={setPage} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => toast({ title: "Module installation détecteur RFID" })}>
          <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
            <div className="rounded-full bg-primary/10 p-3">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <span className="font-medium text-sm text-center">Module installation détecteur RFID</span>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => toast({ title: "Historique & Investigation" })}>
          <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
            <div className="rounded-full bg-amber-500/10 p-3">
              <History className="h-6 w-6 text-amber-500" />
            </div>
            <span className="font-medium text-sm text-center">Historique & Investigation</span>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => exportCsv()}>
          <CardContent className="flex flex-col items-center justify-center p-6 gap-3">
            <div className="rounded-full bg-emerald-500/10 p-3">
              <Download className="h-6 w-6 text-emerald-500" />
            </div>
            <span className="font-medium text-sm text-center flex items-center gap-2">
              EXPORT
              <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-500 text-white border-0">PRO</Badge>
            </span>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
