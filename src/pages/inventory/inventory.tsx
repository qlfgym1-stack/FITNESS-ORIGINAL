import { useState } from "react"
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
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import {
  Package, Plus, Search, Edit, Trash2, AlertTriangle,
} from "lucide-react"

interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  min_stock: number
  price: number
  supplier: string
}

const defaultItems: InventoryItem[] = [
  { id: "1", name: "Protein Powder", category: "Supplements", quantity: 50, unit: "kg", min_stock: 10, price: 4500, supplier: "NutriSport" },
  { id: "2", name: "Yoga Mats", category: "Equipment", quantity: 30, unit: "pcs", min_stock: 5, price: 2500, supplier: "FitGear" },
  { id: "3", name: "Resistance Bands", category: "Equipment", quantity: 100, unit: "pcs", min_stock: 20, price: 800, supplier: "FitGear" },
  { id: "4", name: "Towels", category: "Linens", quantity: 200, unit: "pcs", min_stock: 50, price: 600, supplier: "TextilePro" },
  { id: "5", name: "Water Bottles", category: "Accessories", quantity: 150, unit: "pcs", min_stock: 30, price: 350, supplier: "SportSupply" },
]

const inventorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  quantity: z.coerce.number().min(0, "Min 0"),
  unit: z.string().min(1, "Unit is required"),
  min_stock: z.coerce.number().min(0, "Min 0"),
  price: z.coerce.number().min(0, "Min 0"),
  supplier: z.string().optional().or(z.literal("")),
})

type InventoryForm = z.infer<typeof inventorySchema>

export default function InventoryPage() {
  const t = useT()
  const { toast } = useToast()
  const [items, setItems] = useState<InventoryItem[]>(defaultItems)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const form = useForm<InventoryForm>({
    resolver: zodResolver(inventorySchema),
    defaultValues: { name: "", category: "", quantity: 0, unit: "pcs", min_stock: 0, price: 0, supplier: "" },
  })

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase()) ||
    i.supplier.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    form.reset({ name: "", category: "", quantity: 0, unit: "pcs", min_stock: 0, price: 0, supplier: "" })
    setDialogOpen(true)
  }

  function openEdit(item: InventoryItem) {
    setEditing(item)
    form.reset({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      min_stock: item.min_stock,
      price: item.price,
      supplier: item.supplier,
    })
    setDialogOpen(true)
  }

  function onSubmit(values: InventoryForm) {
    if (editing) {
      setItems((prev) => prev.map((i) => (i.id === editing.id ? { ...i, ...values } : i)))
      toast({ title: t("common.updated"), description: t("inventory.updateSuccess") })
    } else {
      const newItem = { id: String(Date.now()), ...values } as InventoryItem
      setItems((prev) => [...prev, newItem])
      toast({ title: t("common.created"), description: t("inventory.createSuccess") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    toast({ title: t("common.deleted"), description: t("inventory.deleteSuccess") })
  }

  return (
    <div>
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("inventory.add")}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("inventory.name")}</TableHead>
              <TableHead>{t("inventory.category")}</TableHead>
              <TableHead className="text-right">{t("inventory.quantity")}</TableHead>
              <TableHead>{t("inventory.unit")}</TableHead>
              <TableHead className="text-right">{t("inventory.minStock")}</TableHead>
              <TableHead className="text-right">{t("inventory.price")}</TableHead>
              <TableHead>{t("inventory.supplier")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => {
              const lowStock = item.quantity <= item.min_stock
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      {item.name}
                      {lowStock && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> {t("inventory.lowStock")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell>{item.unit}</TableCell>
                  <TableCell className="text-right">{item.min_stock}</TableCell>
                  <TableCell className="text-right">{item.price.toLocaleString()} DA</TableCell>
                  <TableCell>{item.supplier}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(item.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("inventory.edit") : t("inventory.add")}</DialogTitle>
            <DialogDescription>{t("inventory.formDescription")}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventory.name")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.category")}</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="unit" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.unit")}</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pcs">Pieces</SelectItem>
                          <SelectItem value="kg">Kilograms</SelectItem>
                          <SelectItem value="L">Liters</SelectItem>
                          <SelectItem value="box">Box</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="quantity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.quantity")}</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="min_stock" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("inventory.minStock")}</FormLabel>
                    <FormControl><Input type="number" min={0} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="price" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventory.price")}</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="supplier" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inventory.supplier")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit">{t("common.save")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
