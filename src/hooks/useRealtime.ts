import { useEffect, useRef } from "react"
import { useSupabase } from "@/hooks/useSupabase"
import { useQueryClient } from "@/hooks/useQuery"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface UseRealtimeOptions {
  table: string
  queryKey: string[]
  filter?: string
  event?: "*" | "INSERT" | "UPDATE" | "DELETE"
}

export function useRealtime({ table, queryKey, filter, event = "*" }: UseRealtimeOptions) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { isOnline } = useNetworkStatus()
  const queryKeyRef = useRef(queryKey)
  queryKeyRef.current = queryKey

  useEffect(() => {
    if (!isOnline) return

    const channel: RealtimeChannel = supabase
      .channel(`realtime-${table}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table, filter },
        () => {
          queryClient.invalidateQueries({ queryKey: queryKeyRef.current })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, event, filter, isOnline, queryClient, supabase])

  return null
}
