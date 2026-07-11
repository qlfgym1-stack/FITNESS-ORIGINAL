import { useState, useMemo, useEffect } from "react"
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/ui/toast"
import {
  Search, LogIn, LogOut, Download, Clock, UserCheck, UserX, AlertTriangle, Loader2,
} from "lucide-react"
import { formatDate, formatDateTime, cn, toUpper } from "@/lib/utils"
import type { Member, Attendance } from "@/types/supabase"
import { format, startOfDay, endOfDay, differenceInMinutes } from "date-fns"


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
  const [sourceFilter, setSourceFilter] = useState<"all" | "rfid" | "manual" | "app">("all")

  const todayStart = startOfDay(new Date()).toISOString()
  const todayEnd = endOfDay(new Date()).toISOString()

  const { data: activeMembers, isError: activeMembersError, error: activeMembersQueryError } = useQuery({
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

  useEffect(() => {
    if (activeMembersError && activeMembersQueryError) {
      toast({ title: t("common.error") || "Error", description: activeMembersQueryError.message, variant: "destructive" })
    }
  }, [activeMembersError, activeMembersQueryError])

  const { data: todayAttendance, isError: todayError, error: todayQueryError } = useQuery({
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

  useEffect(() => {
    if (todayError && todayQueryError) {
      toast({ title: t("common.error") || "Error", description: todayQueryError.message, variant: "destructive" })
    }
  }, [todayError, todayQueryError])

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
        source: "app",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      toast({ title: t("attendance.toastCheckIn") })
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" })
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] })
      toast({ title: t("attendance.toastCheckOut") })
    },
    onError: (err) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" })
    },
  })

  const membersWithAttendance: MemberWithAttendance[] = useMemo(() => {
    if (!activeMembers || !todayAttendance) return []
    const filteredAttendance = sourceFilter === "all"
      ? todayAttendance
      : todayAttendance.filter((a) => a.source === sourceFilter)
    return activeMembers.map((m) => {
      const att = filteredAttendance.find((a) => a.member_id === m.id)
      return { ...m, attendance: att ?? null }
    })
  }, [activeMembers, todayAttendance, sourceFilter])

  const checkedInCount = membersWithAttendance.filter((m) => m.attendance && !m.attendance.check_out).length
  const totalToday = todayAttendance?.length ?? 0

  const filteredMembers = membersWithAttendance.filter((m) => {
    const name = `${m.first_name} ${m.last_name}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })

  const handleExportHistory = async () => {
    if (!history) return
    const XLSX = await import("xlsx")
    const data = history.map((h) => ({
      [t("attendance.member")]: `${h.members?.first_name ?? ""} ${h.members?.last_name ?? ""}`,
      [t("attendance.checkIn")]: h.check_in ? format(new Date(h.check_in), "HH:mm") : "-",
      [t("attendance.checkOut")]: h.check_out ? format(new Date(h.check_out), "HH:mm") : "-",
      [t("attendance.duration")]: h.check_in && h.check_out
        ? `${differenceInMinutes(new Date(h.check_out), new Date(h.check_in))} ${t("attendance.min")}`
        : "-",
      [t("attendance.source") || "Source"]: h.source,
      [t("common.status")]: h.check_out ? t("attendance.completed") : t("attendance.inProgress"),
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, t("attendance.title"))
    XLSX.writeFile(wb, `${t("attendance.exportFileName")}-${historyDateFrom}-${historyDateTo}.xlsx`)
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
            <CardTitle className="text-sm font-medium">{t("attendance.presentToday")}</CardTitle>
            <UserCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{presentToday}</div>
            <p className="text-xs text-muted-foreground">{checkedInCount} {t("attendance.currentlyInRoom")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("attendance.late")}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lateToday}</div>
            <p className="text-xs text-muted-foreground">{t("attendance.lateDescription")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{t("attendance.absentMembers")}</CardTitle>
            <UserX className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{absentToday}</div>
            <p className="text-xs text-muted-foreground">{t("attendance.absentNoCheckIn")}</p>
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
              <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("common.search")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={sourceFilter} onValueChange={(v: "all" | "rfid" | "manual" | "app") => setSourceFilter(v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("attendance.all") || "Toutes"}</SelectItem>
                    <SelectItem value="rfid">RFID</SelectItem>
                    <SelectItem value="manual">{t("attendance.manual") || "Manuel"}</SelectItem>
                    <SelectItem value="app">{t("attendance.app") || "App"}</SelectItem>
                  </SelectContent>
                </Select>
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
                            {toUpper(member.first_name.charAt(0))}{toUpper(member.last_name.charAt(0))}
                          </div>
                          <div>
                            <p className="font-medium">{toUpper(member.first_name)} {toUpper(member.last_name)}</p>
                            {member.attendance?.check_in && (
                              <p className="text-xs text-muted-foreground">
                                {t("attendance.checkInLabel")}{format(new Date(member.attendance.check_in), "HH:mm")}
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
                            <Badge variant="secondary">{t("attendance.checkOutDone")}</Badge>
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
                  <label className="text-sm font-medium mb-1 block">{t("attendance.from")}</label>
                  <Input
                    type="date"
                    value={historyDateFrom}
                    onChange={(e) => setHistoryDateFrom(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">{t("attendance.to")}</label>
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
                    <TableHead>{t("attendance.checkIn")}</TableHead>
                    <TableHead>{t("attendance.checkOut")}</TableHead>
                    <TableHead>{t("attendance.duration")}</TableHead>
                    <TableHead>{t("attendance.source") || "Source"}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {t("common.noData")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    history?.map((entry) => {
                      const checkIn = entry.check_in ? new Date(entry.check_in) : null
                      const checkOut = entry.check_out ? new Date(entry.check_out) : null
                      const duration = checkIn && checkOut ? differenceInMinutes(checkOut, checkIn) : null
                      const sourceVariant = entry.source === "rfid" ? "default" : entry.source === "manual" ? "secondary" : "outline"
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium">
                            {toUpper(entry.members?.first_name)} {toUpper(entry.members?.last_name)}
                          </TableCell>
                          <TableCell>
                            {checkIn ? format(checkIn, "HH:mm") : "-"}
                          </TableCell>
                          <TableCell>
                            {checkOut ? format(checkOut, "HH:mm") : "-"}
                          </TableCell>
                          <TableCell>
                            {duration !== null ? `${duration} ${t("attendance.min")}` : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={sourceVariant} className={
                              entry.source === "rfid" ? "bg-blue-500/10 text-blue-500 border-blue-500/30" :
                              entry.source === "manual" ? "bg-orange-500/10 text-orange-500 border-orange-500/30" :
                              "bg-green-500/10 text-green-500 border-green-500/30"
                            }>
                              {entry.source === "rfid" ? "RFID" :
                               entry.source === "manual" ? (t("attendance.manual") || "Manuel") :
                               (t("attendance.app") || "App")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {checkOut ? (
                              <Badge variant="default">{t("attendance.present")}</Badge>
                            ) : checkIn ? (
                              <Badge variant="secondary">{t("attendance.inProgress")}</Badge>
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

