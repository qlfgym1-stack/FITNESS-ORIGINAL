import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table"
import { Download, Printer, Loader2 } from "lucide-react"
import { formatCurrency, formatDate, toUpper } from "@/lib/utils"
import { generateInvoice, type InvoiceData } from "@/lib/invoice"
import type { Payment } from "@/types/supabase"

type PaymentWithMember = Payment & {
  members: { first_name: string; last_name: string; member_number?: string | null }
  member_subscriptions: { subscription_types: { name: string } } | null
}

interface InvoiceDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  payment: PaymentWithMember
  invoiceNumber: string
  organizationName: string
  organizationAddress?: string | null
  organizationPhone?: string | null
}

export function InvoiceDialog({
  open,
  onOpenChange,
  payment,
  invoiceNumber,
  organizationName,
  organizationAddress,
  organizationPhone,
}: InvoiceDialogProps) {
  const [generating, setGenerating] = useState(false)

  const memberName = `${toUpper(payment.members?.first_name)} ${toUpper(payment.members?.last_name)}`
  const description = payment.notes || "Paiement"
  const subscriptionName = payment.member_subscriptions?.subscription_types?.name

  const buildInvoiceData = useCallback((): InvoiceData => ({
    invoiceNumber,
    date: formatDate(payment.payment_date),
    memberName,
    memberNumber: payment.members?.member_number ?? undefined,
    organizationName,
    organizationAddress: organizationAddress ?? undefined,
    organizationPhone: organizationPhone ?? undefined,
    items: [
      {
        description: subscriptionName ? `${description} - ${subscriptionName}` : description,
        quantity: 1,
        unitPrice: payment.amount,
        total: payment.amount,
      },
    ],
    subtotal: payment.amount,
    total: payment.amount,
    paymentMethod: payment.payment_method,
  }), [invoiceNumber, payment, memberName, organizationName, organizationAddress, organizationPhone, subscriptionName, description])

  const handleDownload = useCallback(async () => {
    setGenerating(true)
    try {
      const blob = await generateInvoice(buildInvoiceData())
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `facture-${invoiceNumber}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setGenerating(false)
    }
  }, [buildInvoiceData, invoiceNumber])

  const handlePrint = useCallback(async () => {
    setGenerating(true)
    try {
      const blob = await generateInvoice(buildInvoiceData())
      const url = URL.createObjectURL(blob)
      const win = window.open(url, "_blank")
      if (win) {
        win.onload = () => {
          win.print()
        }
      }
    } finally {
      setGenerating(false)
    }
  }, [buildInvoiceData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Facture</DialogTitle>
          <DialogDescription>Aperçu et téléchargement de la facture</DialogDescription>
        </DialogHeader>

        <div className="p-6 border rounded-lg space-y-4">
          <div className="text-center">
            <h2 className="text-xl font-bold">FACTURE</h2>
            <p className="text-sm text-muted-foreground">N° {invoiceNumber}</p>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Date:</p>
                <p>{formatDate(payment.payment_date)}</p>
              </div>
              <div>
                <p className="font-medium">Client:</p>
                <p>{memberName}</p>
                {payment.members?.member_number && <p className="text-xs text-muted-foreground">N° {payment.members.member_number}</p>}
              </div>
          </div>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>
                  {subscriptionName ? `${description} - ${subscriptionName}` : description}
                </TableCell>
                <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="flex justify-end">
            <p className="text-lg font-bold">Total: {formatCurrency(payment.amount)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handlePrint} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            Imprimer
          </Button>
          <Button onClick={handleDownload} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Télécharger PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
