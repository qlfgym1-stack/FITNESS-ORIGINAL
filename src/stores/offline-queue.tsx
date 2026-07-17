import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"

const STORAGE_KEY = "FITMANAGER_OFFLINE_QUEUE"

function loadQueue(): QueuedMutation[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")
  } catch {
    return []
  }
}

interface QueuedMutation {
  id: string
  operation: string
  table: string
  payload: Record<string, unknown>
  timestamp: number
}

interface OfflineQueueContextType {
  queue: QueuedMutation[]
  addToQueue: (mutation: Omit<QueuedMutation, "id" | "timestamp">) => void
  removeFromQueue: (id: string) => void
  clearQueue: () => void
  isProcessing: boolean
  setIsProcessing: (v: boolean) => void
}

const OfflineQueueContext = createContext<OfflineQueueContextType | undefined>(undefined)

export function OfflineQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueuedMutation[]>(loadQueue)
  const [isProcessing, setIsProcessing] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  }, [queue])

  const addToQueue = useCallback((mutation: Omit<QueuedMutation, "id" | "timestamp">) => {
    setQueue((prev) => [
      ...prev,
      {
        ...mutation,
        id: `oq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      },
    ])
  }, [])

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const clearQueue = useCallback(() => {
    setQueue([])
  }, [])

  const ctxValue = useMemo(
    () => ({ queue, addToQueue, removeFromQueue, clearQueue, isProcessing, setIsProcessing }),
    [queue, addToQueue, removeFromQueue, clearQueue, isProcessing]
  )

  return (
    <OfflineQueueContext.Provider value={ctxValue}>
      {children}
    </OfflineQueueContext.Provider>
  )
}

export function useOfflineQueue(): OfflineQueueContextType {
  const ctx = useContext(OfflineQueueContext)
  if (!ctx) throw new Error("useOfflineQueue must be used within OfflineQueueProvider")
  return ctx
}
