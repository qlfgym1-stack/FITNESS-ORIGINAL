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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { formatDateTime } from "@/lib/utils"
import {
  Shield, Plus, Search, Edit, Trash2, DoorOpen, LogIn, XCircle,
} from "lucide-react"

interface AccessDevice {
  id: string
  name: string
  type: "turnstile" | "door" | "barrier"
  device_id: string
  is_active: boolean
}

interface AccessLog {
  id: string
  device: string
  member: string
  status: "granted" | "denied"
  timestamp: string
}

const defaultDevices: AccessDevice[] = [
  { id: "1", name: "Main Entrance Turnstile", type: "turnstile", device_id: "TST-001", is_active: true },
  { id: "2", name: "Back Door", type: "door", device_id: "DR-002", is_active: true },
  { id: "3", name: "Parking Barrier", type: "barrier", device_id: "BR-003", is_active: false },
  { id: "4", name: "Pool Gate", type: "door", device_id: "DR-004", is_active: true },
]

const defaultLogs: AccessLog[] = [
  { id: "1", device: "Main Entrance Turnstile", member: "Ahmed Benali", status: "granted", timestamp: "2026-07-03T08:30:00" },
  { id: "2", device: "Main Entrance Turnstile", member: "Fatima Zohra", status: "granted", timestamp: "2026-07-03T09:15:00" },
  { id: "3", device: "Back Door", member: "Unknown", status: "denied", timestamp: "2026-07-03T10:00:00" },
  { id: "4", device: "Pool Gate", member: "Karim Ouali", status: "granted", timestamp: "2026-07-03T11:30:00" },
]

export default function AccessControlPage() {
  const t = useT()
  const { toast } = useToast()
  const [devices, setDevices] = useState<AccessDevice[]>(defaultDevices)
  const [logs] = useState<AccessLog[]>(defaultLogs)
  const [search, setSearch] = useState("")
  const [editing, setEditing] = useState<AccessDevice | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Omit<AccessDevice, "id">>({
    name: "", type: "turnstile", device_id: "", is_active: true,
  })

  const filteredDevices = devices.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase()) || d.device_id.toLowerCase().includes(search.toLowerCase())
  )
  const filteredLogs = logs.filter((l) =>
    l.device.toLowerCase().includes(search.toLowerCase()) || l.member.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ name: "", type: "turnstile", device_id: "", is_active: true })
    setDialogOpen(true)
  }

  function openEdit(d: AccessDevice) {
    setEditing(d)
    setForm({ name: d.name, type: d.type, device_id: d.device_id, is_active: d.is_active })
    setDialogOpen(true)
  }

  function save() {
    if (editing) {
      setDevices((prev) => prev.map((d) => (d.id === editing.id ? { ...d, ...form } : d)))
      toast({ title: t("common.updated") })
    } else {
      setDevices((prev) => [...prev, { id: String(Date.now()), ...form }])
      toast({ title: t("common.created") })
    }
    setDialogOpen(false)
  }

  function remove(id: string) {
    setDevices((prev) => prev.filter((d) => d.id !== id))
    toast({ title: t("common.deleted") })
  }

  function toggleDevice(id: string) {
    setDevices((prev) => prev.map((d) => (d.id === id ? { ...d, is_active: !d.is_active } : d)))
  }

  return (
    <div>
      <PageHeader
        title={t("accessControl.title")}
        description={t("accessControl.description")}
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> {t("accessControl.addDevice")}
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs defaultValue="devices">
        <TabsList className="mb-4">
          <TabsTrigger value="devices">{t("accessControl.devices")}</TabsTrigger>
          <TabsTrigger value="logs">{t("accessControl.logs")}</TabsTrigger>
        </TabsList>

        <TabsContent value="devices">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accessControl.deviceName")}</TableHead>
                  <TableHead>{t("accessControl.type")}</TableHead>
                  <TableHead>{t("accessControl.deviceId")}</TableHead>
                  <TableHead>{t("accessControl.status")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevices.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        {d.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <DoorOpen className="mr-1 h-3 w-3" />
                        {d.type.charAt(0).toUpperCase() + d.type.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{d.device_id}</TableCell>
                    <TableCell>
                      <Switch checked={d.is_active} onCheckedChange={() => toggleDevice(d.id)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(d.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accessControl.device")}</TableHead>
                  <TableHead>{t("accessControl.member")}</TableHead>
                  <TableHead>{t("accessControl.accessStatus")}</TableHead>
                  <TableHead>{t("accessControl.timestamp")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.device}</TableCell>
                    <TableCell>{l.member}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "granted" ? "default" : "destructive"} className="gap-1">
                        {l.status === "granted" ? <LogIn className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(l.timestamp)}</TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      {t("common.noResults")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("accessControl.editDevice") : t("accessControl.addDevice")}</DialogTitle>
            <DialogDescription>{t("accessControl.deviceFormDescription")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>{t("accessControl.deviceName")}</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("accessControl.type")}</Label>
                <Select value={form.type} onValueChange={(v: "turnstile" | "door" | "barrier") => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="turnstile">Turnstile</SelectItem>
                    <SelectItem value="door">Door</SelectItem>
                    <SelectItem value="barrier">Barrier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("accessControl.deviceId")}</Label>
                <Input value={form.device_id} onChange={(e) => setForm((f) => ({ ...f, device_id: e.target.value }))} />
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
