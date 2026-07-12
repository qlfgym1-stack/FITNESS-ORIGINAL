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
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { formatDate, formatCurrency, getStatusColor } from "@/lib/utils"
import { Building, Plus, Search, Edit, Trash2, Phone, Mail, Percent, Download, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { Pagination } from "@/components/ui/pagination"
import { Card } from "@/components/ui/card"

interface CorporateAccount {
  id: string
  company_name: string
  contact_name: string
  email: string
  phone: string
  address: string
  discount_rate: number
  contract_start: string
  contract_end: string
  is_active: boolean
}

const defaultAccounts: CorporateAccount[] = [
  { id: "1", company_name: "Sonatrach", contact_name: "Ali Haddad", email: "ali@sonatrach.dz", phone: "+213 21 123 456", address: "Hydra, Alger", discount_rate: 15, contract_start: "2026-01-01", contract_end: "2026-12-31", is_active: true },
  { id: "2", company_name: "Air Algérie", contact_name: "Samira Bellil", email: "samira@airalgerie.dz", phone: "+213 21 789 012", address: "Dar El Beida, Alger", discount_rate: 10, contract_start: "2026-03-01", contract_end: "2027-02-28", is_active: true },
  { id: "3", company_name: "Algerian Telecom", contact_name: "Rachid Mansour", email: "rachid@telecom.dz", phone: "+213 770 555 555", address: "Rouiba, Alger", discount_rate: 20, contract_start: "2026-02-01", contract_end: "2026-08-01", is_active: false },
]

export default function CorporatePage() {
  const t = useT()
  const { toast } = useToast()
  const [accounts, setAccounts] = useState<CorporateAccount[]>(defaultAccounts)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [editing, setEditing] = useState<CorporateAccount | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Omit<CorporateAccount, "id">>({
    company_name: "", contact_name: "", email: "", phone: "", address: "", discount_rate: 0,
    contract_start: "", contract_end: "", is_active: true,
  })

  const filtered = accounts.filter((a) => {
    const matchesSearch = a.company_name.toLowerCase().includes(search.toLowerCase()) ||
      a.contact_name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && a.is_active) ||
      (statusFilter === "inactive" && !a.is_active)
    return matchesSearch && matchesStatus
  })

  const { page, setPage, totalPages, paginatedData: paginatedAccounts } = usePagination(filtered, 20)

  const { exportCsv } = useExportCsv(
    filtered.map(a => ({ company_name: a.company_name, contact_name: a.contact_name, email: a.email, phone: a.phone, address: a.address, discount_rate: a.discount_rate, contract_start: a.contract_start, contract_end: a.contract_end, active: a.is_active ? 'Yes' : 'No' })),
    'corporate',
    [
      { key: 'company_name', label: t('corporate.company') },
      { key: 'contact_name', label: t('corporate.contact') },
      { key: 'email', label: t('corporate.email') },
      { key: 'phone', label: t('corporate.phone') },
      { key: 'discount_rate', label: t('corporate.discount') },
      { key: 'contract_start', label: t('corporate.contractStart') },
      { key: 'contract_end', label: t('corporate.contractEnd') },
      { key: 'active', label: t('corporate.active') },
    ]
  )

  function openCreate() {
    setEditing(null)
    setForm({ company_name: "", contact_name: "", email: "", phone: "", address: "", discount_rate: 0, contract_start: "", contract_end: "", is_active: true })
    setDialogOpen(true)
  }

  function openEdit(a: CorporateAccount) {
    setEditing(a)
    setForm({ company_name: a.company_name, contact_name: a.contact_name, email: a.email, phone: a.phone, address: a.address, discount_rate: a.discount_rate, contract_start: a.contract_start, contract_end: a.contract_end, is_active: a.is_active })
    setDialogOpen(true)
  }

  function save() {
    if (editing) {
      setAccounts((prev) => prev.map((a) => (a.id === editing.id ? { ...a, ...form } : a)))
      toast({ title: t("common.updated") })
    } else {
      setAccounts((prev) => [...prev, { id: String(Date.now()), ...form }])
      toast({ title: t("common.created") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setAccounts((prev) => prev.filter((a) => a.id !== id))
    toast({ title: t("common.deleted") })
  }

  return (
    <div>
      <PageHeader
        title={t("corporate.title")}
        description={t("corporate.description")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportCsv()}>
              <Download className="mr-2 h-4 w-4" />
              {t("common.export") || "Export"}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> {t("corporate.add")}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t("common.status")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("common.all")}</SelectItem>
            <SelectItem value="active">{t("common.active")}</SelectItem>
            <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => { setSearch(""); setStatusFilter("all"); setPage(1) }} title="Reset filters">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("corporate.company")}</TableHead>
              <TableHead>{t("corporate.contact")}</TableHead>
              <TableHead>{t("corporate.email")}</TableHead>
              <TableHead>{t("corporate.phone")}</TableHead>
              <TableHead>{t("corporate.discount")}</TableHead>
              <TableHead>{t("corporate.contract")}</TableHead>
              <TableHead>{t("corporate.active")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAccounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    {a.company_name}
                  </div>
                </TableCell>
                <TableCell>{a.contact_name}</TableCell>
                <TableCell><Mail className="inline h-3 w-3 mr-1 text-muted-foreground" />{a.email}</TableCell>
                <TableCell><Phone className="inline h-3 w-3 mr-1 text-muted-foreground" />{a.phone}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="gap-1">
                    <Percent className="h-3 w-3" /> {a.discount_rate}%
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">
                  {formatDate(a.contract_start)} - {formatDate(a.contract_end)}
                </TableCell>
                <TableCell>
                  <Badge variant={a.is_active ? "default" : "secondary"}>
                    {a.is_active ? t("common.yes") : t("common.no")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {paginatedAccounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="md:hidden space-y-3 p-4">
        {paginatedAccounts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{t("common.noResults")}</p>
        ) : (
          paginatedAccounts.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{a.company_name}</span>
                <Badge variant={a.is_active ? "default" : "secondary"} className="ml-auto">
                  {a.is_active ? t("common.yes") : t("common.no")}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{a.contact_name}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1 mb-1"><Mail className="h-3 w-3" />{a.email}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{a.phone}</p>
              <div className="flex justify-end gap-1 mt-2">
                <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("corporate.edit") : t("corporate.add")}</DialogTitle>
            <DialogDescription>{t("corporate.formDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("corporate.company")}</Label>
                <Input value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("corporate.contact")}</Label>
                <Input value={form.contact_name} onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("corporate.email")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("corporate.phone")}</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("corporate.address")}</Label>
              <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>{t("corporate.discount")}</Label>
                <Input type="number" value={form.discount_rate} onChange={(e) => setForm((f) => ({ ...f, discount_rate: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("corporate.contractStart")}</Label>
                <Input type="date" value={form.contract_start} onChange={(e) => setForm((f) => ({ ...f, contract_start: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("corporate.contractEnd")}</Label>
                <Input type="date" value={form.contract_end} onChange={(e) => setForm((f) => ({ ...f, contract_end: e.target.value }))} />
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
