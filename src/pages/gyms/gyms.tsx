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
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { formatDate } from "@/lib/utils"
import { Building2, Plus, Search, Edit, Trash2, Users, Calendar, MapPin } from "lucide-react"

interface Gym {
  id: string
  name: string
  slug: string
  address: string
  phone: string
  email: string
  logo_url: string | null
  member_count: number
  created_at: string
}

const defaultGyms: Gym[] = [
  { id: "1", name: "Dinatek Fitness Alger Centre", slug: "alger-centre", address: "123 Rue Didouche Mourad, Alger", phone: "+213 21 123 456", email: "alger@dinatek.dz", logo_url: null, member_count: 450, created_at: "2025-01-15" },
  { id: "2", name: "Dinatek Fitness Oran", slug: "oran", address: "45 Boulevard Front de Mer, Oran", phone: "+213 41 789 012", email: "oran@dinatek.dz", logo_url: null, member_count: 320, created_at: "2025-03-20" },
  { id: "3", name: "Dinatek Fitness Constantine", slug: "constantine", address: "78 Rue Larbi Ben M'hidi, Constantine", phone: "+213 31 456 789", email: "constantine@dinatek.dz", logo_url: null, member_count: 280, created_at: "2025-06-10" },
  { id: "4", name: "Dinatek Fitness Annaba", slug: "annaba", address: "12 Boulevard de la République, Annaba", phone: "+213 38 123 456", email: "annaba@dinatek.dz", logo_url: null, member_count: 190, created_at: "2026-01-05" },
]

export default function GymsPage() {
  const t = useT()
  const { toast } = useToast()
  const [gyms, setGyms] = useState<Gym[]>(defaultGyms)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Gym | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Omit<Gym, "id" | "member_count" | "created_at">>({
    name: "", slug: "", address: "", phone: "", email: "", logo_url: null,
  })

  const filtered = gyms.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.address.toLowerCase().includes(search.toLowerCase())
  )

  const totalMembers = gyms.reduce((sum, g) => sum + g.member_count, 0)

  function openCreate() {
    setEditing(null)
    setForm({ name: "", slug: "", address: "", phone: "", email: "", logo_url: null })
    setDialogOpen(true)
  }

  function openEdit(g: Gym) {
    setEditing(g)
    setForm({ name: g.name, slug: g.slug, address: g.address, phone: g.phone, email: g.email, logo_url: g.logo_url })
    setDialogOpen(true)
  }

  function save() {
    if (editing) {
      setGyms((prev) => prev.map((g) => (g.id === editing.id ? { ...g, ...form } : g)))
      toast({ title: t("common.updated") })
    } else {
      setGyms((prev) => [...prev, { id: String(Date.now()), ...form, member_count: 0, created_at: new Date().toISOString().slice(0, 10) }])
      toast({ title: t("common.created") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setGyms((prev) => prev.filter((g) => g.id !== id))
    toast({ title: t("common.deleted") })
  }

  return (
    <div>
      <PageHeader
        title={t("gyms.title")}
        description={t("gyms.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("gyms.add")}
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("gyms.totalGyms")}</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{gyms.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("gyms.totalMembers")}</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalMembers.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t("gyms.averageMembers")}</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{gyms.length ? Math.round(totalMembers / gyms.length) : 0}</p></CardContent>
        </Card>
      </div>

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
              <TableHead>{t("gyms.name")}</TableHead>
              <TableHead>{t("gyms.address")}</TableHead>
              <TableHead>{t("gyms.contact")}</TableHead>
              <TableHead className="text-right">{t("gyms.members")}</TableHead>
              <TableHead>{t("gyms.createdAt")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {g.name}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{g.address}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <div>{g.phone}</div>
                  <div className="text-muted-foreground">{g.email}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary"><Users className="mr-1 h-3 w-3" />{g.member_count}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(g.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(g)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(g.id)}>
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
            <DialogTitle>{editing ? t("gyms.edit") : t("gyms.add")}</DialogTitle>
            <DialogDescription>{t("gyms.formDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("gyms.name")}</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("gyms.slug")}</Label>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("gyms.address")}</Label>
              <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("gyms.phone")}</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("gyms.email")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
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
