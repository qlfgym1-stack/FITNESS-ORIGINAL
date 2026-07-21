import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { AuthProvider } from '@/stores/auth'
import { useAuth } from '@/stores/auth'
import { lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { Button } from '@/components/ui/button'

const SignIn = lazy(() => import('@/pages/auth/sign-in'))
const SignUp = lazy(() => import('@/pages/auth/sign-up'))
const Recovery = lazy(() => import('@/pages/auth/recovery'))
const Dashboard = lazy(() => import('@/pages/dashboard/dashboard'))
const Members = lazy(() => import('@/pages/members/members'))
const Subscriptions = lazy(() => import('@/pages/subscriptions/subscriptions'))
const Payments = lazy(() => import('@/pages/payments/payments'))
const Encaissement = lazy(() => import('@/pages/encaissement/encaissement'))
const Classes = lazy(() => import('@/pages/classes/classes'))
const Attendance = lazy(() => import('@/pages/attendance/attendance'))
const Staff = lazy(() => import('@/pages/staff/staff'))
const StaffTimesheet = lazy(() => import('@/pages/staff/timesheet'))
const StaffPlanning = lazy(() => import('@/pages/staff/planning'))
const StaffLeaves = lazy(() => import('@/pages/staff/leaves'))
const POS = lazy(() => import('@/pages/pos/pos'))
const Materiel = lazy(() => import('@/pages/materiel/materiel'))
const Equipment = lazy(() => import('@/pages/equipment/equipment'))
const EquipmentReservations = lazy(() => import('@/pages/equipment/reservations'))
const EquipmentReport = lazy(() => import('@/pages/equipment/report'))
const Inventory = lazy(() => import('@/pages/inventory/inventory'))
const Products = lazy(() => import('@/pages/products/products'))
const Suppliers = lazy(() => import('@/pages/suppliers/suppliers'))
const PurchaseOrders = lazy(() => import('@/pages/suppliers/purchase-orders'))
const AccessControl = lazy(() => import('@/pages/access-control/access-control'))
const Badges = lazy(() => import('@/pages/badges/badges'))
const Pointage = lazy(() => import('@/pages/pointage/pointage'))

const MemberPortal = lazy(() => import('@/pages/member-portal/portal'))
const CoachMode = lazy(() => import('@/pages/coach-mode/coach-mode'))
const CoachPortal = lazy(() => import('@/pages/coach-portal/coach-portal'))
const Rh = lazy(() => import('@/pages/rh/rh'))
const Reports = lazy(() => import('@/pages/reports/reports'))
const Corporate = lazy(() => import('@/pages/corporate/corporate'))
const Gyms = lazy(() => import('@/pages/gyms/gyms'))
const Licenses = lazy(() => import('@/pages/licenses/licenses'))
const Notifications = lazy(() => import('@/pages/notifications/notifications'))
const Settings = lazy(() => import('@/pages/settings/settings'))
const Profile = lazy(() => import('@/pages/settings/profile'))
const SuperAdmin = lazy(() => import('@/pages/super-admin/super-admin'))
const AdminUsers = lazy(() => import('@/pages/admin/users'))
const Display = lazy(() => import('@/pages/display/display'))
const Expenses = lazy(() => import('@/pages/expenses/expenses'))
const AssistantComptable = lazy(() => import('@/pages/assistant-comptable/assistant-comptable'))
const Rentabilite = lazy(() => import('@/pages/rentabilite/rentabilite'))
const AiAssistant = lazy(() => import('@/pages/display/display'))
const Install = lazy(() => import('@/pages/install/install'))

function Loading() {
  return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
}

function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
        <p className="text-lg text-muted-foreground">Page not found</p>
        <Button onClick={() => window.history.back()}>Go back</Button>
      </div>
    </div>
  )
}

function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Loading />
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Loading />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const location = useLocation()

  return (
    <AuthProvider>
      <ErrorBoundary>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/auth" element={<PublicRoute><Suspense fallback={<Loading />}><SignIn /></Suspense></PublicRoute>} />
            <Route path="/auth/sign-up" element={<PublicRoute><Suspense fallback={<Loading />}><SignUp /></Suspense></PublicRoute>} />
            <Route path="/auth/recovery" element={<PublicRoute><Suspense fallback={<Loading />}><Recovery /></Suspense></PublicRoute>} />
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<PageTransition><Suspense fallback={<Loading />}><Dashboard /></Suspense></PageTransition>} />
              <Route path="pointage" element={<PageTransition><Suspense fallback={<Loading />}><Pointage /></Suspense></PageTransition>} />
              <Route path="members" element={<PageTransition><Suspense fallback={<Loading />}><Members /></Suspense></PageTransition>} />
              <Route path="subscriptions" element={<PageTransition><Suspense fallback={<Loading />}><Subscriptions /></Suspense></PageTransition>} />
              <Route path="payments" element={<PageTransition><Suspense fallback={<Loading />}><Payments /></Suspense></PageTransition>} />
              <Route path="encaissement" element={<PageTransition><Suspense fallback={<Loading />}><Encaissement /></Suspense></PageTransition>} />
              <Route path="classes" element={<PageTransition><Suspense fallback={<Loading />}><Classes /></Suspense></PageTransition>} />
              <Route path="attendance" element={<PageTransition><Suspense fallback={<Loading />}><Attendance /></Suspense></PageTransition>} />
              <Route path="staff" element={<PageTransition><Suspense fallback={<Loading />}><Staff /></Suspense></PageTransition>} />
              <Route path="staff/timesheet" element={<PageTransition><Suspense fallback={<Loading />}><StaffTimesheet /></Suspense></PageTransition>} />
              <Route path="staff/planning" element={<PageTransition><Suspense fallback={<Loading />}><StaffPlanning /></Suspense></PageTransition>} />
              <Route path="staff/leaves" element={<PageTransition><Suspense fallback={<Loading />}><StaffLeaves /></Suspense></PageTransition>} />
              <Route path="pos" element={<PageTransition><Suspense fallback={<Loading />}><POS /></Suspense></PageTransition>} />
              <Route path="materiel" element={<PageTransition><Suspense fallback={<Loading />}><Materiel /></Suspense></PageTransition>} />
              <Route path="equipment" element={<PageTransition><Suspense fallback={<Loading />}><Equipment /></Suspense></PageTransition>} />
              <Route path="equipment/reservations" element={<PageTransition><Suspense fallback={<Loading />}><EquipmentReservations /></Suspense></PageTransition>} />
              <Route path="equipment/report" element={<PageTransition><Suspense fallback={<Loading />}><EquipmentReport /></Suspense></PageTransition>} />
              <Route path="inventory" element={<PageTransition><Suspense fallback={<Loading />}><Inventory /></Suspense></PageTransition>} />
              <Route path="products" element={<PageTransition><Suspense fallback={<Loading />}><Products /></Suspense></PageTransition>} />
              <Route path="suppliers" element={<PageTransition><Suspense fallback={<Loading />}><Suppliers /></Suspense></PageTransition>} />
              <Route path="purchase-orders" element={<PageTransition><Suspense fallback={<Loading />}><PurchaseOrders /></Suspense></PageTransition>} />
              <Route path="access-control" element={<PageTransition><Suspense fallback={<Loading />}><AccessControl /></Suspense></PageTransition>} />
              <Route path="badges" element={<PageTransition><Suspense fallback={<Loading />}><Badges /></Suspense></PageTransition>} />
              <Route path="member-portal" element={<PageTransition><Suspense fallback={<Loading />}><MemberPortal /></Suspense></PageTransition>} />
              <Route path="coach-mode" element={<PageTransition><Suspense fallback={<Loading />}><CoachMode /></Suspense></PageTransition>} />
              <Route path="coach-portal" element={<PageTransition><Suspense fallback={<Loading />}><CoachPortal /></Suspense></PageTransition>} />
              <Route path="rh" element={<PageTransition><Suspense fallback={<Loading />}><Rh /></Suspense></PageTransition>} />
              <Route path="expenses" element={<PageTransition><Suspense fallback={<Loading />}><Expenses /></Suspense></PageTransition>} />
              <Route path="assistant-comptable" element={<PageTransition><Suspense fallback={<Loading />}><AssistantComptable /></Suspense></PageTransition>} />
              <Route path="reports" element={<PageTransition><Suspense fallback={<Loading />}><Reports /></Suspense></PageTransition>} />
              <Route path="rentabilite" element={<PageTransition><Suspense fallback={<Loading />}><Rentabilite /></Suspense></PageTransition>} />
              <Route path="corporate" element={<PageTransition><Suspense fallback={<Loading />}><Corporate /></Suspense></PageTransition>} />
              <Route path="gyms" element={<PageTransition><Suspense fallback={<Loading />}><Gyms /></Suspense></PageTransition>} />
              <Route path="licenses" element={<PageTransition><Suspense fallback={<Loading />}><Licenses /></Suspense></PageTransition>} />
              <Route path="notifications" element={<PageTransition><Suspense fallback={<Loading />}><Notifications /></Suspense></PageTransition>} />
              <Route path="settings" element={<PageTransition><Suspense fallback={<Loading />}><Settings /></Suspense></PageTransition>} />
              <Route path="profile" element={<PageTransition><Suspense fallback={<Loading />}><Profile /></Suspense></PageTransition>} />
              <Route path="super-admin" element={<PageTransition><Suspense fallback={<Loading />}><SuperAdmin /></Suspense></PageTransition>} />
              <Route path="admin/users" element={<PageTransition><Suspense fallback={<Loading />}><AdminUsers /></Suspense></PageTransition>} />
              <Route path="display" element={<PageTransition><Suspense fallback={<Loading />}><Display /></Suspense></PageTransition>} />
              <Route path="ai-assistant" element={<PageTransition><Suspense fallback={<Loading />}><AiAssistant /></Suspense></PageTransition>} />
              <Route path="install" element={<PageTransition><Suspense fallback={<Loading />}><Install /></Suspense></PageTransition>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </ErrorBoundary>
    </AuthProvider>
  )
}