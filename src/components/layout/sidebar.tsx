import { useState } from "react"
import { useLocation, Link } from "react-router-dom"
import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Wallet,
  Calendar,
  ClipboardCheck,
  UsersRound,
  ShoppingCart,
  Package,
  Boxes,
  Truck,
  Dumbbell,
  Clock,
  BarChart3,
  ClipboardList,
  Shield,
  Award,

  UserCircle,
  GraduationCap,
  Monitor,
  Settings,
  UserCog,
  Building2,
  Bell,
  ShieldCheck,
  Key,
  Briefcase,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { useT, useLocale } from "@/i18n"
import { useAuth } from "@/stores/auth"

interface NavItem {
  key: string
  path: string
  icon: React.ElementType
}

interface NavGroup {
  groupKey: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    groupKey: "main",
    items: [
      { key: "dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { key: "pointage", icon: Clock, path: "/pointage" },
      { key: "members", icon: Users, path: "/members" },
      { key: "subscriptions", icon: CreditCard, path: "/subscriptions" },
      { key: "payments", icon: Wallet, path: "/payments" },
    ],
  },
  {
    groupKey: "planning",
    items: [
      { key: "classes", icon: Calendar, path: "/classes" },
      { key: "attendance", icon: ClipboardCheck, path: "/attendance" },
      { key: "staff", icon: UsersRound, path: "/staff" },
    ],
  },
  {
    groupKey: "sales",
    items: [
      { key: "pos", icon: ShoppingCart, path: "/pos" },
      { key: "products", icon: Package, path: "/products" },
      { key: "inventory", icon: Boxes, path: "/inventory" },
      { key: "stock", icon: ClipboardList, path: "/stock" },
      { key: "suppliers", icon: Truck, path: "/suppliers" },
    ],
  },
  {
    groupKey: "equipment",
    items: [
      { key: "equipment", icon: Dumbbell, path: "/equipment" },
      { key: "reservations", icon: Clock, path: "/equipment/reservations" },
      { key: "reports", icon: BarChart3, path: "/reports" },
    ],
  },
  {
    groupKey: "access",
    items: [
      { key: "accessControl", icon: Shield, path: "/access-control" },
      { key: "badges", icon: Award, path: "/badges" },
    ],
  },
  {
    groupKey: "portal",
    items: [
      { key: "memberPortal", icon: UserCircle, path: "/member-portal" },
      { key: "coachMode", icon: GraduationCap, path: "/coach-mode" },
      { key: "display", icon: Monitor, path: "/display" },
    ],
  },
  {
    groupKey: "admin",
    items: [
      { key: "settings", icon: Settings, path: "/settings" },
      { key: "profile", icon: UserCog, path: "/profile" },
      { key: "gyms", icon: Building2, path: "/gyms" },
      { key: "notifications", icon: Bell, path: "/notifications" },
      { key: "users", icon: Users, path: "/admin/users" },
    ],
  },
  {
    groupKey: "superAdmin",
    items: [
      { key: "superAdmin", icon: ShieldCheck, path: "/super-admin" },
      { key: "licenses", icon: Key, path: "/licenses" },
      { key: "corporate", icon: Briefcase, path: "/corporate" },
    ],
  },
]

const VISIBLE_GROUPS: Record<string, string[]> = {
  super_admin: navGroups.map(g => g.groupKey),
  admin: ['main', 'planning', 'sales', 'equipment', 'access', 'portal', 'admin'],
  staff: ['main', 'planning'],
  coach: ['main', 'planning'],
}

function getTopRole(roles: { role: string }[]): string {
  if (roles.some(r => r.role === 'super_admin')) return 'super_admin'
  if (roles.some(r => r.role === 'admin')) return 'admin'
  if (roles.some(r => r.role === 'staff')) return 'staff'
  if (roles.some(r => r.role === 'coach')) return 'coach'
  return 'admin'
}

function SidebarNav({ onNavClick, collapsed }: { onNavClick?: () => void; collapsed?: boolean }) {
  const pathname = useLocation().pathname
  const t = useT()
  const { user, profile, signOut, roles } = useAuth()
  const topRole = getTopRole(roles)
  const visibleGroups = VISIBLE_GROUPS[topRole] ?? VISIBLE_GROUPS.admin
  const filteredGroups = navGroups.filter(g => visibleGroups.includes(g.groupKey))
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() || 'AD'
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const groups: Record<string, boolean> = {}
    filteredGroups.forEach((g) => { groups[g.groupKey] = true })
    return groups
  })

  const isActive = (path: string) => {
    if (path === "/dashboard") return pathname === path
    return pathname.startsWith(path) || pathname === path
  }

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center">
        <div className="flex h-14 items-center justify-center border-b border-border/50 w-full">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20">
            <Dumbbell className="h-4 w-4 text-white" />
          </div>
        </div>
        <ScrollArea className="flex-1 w-full px-2 py-2">
          <nav className="space-y-2">
            {filteredGroups.map((group) => (
              <div key={group.groupKey} className="space-y-0.5">
                {group.items.map((item) => (
                  <motion.li key={item.path} whileHover={{ scale: 1.05 }} transition={{ duration: 0.15 }} className="list-none">
                    <Link
                      to={item.path}
                      onClick={onNavClick}
                      className={cn(
                        "flex items-center justify-center rounded-md p-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                        isActive(item.path) ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                      )}
                      title={t(`nav.${item.key}`)}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                    </Link>
                  </motion.li>
                ))}
              </div>
            ))}
          </nav>
        </ScrollArea>
        <Separator />
        <div className="p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex h-14 items-center gap-2 border-b border-border/50 px-4"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20">
          <Dumbbell className="h-4 w-4 text-white" />
        </div>
        <span className="text-lg font-bold tracking-tight">
          <span className="text-gradient">FitManager</span>
          <span className="ml-1 text-xs font-semibold text-muted-foreground tracking-wider uppercase">Pro</span>
        </span>
      </motion.div>
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {filteredGroups.map((group) => (
            <div key={group.groupKey}>
              <button
                onClick={() => toggleGroup(group.groupKey)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
              >
                {t(`nav.groups.${group.groupKey}`)}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    openGroups[group.groupKey] ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
              {openGroups[group.groupKey] && (
                <ul className="space-y-0.5 mt-0.5">
                  {group.items.map((item) => (
                    <motion.li
                      key={item.path}
                      whileHover={{ scale: 1.05 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Link
                        to={item.path}
                        onClick={onNavClick}
                        className={cn(
                          "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                          isActive(item.path)
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {t(`nav.${item.key}`)}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ''} />
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium">{profile?.full_name || 'Admin'}</p>
            <p className="text-xs text-muted-foreground">{user?.email || 'MoussaMohamedelmabrouk@gmail.com'}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "hidden lg:flex lg:flex-col lg:border-r lg:bg-card relative",
        collapsed ? "lg:w-16" : "lg:w-60",
        className
      )}
    >
      <SidebarNav collapsed={collapsed} />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 h-6 w-6 rounded-full border bg-background shadow-sm z-20"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </Button>
    </motion.aside>
  )
}

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { locale } = useLocale()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={locale === "ar" ? "right" : "left"} className="w-72 p-0">
        <SidebarNav onNavClick={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
