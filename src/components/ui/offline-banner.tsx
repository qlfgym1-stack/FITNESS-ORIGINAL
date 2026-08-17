import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAuth } from '@/stores/auth'
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'

export function OfflineBanner() {
  const { isOnline, recovering } = useNetworkStatus()
  const { authError, retryAuth, isLoading } = useAuth()

  return (
    <AnimatePresence>
      {authError && !isLoading && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-white text-sm font-medium"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-center">{authError}</span>
          <Button variant="ghost" size="sm" onClick={() => retryAuth()} className="text-white hover:bg-white/20 h-7 gap-1" disabled={isLoading}>
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            Réessayer
          </Button>
        </motion.div>
      )}
      {!isOnline && !authError && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-destructive-foreground text-sm font-medium"
        >
          <WifiOff className="h-4 w-4" />
          <span>You are offline. Showing cached data.</span>
        </motion.div>
      )}
      {recovering && isOnline && !authError && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-success px-4 py-2 text-success-foreground text-sm font-medium"
        >
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Back online — refreshing data...</span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
