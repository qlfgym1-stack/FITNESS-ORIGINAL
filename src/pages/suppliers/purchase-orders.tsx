import { useState, useMemo } from "react"
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
import { Label } from "@/components/ui/label"
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
import { ShoppingCart, Plus, Search, Edit, Trash2, Loader2, Download, PackageCheck, X } from "lucide-react"
import type { Product } from "@/types/supabase"

interface PurchaseOrderItem {
  id: string
  product_id: string | null
  quantity: number
  unit_price: number
  subtotal: number
  products?: { name: string } | null
}

interface PurchaseOrder {
  id: string
  supplier_id: string | null
  order_date: string
  status: string
  total_amount: number
  notes: string
  suppliers?: { name: string } | null
  purchase_order_items?: PurchaseOrderItem[]
}

interface LineItem {
  product_id: string
  quantity: number
  unit_price: number
}

const purchaseOrderSchema = z.object({
  supplier_id: z.string().min(1, "Supplier is required"),
  order_date: z.string().min(1, "Order date is required"),
  notes: z.string().optional().or(z.literal("")),
})

type PurchaseOrderForm = z.infer<typeof purchaseOrderSchema>

const STATUS_OPTIONS = ["pending", "received", "completed", "cancelled"]

export default function PurchaseOrdersPage() {
  const t = useT()
  const { toast } = useToast()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization, roles } = useAuth()
  const orgId = organization?.id
  const isAdmin = roles?.some((r) => r.role === "admin") === true
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<PurchaseOrder | null>(null)
  const [lines, setLines] = useState<LineItem[]>([])

  const form = useForm<PurchaseOrderForm>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: { supplier_id: "", order_date: new Date().toISOString().slice(0, 10), notes: "" },
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", orgId],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      if (!orgId) return []
      const { data } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("organization_id", orgId)
        .order("name")
      return (data ?? []) as { id: string; name: string }[]
    },
    enabled: !!orgId,
  })

  const { data: products = [] } = useQuery({
    queryKey: ["products", orgId],
    queryFn: async (): Promise<Product[]> => {
      if (!orgId) return []
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name")
      return (data ?? []) as Product[]
    },
    enabled: !!orgId,
  })

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["purchase_orders", orgId],
    queryFn: async (): Promise<PurchaseOrder[]> => {
      if (!orgId) return []
      const { data } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name), purchase_order_items(product_id, quantity, unit_price, subtotal, products(name))")
        .eq("organization_id", orgId)
        .order("order_date", { ascending: false })
      return (data ?? []) as any[]
    },
    enabled: !!orgId,
  })

  const productName = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of products) map.set(p.id, p.name)
    return map
  }, [products])

  const filtered = orders.filter((o: PurchaseOrder) =>
    (o.suppliers?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (o.notes ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, paginatedData: paginatedOrders } = usePagination(filtered, 20)

  const { exportCsv } = useExportCsv(
    filtered.map((o: PurchaseOrder) => ({ supplier: o.suppliers?.name ?? "", date: o.order_date, status: o.status, total: o.total_amount, notes: o.notes ?? "" })),
    'purchase-orders',
    [
      { key: 'supplier', label: t('purchaseOrders.supplier') },
      { key: 'date', label: t('purchaseOrders.date') },
      { key: 'status', label: t('purchaseOrders.status') },
      { key: 'total', label: t('purchaseOrders.total') },
      { key: 'notes', label: t('purchaseOrders.notes') },
    ]
  )

  function addLine() {
    setLines(prev => [...prev, { product_id: "", quantity: 1, unit_price: 0 }])
  }

  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines(prev => prev.map((line, i) => {
      if (i !== index) return line
      const next = { ...line, ...patch }
      if (patch.product_id) {
        const p = products.find((pr: Product) => pr.id === patch.product_id)
        if (p && (line.unit_price === 0 || !line.unit_price)) next.unit_price = p.cost ?? p.price
      }
      return next
    }))
  }

  function removeLine(index: number) {
    setLines(prev => prev.filter((_, i) => i !== index))
  }

  const total = lines.reduce((sum, l) => sum + (l.quantity * (l.unit_price || 0)), 0)

  const createMutation = useMutation({
    mutationFn: async (values: PurchaseOrderForm) => {
      if (!orgId) throw new Error("No organization")
      const validLines = lines.filter(l => l.product_id && l.quantity > 0)
      if (validLines.length === 0) throw new Error(t("purchaseOrders.noLines") || "Ajoutez au moins une ligne")
      const { error } = await (supabase.rpc as any)("create_purchase_order", {
        p_supplier_id: values.supplier_id,
        p_order_date: values.order_date,
        p_notes: values.notes || null,
        p_items: JSON.stringify(validLines.map(l => ({ product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price }))),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders", orgId] })
      toast({ title: t("common.created") })
      setDialogOpen(false)
      setLines([])
      form.reset({ supplier_id: "", order_date: new Date().toISOString().slice(0, 10), notes: "" })
    },
    onError: (err: Error) => toast({ title: t("errors.error"), description: err.message, variant: "destructive" }),
  })

  const receiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.rpc as any)("receive_purchase_order", { p_order_id: id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders", orgId] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] })
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      toast({ title: t("purchaseOrders.received") || "Bon de commande réceptionné" })
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
    setLines([])
    form.reset({ supplier_id: "", order_date: new Date().toISOString().slice(0, 10), notes: "" })
    setDialogOpen(true)
  }

  function onSubmit(values: PurchaseOrderForm) {
    createMutation.mutate(values)
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
            {isAdmin && (
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" /> {t("purchaseOrders.add")}
              </Button>
            )}
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
              <TableHead>{t("purchaseOrders.items") || "Articles"}</TableHead>
              <TableHead className="text-right">{t("purchaseOrders.total")}</TableHead>
              <TableHead>{t("purchaseOrders.notes")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
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
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {(o.purchase_order_items?.length ?? 0)} ligne(s)
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(o.total_amount ?? 0)}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{toUpper(o.notes ?? "")}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {isAdmin && o.status !== "received" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={receiveMutation.isPending}
                        onClick={() => receiveMutation.mutate(o.id)}
                        title={t("purchaseOrders.receive") || "Réceptionner"}
                      >
                        <PackageCheck className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => { setDeleting(o); setDeleteOpen(true) }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && paginatedOrders.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                <span className="font-mono">{formatCurrency(o.total_amount ?? 0)}</span>
                <span className="text-muted-foreground ml-2">({o.purchase_order_items?.length ?? 0} ligne(s))</span>
              </div>
              <div className="mt-3 flex gap-2">
                {isAdmin && o.status !== "received" && (
                  <Button variant="outline" size="sm" onClick={() => receiveMutation.mutate(o.id)} disabled={receiveMutation.isPending}>
                    <PackageCheck className="h-4 w-4 mr-1 text-emerald-600" /> {t("purchaseOrders.receive") || "Réceptionner"}
                  </Button>
                )}
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("purchaseOrders.add")}</DialogTitle>
            <DialogDescription>{t("purchaseOrders.formDescription")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="supplier_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("purchaseOrders.supplier")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder={t("purchaseOrders.selectSupplier") || "Sélectionner un fournisseur"} /></SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s: { id: string; name: string }) => (
                            <SelectItem key={s.id} value={s.id}>{toUpper(s.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="order_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("purchaseOrders.date")}</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t("purchaseOrders.items") || "Articles"}</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="mr-1 h-3 w-3" /> {t("purchaseOrders.addLine") || "Ajouter une ligne"}
                  </Button>
                </div>
                {lines.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("purchaseOrders.noLinesHint") || "Aucune ligne — ajoutez des articles"}</p>
                )}
                {lines.map((line, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <div className="flex-1 grid gap-1">
                      <Label className="text-xs">{t("purchaseOrders.product") || "Produit"}</Label>
                      <Select value={line.product_id} onValueChange={(v) => updateLine(i, { product_id: v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p: Product) => (
                            <SelectItem key={p.id} value={p.id}>{toUpper(p.name)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-20 grid gap-1">
                      <Label className="text-xs">{t("purchaseOrders.qty") || "Qté"}</Label>
                      <Input type="number" min={1} value={line.quantity}
                        onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                    </div>
                    <div className="w-28 grid gap-1">
                      <Label className="text-xs">{t("purchaseOrders.unitPrice") || "PU (DA)"}</Label>
                      <Input type="number" min={0} value={line.unit_price}
                        onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} />
                    </div>
                    <div className="w-28 text-right pb-2 font-mono text-sm">
                      {formatCurrency(line.quantity * (line.unit_price || 0))}
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(i)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                {lines.length > 0 && (
                  <div className="flex justify-end gap-4 pt-2 border-t">
                    <span className="text-sm text-muted-foreground">{t("purchaseOrders.total")}</span>
                    <span className="font-mono font-semibold">{formatCurrency(total)}</span>
                  </div>
                )}
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("purchaseOrders.notes")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={createMutation.isPending}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
