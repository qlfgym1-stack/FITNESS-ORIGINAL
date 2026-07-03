import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { useNavigate, useLocation } from "react-router-dom"
import { formatDate } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
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
import { Loader2, Plus, Check, X } from "lucide-react"
import type { StaffLeave, Staff } from "@/types/supabase"

const TABS = [
  { value: "list", label: "Staff List", path: "/staff" },
  { value: "timesheet", label: "Timesheet", path: "/staff/timesheet" },
  { value: "planning", label: "Planning", path: "/staff/planning" },
  { value: "leaves", label: "Leaves", path: "/staff/leaves" },
]

const leaveSchema = z.object({
  staffId: z.string().min(1, "Required"),
  type: z.enum(["vacation", "sick", "personal"]),
  startDate: z.string().min(1, "Required"),
  endDate: z.string().min(1, "Required"),
  reason: z.string().optional().or(z.literal("")),
})

type LeaveForm = z.infer<typeof leaveSchema>

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
}

export default function LeavesPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema),
    defaultValues: { staffId: "", type: "vacation", startDate: "", endDate: "", reason: "" },
  })

  const { data: staffList } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("*").order("first_name")
      return data ?? []
    },
  })

  const { data: leaves, isLoading } = useQuery({
    queryKey: ["staff_leaves"],
    queryFn: async () => {
      const { data } = await supabase.from("staff_leaves").select("*").order("created_at", { ascending: false })
      return data ?? []
    },
  })

  const staffMap = new Map<string, Staff>()
  staffList?.forEach(s => staffMap.set(s.id, s))

  const createMutation = useMutation({
    mutationFn: async (values: LeaveForm) => {
      const { error } = await supabase.from("staff_leaves").insert({
        staff_id: values.staffId,
        organization_id: (await supabase.auth.getUser()).data.user?.id ?? "",
        type: values.type,
        start_date: values.startDate,
        end_date: values.endDate,
        reason: values.reason || null,
        status: "pending",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff_leaves"] })
      toast({ title: "Leave requested" })
      setOpen(false)
      form.reset()
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("staff_leaves").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff_leaves"] })
      toast({ title: "Leave status updated" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  function onSubmit(values: LeaveForm) {
    createMutation.mutate(values)
  }

  const currentTab = TABS.find(t => t.path === location.pathname)?.value ?? "leaves"

  return (
    <div>
      <PageHeader
        title={t("leaves.title") || "Leave Management"}
        description={t("leaves.description") || "Manage staff leave requests"}
        actions={
          <Button onClick={() => { form.reset(); setOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" /> {t("leaves.request") || "Request Leave"}
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("leaves.staffName") || "Staff Name"}</TableHead>
                <TableHead>{t("leaves.type") || "Type"}</TableHead>
                <TableHead>{t("leaves.startDate") || "Start Date"}</TableHead>
                <TableHead>{t("leaves.endDate") || "End Date"}</TableHead>
                <TableHead>{t("leaves.status") || "Status"}</TableHead>
                <TableHead>{t("leaves.reason") || "Reason"}</TableHead>
                <TableHead>{t("leaves.actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : leaves?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("leaves.noData") || "No leave requests found"}</TableCell></TableRow>
              ) : (
                leaves?.map(leave => {
                  const staff = staffMap.get(leave.staff_id)
                  return (
                    <TableRow key={leave.id}>
                      <TableCell className="font-medium">{staff ? `${staff.first_name} ${staff.last_name}` : "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{leave.type}</Badge>
                      </TableCell>
                      <TableCell>{formatDate(leave.start_date)}</TableCell>
                      <TableCell>{formatDate(leave.end_date)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[leave.status]} className="capitalize">{leave.status}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{leave.reason || "-"}</TableCell>
                      <TableCell>
                        {leave.status === "pending" ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" onClick={() => statusMutation.mutate({ id: leave.id, status: "approved" })} disabled={statusMutation.isPending}>
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate({ id: leave.id, status: "rejected" })} disabled={statusMutation.isPending}>
                              <X className="h-3 w-3 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">{leave.status}</span>
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

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) form.reset() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("leaves.requestLeave") || "Request Leave"}</DialogTitle>
            <DialogDescription>Submit a new leave request</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="staffId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("leaves.staff") || "Staff"}</FormLabel>
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
              <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("leaves.type") || "Type"}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="vacation">Vacation</SelectItem>
                      <SelectItem value="sick">Sick</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("leaves.startDate") || "Start Date"}</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("leaves.endDate") || "End Date"}</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="reason" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("leaves.reason") || "Reason"}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); form.reset() }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
