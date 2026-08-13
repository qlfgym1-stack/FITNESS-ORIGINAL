import { useQuery } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { IS_MOCK } from "@/lib/config"

function humanizeNotifKey(key: string): string {
  switch (key) {
    case "days_left": return "Jours restants"
    case "member_id": return "Membre"
    case "member_subscription_id": return "Abonnement"
    default:
      return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  }
}

export function NotificationDetails({ data }: { data: unknown }) {
  const supabase = useSupabase()
  const memberId = data && typeof data === "object" ? (data as Record<string, unknown>).member_id : null
  const subId = data && typeof data === "object" ? (data as Record<string, unknown>).member_subscription_id : null

  const { data: member } = useQuery({
    queryKey: ["notif-member-name", String(memberId ?? "")],
    queryFn: async () => {
      if (!memberId) return null
      const { data: row, error } = await supabase
        .from("members")
        .select("first_name, last_name")
        .eq("id", String(memberId))
        .maybeSingle()
      if (error) throw error
      return (row as { first_name: string; last_name: string } | null) ?? null
    },
    enabled: !!memberId && !IS_MOCK,
  })

  const { data: sub } = useQuery({
    queryKey: ["notif-sub-name", String(subId ?? "")],
    queryFn: async () => {
      if (!subId) return null
      const { data: row, error } = await supabase
        .from("member_subscriptions")
        .select("subscription_types(name)")
        .eq("id", String(subId))
        .maybeSingle()
      if (error) throw error
      return (row as { subscription_types: { name: string } | null } | null) ?? null
    },
    enabled: !!subId && !IS_MOCK,
  })

  if (!data || typeof data !== "object") return null
  const entries = Object.entries(data as Record<string, unknown>)
  if (entries.length === 0) return null

  const memberName = member ? `${member.first_name} ${member.last_name}`.trim() : null
  const subName = sub?.subscription_types?.name ?? null

  return (
    <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
      {entries.map(([k, v]) => {
        let display: React.ReactNode = String(v)
        if (k === "member_id" && memberName) display = memberName
        if (k === "member_subscription_id" && subName) display = subName
        return (
          <div key={k} className="flex items-start justify-between gap-3">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0">
              {humanizeNotifKey(k)}
            </span>
            <span className="text-xs font-medium text-foreground break-all text-right">{display}</span>
          </div>
        )
      })}
    </div>
  )
}
