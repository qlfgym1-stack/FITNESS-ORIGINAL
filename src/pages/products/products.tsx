import { useState, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { toUpper } from "../../lib/utils"
import {
  Package, Plus, Search, Edit, Trash2, Loader2, Download, Camera, ImageIcon, X,
} from "lucide-react"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Pagination } from "@/components/ui/pagination"
import { Card } from "@/components/ui/card"
import type { Product } from "@/types/supabase"

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  price: z.coerce.number().min(0, "Min 0"),
  cost: z.coerce.number().min(0, "Min 0").optional().or(z.literal("")),
  stock: z.coerce.number().min(0, "Min 0").optional().or(z.literal("")),
  barcode: z.string().optional().or(z.literal("")),
  image_url: z.string().optional().or(z.literal("")),
  is_active: z.boolean().default(true),
})

type ProductForm = z.infer<typeof productSchema>

export default function ProductsPage() {
  const t = useT()
  const { toast } = useToast()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { organization } = useAuth()
  const orgId = organization?.id
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Product | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState<Product | null>(null)
  const [imageUploading, setImageUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["products", orgId],
    queryFn: async (): Promise<Product[]> => {
      if (!orgId) return []
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("organization_id", orgId)
        .order("name")
      return (data ?? []) as Product[]
    },
    enabled: !!orgId,
  })

  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", category: "", price: 0, cost: "", stock: "", barcode: "", image_url: "", is_active: true },
  })

  const categories = [...new Set(items.map(i => i.category).filter(Boolean))].sort() as string[]

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category ?? "").toLowerCase().includes(search.toLowerCase()) ||
    (i.barcode ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, paginatedData: paginatedItems } = usePagination(filtered, 20)

  const { exportCsv } = useExportCsv(
    filtered.map(i => ({ name: i.name, category: i.category ?? "", price: i.price, cost: i.cost ?? 0, stock: i.stock ?? 0, barcode: i.barcode ?? "", status: i.is_active ? "Active" : "Inactive" })),
    'products',
    [
      { key: 'name', label: t('products.name') || 'Name' },
      { key: 'category', label: t('products.category') || 'Category' },
      { key: 'price', label: t('products.price') || 'Price' },
      { key: 'cost', label: t('products.cost') || 'Cost' },
      { key: 'stock', label: t('products.stock') || 'Stock' },
      { key: 'barcode', label: t('products.barcode') || 'Barcode' },
      { key: 'status', label: t('products.status') || 'Status' },
    ]
  )

  const upsertMutation = useMutation({
    mutationFn: async (values: ProductForm) => {
      if (!orgId) throw new Error("No organization")
      const payload: any = {
        name: values.name,
        category: values.category,
        price: values.price,
        cost: values.cost || null,
        stock: values.stock || null,
        barcode: values.barcode || null,
        image_url: values.image_url || null,
        is_active: values.is_active,
      }
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, organization_id: orgId })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast({ title: editing ? t("common.updated") || "Updated" : t("common.created") || "Created" })
      setDialogOpen(false)
      setEditing(null)
      form.reset()
    },
    onError: (err: Error) => toast({ title: t("errors.error") || "Error", description: err.message, variant: "destructive" }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      toast({ title: t("common.deleted") || "Deleted" })
      setDeleteOpen(false)
      setDeleting(null)
    },
    onError: (err: Error) => toast({ title: t("errors.error") || "Error", description: err.message, variant: "destructive" }),
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: "", category: "", price: 0, cost: "", stock: "", barcode: "", image_url: "", is_active: true })
    setDialogOpen(true)
  }

  function openEdit(item: Product) {
    setEditing(item)
    form.reset({
      name: item.name,
      category: item.category ?? "",
      price: item.price,
      cost: item.cost ?? "" as any,
      stock: item.stock ?? "" as any,
      barcode: item.barcode ?? "",
      image_url: item.image_url ?? "",
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  async function handleImageUpload(file: File) {
    if (!orgId) return
    setImageUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const filePath = `${orgId}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('product-images').upload(filePath, file)
      if (uploadError) throw uploadError
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath)
      form.setValue('image_url', urlData.publicUrl)
    } catch (e) {
      toast({ title: t("errors.error") || "Error", description: e instanceof Error ? e.message : 'Upload failed', variant: "destructive" })
    } finally {
      setImageUploading(false)
    }
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file)
  }

  function clearImage() {
    form.setValue('image_url', "")
  }

  function onSubmit(values: ProductForm) {
    upsertMutation.mutate(values)
  }

  return (
    <div>
      <PageHeader
        title={t("products.title") || "Products"}
        description={t("products.description") || "Manage sellable products"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv()}>
              <Download className="mr-2 h-4 w-4" />
              {t("common.export") || "Export"}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> {t("products.add") || "Add Product"}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search") || "Search..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("products.image") || "Image"}</TableHead>
              <TableHead>{t("products.name") || "Name"}</TableHead>
              <TableHead>{t("products.category") || "Category"}</TableHead>
              <TableHead className="text-right">{t("products.price") || "Price"}</TableHead>
              <TableHead className="text-right">{t("products.cost") || "Cost"}</TableHead>
              <TableHead className="text-right">{t("products.stock") || "Stock"}</TableHead>
              <TableHead>{t("products.barcode") || "Barcode"}</TableHead>
              <TableHead>{t("products.status") || "Status"}</TableHead>
              <TableHead className="text-right">{t("common.actions") || "Actions"}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : paginatedItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-md object-cover border border-border" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                    {toUpper(item.name)}
                  </div>
                </TableCell>
                <TableCell><Badge variant="outline">{toUpper(item.category ?? "")}</Badge></TableCell>
                <TableCell className="text-right">{item.price.toLocaleString()} DA</TableCell>
                <TableCell className="text-right">{item.cost ? `${item.cost.toLocaleString()} DA` : "-"}</TableCell>
                <TableCell className="text-right">{item.stock ?? "-"}</TableCell>
                <TableCell className="font-mono text-xs">{item.barcode ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant={item.is_active ? "default" : "secondary"}>
                    {item.is_active ? (t("products.active") || "Active") : (t("products.inactive") || "Inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true) }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && paginatedItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {t("common.noResults") || "No results"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden space-y-3 p-4">
        {!isLoading && paginatedItems.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{t("common.noResults") || "No results"}</p>
        ) : (
          paginatedItems.map(item => (
            <Card key={item.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-md object-cover border border-border" />
                ) : (
                  <ImageIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <span className="font-medium">{toUpper(item.name)}</span>
                <Badge variant={item.is_active ? "default" : "secondary"} className="ml-auto">
                  {item.is_active ? (t("products.active") || "Active") : (t("products.inactive") || "Inactive")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground"><Badge variant="outline">{toUpper(item.category ?? "")}</Badge></p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("products.price") || "Price"}: {item.price.toLocaleString()} DA
                {item.cost ? ` | ${t("products.cost") || "Cost"}: ${item.cost.toLocaleString()} DA` : ""}
                {item.stock != null ? ` | ${t("products.stock") || "Stock"}: ${item.stock}` : ""}
              </p>
              {item.barcode && <p className="text-xs text-muted-foreground font-mono mt-1">{t("products.barcode") || "Barcode"}: {item.barcode}</p>}
              <div className="flex justify-end gap-1 mt-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setDeleting(item); setDeleteOpen(true) }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
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
            <DialogTitle>{editing ? t("products.edit") || "Edit Product" : t("products.add") || "Add Product"}</DialogTitle>
            <DialogDescription>{t("products.formDescription") || "Fill in the product details"}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="image_url" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("products.image") || "Image"}</FormLabel>
                  <FormControl>
                    <div>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageFileChange}
                      />
                      {field.value ? (
                        <div className="relative w-32 h-32 rounded-md overflow-hidden border border-border">
                          <img src={field.value} alt="Preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={clearImage}
                            className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 hover:bg-background"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          disabled={imageUploading}
                          className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-accent text-sm"
                        >
                          {imageUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="h-4 w-4" />
                          )}
                          {imageUploading ? (t("common.uploading") || "Uploading...") : (t("products.uploadImage") || "Upload Image")}
                        </button>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("products.name") || "Name"}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("products.category") || "Category"}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue placeholder={t("products.selectCategory") || "Select category"} /></SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat} value={cat}>{toUpper(cat)}</SelectItem>
                          ))}
                          <SelectItem value="snacks">Snacks</SelectItem>
                          <SelectItem value="drinks">Drinks</SelectItem>
                          <SelectItem value="supplements">Supplements</SelectItem>
                          <SelectItem value="apparel">Apparel</SelectItem>
                          <SelectItem value="equipment">Equipment</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="barcode" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("products.barcode") || "Barcode"}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("products.price") || "Price"}</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="cost" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("products.cost") || "Cost"}</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("products.stock") || "Stock"}</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="is_active" render={({ field }) => (
                  <FormItem className="flex items-center gap-2 pt-6">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">{t("products.active") || "Active"}</FormLabel>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={upsertMutation.isPending}>{t("common.cancel") || "Cancel"}</Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("common.save") || "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("products.confirmDelete") || "Confirm Delete"}</DialogTitle>
            <DialogDescription>
              {t("products.deleteWarning") || "Are you sure you want to delete"} <strong>{toUpper(deleting?.name ?? "")}</strong>? {t("products.deleteWarning2") || "This action cannot be undone."}
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
