import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSupabase } from '@/hooks/useSupabase'
import { useAuth } from '@/stores/auth'
import { useT } from '@/i18n'
import { useToast } from '@/components/ui/toast'
import { PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { runFullDiagnostic, generateReport, generateCopyText, type DiagnosticResult, type DiagnosticStatus } from '@/lib/diagnostic'
import { Activity, Shield, Wifi, Database, HardDrive, Cpu, Globe, RefreshCw, Copy, CheckCircle, AlertTriangle, XCircle, Loader2, Zap, LogIn } from 'lucide-react'

const STATUS_COLORS: Record<DiagnosticStatus, string> = {
  ok: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  error: 'bg-destructive/10 text-destructive border-destructive/30',
  unknown: 'bg-muted text-muted-foreground border-border',
}

const STATUS_ICONS: Record<DiagnosticStatus, React.ReactNode> = {
  ok: <CheckCircle className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  error: <XCircle className="h-4 w-4" />,
  unknown: <Activity className="h-4 w-4" />,
}

const ZONE_ICONS: Record<string, React.ReactNode> = {
  ENVIRONMENT: <Globe className="h-4 w-4" />,
  NETWORK: <Wifi className="h-4 w-4" />,
  AUTH: <Shield className="h-4 w-4" />,
  SUPABASE: <Database className="h-4 w-4" />,
  STORAGE: <HardDrive className="h-4 w-4" />,
  CACHE: <Cpu className="h-4 w-4" />,
  JAVASCRIPT: <Zap className="h-4 w-4" />,
  SYNC: <RefreshCw className="h-4 w-4" />,
  MODULES: <Activity className="h-4 w-4" />,
}

function ZoneCard({ zone }: { zone: { label: string; status: DiagnosticStatus; detail: string } }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border p-3 ${STATUS_COLORS[zone.status]}`}>
      <div className="shrink-0">{STATUS_ICONS[zone.status]}</div>
      <div className="shrink-0">{ZONE_ICONS[zone.label] || <Activity className="h-4 w-4" />}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{zone.label}</p>
        <p className="text-[11px] opacity-80 truncate">{zone.detail}</p>
      </div>
    </div>
  )
}

function CauseCard({ cause, status }: { cause: string; status: DiagnosticStatus }) {
  const causeLabels: Record<string, string> = {
    ALL_OK: 'Tous les systèmes fonctionnent normalement',
    NETWORK_ISSUE: 'Problème de connexion réseau détecté',
    AUTH_ISSUE: "Problème d'authentification ou de session",
    SESSION_EXPIRED: 'Session expirée — reconnexion requise',
    SUPABASE_ISSUE: 'Problème de connexion à la base de données',
    SUPABASE_PERMISSION_ISSUE: 'Restriction de permissions (RLS)',
    FRONTEND_JS_ERROR: 'Erreurs JavaScript détectées dans le frontend',
    CACHE_STALE: 'Cache obsolète détecté — mise à jour recommandée',
    SYNC_ISSUE: 'Problème de synchronisation offline',
    STORAGE_ISSUE: 'Problème de stockage local',
    ENVIRONMENT_ISSUE: 'Problème lié à l\'environnement ou au navigateur',
  }

  return (
    <div className={`rounded-lg border p-4 ${STATUS_COLORS[status]}`}>
      <p className="text-xs font-semibold mb-1">CAUSE PROBABLE</p>
      <p className="text-sm font-bold">{causeLabels[cause] || cause}</p>
    </div>
  )
}

export default function Diagnostics() {
  const t = useT()
  const { toast } = useToast()
  const navigate = useNavigate()
  const supabase = useSupabase()
  const { user, isAuthenticated, isLoading, roles, authError } = useAuth()

  const [result, setResult] = useState<DiagnosticResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [description, setDescription] = useState('')
  const [copied, setCopied] = useState(false)

  const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || ''

  const isSessionIssue = result?.cause === 'SESSION_EXPIRED' || result?.cause === 'AUTH_ISSUE'

  const runDiag = useCallback(async () => {
    setIsRunning(true)
    setResult(null)
    try {
      const res = await runFullDiagnostic({
        supabaseUrl,
        supabase: supabase as any,
        authState: { isAuthenticated, isLoading, user: user ? { id: user.id } : null, roles, authError },
        isOnline: navigator.onLine,
      })
      setResult(res)
    } catch (err) {
      toast({ title: 'Diagnostic failed', variant: 'destructive' })
    } finally {
      setIsRunning(false)
    }
  }, [supabase, supabaseUrl, isAuthenticated, isLoading, user, roles, authError, toast])

  const handleRepair = useCallback(async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        for (const reg of regs) await reg.unregister()
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        for (const key of keys) await caches.delete(key)
      }
      const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('FITMANAGER_QUERY_CACHE') || k.startsWith('fitmanager-version-check'))
      cacheKeys.forEach(k => localStorage.removeItem(k))

      if (isSessionIssue) {
        await supabase.auth.signOut()
        toast({ title: 'Session détruite — reconnexion requise', variant: 'success' })
        setTimeout(() => navigate('/sign-in', { replace: true }), 800)
        return
      }

      toast({ title: 'Réparation effectuée — rechargement...', variant: 'success' })
      setTimeout(() => window.location.reload(), 1000)
    } catch {
      toast({ title: 'Erreur lors de la réparation', variant: 'destructive' })
    }
  }, [toast, isSessionIssue, supabase, navigate])

  const handleCopy = useCallback(async () => {
    if (!result) return
    const text = generateCopyText(result, description)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({ title: 'Copié dans le presse-papiers', variant: 'success' })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      toast({ title: 'Copié dans le presse-papiers', variant: 'success' })
      setTimeout(() => setCopied(false), 2000)
    }
  }, [result, description, toast])

  const zones = result ? [
    result.environment,
    result.network,
    result.auth,
    result.supabase,
    result.storage,
    result.cache,
    result.javascript,
    result.sync,
    result.modules,
  ] : []

  const overallStatus: DiagnosticStatus = !result ? 'unknown' :
    zones.some(z => z.status === 'error') ? 'error' :
    zones.some(z => z.status === 'warning') ? 'warning' : 'ok'

  return (
    <div className="space-y-6">
      <PageHeader title={t('diagnostics.title')} description={t('diagnostics.subtitle')} />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">{t('diagnostics.globalDiagnostic')}</h3>
              <p className="text-xs text-muted-foreground">{t('diagnostics.globalDiagnosticDesc')}</p>
            </div>
            <Button onClick={runDiag} disabled={isRunning}>
              {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
              {isRunning ? t('diagnostics.running') : t('diagnostics.runDiagnostic')}
            </Button>
          </div>

          {result && (
            <>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xs font-mono font-bold text-primary">{result.diagId}</span>
                <Badge className={STATUS_COLORS[overallStatus]}>
                  {overallStatus === 'ok' ? 'ALL OK' : overallStatus === 'warning' ? 'WARNINGS' : 'ERRORS'}
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {zones.map(z => <ZoneCard key={z.label} zone={z} />)}
              </div>

              <CauseCard cause={result.cause} status={overallStatus} />

              <div className="space-y-2">
                <p className="text-xs font-semibold">{t('diagnostics.describeProblem')}</p>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('diagnostics.describePlaceholder')}
                  rows={2}
                  className="text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant={isSessionIssue ? "default" : "outline"} size="sm" onClick={handleRepair}>
                  {isSessionIssue ? <LogIn className="mr-2 h-4 w-4" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  {isSessionIssue ? (t('diagnostics.reconnect') || 'Se reconnecter') : t('diagnostics.secureRepair')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => {
                  const report = generateReport(result)
                  const blob = new Blob([report], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${result.diagId}.txt`
                  a.click()
                  URL.revokeObjectURL(url)
                }}>
                  <Activity className="mr-2 h-4 w-4" />
                  {t('diagnostics.generateReport')}
                </Button>
                <Button size="sm" onClick={handleCopy} disabled={!result}>
                  {copied ? <CheckCircle className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                  {copied ? t('diagnostics.copied') : t('diagnostics.copyForSupport')}
                </Button>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-xs font-semibold mb-2">{t('diagnostics.reportPreview')}</p>
                <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap overflow-auto max-h-64">
                  {generateReport(result)}
                </pre>
              </div>
            </>
          )}

          {!result && !isRunning && (
            <div className="text-center py-8">
              <Activity className="mx-auto h-12 w-12 text-muted-foreground mb-3 opacity-40" />
              <p className="text-sm text-muted-foreground">{t('diagnostics.noResult')}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('diagnostics.clickToStart')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
