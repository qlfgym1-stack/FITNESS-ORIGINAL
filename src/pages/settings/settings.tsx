import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/toast"
import { useT, useLocale } from "@/i18n"
import { useTheme } from "@/stores/theme"
import { Save, Building2, Globe, Palette, Bell } from "lucide-react"

const settingsSchema = z.object({
  gym_name: z.string().min(1, "Gym name is required"),
  address: z.string().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  currency: z.string().min(1, "Currency is required"),
  language: z.string().min(1, "Language is required"),
  notifications_enabled: z.boolean(),
  email_notifications: z.boolean(),
  sms_notifications: z.boolean(),
})

type SettingsForm = z.infer<typeof settingsSchema>

export default function SettingsPage() {
  const t = useT()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const { locale, setLocale } = useLocale()

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      gym_name: "Dinatek Fitness Alger Centre",
      address: "123 Rue Didouche Mourad, Alger",
      phone: "+213 21 123 456",
      email: "contact@dinatek.dz",
      currency: "DZD",
      language: locale,
      notifications_enabled: true,
      email_notifications: true,
      sms_notifications: false,
    },
  })

  function onSubmit() {
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
            <FormField control={form.control} name="gym_name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.gymName")}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>{t("settings.address")}</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.phone")}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.email")}</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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
              <FormField control={form.control} name="language" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.language")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={(v) => { field.onChange(v); setLocale(v) }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="ar">العربية</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("settings.currency")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DZD">DZD - Algerian Dinar</SelectItem>
                        <SelectItem value="EUR">EUR - Euro</SelectItem>
                        <SelectItem value="USD">USD - US Dollar</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
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
            <FormField control={form.control} name="notifications_enabled" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <div>
                    <FormLabel>{t("settings.pushNotifications")}</FormLabel>
                    <p className="text-sm text-muted-foreground">{t("settings.pushNotificationsDescription")}</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </div>
              </FormItem>
            )} />
            <Separator />
            <FormField control={form.control} name="email_notifications" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <div>
                    <FormLabel>{t("settings.emailNotifications")}</FormLabel>
                    <p className="text-sm text-muted-foreground">{t("settings.emailNotificationsDescription")}</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </div>
              </FormItem>
            )} />
            <Separator />
            <FormField control={form.control} name="sms_notifications" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <div>
                    <FormLabel>{t("settings.smsNotifications")}</FormLabel>
                    <p className="text-sm text-muted-foreground">{t("settings.smsNotificationsDescription")}</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </div>
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Button onClick={form.handleSubmit(onSubmit)} className="w-full sm:w-auto">
          <Save className="mr-2 h-4 w-4" /> {t("settings.saveSettings")}
        </Button>
      </div>
    </div>
  )
}
