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
  Shield,
  Award,
  ScanQrCode,
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
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: "Main",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
      { label: "Members", icon: Users, path: "/members" },
      { label: "Subscriptions", icon: CreditCard, path: "/subscriptions" },
      { label: "Payments", icon: Wallet, path: "/payments" },
    ],
  },
  {
    label: "Planning",
    items: [
      { label: "Classes", icon: Calendar, path: "/classes" },
      { label: "Attendance", icon: ClipboardCheck, path: "/attendance" },
      { label: "Staff", icon: UsersRound, path: "/staff" },
    ],
  },
  {
    label: "Sales",
    items: [
      { label: "POS", icon: ShoppingCart, path: "/pos" },
      { label: "Inventory", icon: Package, path: "/inventory" },
      { label: "Stock", icon: Boxes, path: "/stock" },
      { label: "Suppliers", icon: Truck, path: "/suppliers" },
    ],
  },
  {
    label: "Equipment",
    items: [
      { label: "Equipment", icon: Dumbbell, path: "/equipment" },
      { label: "Reservations", icon: Clock, path: "/reservations" },
      { label: "Reports", icon: BarChart3, path: "/reports" },
    ],
  },
  {
    label: "Access",
    items: [
      { label: "Access Control", icon: Shield, path: "/access-control" },
      { label: "Badges", icon: Award, path: "/badges" },
      { label: "Check-in Kiosk", icon: ScanQrCode, path: "/check-in" },
    ],
  },
  {
    label: "Portal",
    items: [
      { label: "Member Portal", icon: UserCircle, path: "/member-portal" },
      { label: "Coach Mode", icon: GraduationCap, path: "/coach" },
      { label: "Display", icon: Monitor, path: "/display" },
    ],
  },
  {
    label: "Admin",
    items: [
      { label: "Settings", icon: Settings, path: "/settings" },
      { label: "Profile", icon: UserCog, path: "/profile" },
      { label: "Gyms", icon: Building2, path: "/gyms" },
      { label: "Notifications", icon: Bell, path: "/notifications" },
    ],
  },
  {
    label: "Super Admin",
    items: [
      { label: "Super Admin", icon: ShieldCheck, path: "/super-admin" },
      { label: "Licenses", icon: Key, path: "/licenses" },
      { label: "Corporate", icon: Briefcase, path: "/corporate" },
    ],
  },
]

function SidebarNav({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = useLocation().pathname

  const isActive = (path: string) => {
    if (path === "/dashboard") return pathname === path
    return pathname.startsWith(path) || pathname === path
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
        <nav className="space-y-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <h4 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h4>
              <ul className="space-y-0.5">
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
                      {item.label}
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>
      <Separator />
      <div className="p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-1.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="text-sm font-medium">Admin</p>
            <p className="text-xs text-muted-foreground">admin@fitmanager.pro</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
  return (
    <motion.aside
      initial={{ width: 240 }}
      animate={{ width: 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className={cn(
        "hidden lg:flex lg:w-60 lg:flex-col lg:border-r lg:bg-card",
        className
      )}
    >
      <SidebarNav />
    </motion.aside>
  )
}

interface MobileSidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SidebarNav onNavClick={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}
