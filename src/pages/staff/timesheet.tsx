import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { useNavigate, useLocation } from "react-router-dom"
import { format, startOfWeek, endOfWeek, parseISO, differenceInMinutes } from "date-fns"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { toUpper } from "../../lib/utils"
import { Loader2, Clock } from "lucide-react"
import type { Staff, StaffTimesheet } from "@/types/supabase"

const TABS = [
  { value: "list", label: "Staff List", path: "/staff" },
  { value: "timesheet", label: "Timesheet", path: "/staff/timesheet" },
  { value: "planning", label: "Planning", path: "/staff/planning" },
  { value: "leaves", label: "Leaves", path: "/staff/leaves" },
]

export default function TimesheetPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const { organization } = useAuth()
  const orgId = organization?.id
  const today = format(new Date(), "yyyy-MM-dd")
  const [selectedDate, setSelectedDate] = useState(today)

  const { data: staffList } = useQuery({
    queryKey: ["staff", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from("staff").select("*").eq("organization_id", orgId).eq("is_active", true).order("first_name")
      return data ?? []
    },
    enabled: !!orgId,
  })

  const { data: timesheets, isLoading, isError: timesheetError, error: timesheetQueryError } = useQuery({
    queryKey: ["staff_timesheet", selectedDate, orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from("staff_timesheet").select("*").eq("date", selectedDate).eq("organization_id", orgId)
      return data ?? []
    },
    enabled: !!orgId,
  })

  useEffect(() => {
    if (timesheetError && timesheetQueryError) {
      toast({ title: t("errors.error") || "Error", description: timesheetQueryError.message, variant: "destructive" })
    }
  }, [timesheetError, timesheetQueryError])

  const weekStart = format(startOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const weekEnd = format(endOfWeek(parseISO(selectedDate), { weekStartsOn: 1 }), "yyyy-MM-dd")

  const { data: weeklyData } = useQuery({
    queryKey: ["staff_timesheet_weekly", weekStart, weekEnd, orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from("staff_timesheet").select("*").gte("date", weekStart).lte("date", weekEnd).eq("organization_id", orgId)
      return data ?? []
    },
    enabled: !!orgId,
  })

  const timesheetMap = useMemo(() => {
    const map = new Map<string, StaffTimesheet>()
    timesheets?.forEach(ts => map.set(ts.staff_id, ts))
    return map
  }, [timesheets])

  const weeklySummary = useMemo(() => {
    const summary = new Map<string, number>()
    weeklyData?.forEach(ts => {
      const current = summary.get(ts.staff_id) ?? 0
      summary.set(ts.staff_id, current + (ts.total_hours ?? 0))
    })
    return summary
  }, [weeklyData])

  const clockMutation = useMutation({
    mutationFn: async ({ staffId, type, existing }: { staffId: string; type: "in" | "out" | "break_start" | "break_end"; existing?: StaffTimesheet }) => {
      const now = new Date().toISOString()
      if (existing) {
        const update: Record<string, unknown> = {}
        if (type === "in") update.clock_in = now
        else if (type === "out") {
          update.clock_out = now
          const clockIn = existing.clock_in ? new Date(existing.clock_in) : null
          const clockOut = new Date(now)
          const breakStart = existing.break_start ? new Date(existing.break_start) : null
          const breakEnd = existing.break_end ? new Date(existing.break_end) : null
          let total = clockIn ? differenceInMinutes(clockOut, clockIn) : 0
          if (breakStart && breakEnd) total -= differenceInMinutes(breakEnd, breakStart)
          update.total_hours = Math.round((total / 60) * 100) / 100
        } else if (type === "break_start") update.break_start = now
        else if (type === "break_end") {
          update.break_end = now
        }
        const { error } = await supabase.from("staff_timesheet").update(update as any).eq("id", existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("staff_timesheet").insert({
          staff_id: staffId,
          organization_id: orgId ?? "",
          date: selectedDate,
          clock_in: type === "in" ? now : null,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff_timesheet"] })
      queryClient.invalidateQueries({ queryKey: ["staff_timesheet_weekly"] })
      toast({ title: "Timesheet updated" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const currentTab = TABS.find(t => t.path === location.pathname)?.value ?? "timesheet"

  function getStaffName(staff: Staff) {
    return `${toUpper(staff.first_name)} ${toUpper(staff.last_name)}`
  }

  return (
    <div>
      <PageHeader title={t("timesheet.title") || "Timesheet"} description={t("timesheet.description") || "Track staff attendance"} />

      <Tabs value={currentTab} onValueChange={(v) => { const tab = TABS.find(t => t.value === v); if (tab) navigate(tab.path) }}>
        <TabsList className="mb-6">
          {TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-4">
        <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-fit" />
      </div>

      <Card>
        <CardHeader><CardTitle>{t("timesheet.daily") || "Daily Timesheet"}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("timesheet.staffName") || "Staff Name"}</TableHead>
                <TableHead>{t("timesheet.clockIn") || "Clock In"}</TableHead>
                <TableHead>{t("timesheet.clockOut") || "Clock Out"}</TableHead>
                <TableHead>{t("timesheet.breakStart") || "Break Start"}</TableHead>
                <TableHead>{t("timesheet.breakEnd") || "Break End"}</TableHead>
                <TableHead>{t("timesheet.totalHours") || "Total Hours"}</TableHead>
                <TableHead>{t("timesheet.actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : (
                staffList?.map(staff => {
                  const ts = timesheetMap.get(staff.id)
                  return (
                    <TableRow key={staff.id}>
                      <TableCell className="font-medium">{getStaffName(staff)}</TableCell>
                      <TableCell>{ts?.clock_in ? format(new Date(ts.clock_in), "HH:mm") : "-"}</TableCell>
                      <TableCell>{ts?.clock_out ? format(new Date(ts.clock_out), "HH:mm") : "-"}</TableCell>
                      <TableCell>{ts?.break_start ? format(new Date(ts.break_start), "HH:mm") : "-"}</TableCell>
                      <TableCell>{ts?.break_end ? format(new Date(ts.break_end), "HH:mm") : "-"}</TableCell>
                      <TableCell>{ts?.total_hours ? `${ts.total_hours}h` : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {!ts?.clock_in ? (
                            <Button size="sm" onClick={() => clockMutation.mutate({ staffId: staff.id, type: "in" })} disabled={clockMutation.isPending}>
                              <Clock className="mr-1 h-3 w-3" /> In
                            </Button>
                          ) : !ts?.clock_out ? (
                            <>
                              {!ts?.break_start ? (
                                <Button size="sm" variant="outline" onClick={() => clockMutation.mutate({ staffId: staff.id, type: "break_start", existing: ts })} disabled={clockMutation.isPending}>
                                  Break
                                </Button>
                              ) : !ts?.break_end ? (
                                <Button size="sm" variant="outline" onClick={() => clockMutation.mutate({ staffId: staff.id, type: "break_end", existing: ts })} disabled={clockMutation.isPending}>
                                  End Break
                                </Button>
                              ) : null}
                              <Button size="sm" variant="secondary" onClick={() => clockMutation.mutate({ staffId: staff.id, type: "out", existing: ts })} disabled={clockMutation.isPending}>
                                <Clock className="mr-1 h-3 w-3" /> Out
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">Done</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader><CardTitle>{t("timesheet.weeklySummary") || "Weekly Summary"} ({weekStart} - {weekEnd})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("timesheet.staffName") || "Staff Name"}</TableHead>
                <TableHead>{t("timesheet.totalHours") || "Total Hours"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staffList?.map(staff => (
                <TableRow key={staff.id}>
                  <TableCell className="font-medium">{getStaffName(staff)}</TableCell>
                  <TableCell>{weeklySummary.get(staff.id) ? `${weeklySummary.get(staff.id)}h` : "0h"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
