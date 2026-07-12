import { useState, useCallback } from 'react'

interface ExportColumn {
  key: string
  label: string
}

export function useExportCsv<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: ExportColumn[]
) {
  const [isExporting, setIsExporting] = useState(false)

  const exportCsv = useCallback(async () => {
    if (!data.length) return
    setIsExporting(true)
    try {
      const XLSX = await import('xlsx')
      const rows = data.map((row) => {
        const mapped: Record<string, unknown> = {}
        for (const col of columns) {
          mapped[col.label] = row[col.key] ?? ''
        }
        return mapped
      })
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Data')
      XLSX.writeFile(wb, `${filename}.xlsx`)
    } finally {
      setIsExporting(false)
    }
  }, [data, filename, columns])

  return { exportCsv, isExporting }
}
