import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useT } from "@/i18n"
import { getInitials } from "@/lib/utils"
import { Users, Calendar, Clock, Activity, TrendingUp, UserCheck, LogIn } from "lucide-react"

const mockRecentCheckins = [
  { id: "1", name: "Ahmed Benali", time: "08:30", type: "check-in" },
  { id: "2", name: "Fatima Zohra", time: "08:45", type: "check-in" },
  { id: "3", name: "Karim Ouali", time: "09:00", type: "class", class_name: "Yoga" },
  { id: "4", name: "Lamia Bensaid", time: "09:15", type: "check-in" },
  { id: "5", name: "Sami Mokhtar", time: "09:30", type: "class", class_name: "CrossFit" },
  { id: "6", name: "Nadia Hamdi", time: "09:45", type: "check-in" },
  { id: "7", name: "Rachid Mansour", time: "10:00", type: "check-in" },
  { id: "8", name: "Ines Merabet", time: "10:15", type: "class", class_name: "Spinning" },
]

const mockTodayClasses = [
  { id: "1", name: "Morning Yoga", time: "08:00 - 09:00", coach: "Sami", enrolled: 12, capacity: 20 },
  { id: "2", name: "CrossFit", time: "10:00 - 11:00", coach: "Sami", enrolled: 15, capacity: 15 },
  { id: "3", name: "Spinning", time: "17:00 - 18:00", coach: "Ines", enrolled: 8, capacity: 12 },
  { id: "4", name: "Zumba", time: "18:30 - 19:30", coach: "Meriem", enrolled: 10, capacity: 20 },
]

export default function DisplayPage() {
  const t = useT()
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-background overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-8 py-6 border-b bg-card">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">FitManager</h1>
          <p className="text-muted-foreground text-lg">{t("display.title")}</p>
        </div>
        <div className="text-right">
          <div className="text-5xl font-bold tracking-tight antialiased">
            {time.toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="text-lg text-muted-foreground mt-1">
            {time.toLocaleDateString("fr-DZ", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-6 p-8 overflow-hidden">
        <div className="col-span-2 flex flex-col gap-6 overflow-hidden">
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 text-center">
                <Users className="h-8 w-8 mx-auto mb-1 text-primary" />
                <div className="text-3xl font-bold">42</div>
                <div className="text-sm text-muted-foreground">{t("display.todayCheckins")}</div>
              </CardContent>
            </Card>
            <Card className="bg-success/5 border-success/20">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 mx-auto mb-1 text-success" />
                <div className="text-3xl font-bold">156</div>
                <div className="text-sm text-muted-foreground">{t("display.activeMembers")}</div>
              </CardContent>
            </Card>
            <Card className="bg-warning/5 border-warning/20">
              <CardContent className="p-4 text-center">
                <Calendar className="h-8 w-8 mx-auto mb-1 text-warning" />
                <div className="text-3xl font-bold">12</div>
                <div className="text-sm text-muted-foreground">{t("display.todayClasses")}</div>
              </CardContent>
            </Card>
            <Card className="bg-destructive/5 border-destructive/20">
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-1 text-destructive" />
                <div className="text-3xl font-bold">89%</div>
                <div className="text-sm text-muted-foreground">{t("display.occupancy")}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 border-b bg-muted/30">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <LogIn className="h-5 w-5" /> {t("display.recentCheckins")}
                </h2>
              </div>
              <div className="divide-y overflow-y-auto max-h-[calc(100vh-24rem)]">
                {mockRecentCheckins.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>{getInitials(...c.name.split(" ") as [string, string])}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-sm text-muted-foreground">{c.time}</p>
                    </div>
                    <Badge variant={c.type === "class" ? "secondary" : "outline"}>
                      {c.type === "class" ? c.class_name : t("display.checkIn")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 overflow-hidden">
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 border-b bg-muted/30">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5" /> {t("display.todaySchedule")}
                </h2>
              </div>
              <div className="divide-y overflow-y-auto max-h-[calc(100vh-16rem)]">
                {mockTodayClasses.map((c) => (
                  <div key={c.id} className="p-4">
                    <div className="font-semibold text-lg">{c.name}</div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Clock className="h-3.5 w-3.5" /> {c.time}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" /> {c.enrolled}/{c.capacity}
                    </div>
                    <div className="mt-2">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${(c.enrolled / c.capacity) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="border-t px-8 py-3 text-center text-sm text-muted-foreground bg-card">
        {t("display.footer")}
      </div>
    </div>
  )
}
