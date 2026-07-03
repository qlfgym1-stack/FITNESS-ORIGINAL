import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card"
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import {
  Search, LogIn, LogOut, Download, Clock, UserCheck, UserX, AlertTriangle, Loader2,
} from "lucide-react"
import { formatDate, formatDateTime, cn } from "@/lib/utils"
import type { Member, Attendance } from "@/types/supabase"
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns"
import * as XLSX from "xlsx"

interface MemberWithAttendance extends Pick<Member, "id" | "first_name" | "last_name" | "photo_url"> {
  attendance: Attendance | null
}

export default function AttendancePage() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const [search, setSearch] = useState("")
  const [historyDateFrom, setHistoryDateFrom] = useState(format(new Date(), "yyyy-MM-dd"))
  const [historyDateTo, setHistoryDateTo] = useState(format(new Date(), "yyyy-MM-dd"))

  const todayStart = startOfDay(new Date()).toISOString()
  const todayEnd = endOfDay(new Date()).toISOString()

  const { data: activeMembers } = useQuery({
    queryKey: ["active-members", orgId],
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

  const { data: todayAttendance } = useQuery({
    queryKey: ["attendance-today", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("organization_id", orgId)
        .gte("check_in", todayStart)
        .lte("check_in", todayEnd)
        .order("check_in", { ascending: false })
      return data as Attendance[]
    },
    enabled: !!orgId,
  })

  const { data: history } = useQuery({
    queryKey: ["attendance-history", orgId, historyDateFrom, historyDateTo],
    queryFn: async () => {
      if (!orgId) return []
      const from = startOfDay(new Date(historyDateFrom)).toISOString()
      const to = endOfDay(new Date(historyDateTo)).toISOString()
      const { data } = await supabase
        .from("attendance")
        .select("*, members(first_name, last_name)")
        .eq("organization_id", orgId)
        .gte("check_in", from)
        .lte("check_in", to)
        .order("check_in", { ascending: false })
      return data as (Attendance & { members: { first_name: string; last_name: string } })[]
    },
    enabled: !!orgId,
  })

  const checkInMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!orgId) throw new Error("No organization")
      const { error } = await supabase.from("attendance").insert({
        organization_id: orgId,
        member_id: memberId,
        check_in: new Date().toISOString(),
        type: "check-in",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] })
      toast({ title: "Check-in enregistré" })
    },
    onError: (err) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" })
    },
  })

  const checkOutMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      const { error } = await supabase
        .from("attendance")
        .update({ check_out: new Date().toISOString() })
        .eq("id", attendanceId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] })
      toast({ title: "Check-out enregistré" })
    },
    onError: (err) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" })
    },
  })

  const membersWithAttendance: MemberWithAttendance[] = useMemo(() => {
    if (!activeMembers || !todayAttendance) return []
    return activeMembers.map((m) => {
      const att = todayAttendance.find((a) => a.member_id === m.id)
      return { ...m, attendance: att ?? null }
    })
  }, [activeMembers, todayAttendance])

  const checkedInCount = membersWithAttendance.filter((m) => m.attendance && !m.attendance.check_out).length
  const totalToday = todayAttendance?.length ?? 0

  const filteredMembers = membersWithAttendance.filter((m) => {
    const name = `${m.first_name} ${m.last_name}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })

  const handleExportHistory = () => {
    if (!history) return
    const data = history.map((h) => ({
      Membre: `${h.members?.first_name ?? ""} ${h.members?.last_name ?? ""}`,
      "Check-in": h.check_in ? format(new Date(h.check_in), "HH:mm") : "-",
      "Check-out": h.check_out ? format(new Date(h.check_out), "HH:mm") : "-",
      Durée: h.check_in && h.check_out
        ? `${differenceInMinutes(new Date(h.check_out), new Date(h.check_in))} min`
        : "-",
      Statut: h.check_out ? "Terminé" : "En cours",
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Présence")
    XLSX.writeFile(wb, `presence-${historyDateFrom}-${historyDateTo}.xlsx`)
  }

  const presentToday = membersWithAttendance.filter((m) => m.attendance).length
  const lateToday = membersWithAttendance.filter((m) => {
    if (!m.attendance?.check_in) return false
    const hour = new Date(m.attendance.check_in).getHours()
    return hour >= 10
  }).length
  const absentToday = activeMembers ? activeMembers.length - presentToday : 0

  return (
    <div>
      <PageHeader
        title={t("attendance.title")}
        description={t("attendance.description")}
      />

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Présents aujourd'hui</CardTitle>
            <UserCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{presentToday}</div>
            <p className="text-xs text-muted-foreground">{checkedInCount} actuellement dans la salle</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">En retard</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lateToday}</div>
            <p className="text-xs text-muted-foreground">Check-in après 10h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Absents</CardTitle>
            <UserX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absentToday}</div>
            <p className="text-xs text-muted-foreground">Membres actifs sans check-in</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="today" className="mb-6">
        <TabsList>
          <TabsTrigger value="today">{t("attendance.today")}</TabsTrigger>
          <TabsTrigger value="history">{t("attendance.history")}</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <div className="relative mb-4 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("common.search")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="grid gap-3">
                {filteredMembers.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">{t("common.noData")}</p>
                ) : (
                  filteredMembers.map((member) => {
                    const isCheckedIn = !!member.attendance
                    const isCheckedOut = member.attendance?.check_out != null
                    const isActive = isCheckedIn && !isCheckedOut
                    return (
                      <div
                        key={member.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border transition-colors",
                          isActive ? "bg-success/5 border-success/20" : "bg-card"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium",
                            isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                          )}>
                            {member.first_name.charAt(0)}{member.last_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{member.first_name} {member.last_name}</p>
                            {member.attendance?.check_in && (
                              <p className="text-xs text-muted-foreground">
                                Check-in: {format(new Date(member.attendance.check_in), "HH:mm")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isActive ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/30 hover:bg-destructive/10"
                              onClick={() => checkOutMutation.mutate(member.attendance!.id)}
                              disabled={checkOutMutation.isPending}
                            >
                              <LogOut className="mr-2 h-4 w-4" />
                              {t("attendance.checkOut")}
                            </Button>
                          ) : !isCheckedIn ? (
                            <Button
                              size="sm"
                              onClick={() => checkInMutation.mutate(member.id)}
                              disabled={checkInMutation.isPending}
                            >
                              <LogIn className="mr-2 h-4 w-4" />
                              {t("attendance.checkIn")}
                            </Button>
                          ) : (
                            <Badge variant="secondary">Check-out effectué</Badge>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Du</label>
                  <Input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Au</label>
                  <Input
                    type="date"
                    value={historyDateTo}
                    onChange={(e) => setHistoryDateTo(e.target.value)}
                  />
                </div>
                <Button variant="outline" onClick={handleExportHistory}>
                  <Download className="mr-2 h-4 w-4" />
                  {t("common.export")}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("attendance.member")}</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Durée</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        {t("common.noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    history?.map((entry) => {
                      const checkIn = entry.check_in ? new Date(entry.check_in) : null
                      const checkOut = entry.check_out ? new Date(entry.check_out) : null
                      const duration = checkIn && checkOut ? differenceInMinutes(checkOut, checkIn) : null
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {entry.members?.first_name} {entry.members?.last_name}
                          </TableCell>
                          <TableCell>
                            {checkIn ? format(checkIn, "HH:mm") : "-"}
                          </TableCell>
                          <TableCell>
                            {checkOut ? format(checkOut, "HH:mm") : "-"}
                          </TableCell>
                          <TableCell>
                            {duration !== null ? `${duration} min` : "-"}
                          </TableCell>
                          <TableCell>
                            {checkOut ? (
                              <Badge variant="default">{t("attendance.present")}</Badge>
                            ) : checkIn ? (
                              <Badge variant="secondary">En cours</Badge>
                            ) : (
                              <Badge variant="destructive">{t("attendance.absent")}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

