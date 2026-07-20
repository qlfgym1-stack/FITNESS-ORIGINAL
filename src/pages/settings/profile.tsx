import { useState, useRef, useCallback, useEffect } from "react"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { useAuth } from "@/stores/auth"
import { useSupabase } from "@/hooks/useSupabase"
import { getInitials, toUpper } from "@/lib/utils"
import { User, Camera, Save, Lock, Mail } from "lucide-react"

export default function ProfilePage() {
  const t = useT()
  const { toast } = useToast()
  const { profile, organization } = useAuth()
  const supabase = useSupabase()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name: profile?.full_name || "",
    email: profile?.email || "",
  })
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  })

  function handleAvatarClick() {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const orgId = organization?.id
      if (!orgId) throw new Error('No organization')
      const filePath = "${orgId}/avatars/${user?.id}/${file.name}"
      const { error } = await supabase.storage.from('photos').upload(filePath, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(filePath)
      setAvatarPreview(publicUrl)
      toast({ title: 'Avatar uploaded' })
    } catch (err: any) {
      toast({ title: t('errors.generic'), description: err.message, variant: 'destructive' })
    }
  }, [supabase, t])

  const saveProfile = useCallback(async () => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: form.full_name },
      })
      if (error) throw error
      toast({ title: t('profile.updated'), description: t('profile.updateSuccess') })
    } catch (err: any) {
      toast({ title: t('errors.generic'), description: err.message, variant: 'destructive' })
    }
  }, [supabase, form.full_name, t])

  const changePassword = useCallback(async () => {
    if (passwords.new !== passwords.confirm) {
      toast({ title: t('profile.passwordsNoMatch'), variant: 'destructive' })
      return
    }
    if (passwords.new.length < 6) {
      toast({ title: t('profile.passwordTooShort'), variant: 'destructive' })
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwords.new })
      if (error) throw error
      toast({ title: 'Password updated' })
      setPasswords({ current: '', new: '', confirm: '' })
    } catch (err: any) {
      toast({ title: t('errors.generic'), description: err.message, variant: 'destructive' })
    }
  }, [supabase, passwords, t])

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      full_name: profile?.full_name || '',
      email: profile?.email || '',
    }))
  }, [profile])

  return (
    <div>
      <PageHeader title={t("profile.title")} description={t("profile.description")} />

      <div className="space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" /> {t("profile.personalInfo")}
            </CardTitle>
            <CardDescription>{t("profile.personalInfoDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-20 w-20">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} />
                  ) : profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} />
                  ) : null}
                  <AvatarFallback className="text-xl">
                    {form.full_name ? getInitials(...form.full_name.split(" ") as [string, string]) : "U"}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1.5 text-primary-foreground shadow"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <p className="font-medium text-lg">{toUpper(form.full_name) || t("profile.noName")}</p>
                <p className="text-sm text-muted-foreground">{form.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("profile.fullName")}</Label>
                <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("profile.email")}</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>

            <Button onClick={saveProfile}>
              <Save className="mr-2 h-4 w-4" /> {t("profile.saveChanges")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" /> {t("profile.changePassword")}
            </CardTitle>
            <CardDescription>{t("profile.changePasswordDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label>{t("profile.currentPassword")}</Label>
              <Input type="password" value={passwords.current} onChange={(e) => setPasswords((f) => ({ ...f, current: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>{t("profile.newPassword")}</Label>
                <Input type="password" value={passwords.new} onChange={(e) => setPasswords((f) => ({ ...f, new: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>{t("profile.confirmPassword")}</Label>
                <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords((f) => ({ ...f, confirm: e.target.value }))} />
              </div>
            </div>
            <Button onClick={changePassword} variant="outline">
              <Lock className="mr-2 h-4 w-4" /> {t("profile.updatePassword")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

