import { useState, useMemo, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useAuth } from "@/stores/auth"
import { useT } from "@/i18n"
import { formatCurrency, toUpper, getInitials } from "@/lib/utils"
import { PageHeader } from "@/components/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Sheet, SheetTrigger, SheetContent,
} from "@/components/ui/sheet"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/components/ui/toast"
import { useLocation, useNavigate } from "react-router-dom"
import { Loader2, Plus, Minus, Trash2, Search, ShoppingCart, Check, ImageIcon, CreditCard, User, Percent, Scan, X } from "lucide-react"
import type { Product, Member } from "@/types/supabase"

interface CartItem {
  product: Product
  quantity: number
}

export default function POSPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const { organization } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const pendingSub = location.state?.pendingSubscription as {
    member_id: string; subscription_id: string; total_amount: number; subscription_name: string; organization_id: string; first_name: string; last_name: string
  } | undefined

  const currencySymbol = useMemo(() => {
    try { return new Intl.NumberFormat('fr-DZ', { style: 'currency', currency: 'DZD' }).formatToParts(0).find(p => p.type === 'currency')?.value || 'DA' } catch { return 'DA' }
  }, [])

  const CATEGORIES = ["snacks", "drinks", "supplements", "apparel", "equipment"]
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("snacks")
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountPercent, setDiscountPercent] = useState<number | null>(null)
  const [discountAmount, setDiscountAmount] = useState<number | null>(null)
  const [memberSearch, setMemberSearch] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [showSuccess, setShowSuccess] = useState(false)
  const [qrInput, setQrInput] = useState("")
  const [panelProductSearch, setPanelProductSearch] = useState("")
  const [mobileCartOpen, setMobileCartOpen] = useState(false)

  const { data: products, isLoading, isError: productsError, error: productsQueryError } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("is_active", true).order("name")
      return data ?? []
    },
  })

  useEffect(() => {
    if (productsError && productsQueryError) {
      toast({ title: t("errors.generic") || "Error", description: productsQueryError.message, variant: "destructive" })
    }
  }, [productsError, productsQueryError])

  useEffect(() => {
    if (pendingSub) {
      window.history.replaceState({}, "")
      setCart([{
        product: {
          id: `__subscription__${pendingSub.subscription_id}`,
          organization_id: pendingSub.organization_id,
          name: pendingSub.subscription_name,
          category: null,
          price: pendingSub.total_amount,
          cost: null,
          stock: null,
          image_url: null,
          barcode: null,
          is_active: true,
          created_at: "",
        },
        quantity: 1,
      }])
      setSelectedMemberId(pendingSub.member_id)
      setMemberSearch(`${toUpper(pendingSub.first_name)} ${toUpper(pendingSub.last_name)}`)
    }
  }, [pendingSub])

  const { data: members } = useQuery({
    queryKey: ["members_minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, first_name, last_name, phone, photo_url").eq("status", "active").order("first_name")
      return data ?? []
    },
  })

  const { data: selectedMemberDetails } = useQuery({
    queryKey: ["member_details_pos", selectedMemberId],
    queryFn: async () => {
      if (!selectedMemberId) return null
      const { data: member } = await supabase.from("members").select("id, first_name, last_name, phone, photo_url").eq("id", selectedMemberId).single()
      if (!member) return null
      const { data: sub } = await supabase.from("member_subscriptions").select("status, start_date, end_date, subscription_types(name)").eq("member_id", selectedMemberId).eq("status", "active").maybeSingle()
      return { ...member, subscription: sub as { status: string; start_date: string; end_date: string; subscription_types: { name: string } | null } | null ?? null }
    },
    enabled: !!selectedMemberId,
  })

  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesCategory = p.category === category || (!p.category && category === "snacks")
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [products, category, search])

  const panelFilteredProducts = useMemo(() => {
    if (!panelProductSearch || !products) return []
    const q = panelProductSearch.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    )
  }, [products, panelProductSearch])

  const filteredMembers = useMemo(() => {
    if (!members) return []
    return members.filter(m =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase()) ||
      (m.phone && m.phone.includes(memberSearch))
    )
  }, [members, memberSearch])

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  }, [cart])

  const discountValue = useMemo(() => {
    return Math.round((subtotal * (discountPercent ?? 0) / 100) + (discountAmount ?? 0))
  }, [subtotal, discountPercent, discountAmount])

  const total = Math.max(0, subtotal - discountValue)

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
  }

  function updateQuantity(productId: string, delta: number) {
    setCart(prev => {
      return prev.reduce<CartItem[]>((acc, item) => {
        if (item.product.id !== productId) {
          acc.push(item)
          return acc
        }
        const newQty = item.quantity + delta
        if (newQty <= 0) return acc
        acc.push({ ...item, quantity: newQty })
        return acc
      }, [])
    })
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(item => item.product.id !== productId))
  }

  function handleScan(value: string) {
    if (!value) return
    const trimmed = value.trim().toLowerCase()
    // Try product barcode first
    const product = products?.find(p => p.barcode && p.barcode.toLowerCase() === trimmed)
    if (product) {
      addToCart(product)
      setQrInput("")
      return
    }
    // Try member phone or id
    const member = members?.find(m => m.phone && m.phone.toLowerCase() === trimmed)
    if (member) {
      setSelectedMemberId(member.id)
      setMemberSearch(`${toUpper(member.first_name)} ${toUpper(member.last_name)}`)
      setQrInput("")
      return
    }
    toast({ title: "Code non reconnu", description: `Aucun produit ou adhérent trouvé pour "${value}"`, variant: "destructive" })
    setQrInput("")
  }

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const orgId = organization?.id
      if (!orgId) throw new Error("No organization")

      // First: decrement stock for physical items (atomic)
      for (const item of cart) {
        if (item.product.id.startsWith("__subscription__")) continue
        const { data: updated, error: stockError } = await (supabase.rpc as any)(
          'decrement_product_stock', { p_id: item.product.id, p_qty: item.quantity })
        if (stockError) throw stockError
        if (updated === false) throw new Error(`Insufficient stock for ${item.product.name}`)
      }

      // Then: create session + transaction (only after stock is confirmed)
      const { data: session } = await supabase.from("pos_sessions").insert({
        organization_id: orgId,
        status: "open",
        opened_at: new Date().toISOString(),
        total: total,
      }).select().single()
      if (!session) throw new Error("No session")
      const { error: txError } = await supabase.from("pos_transactions").insert({
        session_id: session.id,
        organization_id: orgId,
        member_id: selectedMemberId,
        items: cart.map(item => ({ id: item.product.id, name: item.product.name, price: item.product.price, quantity: item.quantity })),
        subtotal,
        discount: discountValue || null,
        total,
        payment_method: paymentMethod,
        payment_status: "completed",
      })
      if (txError) throw txError

      // Finalize subscription payment if this was a pending subscription checkout
      if (pendingSub) {
        const { error: finalizeError } = await (supabase.rpc as any)('finalize_subscription_payment', {
          p_subscription_id: pendingSub.subscription_id,
          p_organization_id: orgId,
          p_member_id: pendingSub.member_id,
          p_payment_method: paymentMethod,
          p_amount: total,
        })
        if (finalizeError) throw finalizeError
      }
    },
    onSuccess: async () => {
      setShowCheckout(false)
      setShowSuccess(true)
      setCart([])
      setDiscountPercent(null)
      setDiscountAmount(null)
      setSelectedMemberId(null)
      setMemberSearch("")
      setQrInput("")
      setPanelProductSearch("")
      queryClient.invalidateQueries({ queryKey: ["products"] })
      queryClient.invalidateQueries({ queryKey: ["subscription-types"] })
      queryClient.invalidateQueries({ queryKey: ["payments"] })
      const { data: { user } } = await supabase.auth.getUser()
      if (user) queryClient.invalidateQueries({ queryKey: ["member-subscriptions", user.id] })
    },
    onError: (err: Error) => toast({ title: t("errors.generic"), description: err.message, variant: "destructive" }),
  })

  // Cart panel component (used in both desktop sidebar and mobile drawer)
  const CartPanel = () => (
    <Card className={mobileCartOpen ? "border-0 rounded-none h-full" : "sticky top-4"}>
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <h3 className="font-semibold">{t("pos.cart")} ({cart.length})</h3>
          </div>
          {cart.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setCart([])}>
              {t("pos.clearCart")}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 min-h-0 mb-3">
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("pos.emptyCart")}</p>
          ) : (
            <div className="space-y-2">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center justify-between gap-2 p-2 rounded-lg hover:bg-accent/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {item.product.id.startsWith("__subscription__") && <CreditCard className="h-3 w-3 text-primary shrink-0" />}
                      <p className="text-sm font-medium truncate">{toUpper(item.product.name)}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.product.id.startsWith("__subscription__") ? (
                      <>
                        <Badge variant="secondary" className="text-xs">{t("pos.subscription")}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator className="mb-3" />

        <div className="space-y-2 mb-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("pos.subtotal")}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>

          {/* Discount% input */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t("pos.discountPercent")}</span>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                max="100"
                placeholder="0"
                value={discountPercent ?? ""}
                onChange={e => setDiscountPercent(e.target.value ? Number(e.target.value) : null)}
                className="w-16 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>

          {/* Fixed discount input */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t("pos.discountAmount")}</span>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{currencySymbol}</span>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={discountAmount ?? ""}
                onChange={e => setDiscountAmount(e.target.value ? Number(e.target.value) : null)}
                className="w-20 h-7 text-xs"
              />
            </div>
          </div>

          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>{t("pos.total")}</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Member selection */}
        <div className="mb-3">
          <label className="text-xs font-medium mb-1 block text-muted-foreground">{t("pos.member")}</label>
          <Input
            placeholder={t("pos.searchMember")}
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            className="h-8 text-sm mb-1"
          />
          {memberSearch && (
            <div className="max-h-[100px] overflow-y-auto border rounded-md">
              {filteredMembers.slice(0, 5).map(m => (
                <div
                  key={m.id}
                  className={`p-1.5 text-xs cursor-pointer hover:bg-accent truncate ${selectedMemberId === m.id ? "bg-accent font-medium" : ""}`}
                  onClick={() => { setSelectedMemberId(m.id); setMemberSearch(`${toUpper(m.first_name)} ${toUpper(m.last_name)}`) }}
                >
                  {toUpper(m.first_name)} {toUpper(m.last_name)}
                  {m.phone && <span className="text-muted-foreground ml-1">{m.phone}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          className="w-full"
          size="lg"
          disabled={cart.length === 0 || checkoutMutation.isPending}
          onClick={() => setShowCheckout(true)}
        >
          {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          {t("pos.checkout")} — {formatCurrency(total)}
        </Button>
      </CardContent>
    </Card>
  )

  return (
    <div>
      <PageHeader title={t("pos.title")} description={t("pos.description")} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {/* QR code / barcode scan input */}
          <div className="mb-2 relative">
            <Scan className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("pos.scanBarcode")}
              value={qrInput}
              onChange={e => setQrInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleScan(e.currentTarget.value) }}
              className="pl-9 h-9 text-sm"
            />
          </div>
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("pos.searchProducts")}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="mb-4 flex-wrap h-auto">
              {CATEGORIES.map(cat => (
                <TabsTrigger key={cat} value={cat}>{t(`pos.${cat}`)}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filteredProducts.map(product => (
                <Card
                  key={product.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => addToCart(product)}
                >
                  <CardContent className="p-3">
                    <div className="aspect-square bg-muted rounded-md flex items-center justify-center mb-2">
                      {product.image_url ? (
                        <img src={product.image_url} alt={toUpper(product.name)} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{toUpper(product.name)}</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(product.price)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right panel: fixed cart */}
        <div className="hidden lg:block">
          <CartPanel />
        </div>
      </div>

      {/* Mobile cart FAB + drawer */}
      <div className="lg:hidden fixed bottom-4 right-4 z-40">
        <Button className="h-14 w-14 rounded-full shadow-lg" onClick={() => setMobileCartOpen(true)}>
          <ShoppingCart className="h-6 w-6" />
          {cart.length > 0 && <Badge className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs">{cart.length}</Badge>}
        </Button>
      </div>
      <Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
        <SheetContent side="right" className="w-[85vw] p-0 sm:max-w-sm">
          <CartPanel />
        </SheetContent>
      </Sheet>

      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingSub ? t("pos.finalizeSubscription") : t("pos.payment")}</DialogTitle>
            <DialogDescription>{pendingSub ? t("pos.subscriptionPaymentDesc") : t("pos.selectPaymentMethod")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{formatCurrency(total)}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("pos.paymentMethod")}</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("pos.cash")}</SelectItem>
                  <SelectItem value="card">{t("pos.card")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)}>{t("pos.cancel")}</Button>
            <Button onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending}>
              {checkoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("pos.confirmPayment")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <Check className="h-6 w-6 text-success" />
                </div>
                {t("pos.success")}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="text-center text-sm text-muted-foreground">
            {pendingSub ? t("pos.subscriptionPaymentDesc") : t("pos.successMessage")}
          </div>
          <DialogFooter className="justify-center">
            {pendingSub ? (
              <Button onClick={() => { setShowSuccess(false); navigate("/members") }}>{t("pos.newSale")}</Button>
            ) : (
              <Button onClick={() => setShowSuccess(false)}>{t("pos.newSale")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
