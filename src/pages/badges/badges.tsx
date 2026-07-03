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
import { formatDate, cn } from "@/lib/utils"
import {
  Award, Plus, Search, Edit, Trash2, UserCheck,
} from "lucide-react"

interface BadgeType {
  id: string
  name: string
  description: string
  color: string
  icon: string
  is_active: boolean
}

interface MemberBadge {
  id: string
  member: string
  badge: string
  assigned_at: string
}

const defaultBadgeTypes: BadgeType[] = [
  { id: "1", name: "Gold Member", description: "Premium membership badge", color: "#FFD700", icon: "star", is_active: true },
  { id: "2", name: "100 Check-ins", description: "Awarded for 100 check-ins", color: "#00C853", icon: "check", is_active: true },
  { id: "3", name: "Referral Star", description: "Referred 10+ members", color: "#448AFF", icon: "users", is_active: true },
  { id: "4", name: "Early Bird", description: "Checked in before 7am 50 times", color: "#FF6D00", icon: "sun", is_active: false },
]

const defaultMemberBadges: MemberBadge[] = [
  { id: "1", member: "Ahmed Benali", badge: "Gold Member", assigned_at: "2026-06-15" },
  { id: "2", member: "Fatima Zohra", badge: "100 Check-ins", assigned_at: "2026-06-20" },
  { id: "3", member: "Karim Ouali", badge: "Referral Star", assigned_at: "2026-05-10" },
]

const colorOptions = ["#FFD700", "#00C853", "#448AFF", "#FF6D00", "#E040FB", "#FF1744", "#00BCD4", "#795548"]

export default function BadgesPage() {
  const t = useT()
  const { toast } = useToast()
  const [badgeTypes, setBadgeTypes] = useState<BadgeType[]>(defaultBadgeTypes)
  const [memberBadges, setMemberBadges] = useState<MemberBadge[]>(defaultMemberBadges)
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<"types" | "assign">("types")
  const [editing, setEditing] = useState<BadgeType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [form, setForm] = useState<Omit<BadgeType, "id">>({
    name: "", description: "", color: "#FFD700", icon: "star", is_active: true,
  })
  const [assignForm, setAssignForm] = useState({ member: "", badge: "" })

  const filtered = badgeTypes.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ name: "", description: "", color: "#FFD700", icon: "star", is_active: true })
    setDialogOpen(true)
  }

  function openEdit(b: BadgeType) {
    setEditing(b)
    setForm({ name: b.name, description: b.description, color: b.color, icon: b.icon, is_active: b.is_active })
    setDialogOpen(true)
  }

  function save() {
    if (editing) {
      setBadgeTypes((prev) => prev.map((b) => (b.id === editing.id ? { ...b, ...form } : b)))
      toast({ title: t("common.updated") })
    } else {
      setBadgeTypes((prev) => [...prev, { id: String(Date.now()), ...form }])
      toast({ title: t("common.created") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setBadgeTypes((prev) => prev.filter((b) => b.id !== id))
    toast({ title: t("common.deleted") })
  }

  function assignBadge() {
    if (!assignForm.member || !assignForm.badge) return
    setMemberBadges((prev) => [...prev, {
      id: String(Date.now()),
      member: assignForm.member,
      badge: assignForm.badge,
      assigned_at: new Date().toISOString().slice(0, 10),
    }])
    toast({ title: t("badges.assigned") })
    setAssignOpen(false)
    setAssignForm({ member: "", badge: "" })
  }

  function removeAssignment(id: string) {
    setMemberBadges((prev) => prev.filter((a) => a.id !== id))
    toast({ title: t("common.deleted") })
  }

  return (
    <div>
      <PageHeader
        title={t("badges.title")}
        description={t("badges.description")}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(true)}>
              <UserCheck className="mr-2 h-4 w-4" /> {t("badges.assign")}
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> {t("badges.add")}
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {tab === "types" && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("badges.name")}</TableHead>
                <TableHead>{t("badges.description")}</TableHead>
                <TableHead>{t("badges.color")}</TableHead>
                <TableHead>{t("badges.icon")}</TableHead>
                <TableHead>{t("badges.active")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4" style={{ color: b.color }} />
                      {b.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{b.description}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full border" style={{ backgroundColor: b.color }} />
                      <span className="text-xs font-mono">{b.color}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{b.icon}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={b.is_active ? "default" : "secondary"}>
                      {b.is_active ? t("common.yes") : t("common.no")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(b.id)}>
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
      )}

      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-3">{t("badges.assignedBadges")}</h3>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("badges.member")}</TableHead>
                <TableHead>{t("badges.badge")}</TableHead>
                <TableHead>{t("badges.assignedAt")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberBadges.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.member}</TableCell>
                  <TableCell><Badge variant="outline">{a.badge}</Badge></TableCell>
                  <TableCell>{formatDate(a.assigned_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => removeAssignment(a.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("badges.edit") : t("badges.add")}</DialogTitle>
            <DialogDescription>{t("badges.formDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("badges.name")}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("badges.description")}</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("badges.color")}</Label>
              <div className="flex gap-2 flex-wrap">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn("h-8 w-8 rounded-full border-2 transition-all", form.color === c ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm((f) => ({ ...f, color: c }))}
                  />
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("badges.icon")}</Label>
              <Input value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={save}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("badges.assign")}</DialogTitle>
            <DialogDescription>{t("badges.assignDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("badges.member")}</Label>
              <Input value={assignForm.member} onChange={(e) => setAssignForm((f) => ({ ...f, member: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("badges.badge")}</Label>
              <Select value={assignForm.badge} onValueChange={(v) => setAssignForm((f) => ({ ...f, badge: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {badgeTypes.filter((b) => b.is_active).map((b) => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={assignBadge}>{t("badges.assign")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
