import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface AiChatContextValue {
  messages: ChatMessage[]
  loading: boolean
  responding: boolean
  error: string | null
  send: (question: string, context: string) => Promise<void>
  reset: () => void
}

const AiChatContext = createContext<AiChatContextValue | null>(null)

// Store UNIQUE du chat : partagé entre le module /ai-assistant et le robot
// flottant. Une question posée depuis le robot est visible dans le module et
// inversement (règle : un seul assistant, une seule session, un seul historique).
export function AiChatProvider({ children }: { children: ReactNode }) {
  const t = useT()
  const db = useSupabase()
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: t("aiAssistant.chatWelcome") },
  ])
  const [loading, setLoading] = useState(false)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const respondTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (respondTimer.current) window.clearTimeout(respondTimer.current)
    }
  }, [])

  const send = useCallback(async (question: string, context: string) => {
    const trimmed = question.trim()
    if (!trimmed) return
    setError(null)
    setMessages((prev) => [...prev, { role: "user", content: trimmed }])
    setLoading(true)
    try {
      const { data: res, error: invokeError } = await db.functions.invoke<{ content: string }>("ai-chat", {
        body: {
          messages: [{ role: "user", content: trimmed }],
          context,
        },
      })
      if (invokeError) throw invokeError
      if (!res?.content) throw new Error("Réponse vide de l'assistant")
      setMessages((prev) => [...prev, { role: "assistant", content: res.content }])
      setResponding(true)
      if (respondTimer.current) window.clearTimeout(respondTimer.current)
      respondTimer.current = window.setTimeout(() => setResponding(false), 900)
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'appel à l'assistant")
      setMessages((prev) => prev.slice(0, -1))
      setResponding(false)
    } finally {
      setLoading(false)
    }
  }, [db])

  const reset = useCallback(() => {
    setMessages([{ role: "assistant", content: t("aiAssistant.chatWelcome") }])
    setError(null)
    setLoading(false)
    setResponding(false)
  }, [t])

  const value = useMemo<AiChatContextValue>(
    () => ({ messages, loading, responding, error, send, reset }),
    [messages, loading, responding, error, send, reset]
  )

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>
}

export function useAiChat(): AiChatContextValue {
  const ctx = useContext(AiChatContext)
  if (!ctx) throw new Error("useAiChat must be used within AiChatProvider")
  return ctx
}
