import { useState, useCallback } from 'react'

interface ExportColumn {
  key: string
  label: string
}

interface ExportOptions {
  title?: string
  filename?: string
  orientation?: 'portrait' | 'landscape'
}

export function useExportPdf<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn[],
  options?: ExportOptions
) {
  const [isExporting, setIsExporting] = useState(false)

  const exportPdf = useCallback(async () => {
    if (!data.length) return
    setIsExporting(true)
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const doc = new jsPDF({ orientation: options?.orientation ?? 'portrait', unit: 'pt', format: 'a4' })

      if (options?.title) {
        doc.setFontSize(14)
        doc.text(options.title, 40, 40)
      }

      autoTable(doc, {
        head: [columns.map((c) => c.label)],
        body: data.map((row) => columns.map((c) => String(row[c.key] ?? ''))),
        startY: options?.title ? 56 : 40,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [37, 99, 235] },
      })

      doc.save(`${options?.filename ?? 'export'}.pdf`)
    } finally {
      setIsExporting(false)
    }
  }, [data, columns, options?.title, options?.filename, options?.orientation])

  return { exportPdf, isExporting }
}
