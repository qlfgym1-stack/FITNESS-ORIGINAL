import { useState } from "react"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { useT } from "@/i18n"
import { formatDate, formatCurrency, getStatusColor } from "@/lib/utils"
import { ShoppingCart, Plus, Search, Edit, Trash2 } from "lucide-react"

interface PurchaseOrder {
  id: string
  supplier: string
  order_date: string
  status: string
  total_amount: number
  notes: string
}

const defaultOrders: PurchaseOrder[] = [
  { id: "1", supplier: "NutriSport", order_date: "2026-07-01", status: "completed", total_amount: 45000, notes: "Monthly protein restock" },
  { id: "2", supplier: "FitGear", order_date: "2026-06-28", status: "pending", total_amount: 12500, notes: "New yoga mats" },
  { id: "3", supplier: "TextilePro", order_date: "2026-06-25", status: "completed", total_amount: 18000, notes: "Towel batch #4" },
  { id: "4", supplier: "SportSupply", order_date: "2026-06-20", status: "cancelled", total_amount: 7500, notes: "Cancelled - out of stock" },
]

export default function PurchaseOrdersPage() {
  const t = useT()
  const { toast } = useToast()
  const [orders, setOrders] = useState<PurchaseOrder[]>(defaultOrders)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<PurchaseOrder | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Omit<PurchaseOrder, "id">>({
    supplier: "", order_date: "", status: "pending", total_amount: 0, notes: "",
  })

  const filtered = orders.filter((o) =>
    o.supplier.toLowerCase().includes(search.toLowerCase()) || o.notes.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ supplier: "", order_date: "", status: "pending", total_amount: 0, notes: "" })
    setDialogOpen(true)
  }

  function openEdit(o: PurchaseOrder) {
    setEditing(o)
    setForm({ supplier: o.supplier, order_date: o.order_date, status: o.status, total_amount: o.total_amount, notes: o.notes })
    setDialogOpen(true)
  }

  function save() {
    if (editing) {
      setOrders((prev) => prev.map((o) => (o.id === editing.id ? { ...o, ...form } : o)))
      toast({ title: t("common.updated"), description: t("purchaseOrders.updateSuccess") })
    } else {
      setOrders((prev) => [...prev, { id: String(Date.now()), ...form }])
      toast({ title: t("common.created"), description: t("purchaseOrders.createSuccess") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setOrders((prev) => prev.filter((o) => o.id !== id))
    toast({ title: t("common.deleted"), description: t("purchaseOrders.deleteSuccess") })
  }

  return (
    <div>
      <PageHeader
        title={t("purchaseOrders.title")}
        description={t("purchaseOrders.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("purchaseOrders.add")}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <div className="rounded-md border">
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
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    {o.supplier}
                  </div>
                </TableCell>
                <TableCell>{formatDate(o.order_date)}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(o.status)} variant="secondary">
                    {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(o.total_amount)}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{o.notes}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(o)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(o.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
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
            <DialogTitle>{editing ? t("purchaseOrders.edit") : t("purchaseOrders.add")}</DialogTitle>
            <DialogDescription>{t("purchaseOrders.formDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("purchaseOrders.supplier")}</Label>
              <Input value={form.supplier} onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("purchaseOrders.date")}</Label>
                <Input type="date" value={form.order_date} onChange={(e) => setForm((f) => ({ ...f, order_date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("purchaseOrders.status")}</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("purchaseOrders.total")}</Label>
              <Input type="number" value={form.total_amount} onChange={(e) => setForm((f) => ({ ...f, total_amount: Number(e.target.value) }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("purchaseOrders.notes")}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
