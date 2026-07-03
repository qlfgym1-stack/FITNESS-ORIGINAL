import { useState } from "react"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/toast"
import { useT, useLocale } from "@/i18n"
import { useTheme } from "@/stores/theme"
import { Save, Building2, Globe, Palette, Bell } from "lucide-react"

export default function SettingsPage() {
  const t = useT()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useLocale()
  const [form, setForm] = useState({
    gym_name: "Dinatek Fitness Alger Centre",
    address: "123 Rue Didouche Mourad, Alger",
    phone: "+213 21 123 456",
    email: "contact@dinatek.dz",
    currency: "DZD",
    language: locale,
    notifications_enabled: true,
    email_notifications: true,
    sms_notifications: false,
  })

  function save() {
    toast({ title: t("settings.saved"), description: t("settings.savedDescription") })
  }

  return (
    <div>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" /> {t("settings.gymInfo")}
            </CardTitle>
            <CardDescription>{t("settings.gymInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("settings.gymName")}</Label>
              <Input value={form.gym_name} onChange={(e) => setForm((f) => ({ ...f, gym_name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>{t("settings.address")}</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("settings.phone")}</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("settings.email")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> {t("settings.localization")}
            </CardTitle>
            <CardDescription>{t("settings.localizationDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("settings.language")}</Label>
                <Select value={form.language} onValueChange={(v) => {
                  setForm((f) => ({ ...f, language: v }))
                  setLocale(v)
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="ar">العربية</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>{t("settings.currency")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DZD">DZD - Algerian Dinar</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" /> {t("settings.appearance")}
            </CardTitle>
            <CardDescription>{t("settings.appearanceDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("settings.theme")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.themeDescription")}</p>
              </div>
              <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark")}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t("settings.light")}</SelectItem>
                  <SelectItem value="dark">{t("settings.dark")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" /> {t("settings.notifications")}
            </CardTitle>
            <CardDescription>{t("settings.notificationsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("settings.pushNotifications")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.pushNotificationsDescription")}</p>
              </div>
              <Switch checked={form.notifications_enabled} onCheckedChange={(v) => setForm((f) => ({ ...f, notifications_enabled: v }))} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("settings.emailNotifications")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.emailNotificationsDescription")}</p>
              </div>
              <Switch checked={form.email_notifications} onCheckedChange={(v) => setForm((f) => ({ ...f, email_notifications: v }))} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <Label>{t("settings.smsNotifications")}</Label>
                <p className="text-sm text-muted-foreground">{t("settings.smsNotificationsDescription")}</p>
              </div>
              <Switch checked={form.sms_notifications} onCheckedChange={(v) => setForm((f) => ({ ...f, sms_notifications: v }))} />
            </div>
          </CardContent>
        </Card>

        <Button onClick={save} className="w-full sm:w-auto">
          <Save className="mr-2 h-4 w-4" /> {t("settings.saveSettings")}
        </Button>
      </div>
    </div>
  )
}
