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
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { formatDate } from "@/lib/utils"
import { Building2, Plus, Search, Edit, Trash2, Phone, Mail, MapPin } from "lucide-react"

interface Supplier {
  id: string
  name: string
  contact_name: string
  email: string
  phone: string
  address: string
  created_at: string
}

const defaultSuppliers: Supplier[] = [
  { id: "1", name: "NutriSport", contact_name: "Ahmed Benali", email: "ahmed@nutrisport.dz", phone: "+213 555 123 456", address: "123 Rue Didouche, Alger", created_at: "2026-01-15" },
  { id: "2", name: "FitGear", contact_name: "Fatima Zohra", email: "fatima@fitgear.dz", phone: "+213 770 987 654", address: "45 Boulevard Zighoud, Constantine", created_at: "2026-02-20" },
  { id: "3", name: "TextilePro", contact_name: "Karim Ouali", email: "karim@textilepro.dz", phone: "+213 661 456 789", address: "Zone Industrielle, Oran", created_at: "2026-03-10" },
  { id: "4", name: "SportSupply", contact_name: "Lamia Bensaid", email: "lamia@sportsupply.dz", phone: "+213 550 321 654", address: "Cité des Sports, Annaba", created_at: "2026-04-05" },
]

export default function SuppliersPage() {
  const t = useT()
  const { toast } = useToast()
  const [suppliers, setSuppliers] = useState<Supplier[]>(defaultSuppliers)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Omit<Supplier, "id" | "created_at">>({
    name: "", contact_name: "", email: "", phone: "", address: "",
  })

  const filtered = suppliers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contact_name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ name: "", contact_name: "", email: "", phone: "", address: "" })
    setDialogOpen(true)
  }

  function openEdit(s: Supplier) {
    setEditing(s)
    setForm({ name: s.name, contact_name: s.contact_name, email: s.email, phone: s.phone, address: s.address })
    setDialogOpen(true)
  }

  function save() {
    if (editing) {
      setSuppliers((prev) => prev.map((s) => (s.id === editing.id ? { ...s, ...form } : s)))
      toast({ title: t("common.updated"), description: t("suppliers.updateSuccess") })
    } else {
      setSuppliers((prev) => [...prev, { id: String(Date.now()), ...form, created_at: new Date().toISOString().slice(0, 10) }])
      toast({ title: t("common.created"), description: t("suppliers.createSuccess") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setSuppliers((prev) => prev.filter((s) => s.id !== id))
    toast({ title: t("common.deleted"), description: t("suppliers.deleteSuccess") })
  }

  return (
    <div>
      <PageHeader
        title={t("suppliers.title")}
        description={t("suppliers.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("suppliers.add")}
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
              <TableHead>{t("suppliers.name")}</TableHead>
              <TableHead>{t("suppliers.contactName")}</TableHead>
              <TableHead>{t("suppliers.email")}</TableHead>
              <TableHead>{t("suppliers.phone")}</TableHead>
              <TableHead>{t("suppliers.address")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {s.name}
                  </div>
                </TableCell>
                <TableCell>{s.contact_name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    {s.email}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {s.phone}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate max-w-[150px]">{s.address}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
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
            <DialogTitle>{editing ? t("suppliers.edit") : t("suppliers.add")}</DialogTitle>
            <DialogDescription>{t("suppliers.formDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("suppliers.name")}</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("suppliers.contactName")}</Label>
                <Input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("suppliers.email")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("suppliers.phone")}</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("suppliers.address")}</Label>
              <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
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
