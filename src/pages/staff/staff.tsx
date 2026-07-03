import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { useNavigate, useLocation } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { formatDate, formatCurrency, cn } from "@/lib/utils"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/toast"
import { Plus, Pencil, Loader2, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Staff, Tables } from "@/types/supabase"

const staffSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  role: z.string().optional().or(z.literal("")),
  salary: z.coerce.number().min(0).optional().or(z.literal("")),
  hireDate: z.string().optional().or(z.literal("")),
})

type StaffForm = z.infer<typeof staffSchema>

const ROLES = ["coach", "trainer", "receptionist", "cleaner", "manager"]
const TABS = [
  { value: "list", label: "Staff List", path: "/staff" },
  { value: "timesheet", label: "Timesheet", path: "/staff/timesheet" },
  { value: "planning", label: "Planning", path: "/staff/planning" },
  { value: "leaves", label: "Leaves", path: "/staff/leaves" },
]

export default function StaffPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)

  const form = useForm<StaffForm>({
    resolver: zodResolver(staffSchema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "", role: "", salary: "" as unknown as number, hireDate: "" },
  })

  const { data: staffList, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const { data } = await supabase.from("staff").select("*").order("created_at", { ascending: false })
      return data ?? []
    },
  })

  const upsertMutation = useMutation({
    mutationFn: async (values: StaffForm) => {
      const orgId = (await supabase.auth.getUser()).data.user?.id
      if (!orgId) throw new Error("No org")
      const payload = {
        first_name: values.firstName,
        last_name: values.lastName,
        email: values.email || null,
        phone: values.phone || null,
        role: values.role || null,
        salary: values.salary ? Number(values.salary) : null,
        hire_date: values.hireDate || null,
        organization_id: orgId,
      }
      if (editing) {
        const { error } = await supabase.from("staff").update(payload).eq("id", editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("staff").insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      toast({ title: editing ? "Staff updated" : "Staff created" })
      setOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const toggleStatus = useMutation({
    mutationFn: async (staff: Staff) => {
      const { error } = await supabase.from("staff").update({ is_active: !staff.is_active }).eq("id", staff.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff"] })
      toast({ title: "Status updated" })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  function openEdit(staff: Staff) {
    setEditing(staff)
    form.reset({
      firstName: staff.first_name,
      lastName: staff.last_name,
      email: staff.email ?? "",
      phone: staff.phone ?? "",
      role: staff.role ?? "",
      salary: staff.salary ?? "" as unknown as number,
      hireDate: staff.hire_date ?? "",
    })
    setOpen(true)
  }

  function openAdd() {
    setEditing(null)
    form.reset()
    setOpen(true)
  }

  function onSubmit(values: StaffForm) {
    upsertMutation.mutate(values)
  }

  const currentTab = TABS.find(t => t.path === location.pathname)?.value ?? "list"

  return (
    <div>
      <PageHeader
        title={t("staff.title") || "Staff"}
        description={t("staff.description") || "Manage your staff"}
        actions={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t("staff.add") || "Add Staff"}
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
                <TableHead>{t("staff.name") || "Name"}</TableHead>
                <TableHead>{t("staff.email") || "Email"}</TableHead>
                <TableHead>{t("staff.phone") || "Phone"}</TableHead>
                <TableHead>{t("staff.role") || "Role"}</TableHead>
                <TableHead>{t("staff.salary") || "Salary"}</TableHead>
                <TableHead>{t("staff.hireDate") || "Hire Date"}</TableHead>
                <TableHead>{t("staff.status") || "Status"}</TableHead>
                <TableHead className="w-[70px]">{t("staff.actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : staffList?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("staff.noData") || "No staff found"}</TableCell></TableRow>
              ) : (
                staffList?.map(staff => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">{staff.first_name} {staff.last_name}</TableCell>
                    <TableCell>{staff.email}</TableCell>
                    <TableCell>{staff.phone}</TableCell>
                    <TableCell className="capitalize">{staff.role}</TableCell>
                    <TableCell>{staff.salary ? formatCurrency(staff.salary) : "-"}</TableCell>
                    <TableCell>{staff.hire_date ? formatDate(staff.hire_date) : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={staff.is_active ? "default" : "secondary"}>{staff.is_active ? "Active" : "Inactive"}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(staff)}>
                            <Pencil className="mr-2 h-4 w-4" /> {t("staff.edit") || "Edit"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleStatus.mutate(staff)}>
                            {staff.is_active ? t("staff.deactivate") || "Deactivate" : t("staff.activate") || "Activate"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); form.reset() } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editing ? (t("staff.editStaff") || "Edit Staff") : (t("staff.addStaff") || "Add Staff")}</DialogTitle>
            <DialogDescription>{editing ? "Update staff information" : "Fill in the details to add a new staff member"}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="firstName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("staff.firstName") || "First Name"}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="lastName" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("staff.lastName") || "Last Name"}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("staff.email") || "Email"}</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("staff.phone") || "Phone"}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("staff.role") || "Role"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="salary" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("staff.salary") || "Salary"}</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="hireDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("staff.hireDate") || "Hire Date"}</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); form.reset() }}>{t("cancel") || "Cancel"}</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? (t("save") || "Save") : (t("create") || "Create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
