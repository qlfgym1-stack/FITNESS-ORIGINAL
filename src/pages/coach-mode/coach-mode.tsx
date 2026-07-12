import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Pagination } from "@/components/ui/pagination"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { getInitials } from "@/lib/utils"
import { Calendar, Clock, MapPin, UserCheck, CheckCircle2, XCircle, Search, Users, Loader2, Download } from "lucide-react"

interface ClassSession {
  id: string
  name: string
  start_time: string
  end_time: string
  coach: string
  location: string
  enrolled: number
  capacity: number
  attendees: { id: string; name: string; status: string }[]
}

export default function CoachModePage() {
  const t = useT()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const { toast } = useToast()
  const orgId = organization?.id

  const [search, setSearch] = useState("")
  const [selectedClass, setSelectedClass] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const { data: classes = [] } = useQuery({
    queryKey: ["coach-classes", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("classes")
        .select("id, name, start_time, end_time, location, capacity, staff!inner(first_name, last_name)")
        .eq("organization_id", orgId)
        .gte("start_time", today)
        .lt("start_time", new Date(Date.now() + 86400000).toISOString().slice(0, 10))
        .order("start_time")
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: r.name,
        start_time: r.start_time,
        end_time: r.end_time,
        coach: `${r.staff?.first_name ?? ""} ${r.staff?.last_name ?? ""}`,
        location: r.location ?? "",
        enrolled: 0,
        capacity: r.capacity ?? 0,
        attendees: [] as { id: string; name: string; status: string }[],
      })) as ClassSession[]
    },
    enabled: !!orgId,
  })

  const { data: enrollments } = useQuery({
    queryKey: ["coach-enrollments", orgId, selectedClass],
    queryFn: async () => {
      if (!orgId || !selectedClass) return []
      const { data } = await supabase
        .from("class_enrollments")
        .select("id, status, member:members(id, first_name, last_name)")
        .eq("class_id", selectedClass)
      return (data ?? []).map((r: any) => ({
        id: r.id,
        name: `${r.member?.first_name ?? ""} ${r.member?.last_name ?? ""}`,
        status: r.status,
        member_id: r.member?.id,
      }))
    },
    enabled: !!orgId && !!selectedClass,
  })

  const updateAttendance = useMutation({
    mutationFn: async ({ enrollmentId, status }: { enrollmentId: string; status: "attended" | "cancelled" }) => {
      const { error } = await supabase.from("class_enrollments").update({ status }).eq("id", enrollmentId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-enrollments"] })
      toast({ title: t("common.updated") })
    },
    onError: (err: Error) => { toast({ title: t("common.error"), description: err.message, variant: "destructive" }) },
  })

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.coach.toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, paginatedData: paginatedClasses } = usePagination(filteredClasses, 20)

  const { exportCsv } = useExportCsv(
    filteredClasses.map(c => ({
      name: c.name,
      coach: c.coach,
      location: c.location,
      start_time: c.start_time,
      end_time: c.end_time,
      enrolled: c.enrolled,
      capacity: c.capacity,
    })),
    'classes',
    [
      { key: 'name', label: t('coachMode.className') || 'Class' },
      { key: 'coach', label: t('coachMode.coach') || 'Coach' },
      { key: 'location', label: t('coachMode.location') || 'Location' },
      { key: 'start_time', label: t('common.startTime') || 'Start' },
      { key: 'end_time', label: t('common.endTime') || 'End' },
      { key: 'enrolled', label: t('common.enrolled') || 'Enrolled' },
      { key: 'capacity', label: t('common.capacity') || 'Capacity' },
    ]
  )

  const sessions: ClassSession[] = selectedClass
    ? classes.map((c) => c.id === selectedClass ? { ...c, attendees: enrollments ?? [], enrolled: (enrollments ?? []).length } : c)
    : classes

  const currentClass = selectedClass ? sessions.find((c) => c.id === selectedClass) ?? null : null

  return (
    <div className="flex h-full gap-6">
      <div className="w-80 shrink-0 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="icon" onClick={() => exportCsv()}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-2">
            {paginatedClasses.map((c) => (
              <Card key={c.id} className={`cursor-pointer transition-colors hover:bg-accent ${selectedClass === c.id ? "ring-2 ring-primary" : ""}`} onClick={() => setSelectedClass(c.id)}>
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{c.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(c.start_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - {new Date(c.end_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="secondary" className="text-xs">{c.coach}</Badge>
                    <span className="text-xs text-muted-foreground">{c.enrolled}/{c.capacity}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {paginatedClasses.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">{t("common.noResults")}</p>
            )}
          </div>
        </ScrollArea>
        <Pagination page={page} totalPages={totalPages} totalItems={filteredClasses.length} pageSize={20} onPageChange={setPage} />
      </div>

      <div className="flex-1">
        {currentClass ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">{currentClass.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {new Date(currentClass.start_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} - {new Date(currentClass.end_time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  {" · "}{currentClass.location}{" · "}{currentClass.coach}
                </p>
              </div>
              <Badge variant="outline" className="text-sm">
                <Users className="h-4 w-4 mr-1" />
                {currentClass.enrolled}/{currentClass.capacity}
              </Badge>
            </div>
            <div className="rounded-md border">
              {(currentClass.attendees ?? []).length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("common.noData")}</p>
              ) : currentClass.attendees.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{getInitials(a.name.split(" ")[0] ?? "", a.name.split(" ")[1] ?? "")}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{a.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm" variant={a.status === "attended" ? "default" : "outline"}
                      onClick={() => updateAttendance.mutate({ enrollmentId: a.id, status: "attended" })}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> {t("common.present")}
                    </Button>
                    <Button
                      size="sm" variant={a.status === "cancelled" ? "destructive" : "outline"}
                      onClick={() => updateAttendance.mutate({ enrollmentId: a.id, status: "cancelled" })}
                    >
                      <XCircle className="h-4 w-4 mr-1" /> {t("common.absent")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("coachMode.selectClass") || "Sélectionnez un cours"}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
