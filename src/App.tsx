import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { AuthProvider } from '@/stores/auth'
import { useAuth } from '@/stores/auth'
import { lazy, Suspense } from 'react'

const SignIn = lazy(() => import('@/pages/auth/sign-in'))
const SignUp = lazy(() => import('@/pages/auth/sign-up'))
const Dashboard = lazy(() => import('@/pages/dashboard/dashboard'))
const Members = lazy(() => import('@/pages/members/members'))
const Subscriptions = lazy(() => import('@/pages/subscriptions/subscriptions'))
const Payments = lazy(() => import('@/pages/payments/payments'))
const Classes = lazy(() => import('@/pages/classes/classes'))
const Attendance = lazy(() => import('@/pages/attendance/attendance'))
const Staff = lazy(() => import('@/pages/staff/staff'))
const StaffTimesheet = lazy(() => import('@/pages/staff/timesheet'))
const StaffPlanning = lazy(() => import('@/pages/staff/planning'))
const StaffLeaves = lazy(() => import('@/pages/staff/leaves'))
const POS = lazy(() => import('@/pages/pos/pos'))
const Equipment = lazy(() => import('@/pages/equipment/equipment'))
const EquipmentReservations = lazy(() => import('@/pages/equipment/reservations'))
const EquipmentReport = lazy(() => import('@/pages/equipment/report'))
const Inventory = lazy(() => import('@/pages/inventory/inventory'))
const Stock = lazy(() => import('@/pages/inventory/stock'))
const Suppliers = lazy(() => import('@/pages/suppliers/suppliers'))
const PurchaseOrders = lazy(() => import('@/pages/suppliers/purchase-orders'))
const AccessControl = lazy(() => import('@/pages/access-control/access-control'))
const Badges = lazy(() => import('@/pages/badges/badges'))
const CheckInKiosk = lazy(() => import('@/pages/check-in-kiosk/kiosk'))
const MemberPortal = lazy(() => import('@/pages/member-portal/portal'))
const CoachMode = lazy(() => import('@/pages/coach-mode/coach-mode'))
const Reports = lazy(() => import('@/pages/reports/reports'))
const Corporate = lazy(() => import('@/pages/corporate/corporate'))
const Gyms = lazy(() => import('@/pages/gyms/gyms'))
const Licenses = lazy(() => import('@/pages/licenses/licenses'))
const Notifications = lazy(() => import('@/pages/notifications/notifications'))
const Settings = lazy(() => import('@/pages/settings/settings'))
const Profile = lazy(() => import('@/pages/settings/profile'))
const SuperAdmin = lazy(() => import('@/pages/super-admin/super-admin'))
const Display = lazy(() => import('@/pages/display/display'))
const Install = lazy(() => import('@/pages/install/install'))

function Loading() {
  return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Loading />
  if (!isAuthenticated) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function PublicRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return <Loading />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/auth" element={<SignIn />} />
        <Route path="/auth/sign-up" element={<SignUp />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/auth/*" element={<PublicRoute />} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<Loading />}><Dashboard /></Suspense>} />
            <Route path="members" element={<Suspense fallback={<Loading />}><Members /></Suspense>} />
            <Route path="subscriptions" element={<Suspense fallback={<Loading />}><Subscriptions /></Suspense>} />
            <Route path="payments" element={<Suspense fallback={<Loading />}><Payments /></Suspense>} />
            <Route path="classes" element={<Suspense fallback={<Loading />}><Classes /></Suspense>} />
            <Route path="attendance" element={<Suspense fallback={<Loading />}><Attendance /></Suspense>} />
            <Route path="staff" element={<Suspense fallback={<Loading />}><Staff /></Suspense>} />
            <Route path="staff/timesheet" element={<Suspense fallback={<Loading />}><StaffTimesheet /></Suspense>} />
            <Route path="staff/planning" element={<Suspense fallback={<Loading />}><StaffPlanning /></Suspense>} />
            <Route path="staff/leaves" element={<Suspense fallback={<Loading />}><StaffLeaves /></Suspense>} />
            <Route path="pos" element={<Suspense fallback={<Loading />}><POS /></Suspense>} />
            <Route path="equipment" element={<Suspense fallback={<Loading />}><Equipment /></Suspense>} />
            <Route path="equipment/reservations" element={<Suspense fallback={<Loading />}><EquipmentReservations /></Suspense>} />
            <Route path="equipment/report" element={<Suspense fallback={<Loading />}><EquipmentReport /></Suspense>} />
            <Route path="inventory" element={<Suspense fallback={<Loading />}><Inventory /></Suspense>} />
            <Route path="stock" element={<Suspense fallback={<Loading />}><Stock /></Suspense>} />
            <Route path="suppliers" element={<Suspense fallback={<Loading />}><Suppliers /></Suspense>} />
            <Route path="purchase-orders" element={<Suspense fallback={<Loading />}><PurchaseOrders /></Suspense>} />
            <Route path="access-control" element={<Suspense fallback={<Loading />}><AccessControl /></Suspense>} />
            <Route path="badges" element={<Suspense fallback={<Loading />}><Badges /></Suspense>} />
            <Route path="check-in-kiosk" element={<Suspense fallback={<Loading />}><CheckInKiosk /></Suspense>} />
            <Route path="member-portal" element={<Suspense fallback={<Loading />}><MemberPortal /></Suspense>} />
            <Route path="coach-mode" element={<Suspense fallback={<Loading />}><CoachMode /></Suspense>} />
            <Route path="reports" element={<Suspense fallback={<Loading />}><Reports /></Suspense>} />
            <Route path="corporate" element={<Suspense fallback={<Loading />}><Corporate /></Suspense>} />
            <Route path="gyms" element={<Suspense fallback={<Loading />}><Gyms /></Suspense>} />
            <Route path="licenses" element={<Suspense fallback={<Loading />}><Licenses /></Suspense>} />
            <Route path="notifications" element={<Suspense fallback={<Loading />}><Notifications /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<Loading />}><Settings /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<Loading />}><Profile /></Suspense>} />
            <Route path="super-admin" element={<Suspense fallback={<Loading />}><SuperAdmin /></Suspense>} />
            <Route path="display" element={<Suspense fallback={<Loading />}><Display /></Suspense>} />
            <Route path="install" element={<Suspense fallback={<Loading />}><Install /></Suspense>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}
