import { useState, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@/hooks/useQuery"
import { useSupabase } from "@/hooks/useSupabase"
import { useT } from "@/i18n"
import { formatCurrency } from "@/lib/utils"
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
import { useToast } from "@/components/ui/toast"
import { Loader2, Plus, Minus, Trash2, Search, ShoppingCart, Check, ImageIcon } from "lucide-react"
import type { Product } from "@/types/supabase"

const CATEGORIES = ["Snacks", "Drinks", "Supplements", "Apparel", "Equipment", "Subscription"]

interface CartItem {
  product: Product
  quantity: number
}

export default function POSPage() {
  const supabase = useSupabase()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const t = useT()
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("Snacks")
  const [cart, setCart] = useState<CartItem[]>([])
  const [discount, setDiscount] = useState(0)
  const [memberSearch, setMemberSearch] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [showSuccess, setShowSuccess] = useState(false)

  const { data: products, isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data } = await supabase.from("products").select("*").eq("is_active", true).order("name")
      return data ?? []
    },
  })

  const { data: members } = useQuery({
    queryKey: ["members_minimal"],
    queryFn: async () => {
      const { data } = await supabase.from("members").select("id, first_name, last_name, phone").eq("status", "active").order("first_name")
      return data ?? []
    },
  })

  const filteredProducts = useMemo(() => {
    if (!products) return []
    return products.filter(p => {
      const matchesCategory = p.category === category || (!p.category && category === "Snacks")
      const matchesSearch = !search || p.name.toLowerCase().includes(search.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [products, category, search])

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

  const total = Math.max(0, subtotal - discount)

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

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const orgId = (await supabase.auth.getUser()).data.user?.id
      if (!orgId) throw new Error("No org")
      const { data: session } = await supabase.from("pos_sessions").insert({
        organization_id: orgId,
        status: "open",
        opened_at: new Date().toISOString(),
        total: total,
      }).select().single()
      if (!session) throw new Error("No session")
      const { error } = await supabase.from("pos_transactions").insert({
        session_id: session.id,
        organization_id: orgId,
        member_id: selectedMemberId,
        items: cart.map(item => ({ id: item.product.id, name: item.product.name, price: item.product.price, quantity: item.quantity })),
        subtotal,
        discount: discount || null,
        total,
        payment_method: paymentMethod,
        payment_status: "completed",
      })
      if (error) throw error
    },
    onSuccess: () => {
      setShowCheckout(false)
      setShowSuccess(true)
      setCart([])
      setDiscount(0)
      setSelectedMemberId(null)
      setMemberSearch("")
      queryClient.invalidateQueries({ queryKey: ["products"] })
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  })

  return (
    <div>
      <PageHeader title={t("pos.title") || "Point of Sale"} description={t("pos.description") || "Process sales transactions"} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("pos.search") || "Search products..."}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Tabs value={category} onValueChange={setCategory}>
            <TabsList className="mb-4 flex-wrap h-auto">
              {CATEGORIES.map(cat => (
                <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
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
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-md" />
                      ) : (
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-sm font-bold text-primary">{formatCurrency(product.price)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card className="sticky top-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingCart className="h-5 w-5" />
                <h3 className="font-semibold">{t("pos.cart") || "Cart"} ({cart.length})</h3>
              </div>

              <ScrollArea className="h-[300px] mb-4">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">{t("pos.emptyCart") || "Cart is empty"}</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.product.name}</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(item.product.price)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm">{item.quantity}</span>
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              <Separator className="mb-4" />

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span>{t("pos.subtotal") || "Subtotal"}</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">{t("pos.discount") || "Discount"}</span>
                  <Input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={e => setDiscount(Number(e.target.value))}
                    className="w-24 h-8 text-sm"
                  />
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>{t("pos.total") || "Total"}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium mb-1 block">{t("pos.member") || "Member"}</label>
                <Input
                  placeholder={t("pos.searchMember") || "Search member..."}
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  className="mb-2"
                />
                {memberSearch && (
                  <div className="max-h-[120px] overflow-y-auto border rounded-md">
                    {filteredMembers.slice(0, 5).map(m => (
                      <div
                        key={m.id}
                        className={`p-2 text-sm cursor-pointer hover:bg-accent ${selectedMemberId === m.id ? "bg-accent" : ""}`}
                        onClick={() => { setSelectedMemberId(m.id); setMemberSearch(`${m.first_name} ${m.last_name}`) }}
                      >
                        {m.first_name} {m.last_name}
                        {m.phone && <span className="text-muted-foreground ml-2">{m.phone}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                className="w-full"
                size="lg"
                disabled={cart.length === 0}
                onClick={() => setShowCheckout(true)}
              >
                {t("pos.checkout") || "Checkout"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("pos.payment") || "Payment"}</DialogTitle>
            <DialogDescription>Select payment method to complete the sale</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center">
              <p className="text-3xl font-bold">{formatCurrency(total)}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("pos.paymentMethod") || "Payment Method"}</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCheckout(false)}>{t("cancel") || "Cancel"}</Button>
            <Button onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending}>
              {checkoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("pos.confirmPayment") || "Confirm Payment"}
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
                {t("pos.success") || "Payment Successful!"}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="text-center text-sm text-muted-foreground">
            {t("pos.successMessage") || "The transaction has been completed successfully."}
          </div>
          <DialogFooter className="justify-center">
            <Button onClick={() => setShowSuccess(false)}>{t("pos.newSale") || "New Sale"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
