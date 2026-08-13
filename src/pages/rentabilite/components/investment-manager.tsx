import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select"
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Loader2, Plus, Trash2, TrendingUp } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/utils"
import { IS_MOCK } from "@/lib/config"
import type { Investment } from "@/types/supabase"

const INVESTMENT_CATEGORIES = [
  "produits",
  "materiel",
  "travaux",
  "amenagement",
  "logiciels",
  "marketing",
  "publicite",
  "formation",
  "consommables",
  "autres",
] as const

const investmentSchema = z.object({
  category: z.enum(INVESTMENT_CATEGORIES),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  investment_date: z.string().min(1, "Date is required"),
})

type InvestmentFormValues = z.infer<typeof investmentSchema>

interface InvestmentManagerProps {
  orgId?: string
  t: (key: string) => string
}

export function InvestmentManager({ orgId, t }: InvestmentManagerProps) {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { roles } = useAuth()
  const { toast } = useToast()
  const isAdmin = roles?.some((r) => r.role === "admin") === true

  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const form = useForm<InvestmentFormValues>({
    resolver: zodResolver(investmentSchema),
    defaultValues: {
      category: "consommables",
      description: "",
      amount: 0,
      investment_date: new Date().toISOString().slice(0, 10),
    },
  })

  const { data: investments, isLoading } = useQuery({
    queryKey: ["profitability", "investments", orgId],
    queryFn: async () => {
      if (!orgId) return []
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .eq("organization_id", orgId)
        .order("investment_date", { ascending: false })
      if (error) throw error
      return (data ?? []) as Investment[]
    },
    enabled: !!orgId,
  })

  const addMutation = useMutation({
    mutationFn: async (values: InvestmentFormValues) => {
      if (!orgId) throw new Error("No organization")
      if (IS_MOCK) return
      const user = (await supabase.auth.getUser()).data.user
      const { error } = await supabase.from("investments").insert({
        organization_id: orgId,
        category: values.category,
        description: values.description,
        amount: values.amount,
        investment_date: values.investment_date,
        created_by: user?.id ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profitability", "investments"] })
      setAddOpen(false)
      form.reset()
      toast({ title: t("expenses.added") })
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (IS_MOCK) return
      const { error } = await supabase.from("investments").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profitability", "investments"] })
      setDeleteId(null)
      toast({ title: t("expenses.deleted") })
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" })
    },
  })

  const total = investments?.reduce((s: number, inv: Investment) => s + Number(inv.amount || 0), 0) ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-5 w-5" />
          {t("rentabilite.investmentHistory")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("rentabilite.totalInvestment")} :{" "}
            <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
          </p>
          {isAdmin && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  {t("expenses.new")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("expenses.new")}</DialogTitle>
                  <DialogDescription>{t("expenses.formDescription")}</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((v) => addMutation.mutate(v))} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("expenses.category")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder={t("expenses.category")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INVESTMENT_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {t(`rentabilite.inv_${cat}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("expenses.descLabel")}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("expenses.amount")}</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" min="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="investment_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("expenses.date")}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline">
                          {t("common.cancel")}
                        </Button>
                      </DialogClose>
                      <Button type="submit" disabled={addMutation.isPending}>
                        {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {t("common.save")}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (investments ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("rentabilite.noInvestments")}</p>
        ) : (
          <div className="divide-y rounded-lg border">
            {(investments ?? []).map((inv: Investment) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{inv.description || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`rentabilite.inv_${inv.category}`)} · {formatDate(inv.investment_date)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold tabular-nums">{formatCurrency(Number(inv.amount))}</span>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(inv.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("expenses.confirmDelete")}</DialogTitle>
              <DialogDescription>{t("expenses.deleteWarning")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t("common.cancel")}
                </Button>
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("common.delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
