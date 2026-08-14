export type WaTemplateKey = "renewal" | "expired" | "birthday" | "welcome" | "receipt" | "attendance"

export const WA_TEMPLATE_KEYS: WaTemplateKey[] = [
  "renewal",
  "expired",
  "birthday",
  "welcome",
  "receipt",
  "attendance",
]

export const DEFAULT_TEMPLATES: Record<WaTemplateKey, string> = {
  renewal: "Bonjour {NOM}, votre abonnement expirera le {DATE} à {NOM_SALLE}. Pensez à le renouveler !",
  expired: "Bonjour {NOM}, votre abonnement est expiré depuis le {DATE}. Rejoignez-nous vite à {NOM_SALLE} !",
  birthday: "Joyeux anniversaire {NOM} ! Toute l'équipe de {NOM_SALLE} vous souhaite une excellente journée 🎂",
  welcome: "Bienvenue {NOM} à {NOM_SALLE} ! Nous sommes ravis de vous accueillir.",
  receipt: "Bonjour {NOM}, nous avons bien reçu votre paiement à {NOM_SALLE}. Merci pour votre confiance !",
  attendance: "Bonjour {NOM}, merci pour votre visite à {NOM_SALLE} aujourd'hui. À très bientôt !",
}

export function formatPhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "")
}

export function getTemplate(template: string, data: Record<string, string | number>): string {
  return Object.entries(data).reduce(
    (msg, [key, value]) => msg.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  )
}

export function sendWhatsApp(phone: string, message: string): void {
  const digits = formatPhone(phone)
  if (!digits) return
  const text = encodeURIComponent(message)
  const webUrl = `https://wa.me/${digits}?text=${text}`
  const desktopUrl = `whatsapp://send?phone=${digits}&text=${text}`

  const isDesktop = typeof navigator !== "undefined" && /Win|Mac|Linux/i.test(navigator.platform)

  if (isDesktop) {
    window.open(desktopUrl, "_blank")
    setTimeout(() => window.open(webUrl, "_blank"), 800)
  } else {
    window.open(webUrl, "_blank")
  }
}

/** Choisit le modèle WhatsApp selon le statut d'abonnement du membre. */
export function templateForStatus(status: string | null | undefined): WaTemplateKey {
  if (status === "expired" || status === "cancelled") return "expired"
  return "renewal"
}

/** Couleur d'icône WhatsApp selon le statut d'abonnement. */
export function toneForStatus(status: string | null | undefined): "green" | "amber" | "red" {
  if (status === "expired" || status === "cancelled") return "red"
  if (status === "pending_payment") return "amber"
  return "green"
}
