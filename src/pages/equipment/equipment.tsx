import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { useNavigate, useLocation } from "react-router-dom"
import { formatDate, toUpper } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal, Download } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Equipment } from "@/types/supabase"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Pagination } from "@/components/ui/pagination"

const equipmentSchema = z.object({
  name: z.string().min(1, "Required"),
  description: z.string().optional().or(z.literal("")),
  category: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().min(0, "Min 0"),
  status: z.string().optional().or(z.literal("")),
  purchaseDate: z.string().optional().or(z.literal("")),
})

type EquipmentForm = z.infer<typeof equipmentSchema>

const TABS = [
  { value: "list", label: "Equipment", path: "/equipment" },
  { value: "reservations", label: "Reservations", path: "/equipment/reservations" },
  { value: "report", label: "Report", path: "/equipment/report" },
]

export default function EquipmentPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const navigate = useNavigate()
  const location = useLocation()
  const { organization } = useAuth()
  const orgId = organization?.id
  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [deleting, setDeleting] = useState<Equipment | null>(null)

  const form = useForm<EquipmentForm>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: { name: "", description: "", category: "", quantity: 0, status: "", purchaseDate: "" },
  })

  const { data: equipmentList, isLoading, isError: equipmentError, error: equipmentQueryError } = useQuery({
    queryKey: ["equipment", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from("equipment").select("*").eq("organization_id", orgId).order("name")
      return data ?? []
    },
    enabled: !!orgId,
  })

  useEffect(() => {
    if (equipmentError && equipmentQueryError) {
      toast({ title: t("errors.error") || "Error", description: equipmentQueryError.message, variant: "destructive" })
    }
  }, [equipmentError, equipmentQueryError])

  const upsertMutation = useMutation({
    mutationFn: async (values: EquipmentForm) => {
      const orgId = (await supabase.auth.getUser()).data.user?.id
      if (!orgId) throw new Error("No org")
      const quantityVal = Number(values.quantity)
      const base = {
        name: values.name,
        description: values.description || null,
        category: values.category || null,
        quantity: quantityVal,
        status: values.status || null,
        purchase_date: values.purchaseDate || null,
        organization_id: orgId,
      }
      if (editing) {
        const { error } = await supabase.from("equipment").update({ ...base, available_quantity: editing.available_quantity }).eq("id", editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("equipment").insert({ ...base, available_quantity: quantityVal })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] })
      queryClient.invalidateQueries({ queryKey: ["equipment_reservations"] })
      toast({ title: editing ? t("equipment.updated") : t("equipment.created") })
      setOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] })
      queryClient.invalidateQueries({ queryKey: ["equipment_reservations"] })
      toast({ title: t("equipment.deleted") })
      setDeleteOpen(false)
      setDeleting(null)
    },
    onError: (err: Error) => toast({ title: t("errors.error"), description: err.message, variant: "destructive" }),
  })

  function openEdit(equipment: Equipment) {
    setEditing(equipment)
    form.reset({
      name: equipment.name,
      description: equipment.description ?? "",
      category: equipment.category ?? "",
      quantity: equipment.quantity,
      status: equipment.status ?? "",
      purchaseDate: equipment.purchase_date ?? "",
    })
    setOpen(true)
  }

  function openAdd() {
    setEditing(null)
    form.reset()
    setOpen(true)
  }

  function onSubmit(values: EquipmentForm) {
    upsertMutation.mutate(values)
  }

  const { page, setPage, totalPages, paginatedData: paginatedEquipment } = usePagination(equipmentList, 20)

  const { exportCsv } = useExportCsv(
    (equipmentList ?? []).map(item => ({ name: item.name, category: item.category ?? '-', quantity: item.quantity, available_quantity: item.available_quantity, status: item.status ?? 'available', purchase_date: item.purchase_date ?? '-', last_maintenance: item.last_maintenance ?? '-' })),
    'equipment',
    [
      { key: 'name', label: t('equipment.name') || 'Name' },
      { key: 'category', label: t('equipment.category') || 'Category' },
      { key: 'quantity', label: t('equipment.totalQty') || 'Total Qty' },
      { key: 'available_quantity', label: t('equipment.availableQty') || 'Available Qty' },
      { key: 'status', label: t('equipment.status') || 'Status' },
      { key: 'purchase_date', label: t('equipment.purchaseDate') || 'Purchase Date' },
    ]
  )

  const currentTab = TABS.find(t => t.path === location.pathname)?.value ?? "list"

  return (
    <div>
      <PageHeader
        title={t("equipment.title") || "Équipements"}
        description={t("equipment.description") || "Gérer les équipements de la salle"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv()}>
              <Download className="mr-2 h-4 w-4" />
              {t("common.export") || "Export"}
            </Button>
            <Button onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />
              {t("equipment.add") || "Add Equipment"}
            </Button>
          </div>
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
          <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("equipment.name") || "Name"}</TableHead>
                <TableHead>{t("equipment.category") || "Category"}</TableHead>
                <TableHead>{t("equipment.totalQty") || "Total Qty"}</TableHead>
                <TableHead>{t("equipment.availableQty") || "Available Qty"}</TableHead>
                <TableHead>{t("equipment.status") || "Status"}</TableHead>
                <TableHead>{t("equipment.purchaseDate") || "Purchase Date"}</TableHead>
                <TableHead>{t("equipment.lastMaintenance") || "Last Maintenance"}</TableHead>
                <TableHead className="w-[70px]">{t("equipment.actions") || "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : paginatedEquipment?.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("equipment.noData") || "No equipment found"}</TableCell></TableRow>
              ) : (
                paginatedEquipment?.map(item => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{toUpper(item.name)}</TableCell>
                    <TableCell className="capitalize">{toUpper(item.category) || "-"}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{item.available_quantity}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "available" ? "default" : item.status === "maintenance" ? "destructive" : "secondary"} className="capitalize">
                        {toUpper(item.status) || "available"}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.purchase_date ? formatDate(item.purchase_date) : "-"}</TableCell>
                    <TableCell>{item.last_maintenance ? formatDate(item.last_maintenance) : "-"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(item)}>
                            <Pencil className="mr-2 h-4 w-4" /> {t("edit") || "Edit"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => { setDeleting(item); setDeleteOpen(true) }}>
                            <Trash2 className="mr-2 h-4 w-4" /> {t("delete") || "Delete"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
          <div className="md:hidden space-y-3 p-4">
            {isLoading ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : paginatedEquipment?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              paginatedEquipment?.map(item => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium">{toUpper(item.name)}</span>
                    <Badge variant={item.status === "available" ? "default" : item.status === "maintenance" ? "destructive" : "secondary"} className="ml-auto capitalize">
                      {toUpper(item.status) || "available"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{t("equipment.category") || "Category"}: {toUpper(item.category) || "-"}</p>
                  <p className="text-sm text-muted-foreground">{t("equipment.totalQty") || "Total"}: {item.quantity} | {t("equipment.availableQty") || "Available"}: {item.available_quantity}</p>
                  <div className="flex justify-end gap-1 mt-2">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true) }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      <Pagination page={page} totalPages={totalPages} totalItems={equipmentList?.length ?? 0} pageSize={20} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); form.reset() } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editing ? (t("equipment.editEquipment") || "Edit Equipment") : (t("equipment.addEquipment") || "Add Equipment")}</DialogTitle>
            <DialogDescription>{editing ? "Update equipment information" : "Fill in the details to add new equipment"}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("equipment.name") || "Name"}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("equipment.description") || "Description"}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipment.category") || "Category"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cardio">Cardio</SelectItem>
                        <SelectItem value="strength">Strength</SelectItem>
                        <SelectItem value="free_weights">Free Weights</SelectItem>
                        <SelectItem value="machines">Machines</SelectItem>
                        <SelectItem value="accessories">Accessories</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipment.quantity") || "Quantity"}</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipment.status") || "Status"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Available</SelectItem>
                        <SelectItem value="in_use">In Use</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="retired">Retired</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("equipment.purchaseDate") || "Purchase Date"}</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("equipment.confirmDelete") || "Confirm Delete"}</DialogTitle>
            <DialogDescription>
              {t("equipment.deleteWarning") || "Are you sure you want to delete"} <strong>{toUpper(deleting?.name)}</strong>? {t("equipment.deleteWarning2") || "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleting(null) }}>{t("cancel") || "Cancel"}</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("delete") || "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
