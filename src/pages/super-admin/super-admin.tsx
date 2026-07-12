import { useState } from "react"
import { useQuery } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { usePagination } from "@/hooks/usePagination"
import { useExportCsv } from "@/hooks/useExportCsv"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs"
import { Pagination } from "@/components/ui/pagination"
import { useT } from "@/i18n"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Building2, Globe, Users, TrendingUp, DollarSign, Search, Calendar, Download, X } from "lucide-react"
import type { Organization } from "@/types/supabase"

type OrgRow = Organization & { member_count?: number; revenue?: number }

export default function SuperAdminPage() {
  const t = useT()
  const supabase = useSupabase()
  const [search, setSearch] = useState("")

  const { data: orgs = [] } = useQuery({
    queryKey: ["super-admin-orgs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("organizations")
        .select("*")
        .order("created_at", { ascending: false })
      const orgs = (data ?? []) as OrgRow[]
      return Promise.all(orgs.map(async (org) => {
        const { count: mCount } = await supabase.from("members").select("*", { count: "exact", head: true }).eq("organization_id", org.id)
        const { data: payments } = await supabase.from("payments").select("amount").eq("organization_id", org.id).eq("status", "completed")
        return { ...org, member_count: mCount ?? 0, revenue: payments?.reduce((s, p) => s + p.amount, 0) ?? 0 }
      }))
    },
  })

  const totalMembers = orgs.reduce((s, o) => s + (o.member_count ?? 0), 0)
  const totalRevenue = orgs.reduce((s, o) => s + (o.revenue ?? 0), 0)
  const activeOrgs = orgs.filter((o) => o.name && true).length
  const avgMembers = activeOrgs ? totalMembers / activeOrgs : 0

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase()) ||
    (o.address ?? "").toLowerCase().includes(search.toLowerCase())
  )

  const { page, setPage, totalPages, paginatedData: paginatedOrgs } = usePagination(filtered, 20)

  const { exportCsv } = useExportCsv(
    filtered.map(o => ({ name: o.name, slug: o.slug, email: o.email ?? '', phone: o.phone ?? '', members: o.member_count ?? 0, revenue: o.revenue ?? 0, created_at: o.created_at })),
    'organizations',
    [
      { key: 'name', label: t('superAdmin.organization') || 'Organization' },
      { key: 'slug', label: 'Slug' },
      { key: 'email', label: t('superAdmin.contact') || 'Contact' },
      { key: 'phone', label: 'Phone' },
      { key: 'members', label: t('superAdmin.members') || 'Members' },
      { key: 'revenue', label: t('superAdmin.revenue') || 'Revenue' },
      { key: 'created_at', label: t('superAdmin.createdAt') || 'Created' },
    ]
  )

  return (
    <div>
      <PageHeader title={t("superAdmin.title")} description={t("superAdmin.description")} />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />{t("superAdmin.totalOrganizations")}</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{orgs.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />{t("superAdmin.totalMembers")}</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{totalMembers.toLocaleString()}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" />{t("superAdmin.totalRevenue")}</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatCurrency(totalRevenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />{t("superAdmin.avgMembers")}</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{Math.round(avgMembers)}</p></CardContent>
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
        <Button variant="outline" onClick={() => exportCsv()}>
          <Download className="mr-2 h-4 w-4" />
          {t("common.export") || "Export"}
        </Button>
      </div>

      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("superAdmin.organization")}</TableHead>
              <TableHead>{t("superAdmin.contact")}</TableHead>
              <TableHead>{t("superAdmin.members")}</TableHead>
              <TableHead>{t("superAdmin.revenue")}</TableHead>
              <TableHead>{t("superAdmin.createdAt")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedOrgs.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p>{o.name}</p>
                      <p className="text-xs text-muted-foreground">{o.slug}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <p>{o.email ?? "—"}</p>
                  <p className="text-muted-foreground">{o.phone ?? "—"}</p>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary"><Users className="mr-1 h-3 w-3" />{o.member_count ?? 0}</Badge>
                </TableCell>
                <TableCell className="font-medium">{formatCurrency(o.revenue ?? 0)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(o.created_at)}</TableCell>
              </TableRow>
            ))}
            {paginatedOrgs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("common.noResults")}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="md:hidden space-y-3 p-4">
        {paginatedOrgs.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">{t("common.noResults")}</p>
        ) : (
          paginatedOrgs.map(o => (
            <Card key={o.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{o.name}</span>
                <Badge variant="secondary" className="ml-auto"><Users className="mr-1 h-3 w-3" />{o.member_count ?? 0}</Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>{o.email ?? "—"} · {o.phone ?? "—"}</p>
                <p className="font-medium text-foreground">{formatCurrency(o.revenue ?? 0)}</p>
                <p className="text-xs">{formatDate(o.created_at)}</p>
              </div>
            </Card>
          ))
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} totalItems={filtered.length} pageSize={20} onPageChange={setPage} />
    </div>
  )
}
