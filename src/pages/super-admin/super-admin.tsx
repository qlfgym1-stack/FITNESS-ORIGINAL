import { useState } from "react"
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
import { useT } from "@/i18n"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Building2, Globe, Users, TrendingUp, DollarSign, Search, Calendar } from "lucide-react"

interface Organization {
  id: string
  name: string
  slug: string
  address: string
  phone: string
  email: string
  member_count: number
  revenue: number
  status: string
  created_at: string
}

const defaultOrgs: Organization[] = [
  { id: "1", name: "FitManager Alger Centre", slug: "alger-centre", address: "Alger", phone: "+213 21 123 456", email: "alger@fitmanager.dz", member_count: 450, revenue: 2250000, status: "active", created_at: "2025-01-15" },
  { id: "2", name: "FitManager Oran", slug: "oran", address: "Oran", phone: "+213 41 789 012", email: "oran@fitmanager.dz", member_count: 320, revenue: 1600000, status: "active", created_at: "2025-03-20" },
  { id: "3", name: "FitManager Constantine", slug: "constantine", address: "Constantine", phone: "+213 31 456 789", email: "constantine@fitmanager.dz", member_count: 280, revenue: 1400000, status: "active", created_at: "2025-06-10" },
  { id: "4", name: "FitManager Annaba", slug: "annaba", address: "Annaba", phone: "+213 38 123 456", email: "annaba@fitmanager.dz", member_count: 190, revenue: 950000, status: "active", created_at: "2026-01-05" },
  { id: "5", name: "FitZone Blida", slug: "blida", address: "Blida", phone: "+213 25 111 222", email: "contact@fitzone.dz", member_count: 0, revenue: 0, status: "pending", created_at: "2026-07-01" },
]

export default function SuperAdminPage() {
  const t = useT()
  const [orgs] = useState<Organization[]>(defaultOrgs)
  const [search, setSearch] = useState("")

  const totalMembers = orgs.reduce((s, o) => s + o.member_count, 0)
  const totalRevenue = orgs.reduce((s, o) => s + o.revenue, 0)
  const activeOrgs = orgs.filter((o) => o.status === "active").length
  const avgMembers = totalMembers / (activeOrgs || 1)

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase()) ||
    o.address.toLowerCase().includes(search.toLowerCase())
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
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("superAdmin.organization")}</TableHead>
              <TableHead>{t("superAdmin.slug")}</TableHead>
              <TableHead>{t("superAdmin.location")}</TableHead>
              <TableHead className="text-right">{t("superAdmin.members")}</TableHead>
              <TableHead className="text-right">{t("superAdmin.revenue")}</TableHead>
              <TableHead>{t("superAdmin.status")}</TableHead>
              <TableHead>{t("superAdmin.joined")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {o.name}
                  </div>
                </TableCell>
                <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{o.slug}</code></TableCell>
                <TableCell>{o.address}</TableCell>
                <TableCell className="text-right font-mono">{o.member_count}</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(o.revenue)}</TableCell>
                <TableCell>
                  <Badge variant={o.status === "active" ? "default" : "secondary"}>
                    {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(o.created_at)}</TableCell>
              </TableRow>
            ))}
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
    </div>
  )
}
