import { useState, useEffect, useMemo } from "react"
import { Menu, Search, Bell, Sun, Moon, LogOut, User, Globe, Wifi, WifiOff, AlertTriangle, CreditCard, UserCheck, CalendarOff, Settings, CheckCheck } from "lucide-react"
import { motion } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTheme } from "@/stores/theme"
import { useAuth } from "@/stores/auth"
import { useT, useLocale } from "@/i18n"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { OfflineQueueBadge } from "@/components/ui/offline-queue-badge"
import { useSupabase } from "@/hooks/useSupabase"
import type { Notification } from "@/types/supabase"

function ClockDisplay() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  return (
    <div className="hidden sm:block text-right ml-auto mr-3">
      <div className="text-2xl font-bold tabular-nums leading-none tracking-tight text-foreground">
        {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </div>
      <div className="text-xs text-muted-foreground leading-none mt-1">
        {time.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
      </div>
    </div>
  )
}

function NetworkIndicator() {
  const { isOnline, recovering } = useNetworkStatus()
  if (recovering) return null
  return (
    <motion.div
      className="flex items-center gap-1.5 mr-2"
      animate={!isOnline ? { opacity: [1, 0.2, 1] } : { opacity: 1 }}
      transition={!isOnline ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}}
    >
      {isOnline ? (
        <Wifi className="h-4 w-4 text-success" />
      ) : (
        <WifiOff className="h-4 w-4 text-destructive" />
      )}
      <span className={`text-xs font-medium ${isOnline ? 'text-success' : 'text-destructive'}`}>
        {isOnline ? 'En ligne' : 'Hors-ligne'}
      </span>
    </motion.div>
  )
}

const NOTIF_TYPE_ICONS: Record<string, React.ElementType> = {
  subscription_expiring: AlertTriangle,
  payment_overdue: CreditCard,
  member_checkin: UserCheck,
  staff_leave: CalendarOff,
  system: Settings,
}

function timeAgo(dateStr: string, t: (key: string) => string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffSec = Math.floor((now - then) / 1000)
  if (diffSec < 60) return t("notifications.justNow")
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return t("notifications.minutesAgo").replace("{n}", String(diffMin))
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return t("notifications.hoursAgo").replace("{n}", String(diffH))
  const diffD = Math.floor(diffH / 24)
  return t("notifications.daysAgo").replace("{n}", String(diffD))
}

function NotificationsDropdown() {
  const t = useT()
  const { user } = useAuth()
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("created_at", { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as Notification[]
    },
    enabled: !!user?.id && open,
    refetchInterval: open ? 30000 : false,
  })

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications],
  )

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter((n) => !n.is_read && n.user_id === user?.id)
      if (unread.length === 0) return
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", unread.map((n) => n.id))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">{t("notifications.title")}</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-20" />
              {t("notifications.noNotifications")}
            </div>
          ) : (
            notifications.slice(0, 5).map((notif) => {
              const Icon = NOTIF_TYPE_ICONS[notif.type] || Bell
              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-3 border-b px-4 py-3 last:border-0 ${!notif.is_read ? "bg-primary/5" : ""}`}
                >
                  <div className="mt-0.5 rounded-full bg-muted p-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{notif.title}</p>
                      {!notif.is_read && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{notif.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(notif.created_at, t)}</p>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface NavbarProps {
  onMenuClick: () => void
}

const locales = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ar", label: "العربية", flag: "🇩🇿" },
]

export function Navbar({ onMenuClick }: NavbarProps) {
  const t = useT()
  const { locale, setLocale } = useLocale()
  const { theme, toggleTheme } = useTheme()
  const { signOut, user, profile, organization } = useAuth()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'AD'

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/members?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-lg px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuClick}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="relative max-w-md flex-1"
      >
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("navbar.search")}
            className="bg-muted pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </motion.div>

      <ClockDisplay />

      <NetworkIndicator />

      <OfflineQueueBadge />

      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Globe className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuLabel>{t("navbar.language")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {locales.map((loc) => (
              <DropdownMenuItem
                key={loc.code}
                onClick={() => setLocale(loc.code)}
                className={locale === loc.code ? "bg-accent" : ""}
              >
                <span className="mr-2">{loc.flag}</span>
                {loc.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationsDropdown />

        <Button variant="ghost" size="icon" onClick={toggleTheme}>
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{profile?.full_name || organization?.name || 'Admin'}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email || 'MoussaMohamedelmabrouk@gmail.com'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              {t("navbar.profile")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              {t("navbar.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
