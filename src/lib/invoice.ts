import { jsPDF } from "jspdf"
import "jspdf-autotable"
import { supabase } from "@/lib/supabase"
import { toUpper } from "@/lib/utils"

interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface InvoiceData {
  invoiceNumber: string
  date: string
  dueDate?: string
  memberName: string
  memberNumber?: string
  memberAddress?: string
  memberEmail?: string
  organizationName: string
  organizationAddress?: string
  organizationPhone?: string
  organizationLogo?: string
  items: InvoiceItem[]
  subtotal: number
  taxRate?: number
  taxAmount?: number
  total: number
  paymentMethod?: string
  notes?: string
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  card: "Carte",
  transfer: "Virement",
  other: "Autre",
}

export async function generateInvoice(data: InvoiceData): Promise<Blob> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = 15

  if (data.organizationLogo) {
    try {
      doc.addImage(data.organizationLogo, "PNG", 20, y, 25, 25)
    } catch {
      // ignore broken logo
    }
  }

  doc.setFontSize(22)
  doc.setFont("helvetica", "bold")
  doc.text("FACTURE", pageWidth - 20, y + 10, { align: "right" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100)
  doc.text(`N° ${data.invoiceNumber}`, pageWidth - 20, y + 18, { align: "right" })
  doc.text(`Date: ${data.date}`, pageWidth - 20, y + 24, { align: "right" })
  if (data.dueDate) {
    doc.text(`Échéance: ${data.dueDate}`, pageWidth - 20, y + 30, { align: "right" })
  }

  y += 40
  doc.setDrawColor(200)
  doc.line(20, y, pageWidth - 20, y)
  y += 8

  doc.setTextColor(0)
  doc.setFontSize(9)
  doc.setFont("helvetica", "bold")
  doc.text("FACTURER À:", 20, y)
  doc.text("DE:", pageWidth / 2 + 5, y)
  y += 6

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.text(toUpper(data.memberName), 20, y)
  if (data.memberNumber) {
    y += 5
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.text(`N° ${data.memberNumber}`, 20, y)
    doc.setTextColor(0)
  }
  let orgY = y
  doc.text(toUpper(data.organizationName), pageWidth / 2 + 5, orgY)
  orgY += 5

  if (data.memberAddress) {
    y += 5
    doc.setFontSize(9)
    doc.text(data.memberAddress, 20, y)
  }
  if (data.memberEmail) {
    y += 5
    doc.setFontSize(9)
    doc.text(data.memberEmail, 20, y)
  }

  if (data.organizationAddress) {
    doc.setFontSize(9)
    doc.text(data.organizationAddress, pageWidth / 2 + 5, orgY)
    orgY += 5
  }
  if (data.organizationPhone) {
    doc.setFontSize(9)
    doc.text(data.organizationPhone, pageWidth / 2 + 5, orgY)
    orgY += 5
  }

  y = Math.max(y, orgY) + 10

  const tableBody = data.items.map((item) => [
    item.description,
    String(item.quantity),
    `${item.unitPrice.toLocaleString("fr-DZ")} DZD`,
    `${item.total.toLocaleString("fr-DZ")} DZD`,
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc_ = doc as any
  doc_.autoTable({
    startY: y,
    head: [["Description", "Qté", "Prix unitaire", "Total"]],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 40, halign: "right" },
      3: { cellWidth: 35, halign: "right" },
    },
    margin: { left: 20, right: 20 },
  })

  let finalY = doc_.lastAutoTable.finalY + 8
  const rightX = pageWidth - 20

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.text("Sous-total:", rightX - 50, finalY)
  doc.text(`${data.subtotal.toLocaleString("fr-DZ")} DZD`, rightX, finalY, { align: "right" })
  finalY += 6

  if (data.taxRate && data.taxAmount) {
    doc.text(`TVA (${data.taxRate}%):`, rightX - 50, finalY)
    doc.text(`${data.taxAmount.toLocaleString("fr-DZ")} DZD`, rightX, finalY, { align: "right" })
    finalY += 6
  }

  doc.setDrawColor(30)
  doc.line(rightX - 65, finalY, rightX, finalY)
  finalY += 6

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text("TOTAL:", rightX - 50, finalY)
  doc.text(`${data.total.toLocaleString("fr-DZ")} DZD`, rightX, finalY, { align: "right" })
  finalY += 12

  if (data.paymentMethod) {
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80)
    doc.text(`Mode de paiement: ${METHOD_LABELS[data.paymentMethod] || data.paymentMethod}`, 20, finalY)
    finalY += 6
  }

  if (data.notes) {
    doc.setFontSize(9)
    doc.text(`Notes: ${data.notes}`, 20, finalY)
    finalY += 6
  }

  const footerY = doc.internal.pageSize.getHeight() - 15
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text("SIMPLE • RAPIDE • SÉCURISÉ", pageWidth / 2, footerY, { align: "center" })

  return doc.output("blob")
}

export async function getNextInvoiceNumber(orgId: string): Promise<string> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    params: Record<string, string>,
  ) => Promise<{ data: string | null; error: Error | null }>)("next_invoice_number", {
    p_organization_id: orgId,
  })
  if (error || !data) {
    const year = new Date().getFullYear()
    return `${year}-000001`
  }
  return data
}
