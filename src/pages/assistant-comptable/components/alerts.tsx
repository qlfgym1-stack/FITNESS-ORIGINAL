import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { Alert } from '../hooks/types'

interface AlertsProps {
  alerts: Alert[]
  t: (key: string) => string
}

const iconMap = {
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
}

const variantMap = {
  danger: 'bg-destructive/10 border-destructive text-destructive',
  warning: 'bg-warning/10 border-warning text-warning',
  info: 'bg-info/10 border-info text-info',
  success: 'bg-success/10 border-success text-success',
}

export function Alerts({ alerts, t }: AlertsProps) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <AlertTriangle className="h-5 w-5" />
        {t('assistantComptable.alerts')}
      </h3>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-success print-break-inside">
          <CheckCircle2 className="h-4 w-4" />
          <span>{t('assistantComptable.noAlerts')}</span>
        </div>
      ) : (
        alerts.map((alert, index) => {
          const Icon = iconMap[alert.type]
          return (
            <div
              key={index}
              className={`flex items-center gap-2 rounded-lg border p-3 print-break-inside ${variantMap[alert.type]}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-sm">{alert.message}</span>
            </div>
          )
        })
      )}
    </div>
  )
}
