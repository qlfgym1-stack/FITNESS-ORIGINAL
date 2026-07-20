import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
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
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Equipment } from "@/types/supabase"
import { usePagination } from "@/hooks/usePagination"
import { Pagination } from "@/components/ui/pagination"

const materielSchema = z.object({
  name: z.string().min(1, "Required"),
  description: z.string().optional().or(z.literal("")),
  category: z.string({ required_error: "Required" }),
  quantity: z.coerce.number().min(0, "Min 0"),
  purchase_price: z.coerce.number().min(0, "Min 0"),
  status: z.string({ required_error: "Required" }),
  purchaseDate: z.string().optional().or(z.literal("")),
})

type MaterielForm = z.infer<typeof materielSchema>

const CATEGORIES = [
  { value: "appareil", label: "Appareil" },
  { value: "consommable", label: "Consommable" },
  { value: "produits_entretiens", label: "Produits entretiens" },
  { value: "autres", label: "Autres" },
] as const

const STATUSES = [
  { value: "tres_bon", label: "Très bon", variant: "success" as const },
  { value: "entretiens", label: "Entretiens", variant: "warning" as const },
  { value: "retire", label: "Retiré", variant: "destructive" as const },
  { value: "autres", label: "Autres", variant: "secondary" as const },
] as const

const statusVariant: Record<string, "default" | "destructive" | "secondary" | "outline" | null | undefined> = {
  tres_bon: "default",
  entretiens: "secondary",
  retire: "destructive",
  autres: "outline",
}

export default function MaterielPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const { organization } = useAuth()
  const orgId = organization?.id
  const [open, setOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [deleting, setDeleting] = useState<Equipment | null>(null)
  const [categoryFilter, setCategoryFilter] = useState("all")

  const form = useForm<MaterielForm>({
    resolver: zodResolver(materielSchema),
    defaultValues: { name: "", description: "", category: "appareil", quantity: 0, purchase_price: 0, status: "tres_bon", purchaseDate: "" },
  })

  const { data: equipmentList, isLoading } = useQuery({
    queryKey: ["equipment", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data } = await supabase.from("equipment").select("*").eq("organization_id", orgId).order("name")
      return data ?? []
    },
    enabled: !!orgId,
  })

  const filteredList = categoryFilter === "all"
    ? (equipmentList ?? [])
    : (equipmentList ?? []).filter(item => item.category === categoryFilter)

  const upsertMutation = useMutation({
    mutationFn: async (values: MaterielForm) => {
      if (!orgId) throw new Error("No org")
      const base = {
        name: values.name,
        description: values.description || null,
        category: values.category,
        quantity: Number(values.quantity),
        purchase_price: Number(values.purchase_price),
        status: values.status,
        purchase_date: values.purchaseDate || null,
        organization_id: orgId,
      }
      if (editing) {
        const { error } = await supabase.from("equipment").update({ ...base, available_quantity: editing.available_quantity }).eq("id", editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("equipment").insert({ ...base, available_quantity: Number(values.quantity) })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] })
      toast({ title: editing ? t("materiel.updated") : t("materiel.created") })
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
      toast({ title: t("materiel.deleted") })
      setDeleteOpen(false)
      setDeleting(null)
    },
    onError: (err: Error) => toast({ title: t("errors.error"), description: err.message, variant: "destructive" }),
  })

  function openEdit(item: Equipment) {
    setEditing(item)
    form.reset({
      name: item.name,
      description: item.description ?? "",
      category: item.category ?? "appareil",
      quantity: item.quantity,
      purchase_price: item.purchase_price ?? 0,
      status: item.status ?? "tres_bon",
      purchaseDate: item.purchase_date ?? "",
    })
    setOpen(true)
  }

  function openAdd() {
    setEditing(null)
    form.reset({ name: "", description: "", category: "appareil", quantity: 0, purchase_price: 0, status: "tres_bon", purchaseDate: "" })
    setOpen(true)
  }

  function onSubmit(values: MaterielForm) {
    upsertMutation.mutate(values)
  }

  const { page, setPage, totalPages, paginatedData: paginated } = usePagination(filteredList, 20)

  return (
    <div>
      <PageHeader
        title={t("materiel.title")}
        description={t("materiel.description")}
        actions={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            {t("materiel.add")}
          </Button>
        }
      />

      <Tabs value={categoryFilter} onValueChange={setCategoryFilter}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">{t("materiel.all")}</TabsTrigger>
          {CATEGORIES.map(cat => (
            <TabsTrigger key={cat.value} value={cat.value}>{cat.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("materiel.name")}</TableHead>
                  <TableHead>{t("materiel.category")}</TableHead>
                  <TableHead>{t("materiel.quantity")}</TableHead>
                  <TableHead>{t("materiel.purchasePrice")}</TableHead>
                  <TableHead>{t("materiel.status")}</TableHead>
                  <TableHead className="w-[70px]">{t("materiel.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : paginated?.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("materiel.noData")}</TableCell></TableRow>
                ) : (
                  paginated?.map(item => {
                    const alertCount = item.status === "tres_bon" ? 0 : 1
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{toUpper(item.name)}</TableCell>
                        <TableCell className="capitalize">{t(`materiel.cat_${item.category}` as any) || item.category}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{Number(item.purchase_price || 0).toLocaleString()} DA</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={statusVariant[item.status ?? ""] ?? "outline"} className="capitalize">
                              {t(`materiel.stat_${item.status}` as any) || item.status}
                            </Badge>
                            {alertCount > 0 && (
                              <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" title={`${alertCount} alert(s)`} />
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(item)}>
                                <Pencil className="mr-2 h-4 w-4" /> {t("materiel.edit")}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => { setDeleting(item); setDeleteOpen(true) }}>
                                <Trash2 className="mr-2 h-4 w-4" /> {t("materiel.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden space-y-3 p-4">
            {isLoading ? (
              <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
            ) : paginated?.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("common.noResults")}</p>
            ) : (
              paginated?.map(item => {
                const alertCount = item.status === "tres_bon" ? 0 : 1
                return (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{toUpper(item.name)}</span>
                      <Badge variant={statusVariant[item.status ?? ""] ?? "outline"} className="ml-auto capitalize">
                        {t(`materiel.stat_${item.status}` as any) || item.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{t("materiel.category")}: {t(`materiel.cat_${item.category}` as any) || item.category}</p>
                    <p className="text-sm text-muted-foreground">{t("materiel.quantity")}: {item.quantity} | {t("materiel.purchasePrice")}: {Number(item.purchase_price || 0).toLocaleString()} DA</p>
                    {alertCount > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="flex h-2 w-2 rounded-full bg-destructive animate-pulse" />
                        <span className="text-xs text-destructive font-medium">{t("materiel.alertNeeded")}</span>
                      </div>
                    )}
                    <div className="flex justify-end gap-1 mt-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true) }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </CardContent>
      </Card>
      <Pagination page={page} totalPages={totalPages} totalItems={filteredList.length} pageSize={20} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); form.reset() } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editing ? t("materiel.editEquipment") : t("materiel.addEquipment")}</DialogTitle>
            <DialogDescription>{editing ? t("materiel.editDescription") : t("materiel.addDescription")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("materiel.name")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("materiel.descLabel")}</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("materiel.category")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("materiel.quantity")}</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="purchase_price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("materiel.purchasePrice")}</FormLabel>
                    <FormControl><Input type="number" min="0" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("materiel.purchaseDate")}</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("materiel.status")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); form.reset() }}>{t("cancel")}</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? t("save") : t("create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("materiel.confirmDelete")}</DialogTitle>
            <DialogDescription>
              {t("materiel.deleteWarning")} <strong>{toUpper(deleting?.name)}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleting(null) }}>{t("cancel")}</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
