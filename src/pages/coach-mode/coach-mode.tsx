import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/toast"
import { useT } from "@/i18n"
import { getInitials } from "@/lib/utils"
import { Calendar, Clock, MapPin, UserCheck, CheckCircle2, XCircle, Search, Users } from "lucide-react"

interface ClassSession {
  id: string
  name: string
  start_time: string
  end_time: string
  coach: string
  location: string
  enrolled: number
  capacity: number
  attendees: Attendee[]
}

interface Attendee {
  id: string
  name: string
  status: "present" | "absent" | "pending"
}

const mockClasses: ClassSession[] = [
  {
    id: "1", name: "Morning Yoga", start_time: "08:00", end_time: "09:00", coach: "Sami Mokhtar", location: "Studio A",
    enrolled: 12, capacity: 20,
    attendees: [
      { id: "1", name: "Ahmed Benali", status: "pending" },
      { id: "2", name: "Fatima Zohra", status: "pending" },
      { id: "3", name: "Karim Ouali", status: "present" },
      { id: "4", name: "Lamia Bensaid", status: "pending" },
      { id: "5", name: "Rachid Mansour", status: "absent" },
    ],
  },
  {
    id: "2", name: "CrossFit", start_time: "10:00", end_time: "11:00", coach: "Sami Mokhtar", location: "Main Hall",
    enrolled: 15, capacity: 15,
    attendees: [
      { id: "6", name: "Mohamed Khelifi", status: "present" },
      { id: "7", name: "Nadia Hamdi", status: "present" },
      { id: "8", name: "Omar Bensalem", status: "pending" },
    ],
  },
  {
    id: "3", name: "Spinning", start_time: "17:00", end_time: "18:00", coach: "Ines Merabet", location: "Spinning Room",
    enrolled: 8, capacity: 12,
    attendees: [
      { id: "9", name: "Hicham Belkacem", status: "pending" },
      { id: "10", name: "Meriem Cherif", status: "present" },
    ],
  },
]

export default function CoachModePage() {
  const t = useT()
  const { toast } = useToast()
  const [todayClasses, setTodayClasses] = useState<ClassSession[]>(mockClasses)
  const [activeClass, setActiveClass] = useState<string | null>(null)
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  function markAttendance(classId: string, attendeeId: string, status: "present" | "absent") {
    setTodayClasses((prev) =>
      prev.map((c) =>
        c.id === classId
          ? { ...c, attendees: c.attendees.map((a) => (a.id === attendeeId ? { ...a, status } : a)) }
          : c
      )
    )
    toast({
      title: status === "present" ? t("coach.markedPresent") : t("coach.markedAbsent"),
    })
  }

  const currentClass = todayClasses.find((c) => c.id === activeClass)

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-80 border-r bg-muted/30 p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">{t("coach.todayClasses")}</h2>
          <p className="text-sm text-muted-foreground">
            {time.toLocaleDateString("fr-DZ", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        <ScrollArea className="h-[calc(100vh-12rem)]">
          <div className="space-y-3">
            {todayClasses.map((c) => {
              const present = c.attendees.filter((a) => a.status === "present").length
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveClass(c.id)}
                  className={`w-full text-left p-4 rounded-lg border transition-colors ${
                    activeClass === c.id ? "border-primary bg-primary/5" : "bg-card hover:bg-accent"
                  }`}
                >
                  <div className="font-semibold">{c.name}</div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    {c.start_time} - {c.end_time}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {c.location}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge variant="secondary">
                      <Users className="mr-1 h-3 w-3" />
                      {present}/{c.enrolled}
                    </Badge>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 p-6">
        {currentClass ? (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{currentClass.name}</h1>
              <div className="flex items-center gap-4 mt-1 text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {currentClass.start_time} - {currentClass.end_time}</span>
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {currentClass.location}</span>
                <span className="flex items-center gap-1"><UserCheck className="h-4 w-4" /> {currentClass.enrolled}/{currentClass.capacity}</span>
              </div>
            </div>

            <div className="space-y-2">
              {currentClass.attendees.map((a) => (
                <div key={a.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(...a.name.split(" ") as [string, string])}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 font-medium">{a.name}</div>
                  {a.status === "present" ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> {t("coach.present")}
                    </Badge>
                  ) : a.status === "absent" ? (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" /> {t("coach.absent")}
                    </Badge>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" onClick={() => markAttendance(currentClass.id, a.id, "present")}>
                        <CheckCircle2 className="mr-1 h-4 w-4" /> {t("coach.present")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => markAttendance(currentClass.id, a.id, "absent")}>
                        <XCircle className="mr-1 h-4 w-4" /> {t("coach.absent")}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              {currentClass.attendees.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">{t("coach.noAttendees")}</div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <Calendar className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p className="text-lg">{t("coach.selectClass")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
