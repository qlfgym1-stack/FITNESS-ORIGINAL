import { useState } from "react"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { formatDate, getDaysRemaining, getStatusColor } from "@/lib/utils"
import { Key, Plus, Search, Edit, Trash2, Copy, CheckCircle2, AlertTriangle } from "lucide-react"

interface License {
  id: string
  license_key: string
  type: string
  issued_at: string
  expires_at: string
  is_active: boolean
  organization: string
}

const defaultLicenses: License[] = [
  { id: "1", license_key: "DNK-A1B2-C3D4-E5F6", type: "premium", issued_at: "2026-01-01", expires_at: "2027-01-01", is_active: true, organization: "FitManager Alger Centre" },
  { id: "2", license_key: "DNK-G7H8-I9J0-K1L2", type: "standard", issued_at: "2026-03-15", expires_at: "2026-09-15", is_active: true, organization: "FitManager Oran" },
  { id: "3", license_key: "DNK-M3N4-O5P6-Q7R8", type: "basic", issued_at: "2026-02-01", expires_at: "2026-08-01", is_active: false, organization: "FitManager Constantine" },
  { id: "4", license_key: "DNK-S9T0-U1V2-W3X4", type: "premium", issued_at: "2026-06-01", expires_at: "2027-06-01", is_active: true, organization: "FitManager Annaba" },
]

export default function LicensesPage() {
  const t = useT()
  const { toast } = useToast()
  const [licenses, setLicenses] = useState<License[]>(defaultLicenses)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<License | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Omit<License, "id">>({
    license_key: "", type: "standard", issued_at: "", expires_at: "", is_active: true, organization: "",
  })

  const filtered = licenses.filter((l) =>
    l.license_key.toLowerCase().includes(search.toLowerCase()) ||
    l.organization.toLowerCase().includes(search.toLowerCase())
  )

  function generateKey() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const segments = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
    )
    return `DNK-${segments.join("-")}`
  }

  function openCreate() {
    setEditing(null)
    setForm({ license_key: generateKey(), type: "standard", issued_at: new Date().toISOString().slice(0, 10), expires_at: "", is_active: true, organization: "" })
    setDialogOpen(true)
  }

  function openEdit(l: License) {
    setEditing(l)
    setForm({ license_key: l.license_key, type: l.type, issued_at: l.issued_at, expires_at: l.expires_at, is_active: l.is_active, organization: l.organization })
    setDialogOpen(true)
  }

  function save() {
    if (editing) {
      setLicenses((prev) => prev.map((l) => (l.id === editing.id ? { ...l, ...form } : l)))
      toast({ title: t("common.updated") })
    } else {
      setLicenses((prev) => [...prev, { id: String(Date.now()), ...form }])
      toast({ title: t("common.created") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setLicenses((prev) => prev.filter((l) => l.id !== id))
    toast({ title: t("common.deleted") })
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key)
    toast({ title: t("licenses.copied") })
  }

  return (
    <div>
      <PageHeader
        title={t("licenses.title")}
        description={t("licenses.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("licenses.add")}
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
              <TableHead>{t("licenses.key")}</TableHead>
              <TableHead>{t("licenses.type")}</TableHead>
              <TableHead>{t("licenses.organization")}</TableHead>
              <TableHead>{t("licenses.issued")}</TableHead>
              <TableHead>{t("licenses.expires")}</TableHead>
              <TableHead>{t("licenses.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => {
              const daysLeft = getDaysRemaining(l.expires_at)
              const expired = daysLeft <= 0
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <code className="text-xs bg-muted px-2 py-1 rounded">{l.license_key}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{l.type.charAt(0).toUpperCase() + l.type.slice(1)}</Badge>
                  </TableCell>
                  <TableCell>{l.organization}</TableCell>
                  <TableCell className="text-sm">{formatDate(l.issued_at)}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-1">
                      {formatDate(l.expires_at)}
                      {expired ? (
                        <AlertTriangle className="h-3 w-3 text-destructive" />
                      ) : daysLeft < 30 ? (
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 text-success" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={l.is_active ? "default" : "secondary"}>
                      {l.is_active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyKey(l.license_key)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(l)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(l.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
            <DialogTitle>{editing ? t("licenses.edit") : t("licenses.add")}</DialogTitle>
            <DialogDescription>{t("licenses.formDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("licenses.key")}</Label>
              <div className="flex gap-2">
                <Input value={form.license_key} onChange={(e) => setForm((f) => ({ ...f, license_key: e.target.value }))} className="font-mono" />
                <Button variant="outline" onClick={() => setForm((f) => ({ ...f, license_key: generateKey() }))}>
                  {t("licenses.generate")}
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("licenses.type")}</Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("licenses.organization")}</Label>
                <Input value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("licenses.issued")}</Label>
                <Input type="date" value={form.issued_at} onChange={(e) => setForm((f) => ({ ...f, issued_at: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("licenses.expires")}</Label>
                <Input type="date" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
              </div>
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
