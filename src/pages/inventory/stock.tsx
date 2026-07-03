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
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { formatDateTime } from "@/lib/utils"
import { Plus, Search, Edit, Trash2, ArrowUpRight, ArrowDownLeft } from "lucide-react"

interface StockMovement {
  id: string
  product: string
  type: "in" | "out"
  quantity: number
  date: string
  notes: string
}

const defaultMovements: StockMovement[] = [
  { id: "1", product: "Protein Powder", type: "in", quantity: 20, date: "2026-07-03T10:00:00", notes: "Restock from supplier" },
  { id: "2", product: "Yoga Mats", type: "out", quantity: 5, date: "2026-07-02T14:30:00", notes: "Damaged" },
  { id: "3", product: "Resistance Bands", type: "in", quantity: 50, date: "2026-07-01T09:15:00", notes: "New batch" },
  { id: "4", product: "Towels", type: "out", quantity: 10, date: "2026-06-30T16:00:00", notes: "Laundry损耗" },
  { id: "5", product: "Water Bottles", type: "in", quantity: 100, date: "2026-06-28T11:45:00", notes: "Seasonal stock" },
]

export default function StockMovementsPage() {
  const t = useT()
  const { toast } = useToast()
  const [movements, setMovements] = useState<StockMovement[]>(defaultMovements)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<StockMovement | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Omit<StockMovement, "id">>({
    product: "", type: "in", quantity: 0, date: new Date().toISOString().slice(0, 16), notes: "",
  })

  const filtered = movements.filter((m) =>
    m.product.toLowerCase().includes(search.toLowerCase()) || m.notes.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ product: "", type: "in", quantity: 0, date: new Date().toISOString().slice(0, 16), notes: "" })
    setDialogOpen(true)
  }

  function openEdit(m: StockMovement) {
    setEditing(m)
    setForm({ product: m.product, type: m.type, quantity: m.quantity, date: m.date.slice(0, 16), notes: m.notes })
    setDialogOpen(true)
  }

  function save() {
    if (editing) {
      setMovements((prev) => prev.map((m) => (m.id === editing.id ? { ...m, ...form } : m)))
      toast({ title: t("common.updated"), description: t("stock.updateSuccess") })
    } else {
      setMovements((prev) => [...prev, { id: String(Date.now()), ...form }])
      toast({ title: t("common.created"), description: t("stock.createSuccess") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setMovements((prev) => prev.filter((m) => m.id !== id))
    toast({ title: t("common.deleted"), description: t("stock.deleteSuccess") })
  }

  return (
    <div>
      <PageHeader
        title={t("stock.title")}
        description={t("stock.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("stock.add")}
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
              <TableHead>{t("stock.product")}</TableHead>
              <TableHead>{t("stock.type")}</TableHead>
              <TableHead className="text-right">{t("stock.quantity")}</TableHead>
              <TableHead>{t("stock.date")}</TableHead>
              <TableHead>{t("stock.notes")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.product}</TableCell>
                <TableCell>
                  <Badge variant={m.type === "in" ? "default" : "destructive"} className="gap-1">
                    {m.type === "in" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                    {m.type === "in" ? t("stock.in") : t("stock.out")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                <TableCell>{formatDateTime(m.date)}</TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground">{m.notes}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
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
            <DialogTitle>{editing ? t("stock.edit") : t("stock.add")}</DialogTitle>
            <DialogDescription>{t("stock.formDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("stock.product")}</Label>
              <Input value={form.product} onChange={(e) => setForm((f) => ({ ...f, product: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("stock.type")}</Label>
                <Select value={form.type} onValueChange={(v: "in" | "out") => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">{t("stock.in")}</SelectItem>
                    <SelectItem value="out">{t("stock.out")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("stock.quantity")}</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("stock.date")}</Label>
              <Input type="datetime-local" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("stock.notes")}</Label>
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
