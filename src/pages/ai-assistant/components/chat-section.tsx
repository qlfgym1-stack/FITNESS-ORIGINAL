import { useRef, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAiChat } from "@/stores/ai-chat"
import { Bot, User, Loader2, Send, AlertTriangle, Sparkles } from "lucide-react"
import type { AssistantData } from "../hooks/types"

interface ChatSectionProps {
  data: AssistantData
  t: (key: string) => string
  embedded?: boolean
}

export function buildContext(data: AssistantData, t: (key: string) => string): string {
  const lines: string[] = []
  lines.push(`Période analysée — Chiffre d'affaires total: ${Math.round(data.totalRevenue)} DA`)
  lines.push(`Ventes au comptoir: ${Math.round(data.posRevenue)} DA · Revenus abonnements inclus`)
  lines.push(`Dépenses totales: ${Math.round(data.totalExpenses)} DA · Bénéfice net: ${Math.round(data.netProfit)} DA`)

  const forecast = data.revenueForecast.next3Months.map((p) => `${p.label}: ${Math.round(p.value)} DA`).join(", ")
  lines.push(`Prévision CA 3 mois (confiance ${data.revenueForecast.confidence}%, tendance ${data.revenueForecast.trend}): ${forecast || "non disponible"}`)

  if (data.peakHours.peakHours.length) {
    lines.push(`Heures pleines: ${data.peakHours.peakHours.join("h, ")}h`)
  }
  if (data.peakHours.offPeakHours.length) {
    lines.push(`Heures creuses: ${data.peakHours.offPeakHours.join("h, ")}h`)
  }

  if (data.flagship.flagship) {
    const f = data.flagship.flagship
    lines.push(`Produit phare: ${f.name} (CA ${Math.round(f.revenue)} DA, marge ${f.marginPct}%)`)
  }
  if (data.flagship.fastMovers.length) {
    lines.push(`Réassort urgent: ${data.flagship.fastMovers.map((p) => p.name).join(", ")}`)
  }
  if (data.flagship.deadStock.length) {
    lines.push(`Stock dormant: ${data.flagship.deadStock.map((p) => p.name).join(", ")}`)
  }

  if (data.subscription.bestType) {
    lines.push(`Meilleur abonnement: ${data.subscription.bestType.name} (${data.subscription.bestType.count} souscriptions)`)
  }
  lines.push(`Abonnements actifs: ${data.subscription.activeCount}`)
  if (data.subscription.expiring30.length) {
    lines.push(`Expirations sous 30 jours: ${data.subscription.expiring30.map((s) => `${s.memberName} (${s.endDate})`).join(", ")}`)
  }

  if (data.actions.length) {
    lines.push(`Actions recommandées (${data.actions.length}):`)
    data.actions.forEach((a, i) => lines.push(`${i + 1}. [${a.priority.toUpperCase()}] ${t(a.titleKey)} — ${t(a.detailKey)}`))
  }

  if (data.insights.length) {
    lines.push(`Analyse clés:`)
    data.insights.forEach((ins) => lines.push(`- ${t(ins.messageKey)}`))
  }

  return lines.join("\n")
}

export function ChatSection({ data, t, embedded }: ChatSectionProps) {
  const { messages, loading, error, send, input, setInput } = useAiChat()
  const endRef = useRef<HTMLDivElement>(null)
  const context = buildContext(data, t)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  const submit = async () => {
    const question = input.trim()
    if (!question || loading) return
    setInput("")
    await send(question, context)
  }

  const body = (
    <>
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1 mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && <Bot className="h-5 w-5 mt-1 shrink-0 text-primary" />}
            <div
              className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap max-w-[85%] ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {m.content}
            </div>
            {m.role === "user" && <User className="h-5 w-5 mt-1 shrink-0 text-muted-foreground" />}
          </div>
        ))}
        {loading && (
          <div className="flex items-start gap-2">
            <Bot className="h-5 w-5 mt-1 shrink-0 text-primary" />
            <div className="rounded-lg px-3 py-2 text-sm bg-muted text-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("aiAssistant.chatThinking")}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 mb-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("aiAssistant.chatPlaceholder")}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <Button type="submit" size="icon" disabled={!input.trim() || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </>
  )

  if (embedded) {
    return (
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {body}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          {t("aiAssistant.chatTitle")}
        </CardTitle>
        <CardDescription>{t("aiAssistant.chatSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
