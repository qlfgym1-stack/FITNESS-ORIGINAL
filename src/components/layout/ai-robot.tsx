import { useState, useEffect, useRef } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { useAiChat } from "@/stores/ai-chat"
import { useNetworkStatus } from "@/hooks/useNetworkStatus"
import { ChatSection } from "@/pages/ai-assistant/components/chat-section"
import { useAssistantData } from "@/pages/ai-assistant/hooks/useAssistantData"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { X, Maximize2 } from "lucide-react"

const ROBOT_SIZE = 56
const DRAG_THRESHOLD = 5
const STORAGE_KEY = "fitmanager-ai-robot-pos"

interface RobotPos {
  x: number
  y: number
}

function clampPos(p: RobotPos): RobotPos {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    x: Math.min(Math.max(0, p.x), Math.max(0, vw - ROBOT_SIZE)),
    y: Math.min(Math.max(0, p.y), Math.max(0, vh - ROBOT_SIZE)),
  }
}

function defaultPos(): RobotPos {
  return {
    x: Math.max(0, window.innerWidth - ROBOT_SIZE - 24),
    y: Math.max(0, window.innerHeight - ROBOT_SIZE - 24),
  }
}

function loadPos(): RobotPos {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as RobotPos
      if (typeof p?.x === "number" && typeof p?.y === "number") return clampPos(p)
    }
  } catch {
    /* localStorage indisponible : position par défaut */
  }
  return defaultPos()
}

export function AiFloatingRobot() {
  const t = useT()
  const { isAuthenticated } = useAuth()
  const { isOnline } = useNetworkStatus()
  const { loading, responding } = useAiChat()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<RobotPos>(loadPos)
  const [blinking, setBlinking] = useState(false)
  const [dragging, setDragging] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0, moved: false })
  const latestPos = useRef<RobotPos>({ x: 0, y: 0 })
  const fromPointer = useRef(false)
  const gazeTarget = useRef({ x: 0, y: 0 })
  const gazeRaf = useRef<number | null>(null)
  const gazeReturnTimer = useRef<number | null>(null)
  const canHover = useRef(false)
  const location = useLocation()
  const navigate = useNavigate()

  const currentModule = location.pathname.split("/")[1] || "dashboard"

  // Ferme le panneau lors d'un changement de module (le robot reste visible)
  useEffect(() => {
    setOpen(false)
  }, [currentModule])

  // Détection souris fine (désactivée sur mobile / tactile)
  useEffect(() => {
    canHover.current = window.matchMedia?.("(hover: hover) and (pointer: fine)")?.matches ?? false
  }, [])

  // Recalcule la position si la fenêtre change (le robot ne sort jamais de l'écran)
  useEffect(() => {
    const onResize = () => setPos((p) => clampPos(p))
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  // Suivi du regard : pointermove + rAF, aucune requête, seule le transform des yeux change
  useEffect(() => {
    if (!canHover.current) return

    const applyGaze = () => {
      const el = buttonRef.current
      if (el) {
        el.style.setProperty("--eye-x", gazeTarget.current.x.toFixed(2))
        el.style.setProperty("--eye-y", gazeTarget.current.y.toFixed(2))
      }
      gazeRaf.current = null
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!canHover.current) return
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      gazeTarget.current = { x: nx * 16, y: ny * 12 }
      if (gazeReturnTimer.current) {
        window.clearTimeout(gazeReturnTimer.current)
        gazeReturnTimer.current = null
      }
      buttonRef.current?.classList.remove("gaze-return")
      if (gazeRaf.current == null) gazeRaf.current = requestAnimationFrame(applyGaze)
    }

    const onLeave = () => {
      if (!canHover.current) return
      buttonRef.current?.classList.add("gaze-return")
      gazeTarget.current = { x: 0, y: 0 }
      applyGaze()
      if (gazeReturnTimer.current) window.clearTimeout(gazeReturnTimer.current)
      gazeReturnTimer.current = window.setTimeout(() => {
        buttonRef.current?.classList.remove("gaze-return")
      }, 400)
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    document.documentElement.addEventListener("mouseleave", onLeave)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      document.documentElement.removeEventListener("mouseleave", onLeave)
      if (gazeRaf.current != null) cancelAnimationFrame(gazeRaf.current)
      if (gazeReturnTimer.current) window.clearTimeout(gazeReturnTimer.current)
    }
  }, [])

  // Clignement naturel : intervalle aléatoire 3-7s, durée 120-220ms
  useEffect(() => {
    let blinkTimer: number | undefined
    let closeTimer: number | undefined

    const schedule = () => {
      blinkTimer = window.setTimeout(() => {
        setBlinking(true)
        closeTimer = window.setTimeout(() => {
          setBlinking(false)
          schedule()
        }, 120 + Math.random() * 100)
      }, 3000 + Math.random() * 4000)
    }

    schedule()
    return () => {
      if (blinkTimer) window.clearTimeout(blinkTimer)
      if (closeTimer) window.clearTimeout(closeTimer)
    }
  }, [])

  // Applique le clignement via variable CSS (sans casser le suivi du regard)
  useEffect(() => {
    const el = buttonRef.current
    if (el) el.style.setProperty("--eye-blink", blinking ? "0.1" : "1")
  }, [blinking])

  if (!isAuthenticated) return null

  const orbState: "idle" | "thinking" | "responding" | "offline" = !isOnline
    ? "offline"
    : loading
      ? "thinking"
      : responding
        ? "responding"
        : "idle"

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    fromPointer.current = true
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD) d.moved = true
    if (d.moved) {
      const next = clampPos({ x: d.startPosX + e.clientX - d.startX, y: d.startPosY + e.clientY - d.startY })
      latestPos.current = next
      setDragging(true)
      setPos(next)
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (d.moved) {
      const final = clampPos({ x: d.startPosX + e.clientX - d.startX, y: d.startPosY + e.clientY - d.startY })
      latestPos.current = final
      setPos(final)
      setOpen(false)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(final))
      } catch {
        /* ignore */
      }
    } else {
      setOpen((v) => !v)
    }
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const onPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (d.moved) {
      setOpen(false)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(latestPos.current))
      } catch {
        /* ignore */
      }
    }
    setDragging(false)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }

  const onClick = () => {
    if (fromPointer.current) {
      fromPointer.current = false
      return
    }
    setOpen((v) => !v)
  }

  const stateClass =
    orbState === "offline" ? " is-offline" : orbState === "thinking" ? " is-thinking" : orbState === "responding" ? " is-responding" : ""

  return (
    <>
      {open && <AiFloatingPanel onClose={() => setOpen(false)} onExpand={() => navigate("/ai-assistant")} />}

      <button
        ref={buttonRef}
        type="button"
        className={`fitmanager-ai-floating-button${stateClass}${dragging ? " is-dragging" : ""}`}
        style={{ left: pos.x, top: pos.y }}
        aria-label={t("aiAssistant.openAssistant")}
        title={t("aiAssistant.openAssistant")}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <AiRobotSvg state={orbState} />
      </button>
    </>
  )
}

// Le panneau (lourd : 9 requêtes) n'est monté que lorsqu'il est ouvert.
function AiFloatingPanel({ onClose, onExpand }: { onClose: () => void; onExpand: () => void }) {
  const t = useT()
  const { organization } = useAuth()
  const { isOnline } = useNetworkStatus()
  const { loading } = useAiChat()
  const { data, isLoading } = useLazyAssistantData()

  const orbState: "idle" | "thinking" | "responding" | "offline" = !isOnline
    ? "offline"
    : loading
      ? "thinking"
      : "idle"

  return (
    <div className="fitmanager-ai-panel">
      <Card className="fitmanager-ai-panel__card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="fitmanager-ai-panel__orb-mini">
              <AiRobotSvg state={orbState} small />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">{t("aiAssistant.chatTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("aiAssistant.chatSubtitle")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("aiAssistant.title")} onClick={onExpand}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" title={t("common.close")} onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {isLoading || !organization ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            {t("common.loading") || "Chargement du contexte..."}
          </div>
        ) : (
          <ChatSection data={data} t={t} embedded />
        )}
      </Card>
    </div>
  )
}

// Les données assistant (9 queries) ne sont chargées que pour ce panneau.
function useLazyAssistantData() {
  const { organization } = useAuth()
  const orgId = organization?.id
  const [filters] = useState(() => {
    const today = new Date()
    const past = new Date()
    past.setDate(past.getDate() - 30)
    return {
      period: "monthly" as const,
      dateFrom: past.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
    }
  })
  const data = useAssistantData(orgId, filters)
  return { data, isLoading: data.isLoading }
}

// ===== Robot premium : tête arrondie, visière, yeux lumineux, corps, noyau =====
// SVG + CSS natifs, aucun `defs` dupliqué (les ids sont uniques par instance).
function AiRobotSvg({ state, small }: { state: "idle" | "thinking" | "responding" | "offline"; small?: boolean }) {
  const uid = small ? "fitm-ai-s" : "fitm-ai"
  const offline = state === "offline"
  const thinking = state === "thinking"
  const responding = state === "responding"
  return (
    <svg
      className="fitmanager-ai-robot"
      viewBox="0 0 120 132"
      width="120"
      height="132"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${uid}-head`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4b5a7a" />
          <stop offset="45%" stopColor="#232e4d" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>
        <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#334063" />
          <stop offset="100%" stopColor="#0a1120" />
        </linearGradient>
        <radialGradient id={`${uid}-core`} cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="45%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </radialGradient>
        <radialGradient id={`${uid}-eyeGlow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#bae6fd" />
          <stop offset="60%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g className={offline ? "fitmanager-ai-robot--offline" : ""}>
        {/* Antenne */}
        <line x1="60" y1="18" x2="60" y2="9" stroke="#64748b" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="8" r="2.5" fill={thinking || responding ? "#60a5fa" : "#94a3b8"} className="fitmanager-ai-robot__antenna" />

        {/* Tête arrondie */}
        <rect x="27" y="16" width="66" height="56" rx="26" fill={`url(#${uid}-head)`} stroke="rgba(96,165,250,0.55)" strokeWidth="1.5" />

        {/* Ailerons latéraux */}
        <rect x="20" y="34" width="7" height="18" rx="3.5" fill="rgba(37,99,235,0.4)" stroke="rgba(96,165,250,0.35)" strokeWidth="1" />
        <rect x="93" y="34" width="7" height="18" rx="3.5" fill="rgba(37,99,235,0.4)" stroke="rgba(96,165,250,0.35)" strokeWidth="1" />

        {/* Micro-détails de tête */}
        <circle cx="31" cy="26" r="1.4" fill="rgba(148,163,184,0.7)" />
        <circle cx="89" cy="26" r="1.4" fill="rgba(148,163,184,0.7)" />
        <rect x="57.5" y="19" width="5" height="3" rx="1.5" fill="rgba(96,165,250,0.5)" />

        {/* Visière */}
        <rect x="34" y="33" width="52" height="24" rx="12" fill="rgba(2,8,23,0.55)" stroke="rgba(147,197,253,0.35)" strokeWidth="1.2" />
        <rect x="34" y="33" width="52" height="12" rx="6" fill="rgba(96,165,250,0.08)" />

        {/* Yeux lumineux : suivent le curseur via --eye-x/--eye-y, clignent via --eye-blink */}
        <g className="fitmanager-ai-eyes">
          <circle cx="49" cy="45" r="9" fill={`url(#${uid}-eyeGlow)`} className="fitmanager-ai-robot__eye-glow" />
          <circle cx="71" cy="45" r="9" fill={`url(#${uid}-eyeGlow)`} className="fitmanager-ai-robot__eye-glow" />
          <circle cx="49" cy="45" r="3.2" fill="#dbeafe" className="fitmanager-ai-robot__eye" />
          <circle cx="71" cy="45" r="3.2" fill="#dbeafe" className="fitmanager-ai-robot__eye" />
          <circle cx="50.2" cy="43.9" r="1" fill="#ffffff" className="fitmanager-ai-robot__eye-hl" />
          <circle cx="72.2" cy="43.9" r="1" fill="#ffffff" className="fitmanager-ai-robot__eye-hl" />
        </g>

        {/* Cou */}
        <rect x="53" y="72" width="14" height="10" rx="4" fill="#0a1120" stroke="rgba(96,165,250,0.25)" strokeWidth="1" />

        {/* Corps */}
        <rect x="33" y="80" width="54" height="38" rx="17" fill={`url(#${uid}-body)`} stroke="rgba(96,165,250,0.45)" strokeWidth="1.5" />

        {/* Panneau poitrine */}
        <rect x="42" y="87" width="36" height="24" rx="9" fill="rgba(37,99,235,0.14)" stroke="rgba(96,165,250,0.3)" strokeWidth="1" />

        {/* Noyau central lumineux */}
        <circle cx="60" cy="99" r="8.5" fill="rgba(96,165,250,0.25)" className="fitmanager-ai-robot__core-halo" />
        <circle cx="60" cy="99" r="5.5" fill={`url(#${uid}-core)`} className="fitmanager-ai-robot__core" />

        {/* Micro-détails de corps */}
        <circle cx="38" cy="84" r="1.2" fill="rgba(148,163,184,0.6)" />
        <circle cx="82" cy="84" r="1.2" fill="rgba(148,163,184,0.6)" />
        <rect x="38" y="111" width="8" height="2.5" rx="1.25" fill="rgba(96,165,250,0.4)" />
        <rect x="74" y="111" width="8" height="2.5" rx="1.25" fill="rgba(96,165,250,0.4)" />
      </g>
    </svg>
  )
}
