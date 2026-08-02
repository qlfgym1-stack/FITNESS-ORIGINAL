import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { toUpper } from "@/lib/utils"
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
import { useToast } from "@/components/ui/toast"
import { Loader2, Plus, Pencil, Trash2, MoreHorizontal, Search, Box, DollarSign, Wrench, AlertTriangle } from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Equipment } from "@/types/supabase"
import { usePagination } from "@/hooks/usePagination"
import { Pagination } from "@/components/ui/pagination"

const materielSchema = z.object({
  name: z.string().min(1, "Requis"),
  brand: z.string().optional().or(z.literal("")),
  description: z.string().optional().or(z.literal("")),
  category: z.string({ required_error: "Requis" }),
  location: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().min(0, "Min 0"),
  purchase_price: z.coerce.number().min(0, "Min 0"),
  status: z.string({ required_error: "Requis" }),
  purchaseDate: z.string().optional().or(z.literal("")),
  lastMaintenance: z.string().optional().or(z.literal("")),
  nextMaintenance: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
})

type MaterielForm = z.infer<typeof materielSchema>

const CATEGORIES = [
  { value: "musculation", label: "Musculation" },
  { value: "cardio", label: "Cardio" },
  { value: "crossfit", label: "CrossFit" },
  { value: "accessoire", label: "Accessoire" },
  { value: "etirement", label: "Étirement" },
  { value: "boxe", label: "Boxe" },
  { value: "functional", label: "Functional Training" },
  { value: "recovery", label: "Recovery" },
  { value: "audiovisuel", label: "Audiovisuel" },
  { value: "bureautique", label: "Bureautique" },
  { value: "mobilier", label: "Mobilier" },
  { value: "climatisation", label: "Climatisation" },
  { value: "plomberie", label: "Plomberie" },
  { value: "electricite", label: "Électricité" },
  { value: "securite", label: "Sécurité" },
  { value: "autre", label: "Autre" },
] as const

const STATUSES = [
  { value: "en_service", label: "En service", variant: "outline" as const, color: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30" },
  { value: "maintenance", label: "En maintenance", variant: "secondary" as const, color: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30" },
  { value: "hors_service", label: "Hors service", variant: "destructive" as const, color: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30" },
  { value: "retire", label: "Retiré", variant: "secondary" as const, color: "bg-gray-500/20 text-gray-600 dark:text-gray-400 border-gray-500/30" },
  { value: "en_commande", label: "En commande", variant: "outline" as const, color: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  { value: "garantie", label: "Sous garantie", variant: "outline" as const, color: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30" },
] as const

function getStatusConfig(status: string) {
  return STATUSES.find(s => s.value === status) ?? STATUSES[0]
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('fr-DZ', { style: 'decimal', maximumFractionDigits: 0 }).format(n) + ' DA'
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
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  const form = useForm<MaterielForm>({
    resolver: zodResolver(materielSchema),
    defaultValues: {
      name: "", brand: "", description: "", category: "musculation", location: "",
      quantity: 0, purchase_price: 0, status: "en_service",
      purchaseDate: "", lastMaintenance: "", nextMaintenance: "", notes: "",
    },
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

  const filteredList = (equipmentList ?? []).filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || (item.brand ?? "").toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter
    const matchesStatus = statusFilter === "all" || item.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  })

  const totalValue = (equipmentList ?? []).reduce((sum, e) => sum + (e.quantity * (e.purchase_price ?? 0)), 0)
  const needsAttention = (equipmentList ?? []).filter(e => e.status === "hors_service" || e.status === "retire").length
  const enMaintenance = (equipmentList ?? []).filter(e => e.status === "maintenance").length

  const upsertMutation = useMutation({
    mutationFn: async (values: MaterielForm) => {
      if (!orgId) throw new Error("No org")
      const base = {
        name: values.name,
        brand: values.brand || null,
        description: values.description || null,
        category: values.category,
        location: values.location || null,
        quantity: Number(values.quantity),
        purchase_price: Number(values.purchase_price),
        status: values.status,
        purchase_date: values.purchaseDate || null,
        last_maintenance: values.lastMaintenance || null,
        next_maintenance: values.nextMaintenance || null,
        notes: values.notes || null,
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
      toast({ title: editing ? "Matériel modifié" : "Matériel ajouté" })
      setOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] })
      toast({ title: "Matériel supprimé" })
      setDeleteOpen(false)
      setDeleting(null)
    },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  })

  const quickStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("equipment").update({ status }).eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] })
      toast({ title: "Statut mis à jour" })
    },
    onError: (err: Error) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
  })

  function openEdit(item: Equipment) {
    setEditing(item)
    form.reset({
      name: item.name,
      brand: item.brand ?? "",
      description: item.description ?? "",
      category: item.category ?? "musculation",
      location: item.location ?? "",
      quantity: item.quantity,
      purchase_price: item.purchase_price ?? 0,
      status: item.status ?? "en_service",
      purchaseDate: item.purchase_date ?? "",
      lastMaintenance: item.last_maintenance ?? "",
      nextMaintenance: item.next_maintenance ?? "",
      notes: item.notes ?? "",
    })
    setOpen(true)
  }

  function openAdd() {
    setEditing(null)
    form.reset({ name: "", brand: "", description: "", category: "musculation", location: "", quantity: 0, purchase_price: 0, status: "en_service", purchaseDate: "", lastMaintenance: "", nextMaintenance: "", notes: "" })
    setOpen(true)
  }

  function onSubmit(values: MaterielForm) {
    upsertMutation.mutate(values)
  }

  const { page, setPage, totalPages, paginatedData: paginated } = usePagination(filteredList, 20)

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("materiel.title")}
        description="Suivi du matériel et maintenance"
        actions={
          <Button onClick={openAdd}>
            <Plus className="mr-2 h-4 w-4" />
            Nouveau Matériel
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Box className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Matériels</p>
              <p className="text-2xl font-bold">{(equipmentList ?? []).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valeur Totale</p>
              <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Wrench className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">En Maintenance</p>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{enMaintenance}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hors Service</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{needsAttention}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou marque..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Catégorie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matériel</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Emplacement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-center">Qté</TableHead>
                  <TableHead className="text-right">Prix Unit.</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : paginated?.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun matériel trouvé</TableCell></TableRow>
                ) : (
                  paginated?.map(item => {
                    const cfg = getStatusConfig(item.status ?? "en_service")
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <Box className="w-4 h-4 text-blue-500" />
                            </div>
                            <div>
                              <span className="font-medium block">{toUpper(item.name)}</span>
                              {item.brand && <span className="text-xs text-muted-foreground">{item.brand}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-sm">{CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}</TableCell>
                        <TableCell className="text-sm">{item.location || "—"}</TableCell>
                        <TableCell>
                          <select
                            value={item.status ?? "en_service"}
                            onChange={e => quickStatusMutation.mutate({ id: item.id, status: e.target.value })}
                            className={`px-2 py-1 rounded-md text-xs font-medium border bg-transparent cursor-pointer ${cfg.color}`}
                          >
                            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                          </select>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(item.purchase_price ?? 0)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.quantity * (item.purchase_price ?? 0))}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(item)}>
                                <Pencil className="mr-2 h-4 w-4" /> Modifier
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => { setDeleting(item); setDeleteOpen(true) }}>
                                <Trash2 className="mr-2 h-4 w-4" /> Supprimer
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
              <p className="text-center py-8 text-muted-foreground">Aucun matériel</p>
            ) : (
              paginated?.map(item => {
                const cfg = getStatusConfig(item.status ?? "en_service")
                return (
                  <Card key={item.id} className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium">{toUpper(item.name)}</span>
                      <Badge variant={cfg.variant} className="ml-auto text-[10px]">{cfg.label}</Badge>
                    </div>
                    {item.brand && <p className="text-xs text-muted-foreground">{item.brand}</p>}
                    <div className="flex gap-4 mt-1 text-sm text-muted-foreground">
                      <span>{CATEGORIES.find(c => c.value === item.category)?.label ?? item.category}</span>
                      {item.location && <span>📍 {item.location}</span>}
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t text-sm">
                      <span>Qté: {item.quantity}</span>
                      <span className="font-semibold">{formatCurrency(item.quantity * (item.purchase_price ?? 0))}</span>
                    </div>
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le matériel" : "Nouveau matériel"}</DialogTitle>
            <DialogDescription>{editing ? "Modifiez les informations du matériel" : "Ajoutez un nouvel élément de matériel"}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl><Input placeholder="Ex: Presse à cuisses" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="brand" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marque</FormLabel>
                    <FormControl><Input placeholder="Ex: Hammer Strength" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emplacement</FormLabel>
                    <FormControl><Input placeholder="Ex: Salle Muscu" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Statut</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="purchase_price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix unitaire (DA)</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="purchaseDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date d'achat</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="lastMaintenance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dernière maintenance</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nextMaintenance" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prochaine maintenance</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Observations, garanties..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setEditing(null); form.reset() }}>Annuler</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editing ? "Enregistrer" : "Ajouter"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Supprimer <strong>{toUpper(deleting?.name ?? "")}</strong> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleting(null) }}>Annuler</Button>
            <Button variant="destructive" onClick={() => deleting && deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
