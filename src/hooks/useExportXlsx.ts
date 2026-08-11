import { useState, useCallback } from 'react'

interface ExportColumn {
  key: string
  label: string
}

interface ExportOptions {
  sheetName?: string
  filename?: string
}

export function useExportXlsx<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  options?: ExportOptions
) {
  const [isExporting, setIsExporting] = useState(false)

  const exportXlsx = useCallback(async () => {
    if (!data.length) return
    setIsExporting(true)
    try {
      const ExcelJS = await import('exceljs')
      const wb = new ExcelJS.default.Workbook()
      const ws = wb.addWorksheet(options?.sheetName ?? 'Data')
      ws.columns = columns.map((c) => ({ header: c.label, key: c.label, width: 20 }))
      data.forEach((row) => {
        const mapped: Record<string, unknown> = {}
        for (const col of columns) {
          mapped[col.label] = row[col.key] ?? ''
        }
        ws.addRow(mapped)
      })
      await wb.xlsx.writeFile(`${options?.filename ?? 'export'}.xlsx`)
    } finally {
      setIsExporting(false)
    }
  }, [data, columns, options?.sheetName, options?.filename])

  return { exportXlsx, isExporting }
}
