import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { WifiOff, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export function OfflineBanner() {
  const { isOnline, recovering } = useNetworkStatus()

  return (
    <AnimatePresence>
      {!isOnline && (
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
      {recovering && isOnline && (
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
