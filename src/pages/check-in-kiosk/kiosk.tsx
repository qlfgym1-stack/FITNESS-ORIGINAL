import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { getInitials } from "@/lib/utils"
import { Search, CheckCircle2, UserCheck, Clock, Loader2 } from "lucide-react"

interface Member {
  id: string
  first_name: string
  last_name: string
  photo_url: string | null
  status: string
  last_visit: string | null
}

const mockMembers: Member[] = [
  { id: "1", first_name: "Ahmed", last_name: "Benali", photo_url: null, status: "active", last_visit: "2026-07-02T16:30:00" },
  { id: "2", first_name: "Fatima", last_name: "Zohra", photo_url: null, status: "active", last_visit: "2026-07-03T09:15:00" },
  { id: "3", first_name: "Karim", last_name: "Ouali", photo_url: null, status: "active", last_visit: "2026-06-30T11:00:00" },
  { id: "4", first_name: "Lamia", last_name: "Bensaid", photo_url: null, status: "active", last_visit: "2026-07-01T14:45:00" },
  { id: "5", first_name: "Sami", last_name: "Mokhtar", photo_url: null, status: "active", last_visit: "2026-07-03T07:30:00" },
]

export default function KioskPage() {
  const t = useT()
  const { toast } = useToast()
  const [search, setSearch] = useState("")
  const [members] = useState<Member[]>(mockMembers)
  const [checkedIn, setCheckedIn] = useState<string[]>([])
  const [justCheckedIn, setJustCheckedIn] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (justCheckedIn) {
      const timer = setTimeout(() => setJustCheckedIn(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [justCheckedIn])

  const filtered = members.filter((m) =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  )

  const handleCheckIn = useCallback((id: string) => {
    setCheckedIn((prev) => [...prev, id])
    setJustCheckedIn(id)
    toast({
      title: t("kiosk.checkedIn"),
      description: t("kiosk.successMessage"),
    })
    setSearch("")
  }, [t, toast])

  return (
    <div className="fixed inset-0 bg-background flex flex-col">
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-3xl font-bold">{t("kiosk.title")}</h1>
          <p className="text-muted-foreground">{t("kiosk.subtitle")}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold antialiased">
            {time.toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-muted-foreground">
            {time.toLocaleDateString("fr-DZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-2xl mx-auto w-full">
        {justCheckedIn ? (
          <div className="text-center animate-in zoom-in">
            <div className="rounded-full bg-success/20 p-8 mb-6">
              <CheckCircle2 className="h-24 w-24 text-success" />
            </div>
            <h2 className="text-3xl font-bold mb-2">{t("kiosk.welcome")}</h2>
            <p className="text-xl text-muted-foreground">{t("kiosk.enjoyWorkout")}</p>
          </div>
        ) : (
          <>
            <div className="relative w-full mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground" />
              <Input
                placeholder={t("kiosk.searchMember")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-16 text-lg rounded-xl"
                autoFocus
              />
            </div>

            <div className="w-full space-y-3 max-h-[60vh] overflow-y-auto">
              {filtered.map((m) => {
                const isCheckedIn = checkedIn.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    disabled={isCheckedIn}
                    onClick={() => handleCheckIn(m.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <Avatar className="h-14 w-14">
                      {m.photo_url ? <AvatarImage src={m.photo_url} /> : null}
                      <AvatarFallback className="text-lg">{getInitials(m.first_name, m.last_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="text-lg font-semibold">{m.first_name} {m.last_name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {m.last_visit
                          ? `${t("kiosk.lastVisit")} ${new Date(m.last_visit).toLocaleDateString("fr-DZ")}`
                          : t("kiosk.firstVisit")}
                      </div>
                    </div>
                    {isCheckedIn ? (
                      <Badge variant="default" className="gap-1 text-sm py-1">
                        <UserCheck className="h-4 w-4" /> {t("kiosk.checkedIn")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-sm py-1">
                        <Loader2 className="h-4 w-4" /> {t("kiosk.checkIn")}
                      </Badge>
                    )}
                  </button>
                )
              })}
              {filtered.length === 0 && search && (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-lg">{t("kiosk.noMember")}</p>
                  <Button variant="link" className="mt-2">{t("kiosk.registerNew")}</Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="border-t p-4 text-center text-sm text-muted-foreground">
        {t("kiosk.footer")}
      </div>
    </div>
  )
}
