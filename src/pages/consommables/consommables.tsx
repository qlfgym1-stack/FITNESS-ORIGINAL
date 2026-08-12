import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { toUpper, formatCurrency } from "@/lib/utils"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { useToast } from "@/components/ui/toast"
import { Loader2, Plus, Pencil, Trash2, Search, SprayCan, AlertTriangle, Download, ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Consumable } from "@/types/supabase"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Pagination } from "@/components/ui/pagination"
import { ShieldAlert } from "lucide-react"

const consumableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  brand: z.string().optional().or(z.literal("")),
  unit: z.string().optional().or(z.literal("")),
  min_stock: z.coerce.number().min(0, "Min 0"),
  cost: z.coerce.number().min(0, "Min 0"),
  notes: z.string().optional().or(z.literal("")),
})

type ConsumableForm = z.infer<typeof consumableSchema>

const CATEGORIES = [
  { value: "entretien", label: "Entretien" },
  { value: "hygiene", label: "Hygiène" },
  { value: "sanitaire", label: "Sanitaire" },
  { value: "bureau", label: "Bureau" },
  { value: "securite", label: "Sécurité" },
  { value: "autre", label: "Autre" },
] as const

const UNITS = [
  { value: "piece", label: "Pièce" },
  { value: "L", label: "Litres" },
  { value: "kg", label: "Kg" },
  { value: "rouleau", label: "Rouleau" },
  { value: "lot", label: "Lot" },
] as const

const MOVEMENT_REASONS = [
  { value: "achat", label: "Achat" },
  { value: "utilisation", label: "Utilisation" },
  { value: "casse", label: "Casse/Perte" },
  { value: "ajustement", label: "Ajustement" },
  { value: "inventaire", label: "Inventaire" },
] as const

export default function ConsommablesPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const { organization, roles } = useAuth()
  const orgId = organization?.id
  const isAdmin = roles?.some((r) => r.role === "admin") === true

  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [movementOpen, setMovementOpen] = useState(false)
  const [editing, setEditing] = useState<Consumable | null>(null)
  const [deleting, setDeleting] = useState<Consumable | null>(null)
  const [moving, setMoving] = useState<Consumable | null>(null)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [movementForm, setMovementForm] = useState({ type: "in" as "in" | "out", quantity: 1, reason: "achat", notes: "", unit_price: "", supplier_id: "", reference: "", movement_date: new Date().toISOString().slice(0, 10) })

  const form = useForm<ConsumableForm>({
    resolver: zodResolver(consumableSchema),
    defaultValues: { name: "", category: "entretien", brand: "", unit: "piece", min_stock: 0, cost: 0, notes: "" },
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["consumables", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from("consumables").select("*").eq("organization_id", orgId).order("name")
      return (data ?? []) as Consumable[]
    },
    enabled: !!orgId,
  })

  // Fiches d'inventaire liees (necessaires pour enregistrer les mouvements)
  const { data: linkedInventory = [] } = useQuery({
    queryKey: ["consumables-inventory", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from("inventory").select("id, consumable_id").eq("organization_id", orgId).not("consumable_id", "is", null)
      return (data ?? []) as { id: string; consumable_id: string }[]
    },
    enabled: !!orgId,
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

  const inventoryByConsumable = useMemo(() => {
    const map: Record<string, string> = {}
    linkedInventory.forEach((row) => { if (row.consumable_id) map[row.consumable_id] = row.id })
    return map
  }, [linkedInventory])

  const filtered = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || (item.brand ?? "").toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const totalItems = items.length
  const stockValue = items.reduce((sum, i) => sum + ((i.quantity ?? 0) * (i.cost ?? 0)), 0)
  const lowStock = items.filter((i) => (i.quantity ?? 0) <= (i.min_stock ?? 0)).length

  const upsertMutation = useMutation({
    mutationFn: async (values: ConsumableForm) => {
      if (!orgId) throw new Error("No organization")
      const payload = {
        name: values.name,
        category: values.category as Consumable["category"],
        brand: values.brand || null,
        unit: values.unit || "piece",
        min_stock: Number(values.min_stock),
        cost: Number(values.cost),
        notes: values.notes || null,
      }
      if (editing) {
        const { error } = await supabase.from("consumables").update(payload).eq("id", editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("consumables").insert({ ...payload, organization_id: orgId, quantity: 0 })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consumables"] })
      queryClient.invalidateQueries({ queryKey: ["consumables-inventory"] })
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      toast({ title: editing ? t("common.updated") || "Updated" : t("common.created") || "Created" })
      setOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (err: Error) => toast({ title: t("errors.error") || "Error", description: err.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error("No organization")
      const invId = inventoryByConsumable[id]
      if (invId) {
        const { count } = await supabase
          .from("stock_movements")
          .select("id", { count: "exact", head: true })
          .eq("inventory_id", invId)
        if (count && count > 0) {
          throw new Error(t("inventory.deleteBlocked") || "Cannot delete: stock movements exist for this item")
        }
      }
      const { error } = await supabase.from("consumables").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consumables"] })
      queryClient.invalidateQueries({ queryKey: ["consumables-inventory"] })
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      toast({ title: t("common.deleted") || "Deleted" })
      setDeleteOpen(false)
      setDeleting(null)
    },
    onError: (err: Error) => toast({ title: t("errors.error") || "Error", description: err.message, variant: "destructive" }),
  })

  const movementMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: { type: "in" | "out"; quantity: number; reason: string; notes: string; unit_price: string; supplier_id: string; reference: string; movement_date: string } }) => {
      if (!orgId) throw new Error("No organization")
      const inventoryId = inventoryByConsumable[id]
      if (!inventoryId) throw new Error("No linked inventory record — re-save the consumable")
      const { error } = await (supabase.rpc as any)("record_stock_movement", {
        p_organization_id: orgId,
        p_inventory_id: inventoryId,
        p_type: form.type,
        p_quantity: Number(form.quantity),
        p_reason: form.reason || "ajustement",
        p_notes: form.notes || null,
        p_unit_price: form.type === "in" && form.unit_price !== "" ? Number(form.unit_price) : null,
        p_supplier_id: form.type === "in" && form.supplier_id !== "" ? form.supplier_id : null,
        p_reference: form.type === "in" && form.reference !== "" ? form.reference : null,
        p_movement_date: form.type === "in" && form.movement_date !== "" ? form.movement_date : new Date().toISOString().slice(0, 10),
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consumables"] })
      queryClient.invalidateQueries({ queryKey: ["consumables-inventory"] })
      queryClient.invalidateQueries({ queryKey: ["inventory"] })
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] })
      queryClient.invalidateQueries({ queryKey: ["expenses"] })
      toast({ title: t("common.success") || "Success" })
      setMovementOpen(false)
      setMoving(null)
      setMovementForm({ type: "in", quantity: 1, reason: "achat", notes: "", unit_price: "", supplier_id: "", reference: "", movement_date: new Date().toISOString().slice(0, 10) })
    },
    onError: (err: Error) => toast({ title: t("errors.error") || "Error", description: err.message, variant: "destructive" }),
  })

  function openAdd() {
    setEditing(null)
    form.reset({ name: "", category: "entretien", brand: "", unit: "piece", min_stock: 0, cost: 0, notes: "" })
    setOpen(true)
  }

  function openEdit(item: Consumable) {
    setEditing(item)
    form.reset({
      name: item.name,
      category: item.category,
      brand: item.brand ?? "",
      unit: item.unit ?? "piece",
      min_stock: item.min_stock ?? 0,
      cost: item.cost ?? 0,
      notes: item.notes ?? "",
    })
    setOpen(true)
  }

  function onSubmit(values: ConsumableForm) {
    upsertMutation.mutate(values)
  }

  function openMovement(item: Consumable) {
    setMoving(item)
    setMovementForm({ type: "in", quantity: 1, reason: "achat", notes: "", unit_price: "", supplier_id: "", reference: "", movement_date: new Date().toISOString().slice(0, 10) })
    setMovementOpen(true)
  }

  const { page, setPage, totalPages, paginatedData: paginated } = usePagination(filtered, 20)

  const { exportCsv } = useExportCsv(
    filtered.map(i => ({ name: i.name, category: i.category, brand: i.brand ?? "", unit: i.unit ?? "", quantity: i.quantity ?? 0, min_stock: i.min_stock ?? 0, cost: i.cost ?? 0, notes: i.notes ?? "" })),
    'consommables',
    [
      { key: 'name', label: 'Nom' },
      { key: 'category', label: 'Catégorie' },
      { key: 'brand', label: 'Marque' },
      { key: 'unit', label: 'Unité' },
      { key: 'quantity', label: 'Stock' },
      { key: 'min_stock', label: 'Stock min' },
      { key: 'cost', label: 'Coût' },
      { key: 'notes', label: 'Notes' },
    ]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("consommables.title")}
        description={t("consommables.description")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv()}>
              <Download className="mr-2 h-4 w-4" /> {t("common.export") || "Export"}
            </Button>
            {isAdmin && (
              <Button onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" /> {t("consommables.add")}
              </Button>
            )}
          </div>
        }
      />

      {!isAdmin && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldAlert className="h-4 w-4" />
          {t("stock.readOnly") || "Lecture seule — seuls les administrateurs peuvent modifier"}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <SprayCan className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("consommables.total")}</p>
              <p className="text-2xl font-bold">{totalItems}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("consommables.stockValue")}</p>
              <p className="text-2xl font-bold">{formatCurrency(stockValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("consommables.lowStock")}</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{lowStock}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search") || "Rechercher..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t("consommables.category")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("consommables.allCategories")}</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("consommables.name")}</TableHead>
                  <TableHead>{t("consommables.category")}</TableHead>
                  <TableHead>{t("consommables.brand")}</TableHead>
                  <TableHead className="text-right">{t("consommables.stock")}</TableHead>
                  <TableHead className="text-right">{t("consommables.minStock")}</TableHead>
                  <TableHead className="text-right">{t("consommables.cost")}</TableHead>
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
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {t("common.noResults") || "No results"}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((item) => {
                    const low = (item.quantity ?? 0) <= (item.min_stock ?? 0)
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <SprayCan className="h-4 w-4 text-muted-foreground" />
                            {toUpper(item.name)}
                            {low && (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" /> {t("inventory.lowStock")}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{CATEGORIES.find(c => c.value === item.category)?.label ?? toUpper(item.category)}</Badge>
                        </TableCell>
                        <TableCell>{toUpper(item.brand ?? "")}</TableCell>
                        <TableCell className="text-right font-mono">{item.quantity ?? 0} {toUpper(item.unit ?? "")}</TableCell>
                        <TableCell className="text-right">{item.min_stock ?? 0}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.cost ?? 0)}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {isAdmin && (
                              <Button variant="ghost" size="icon" title={t("consommables.movement")} onClick={() => openMovement(item)}>
                                <ArrowDownLeft className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true) }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden space-y-3 p-4">
            {paginated.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("common.noResults") || "No results"}</p>
            ) : (
              paginated.map(item => (
                <div key={item.id} className="p-4 border rounded-lg space-y-1">
                  <div className="flex items-center gap-2">
                    <SprayCan className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{toUpper(item.name)}</span>
                    {(item.quantity ?? 0) <= (item.min_stock ?? 0) && (
                      <Badge variant="destructive" className="gap-1 ml-auto"><AlertTriangle className="h-3 w-3" /> {t("inventory.lowStock")}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}</p>
                  <p className="text-sm text-muted-foreground">{t("consommables.stock")}: {item.quantity ?? 0} {toUpper(item.unit ?? "")} · {t("consommables.minStock")}: {item.min_stock ?? 0}</p>
                  <div className="flex justify-end gap-1 mt-2">
                    {isAdmin && <Button variant="ghost" size="icon" onClick={() => openMovement(item)}><ArrowDownLeft className="h-4 w-4" /></Button>}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Pencil className="h-4 w-4" /></Button>
                    {isAdmin && <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true) }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />

      {/* CRUD dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("consommables.edit") : t("consommables.add")}</DialogTitle>
            <DialogDescription>{t("consommables.formDescription")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("consommables.name")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("consommables.category")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("consommables.unit")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNITS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="brand" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("consommables.brand")}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="min_stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("consommables.minStock")}</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="cost" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("consommables.cost")}</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("consommables.notes")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={upsertMutation.isPending}>{t("common.cancel")}</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("consommables.confirmDelete")}</DialogTitle>
            <DialogDescription>
              {t("consommables.deleteWarning")} <strong>{toUpper(deleting?.name)}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleting(null) }}>{t("common.cancel")}</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock movement dialog */}
      <Dialog open={movementOpen} onOpenChange={setMovementOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("consommables.movement")} — {toUpper(moving?.name ?? "")}</DialogTitle>
            <DialogDescription>{t("consommables.movementDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("stock.type") || "Type"}</Label>
                <Select value={movementForm.type} onValueChange={(v: "in" | "out") => setMovementForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in"><span className="flex items-center gap-1"><ArrowDownLeft className="h-3 w-3" /> {t("stock.in") || "Entrée"}</span></SelectItem>
                    <SelectItem value="out"><span className="flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> {t("stock.out") || "Sortie"}</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("stock.quantity") || "Quantité"}</Label>
                <Input type="number" min={1} value={movementForm.quantity} onChange={(e) => setMovementForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
            </div>
            {movementForm.type === "in" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t("consommables.movementUnitPrice") || "Coût unitaire (DA)"}</Label>
                    <Input type="number" min={0} value={movementForm.unit_price}
                      onChange={(e) => setMovementForm((f) => ({ ...f, unit_price: e.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("consommables.movementDate") || "Date du mouvement"}</Label>
                    <Input type="date" value={movementForm.movement_date}
                      onChange={(e) => setMovementForm((f) => ({ ...f, movement_date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>{t("consommables.movementSupplier") || "Fournisseur"}</Label>
                  <Select value={movementForm.supplier_id} onValueChange={(v) => setMovementForm((f) => ({ ...f, supplier_id: v }))}>
                    <SelectTrigger><SelectValue placeholder={t("products.selectSupplier") || "Sélectionner un fournisseur"} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{toUpper(s.name)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("consommables.movementReference") || "Référence"}</Label>
                  <Input value={movementForm.reference} placeholder="BC-0001 / facture…"
                    onChange={(e) => setMovementForm((f) => ({ ...f, reference: e.target.value }))} />
                </div>
              </>
            )}
            <div className="grid gap-2">
              <Label>{t("stock.reason") || "Motif"}</Label>
              <Select value={movementForm.reason} onValueChange={(v) => setMovementForm((f) => ({ ...f, reason: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MOVEMENT_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("stock.notes") || "Notes"}</Label>
              <Textarea value={movementForm.notes} onChange={(e) => setMovementForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => moving && movementMutation.mutate({ id: moving.id, form: movementForm })} disabled={movementMutation.isPending}>
              {movementMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
