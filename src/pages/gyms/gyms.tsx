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
import { formatDate, formatPhone, displayPhone } from "@/lib/utils"
import { Building2, Plus, Search, Edit, Trash2, Users, Calendar, MapPin, Download, X } from "lucide-react"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Pagination } from "@/components/ui/pagination"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form"

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
  { id: "1", name: "FitManager Alger Centre", slug: "alger-centre", address: "123 Rue Didouche Mourad, Alger", phone: "+213 21 123 456", email: "alger@fitmanager.dz", logo_url: null, member_count: 450, created_at: "2025-01-15" },
  { id: "2", name: "FitManager Oran", slug: "oran", address: "45 Boulevard Front de Mer, Oran", phone: "+213 41 789 012", email: "oran@fitmanager.dz", logo_url: null, member_count: 320, created_at: "2025-03-20" },
  { id: "3", name: "FitManager Constantine", slug: "constantine", address: "78 Rue Larbi Ben M'hidi, Constantine", phone: "+213 31 456 789", email: "constantine@fitmanager.dz", logo_url: null, member_count: 280, created_at: "2025-06-10" },
  { id: "4", name: "FitManager Annaba", slug: "annaba", address: "12 Boulevard de la République, Annaba", phone: "+213 38 123 456", email: "annaba@fitmanager.dz", logo_url: null, member_count: 190, created_at: "2026-01-05" },
]

const gymSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  slug: z.string().min(1, "Le slug est requis").regex(/^[a-z0-9-]+$/, "Slug invalide (lettres minuscules, chiffres, tirets)"),
  address: z.string().min(1, "L'adresse est requise"),
  phone: z.string().default(""),
  email: z.string().email("Email invalide").or(z.literal("")).default(""),
})

type GymFormData = z.infer<typeof gymSchema>

export default function GymsPage() {
  const t = useT()
  const { toast } = useToast()
  const [gyms, setGyms] = useState<Gym[]>(defaultGyms)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<Gym | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const form = useForm<GymFormData>({
    resolver: zodResolver(gymSchema),
    defaultValues: { name: "", slug: "", address: "", phone: "", email: "" },
  })

  const filtered = gyms.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.address.toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, paginatedData: paginatedGyms } = usePagination(filtered, 20)

  const { exportCsv } = useExportCsv(
    filtered.map(g => ({ name: g.name, address: g.address, phone: g.phone, email: g.email, member_count: g.member_count })),
    'gyms',
    [
      { key: 'name', label: t('gyms.name') },
      { key: 'address', label: t('gyms.address') },
      { key: 'phone', label: t('gyms.contact') },
      { key: 'email', label: 'Email' },
      { key: 'member_count', label: t('gyms.members') },
    ]
  )

  const totalMembers = gyms.reduce((sum, g) => sum + g.member_count, 0)

  function openCreate() {
    setEditing(null)
    form.reset({ name: "", slug: "", address: "", phone: "", email: "" })
    setDialogOpen(true)
  }

  function openEdit(g: Gym) {
    setEditing(g)
    form.reset({ name: g.name, slug: g.slug, address: g.address, phone: g.phone, email: g.email })
    setDialogOpen(true)
  }

  function save(data: GymFormData) {
    if (editing) {
      setGyms((prev) => prev.map((g) => (g.id === editing.id ? { ...g, ...data } : g)))
      toast({ title: t("common.updated") })
    } else {
      setGyms((prev) => [...prev, { id: String(Date.now()), ...data, logo_url: null, member_count: 0, created_at: new Date().toISOString().slice(0, 10) }])
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv()}>
              <Download className="mr-2 h-4 w-4" />
              {t("common.export") || "Export"}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> {t("gyms.add")}
            </Button>
          </div>
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
        <Button variant="outline" size="icon" onClick={() => { setSearch(""); setPage(1) }} title="Reset filters">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="hidden md:block">
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
              {paginatedGyms.map((g) => (
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
                    <div>{displayPhone(g.phone)}</div>
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
              {paginatedGyms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {t("common.noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="md:hidden space-y-3 p-4">
          {paginatedGyms.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">{t("common.noResults")}</p>
          ) : (
            paginatedGyms.map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-sm text-muted-foreground">{g.address}</p>
                  </div>
                  <Badge variant="secondary"><Users className="mr-1 h-3 w-3" />{g.member_count}</Badge>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(g)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(g.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(save)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? t("gyms.edit") : t("gyms.add")}</DialogTitle>
                <DialogDescription>{t("gyms.formDescription")}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("gyms.name")}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("gyms.slug")}</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("gyms.address")}</FormLabel>
                      <FormControl><Textarea {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("gyms.phone")}</FormLabel>
                        <FormControl>
                          <Input {...field} onBlur={() => field.onChange(formatPhone(field.value || ""))} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("gyms.email")}</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
                <Button type="submit">{t("common.save")}</Button>
              </DialogFooter>
            </DialogContent>
          </form>
        </Form>
      </Dialog>
    </div>
  )
}
