import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { useNavigate, useLocation } from "react-router-dom"
import { formatDateTime } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import type { EquipmentReservation, Equipment } from "@/types/supabase"

const TABS = [
  { value: "list", label: "Equipment", path: "/equipment" },
  { value: "reservations", label: "Reservations", path: "/equipment/reservations" },
  { value: "report", label: "Report", path: "/equipment/report" },
]

const reservationSchema = z.object({
  equipmentId: z.string().min(1, "Required"),
  memberId: z.string().min(1, "Required"),
  startTime: z.string().min(1, "Required"),
  endTime: z.string().min(1, "Required"),
})

type ReservationForm = z.infer<typeof reservationSchema>

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  confirmed: "default",
  cancelled: "secondary",
  completed: "outline",
}

export default function ReservationsPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)

  const form = useForm<ReservationForm>({
    resolver: zodResolver(reservationSchema),
    defaultValues: { equipmentId: "", memberId: "", startTime: "", endTime: "" },
  })

  const { data: equipmentList } = useQuery({
    queryKey: ["equipment"],
    queryFn: async () => {
      const { data } = await supabase.from("equipment").select("*").gt("available_quantity", 0).order("name")
      return data ?? []
    },
  })

  const { data: members } = useQuery({
    queryKey: ["members_minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, first_name, last_name").eq("status", "active").order("first_name")
      return data ?? []
    },
  })

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["equipment_reservations"],
    queryFn: async () => {
      const { data } = await supabase.from("equipment_reservations").select("*").order("created_at", { ascending: false })
      return data ?? []
    },
  })

  const equipmentMap = new Map<string, Equipment>()
  equipmentList?.forEach(e => equipmentMap.set(e.id, e))

  const memberMap = new Map<string, { first_name: string; last_name: string }>()
  members?.forEach(m => memberMap.set(m.id, m))

  const createMutation = useMutation({
    mutationFn: async (values: ReservationForm) => {
      const { error } = await supabase.from("equipment_reservations").insert({
        equipment_id: values.equipmentId,
        member_id: values.memberId,
        organization_id: (await supabase.auth.getUser()).data.user?.id ?? "",
        start_time: values.startTime,
        end_time: values.endTime,
        status: "confirmed",
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment_reservations"] })
      toast({ title: "Reservation created" })
      setOpen(false)
      form.reset()
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "confirmed" | "cancelled" | "completed" }) => {
      const { error } = await supabase.from("equipment_reservations").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment_reservations"] })
      toast({ title: "Reservation updated" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  function onSubmit(values: ReservationForm) {
    createMutation.mutate(values)
  }

  const currentTab = TABS.find(t => t.path === location.pathname)?.value ?? "reservations"

  return (
    <div>
      <PageHeader
        title={t("reservations.title") || "Equipment Reservations"}
        description={t("reservations.description") || "Manage equipment reservations"}
        actions={
          <Button onClick={() => { form.reset(); setOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" /> {t("reservations.new") || "New Reservation"}
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
                <TableHead>{t("reservations.equipment") || "Equipment"}</TableHead>
                <TableHead>{t("reservations.member") || "Member"}</TableHead>
                <TableHead>{t("reservations.startTime") || "Start Time"}</TableHead>
                <TableHead>{t("reservations.endTime") || "End Time"}</TableHead>
                <TableHead>{t("reservations.status") || "Status"}</TableHead>
                <TableHead>{t("reservations.actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : reservations?.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("reservations.noData") || "No reservations found"}</TableCell></TableRow>
              ) : (
                reservations?.map(res => {
                  const equipment = equipmentMap.get(res.equipment_id)
                  const member = memberMap.get(res.member_id)
                  return (
                    <TableRow key={res.id}>
                      <TableCell className="font-medium">{equipment?.name || "-"}</TableCell>
                      <TableCell>{member ? `${member.first_name} ${member.last_name}` : "-"}</TableCell>
                      <TableCell>{formatDateTime(res.start_time)}</TableCell>
                      <TableCell>{formatDateTime(res.end_time)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANTS[res.status]} className="capitalize">{res.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {res.status === "confirmed" ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" onClick={() => statusMutation.mutate({ id: res.id, status: "completed" })} disabled={statusMutation.isPending}>
                              <Check className="h-3 w-3 mr-1" /> Complete
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => statusMutation.mutate({ id: res.id, status: "cancelled" })} disabled={statusMutation.isPending}>
                              <X className="h-3 w-3 mr-1" /> Cancel
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground capitalize">{res.status}</span>
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
            <DialogTitle>{t("reservations.newReservation") || "New Reservation"}</DialogTitle>
            <DialogDescription>Reserve equipment for a member</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="equipmentId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("reservations.equipment") || "Equipment"}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select equipment" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {equipmentList?.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name} ({e.available_quantity} available)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="memberId" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("reservations.member") || "Member"}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select member" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {members?.map(m => (
                        <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="startTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reservations.startTime") || "Start Time"}</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="endTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("reservations.endTime") || "End Time"}</FormLabel>
                    <FormControl><Input type="datetime-local" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); form.reset() }}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Reservation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
