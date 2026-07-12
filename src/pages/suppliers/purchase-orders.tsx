import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { formatDate, formatCurrency, getStatusColor, toUpper } from "@/lib/utils"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Pagination } from "@/components/ui/pagination"
import { Card } from "@/components/ui/card"
import { ShoppingCart, Plus, Search, Edit, Trash2, Loader2, Download } from "lucide-react"

interface PurchaseOrder {
  id: string
  supplier_id: string | null
  order_date: string
  status: string
  total_amount: number
  notes: string
  suppliers?: { name: string } | null
}

const purchaseOrderSchema = z.object({
  supplier_id: z.string().optional().or(z.literal("")),
  order_date: z.string().min(1, "Order date is required"),
  status: z.string().min(1, "Status is required"),
  total_amount: z.coerce.number().min(0, "Min 0"),
  notes: z.string().optional().or(z.literal("")),
})

type PurchaseOrderForm = z.infer<typeof purchaseOrderSchema>

export default function PurchaseOrdersPage() {
  const t = useT()
  const { toast } = useToast()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const orgId = organization?.id
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<PurchaseOrder | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null)

  const form = useForm<PurchaseOrderForm>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: { supplier_id: "", order_date: "", status: "pending", total_amount: 0, notes: "" },
  })

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", orgId],
    queryFn: async (): Promise<PurchaseOrder[]> => {
      if (!orgId) return []
      const { data } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name)")
        .eq("organization_id", orgId)
        .order("order_date", { ascending: false })
      return (data ?? []) as any[]
    },
    enabled: !!orgId,
  })

  const filtered = orders.filter((o) =>
    (o.suppliers?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    o.notes.toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, paginatedData: paginatedOrders } = usePagination(filtered, 20)

  const { exportCsv } = useExportCsv(
    filtered.map(o => ({ supplier: o.suppliers?.name ?? "", date: o.order_date, status: o.status, total: o.total_amount, notes: o.notes })),
    'purchase-orders',
    [
      { key: 'supplier', label: t('purchaseOrders.supplier') },
      { key: 'date', label: t('purchaseOrders.date') },
      { key: 'status', label: t('purchaseOrders.status') },
      { key: 'total', label: t('purchaseOrders.total') },
      { key: 'notes', label: t('purchaseOrders.notes') },
    ]
  )

  const upsertMutation = useMutation({
    mutationFn: async (values: PurchaseOrderForm) => {
      if (!orgId) throw new Error("No organization")
      const payload: any = {
        supplier_id: values.supplier_id || null,
        order_date: values.order_date,
        status: values.status,
        total_amount: values.total_amount,
        notes: values.notes || "",
      }
      if (editing) {
        const { error } = await supabase.from("purchase_orders").update(payload).eq("id", editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("purchase_orders").insert({ ...payload, organization_id: orgId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders", orgId] })
      toast({ title: editing ? t("common.updated") : t("common.created") })
      setDialogOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (err: Error) => toast({ title: t("errors.error"), description: err.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders", orgId] })
      toast({ title: t("common.deleted") })
      setDeleteOpen(false)
      setDeleting(null)
    },
    onError: (err: Error) => toast({ title: t("errors.error"), description: err.message, variant: "destructive" }),
  })

  function openCreate() {
    setEditing(null)
    form.reset({ supplier_id: "", order_date: "", status: "pending", total_amount: 0, notes: "" })
    setDialogOpen(true)
  }

  function openEdit(o: PurchaseOrder) {
    setEditing(o)
    form.reset({
      supplier_id: o.supplier_id ?? "",
      order_date: o.order_date,
      status: o.status,
      total_amount: o.total_amount,
      notes: o.notes,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: PurchaseOrderForm) {
    upsertMutation.mutate(values)
  }

  return (
    <div>
      <PageHeader
        title={t("purchaseOrders.title")}
        description={t("purchaseOrders.description")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv()}>
              <Download className="mr-2 h-4 w-4" />
              {t("common.export") || "Export"}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> {t("purchaseOrders.add")}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("purchaseOrders.supplier")}</TableHead>
              <TableHead>{t("purchaseOrders.date")}</TableHead>
              <TableHead>{t("purchaseOrders.status")}</TableHead>
              <TableHead className="text-right">{t("purchaseOrders.total")}</TableHead>
              <TableHead>{t("purchaseOrders.notes")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : paginatedOrders.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    {toUpper(o.suppliers?.name ?? "")}
                  </div>
                </TableCell>
                <TableCell>{formatDate(o.order_date)}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(o.status)} variant="secondary">
                    {toUpper(o.status.charAt(0).toUpperCase() + o.status.slice(1))}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(o.total_amount)}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{toUpper(o.notes)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(o)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeleting(o); setDeleteOpen(true) }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && paginatedOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
        ) : paginatedOrders.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{t("common.noResults")}</p>
        ) : (
          paginatedOrders.map((o) => (
            <Card key={o.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium flex items-center gap-1">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    {toUpper(o.suppliers?.name ?? "")}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDate(o.order_date)}</p>
                </div>
                <Badge className={getStatusColor(o.status)} variant="secondary">
                  {toUpper(o.status.charAt(0).toUpperCase() + o.status.slice(1))}
                </Badge>
              </div>
              <div className="mt-2 text-sm">
                <span className="font-mono">{formatCurrency(o.total_amount)}</span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(o)}>
                  <Edit className="h-4 w-4 mr-1" /> {t("common.edit") || "Edit"}
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setDeleting(o); setDeleteOpen(true) }}>
                  <Trash2 className="h-4 w-4 mr-1" /> {t("common.delete") || "Delete"}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("purchaseOrders.edit") : t("purchaseOrders.add")}</DialogTitle>
            <DialogDescription>{t("purchaseOrders.formDescription")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="supplier_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("purchaseOrders.supplier")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="order_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("purchaseOrders.date")}</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("purchaseOrders.status")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="total_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("purchaseOrders.total")}</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("purchaseOrders.notes")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={upsertMutation.isPending}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("purchaseOrders.confirmDelete") || "Confirm Delete"}</DialogTitle>
            <DialogDescription>
              {t("purchaseOrders.deleteWarning") || "Are you sure you want to delete order"} <strong>{toUpper(deleting?.suppliers?.name ?? "")}</strong>? {t("purchaseOrders.deleteWarning2") || "This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleting(null) }}>{t("common.cancel") || "Cancel"}</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.delete") || "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
