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
} from "lucide-react"
import { CameraCapture } from "@/components/ui/camera-capture"
import { getInitials, toUpper } from "@/lib/utils"

const PAGE_TERMINAL = "pointage"

type AttendanceRow = {
  id: string
  member_id: string
  check_in: string | null
  check_out: string | null
  member: { first_name: string; last_name: string; photo_url: string | null } | null
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
  const [scanResult, setScanResult] = useState<{ result: "granted" | "denied"; reason?: string } | null>(null)

  const [birthDate, setBirthDate] = useState("")
  const [codeRfid, setCodeRfid] = useState("")
  const [phone, setPhone] = useState("")
  const [checkedInMemberId, setCheckedInMemberId] = useState<string | null>(null)
  const [qrCameraActive, setQrCameraActive] = useState(false)
  const qrVideoRef = useRef<HTMLVideoElement>(null)
  const qrStreamRef = useRef<MediaStream | null>(null)

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

  const checkInCount = checkedInToday.length
  const isPro = false

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pointage</h1>
          <p className="text-sm text-muted-foreground">
            {checkInCount} check-in{checkInCount !== 1 ? "s" : ""} aujourd&apos;hui
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm bg-muted rounded-lg px-3 py-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{dateFormatted}</span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium">{dateFormatted}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => exportCsv()}>
            <Download className="mr-2 h-4 w-4" />
            EXPORT
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            IMPORT
          </Button>
          <Button variant="outline" size="sm">
            <QrCode className="mr-2 h-4 w-4" />
            QR CODE
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Check-in manuel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Date naissance</Label>
              <Input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Code RFID</Label>
              <Input placeholder="QLF:123 ou QLF-..." value={codeRfid} onChange={e => setCodeRfid(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Téléphone</Label>
              <Input placeholder="05XX XX XX XX" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <Button className="w-full" onClick={handleFormValidate} disabled={isScanning}>
              {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserCheck className="mr-2 h-4 w-4" />}
              VALIDER
            </Button>
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Photo adhérent</p>
              {checkedInMemberId ? (
                <CameraCapture orgId={orgId!} memberId={checkedInMemberId} onPhotoUploaded={(url) => toast({ title: "Photo enregistrée" })} />
              ) : (
                <p className="text-xs text-muted-foreground">Effectuez un check-in pour prendre une photo</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-4 w-4" />
              Scanner QR Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => toast({ title: "QR Code généré" })}>
                <QrCode className="mr-2 h-4 w-4" />
                Generer QR
              </Button>
              <Button variant="outline" className="flex-1" onClick={qrCameraActive ? handleQrCameraClose : startQrCamera}>
                <Camera className="mr-2 h-4 w-4" />
                {qrCameraActive ? "Fermer caméra" : "Activer la caméra"}
              </Button>
            </div>
            {qrCameraActive && (
              <div className="relative rounded-lg overflow-hidden bg-black">
                <video ref={qrVideoRef} autoPlay playsInline muted className="w-full h-48 object-cover" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Probleme de camera ? Saisissez le code QR manuellement :
            </p>
            <Input
              placeholder="IGC:123 ou INF-..."
              value={rfidInput}
              onChange={e => setRfidInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRfidValidate() }}
            />
            {scanResult && (
              <div className={`flex items-center gap-2 text-sm p-2 rounded ${
                scanResult.result === "granted" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              }`}>
                {scanResult.result === "granted" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {scanResult.result === "granted" ? "Accès autorisé" : "Accès refusé" + (scanResult.reason ? ` : ${scanResult.reason}` : "")}
              </div>
            )}
            <Button
              className="w-full"
              onClick={handleRfidValidate}
              disabled={!rfidInput.trim() || isScanning}
            >
              {isScanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              VALIDER
            </Button>
          </CardContent>
        </Card>
      </div>

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
