import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { useNavigate, useLocation } from "react-router-dom"
import { format, startOfWeek, addDays, parseISO } from "date-fns"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus, ChevronLeft, ChevronRight } from "lucide-react"

const TABS = [
  { value: "list", label: "Staff List", path: "/staff" },
  { value: "timesheet", label: "Timesheet", path: "/staff/timesheet" },
  { value: "planning", label: "Planning", path: "/staff/planning" },
  { value: "leaves", label: "Leaves", path: "/staff/leaves" },
]

const shiftSchema = z.object({
  staffId: z.string().min(1, "Required"),
  day: z.string().min(1, "Required"),
  startTime: z.string().min(1, "Required"),
  endTime: z.string().min(1, "Required"),
  notes: z.string().optional().or(z.literal("")),
})

type ShiftForm = z.infer<typeof shiftSchema>

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

interface Shift {
  id: string
  staff_id: string
  day: string
  start_time: string
  end_time: string
  notes: string | null
}

export default function PlanningPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [weekOffset, setWeekOffset] = useState(0)
  const [open, setOpen] = useState(false)
  const [draggingStaff, setDraggingStaff] = useState<string | null>(null)

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
  const currentWeekStart = addDays(weekStart, weekOffset * 7)

  const form = useForm<ShiftForm>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { staffId: "", day: "Monday", startTime: "09:00", endTime: "17:00", notes: "" },
  })

  const { data: staffList } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("*").eq("is_active", true).order("first_name")
      return data ?? []
    },
  })

  const { data: shifts, isLoading } = useQuery({
    queryKey: ["staff_shifts", format(currentWeekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data } = await supabase.from("staff_shifts").select("*")
      return (data ?? []) as Shift[]
    },
  })

  const shiftsByStaffAndDay = useMemo(() => {
    const map = new Map<string, Shift[]>()
    shifts?.forEach(s => {
      const key = `${s.staff_id}-${s.day}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(s)
    })
    return map
  }, [shifts])

  const upsertMutation = useMutation({
    mutationFn: async (values: ShiftForm) => {
      const { error } = await supabase.from("staff_shifts" as any).insert({
        staff_id: values.staffId,
        day: values.day,
        start_time: values.startTime,
        end_time: values.endTime,
        notes: values.notes || null,
        organization_id: (await supabase.auth.getUser()).data.user?.id ?? "",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff_shifts"] })
      toast({ title: "Shift added" })
      setOpen(false)
      form.reset()
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_shifts").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff_shifts"] })
      toast({ title: "Shift removed" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  function onSubmit(values: ShiftForm) {
    upsertMutation.mutate(values)
  }

  function handleDragStart(staffId: string) {
    setDraggingStaff(staffId)
  }

  function handleDrop(day: string) {
    if (draggingStaff) {
      form.setValue("staffId", draggingStaff)
      form.setValue("day", day)
      setOpen(true)
      setDraggingStaff(null)
    }
  }

  const currentTab = TABS.find(t => t.path === location.pathname)?.value ?? "planning"

  return (
    <div>
      <PageHeader
        title={t("planning.title") || "Planning"}
        description={t("planning.description") || "Schedule staff shifts"}
        actions={
          <Button onClick={() => { form.reset(); setOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" /> {t("planning.addShift") || "Add Shift"}
          </Button>
        }
      />

      <Tabs value={currentTab} onValueChange={(v) => { const tab = TABS.find(t => t.value === v); if (tab) navigate(tab.path) }}>
        <TabsList className="mb-6">
          {TABS.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(wo => wo - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium">
            {format(currentWeekStart, "MMM d")} - {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
          </span>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset(wo => wo + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>Today</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[200px_repeat(7,1fr)] gap-px bg-border rounded-lg overflow-hidden min-w-[800px]">
            <div className="bg-muted p-3 font-medium">Staff</div>
            {DAYS.map(day => (
              <div key={day} className="bg-muted p-3 font-medium text-center text-sm">{day}</div>
            ))}
            {staffList?.map(staff => (
              <>
                <div
                  key={staff.id}
                  className="bg-background p-3 text-sm font-medium flex items-center"
                  draggable
                  onDragStart={() => handleDragStart(staff.id)}
                >
                  {staff.first_name} {staff.last_name}
                </div>
                {DAYS.map(day => {
                  const staffShifts = shiftsByStaffAndDay.get(`${staff.id}-${day}`) || []
                  return (
                    <div
                      key={`${staff.id}-${day}`}
                      className="bg-background p-2 min-h-[60px] border-l border-t cursor-pointer hover:bg-accent/20 transition-colors"
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => handleDrop(day)}
                    >
                      {staffShifts.map(shift => (
                        <div
                          key={shift.id}
                          className="bg-primary/10 text-primary text-xs rounded px-2 py-1 mb-1 flex justify-between items-center group"
                        >
                          <span>{shift.start_time}-{shift.end_time}</span>
                          <button
                            className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 ml-1"
                            onClick={() => deleteMutation.mutate(shift.id)}
                          >&times;</button>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("planning.addShift") || "Add Shift"}</DialogTitle>
            <DialogDescription>Assign a shift to a staff member</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="staffId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("planning.staff") || "Staff"}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {staffList?.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.first_name} {s.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="day" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("planning.day") || "Day"}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DAYS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("planning.startTime") || "Start Time"}</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("planning.endTime") || "End Time"}</FormLabel>
                    <FormControl><Input type="time" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("planning.notes") || "Notes"}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); form.reset() }}>Cancel</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
