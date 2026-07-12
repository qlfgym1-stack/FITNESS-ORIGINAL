import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { z } from "zod"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { formatDateTime, toUpper } from "@/lib/utils"
import { Plus, Edit, Trash2, ArrowUpRight, ArrowDownLeft, Loader2, Download } from "lucide-react"
import type { Inventory } from "@/types/supabase"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Pagination } from "@/components/ui/pagination"
import { Card } from "@/components/ui/card"

interface StockMovement {
  id: string
  inventory_id: string
  organization_id: string
  type: "in" | "out"
  quantity: number
  notes: string | null
  created_at: string
  inventory?: { name: string } | null
}

const stockSchema = z.object({
  inventory_id: z.string().min(1, "Product is required"),
  type: z.enum(["in", "out"]),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  notes: z.string().optional().or(z.literal("")),
})

type StockForm = z.infer<typeof stockSchema>

export default function StockMovementsPage() {
  const t = useT()
  const { toast } = useToast()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const orgId = organization?.id
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<StockMovement | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<StockMovement | null>(null)
  const [form, setForm] = useState<StockForm>({
    inventory_id: "", type: "in", quantity: 1, notes: "",
  })

  const { data: inventoryItems } = useQuery({
    queryKey: ["inventory", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from("inventory").select("id, name").eq("organization_id", orgId).order("name")
      return (data ?? []) as Pick<Inventory, "id" | "name">[]
    },
    enabled: !!orgId,
  })

  const { data: movements, isLoading, isError: movementsError, error: movementsQueryError } = useQuery({
    queryKey: ["stock_movements", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase
        .from("stock_movements")
        .select("*, inventory(name)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
      return (data ?? []) as StockMovement[]
    },
    enabled: !!orgId,
  })

  useEffect(() => {
    if (movementsError && movementsQueryError) {
      toast({ title: t("errors.error") || "Error", description: movementsQueryError.message, variant: "destructive" })
    }
  }, [movementsError, movementsQueryError])

  const upsertMutation = useMutation({
    mutationFn: async (values: StockForm) => {
      if (!orgId) throw new Error("No organization")
      const payload = {
        inventory_id: values.inventory_id,
        organization_id: orgId,
        type: values.type,
        quantity: Number(values.quantity),
        notes: values.notes || null,
      }
      if (editing) {
        const { error } = await supabase.from("stock_movements").update(payload).eq("id", editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("stock_movements").insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] })
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      toast({ title: editing ? t("common.updated") || "Updated" : t("common.created") || "Created" })
      setDialogOpen(false)
      setEditing(null)
      setForm({ inventory_id: "", type: "in", quantity: 1, notes: "" })
    },
    onError: (err: Error) => toast({ title: t("errors.error") || "Error", description: err.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("stock_movements").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] })
      toast({ title: t("common.deleted") || "Deleted" })
      setDeleteOpen(false)
      setDeleting(null)
    },
    onError: (err: Error) => toast({ title: t("errors.error") || "Error", description: err.message, variant: "destructive" }),
  })

  const filtered = movements?.filter((m) => {
    const name = m.inventory?.name ?? ""
    const notes = m.notes ?? ""
    return name.toLowerCase().includes(search.toLowerCase()) || notes.toLowerCase().includes(search.toLowerCase())
  }) ?? []

  const { page, setPage, totalPages, paginatedData: paginatedMovements } = usePagination(filtered, 20)

  const { exportCsv } = useExportCsv(
    filtered.map(m => ({ product: m.inventory?.name ?? '-', type: m.type, quantity: m.quantity, date: m.created_at, notes: m.notes ?? '' })),
    'stock-movements',
    [
      { key: 'product', label: t('stock.product') || 'Product' },
      { key: 'type', label: t('stock.type') || 'Type' },
      { key: 'quantity', label: t('stock.quantity') || 'Quantity' },
      { key: 'date', label: t('stock.date') || 'Date' },
      { key: 'notes', label: t('stock.notes') || 'Notes' },
    ]
  )

  function openCreate() {
    setEditing(null)
    setForm({ inventory_id: "", type: "in", quantity: 1, notes: "" })
    setDialogOpen(true)
  }

  function openEdit(m: StockMovement) {
    setEditing(m)
    setForm({ inventory_id: m.inventory_id, type: m.type, quantity: m.quantity, notes: m.notes ?? "" })
    setDialogOpen(true)
  }

  function handleSave() {
    const parsed = stockSchema.safeParse(form)
    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        toast({ title: t("errors.error") || "Error", description: issue.message, variant: "destructive" })
      })
      return
    }
    upsertMutation.mutate(parsed.data)
  }

  const inventoryName = (m: StockMovement) => m.inventory?.name ?? "-"

  return (
    <div>
      <PageHeader
        title={t("stock.title") || "Stock Movements"}
        description={t("stock.description") || "Track inventory movements"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv()}>
              <Download className="mr-2 h-4 w-4" />
              {t("common.export") || "Export"}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> {t("stock.add") || "Add Movement"}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder={t("common.search") || "Search..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("stock.product") || "Product"}</TableHead>
              <TableHead>{t("stock.type") || "Type"}</TableHead>
              <TableHead className="text-right">{t("stock.quantity") || "Quantity"}</TableHead>
              <TableHead>{t("stock.date") || "Date"}</TableHead>
              <TableHead>{t("stock.notes") || "Notes"}</TableHead>
              <TableHead className="text-right">{t("common.actions") || "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : paginatedMovements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {t("common.noResults") || "No results"}
                </TableCell>
              </TableRow>
            ) : (
              paginatedMovements.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{toUpper(inventoryName(m))}</TableCell>
                  <TableCell>
                    <Badge variant={m.type === "in" ? "default" : "destructive"} className="gap-1">
                      {m.type === "in" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                      {m.type === "in" ? t("stock.in") || "In" : t("stock.out") || "Out"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                  <TableCell>{formatDateTime(m.created_at)}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{toUpper(m.notes ?? "")}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeleting(m); setDeleteOpen(true) }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden space-y-3 p-4">
        {paginatedMovements.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{t("common.noResults") || "No results"}</p>
        ) : (
          paginatedMovements.map(m => (
            <Card key={m.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{toUpper(inventoryName(m))}</span>
                <Badge variant={m.type === "in" ? "default" : "destructive"} className="gap-1 ml-auto">
                  {m.type === "in" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                  {m.type === "in" ? t("stock.in") || "In" : t("stock.out") || "Out"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t("stock.quantity") || "Qty"}: {m.quantity}</p>
              <p className="text-sm text-muted-foreground">{formatDateTime(m.created_at)}</p>
              {m.notes && <p className="text-sm text-muted-foreground truncate">{toUpper(m.notes)}</p>}
              <div className="flex justify-end gap-1 mt-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setDeleting(m); setDeleteOpen(true) }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditing(null); setForm({ inventory_id: "", type: "in", quantity: 1, notes: "" }) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("stock.edit") || "Edit Movement" : t("stock.add") || "Add Movement"}</DialogTitle>
            <DialogDescription>{t("stock.formDescription") || "Record a stock movement"}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("stock.product") || "Product"}</Label>
              <Select value={form.inventory_id} onValueChange={(v) => setForm((f) => ({ ...f, inventory_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t("stock.selectProduct") || "Select product"} /></SelectTrigger>
                <SelectContent>
                  {inventoryItems?.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{toUpper(item.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("stock.type") || "Type"}</Label>
                <Select value={form.type} onValueChange={(v: "in" | "out") => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">{t("stock.in") || "In"}</SelectItem>
                    <SelectItem value="out">{t("stock.out") || "Out"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("stock.quantity") || "Quantity"}</Label>
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("stock.notes") || "Notes"}</Label>
              <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditing(null) }}>{t("common.cancel") || "Cancel"}</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save") || "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("common.confirm") || "Confirm Delete"}</DialogTitle>
            <DialogDescription>
              {t("stock.confirmDelete") || "Are you sure you want to delete this stock movement?"} <strong>{toUpper(deleting?.inventory?.name ?? "")}</strong>? {t("common.cannotUndo") || "This action cannot be undone."}
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
