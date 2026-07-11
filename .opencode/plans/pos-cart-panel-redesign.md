# Plan — Refonte panneau PANIER du POS

## Fichier modifié
Un seul fichier : `src/pages/pos/pos.tsx`
Zéro changement backend, migration, API, types ou i18n (sauf ajout de clés si besoin).

---

## Changements état (state)

| Avant | Après |
|---|---|
| `discount: number` | `discountPercent: number \| null` + `discountAmount: number \| null` |
| `memberSearch: string` | `memberSearch: string` (inchangé) |
| `selectedMemberId: string \| null` | `selectedMemberId: string \| null` (inchangé) |
| — | `qrInput: string` (scan QR / code-barres / RFID) |
| — | `panelProductSearch: string` (recherche produit dans le panier) |
| — | `selectedMember: Member \| null` (détails adhérent pour affichage) |
| — | `mobileCartOpen: boolean` (drawer mobile) |

---

## Calculs métier modifiés

**AVANT :**
```
total = Math.max(0, subtotal - discount)
```
Le checkout envoie `discount` (nombre simple) et `total` à `pos_transactions`.

**APRÈS :**
```
discountValue = (subtotal * (discountPercent || 0) / 100) + (discountAmount || 0)
total = Math.max(0, subtotal - discountValue)
```
Le checkout envoie `discount: discountValue` (valeur unique calculée) et `total`.
→ L'API backend reste inchangée, elle reçoit exactement les mêmes champs.

---

## Nouvelles requêtes (lecture seule)

```tsx
// Détails adhérent sélectionné (photo, abonnement)
const { data: selectedMember } = useQuery({
  queryKey: ["member_details", selectedMemberId],
  queryFn: async () => {
    if (!selectedMemberId) return null
    const { data: member } = await supabase.from("members")
      .select("id, first_name, last_name, phone, photo_url")
      .eq("id", selectedMemberId).single()
    const { data: sub } = await supabase.from("member_subscriptions")
      .select("status, start_date, end_date, subscription_types(name)")
      .eq("member_id", selectedMemberId)
      .eq("status", "active").maybeSingle()
    return { ...member, subscription: sub ?? null }
  },
  enabled: !!selectedMemberId,
})

// Recherche rapide produit dans le panier (filtre local sur products déjà chargés)
const panelFilteredProducts = useMemo(() => {
  if (!panelProductSearch || !products) return []
  const q = panelProductSearch.toLowerCase()
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    (p.barcode && p.barcode.toLowerCase().includes(q)) ||
    (p.category && p.category.toLowerCase().includes(q))
  )
}, [products, panelProductSearch])
```

---

## Structure UI du panneau droit

```
┌─────────────────────────────────────┐
│ ① ADHÉRENT                          │ Fixed
│ ┌─────────────────────────────────┐ │
│ │ [Avatar] Nom Prénom             │ │
│ │ N° adhérent                     │ │
│ │ Abonnement X jours restants     │ │
│ │ ───────────────────────────     │ │
│ │ 🔍 Rechercher un adhérent...    │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ② RECHERCHE PRODUIT                 │ Fixed
│ ┌─────────────────────────────────┐ │
│ │ 🔍 Rechercher un produit...     │ │
│ │ (suggestions temps réel)        │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ③ QR CODE / BARCODE / RFID          │ Fixed
│ ┌─────────────────────────────────┐ │
│ │ 📷 Scanner un code...           │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ④ LISTE DU PANIER                   │ SCROLL ONLY
│ ┌─────────────────────────────────┐ │
│ │ [img] Produit 1    12 500 DA   │ │
│ │  [-]  1  [+]  🗑️  12 500 DA   │ │
│ │ ───────────────────────────     │ │
│ │ [img] Produit 2     3 500 DA   │ │
│ │  [-]  2  [+]  🗑️   7 000 DA   │ │
│ │ ... (scroll si > articles)      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ⑤ TOTAUX                            │ Fixed
│ ┌─────────────────────────────────┐ │
│ │ Sous-total           25 000 DA  │ │
│ │ Remise %   [___] %              │ │
│ │ Remise DA  [_____] DA           │ │
│ │ ───────────────────────────     │ │
│ │ TOTAL               25 000 DA   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ⑥ BOUTON ENCAISSER                  │ Fixed bottom
│ ┌─────────────────────────────────┐ │
│ │ ENCAISSER         25 000 DA     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

---

## Ordre des imports (inchangés + ajouts)

```
Sheet, SheetTrigger, SheetContent  (mobile drawer)
User, QrCode, Percent, Scan, X     (nouvelles icônes)
getDaysRemaining                    (depuis utils)
```

---

## Détail des 6 sections

### ① ADHÉRENT
```
{selectedMember ? (
  <div class="flex items-center gap-3 mb-3">
    <Avatar>
      <AvatarImage src={selectedMember.photo_url} />
      <AvatarFallback>{getInitials(...)}</AvatarFallback>
    </Avatar>
    <div>
      <p class="font-semibold text-sm">{Nom Prénom}</p>
      <p class="text-xs text-muted-foreground">N° {id court}</p>
      {subscription && (
        <Badge class="text-xs">{type.name} - {daysLeft}j</Badge>
      )}
    </div>
  </div>
) : null}

<Input placeholder="Rechercher un adhérent..." value={memberSearch} onChange={...} />
{memberSearch && (
  <div class="max-h-[150px] overflow-y-auto border rounded-md">
    {filteredMembers.slice(0, 8).map(m => (...))}
  </div>
)}
```
- **Pas de scroll** sur cette section (hauteur fixe ~140px)
- Affichage automatique après sélection membre ou redirection subscription

### ② RECHERCHE PRODUIT
```
<Input placeholder="🔍 Rechercher un produit..." value={panelProductSearch} onChange={...} />
{panelProductSearch && panelFilteredProducts.length > 0 && (
  <div class="max-h-[120px] overflow-y-auto border rounded-md">
    {panelFilteredProducts.slice(0, 5).map(p => (
      <div class="flex items-center justify-between p-2 cursor-pointer hover:bg-accent"
           onClick={() => { addToCart(p); setPanelProductSearch("") }}>
        <span class="text-sm">{p.name}</span>
        <span class="text-sm font-bold">{formatCurrency(p.price)}</span>
      </div>
    ))}
  </div>
)}
```
- Recherche locale (pas d'appel API)
- Résultats limités à 5 suggestions
- Clic → addToCart + efface champ

### ③ QR CODE / BARCODE / RFID
```
<Input placeholder="📷 Scanner QR code, code-barres ou RFID..."
       value={qrInput}
       onChange={handleScan} />
```
- `handleScan` : 
  - Cherche d'abord dans `products` par `barcode` → si trouvé, `addToCart`
  - Cherche dans `members` par `phone` ou `id` → si trouvé, `setSelectedMemberId`
  - Déclenché à chaque changement (pas de bouton "Valider") pour compatibilité scanner USB
- Supporte saisie clavier + lecture scanner

### ④ LISTE DU PANIER (seule zone scrollable)
```tsx
<div class="flex-1 overflow-y-auto min-h-0">  ← scroll uniquement ici
  {cart.map(item => (
    <div class="flex items-center gap-3 p-3 border-b">
      <div class="w-10 h-10 bg-muted rounded flex items-center justify-center">
        {item.product.image_url ? <img /> : <ImageIcon />}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium truncate">{item.product.name}</p>
        <p class="text-xs text-muted-foreground">{formatCurrency(item.product.price)}</p>
      </div>
      <div class="flex items-center gap-1">
        <Button size="icon" variant="outline" class="h-8 w-8 rounded-full"
                onClick={() => updateQuantity(item.product.id, -1)}>
          <Minus class="h-3 w-3" />
        </Button>
        <span class="w-8 text-center font-medium text-sm">{item.quantity}</span>
        <Button size="icon" variant="outline" class="h-8 w-8 rounded-full"
                onClick={() => updateQuantity(item.product.id, 1)}>
          <Plus class="h-3 w-3" />
        </Button>
        <Button size="icon" variant="ghost" class="h-8 w-8 text-destructive"
                onClick={() => removeFromCart(item.product.id)}>
          <Trash2 class="h-3 w-3" />
        </Button>
      </div>
    </div>
  ))}
</div>
```
- Uniquement cette section scrollable
- `flex-1` + `overflow-y-auto` + `min-h-0` pour occuper l'espace restant
- Boutons + et - arrondis (touch-friendly)
- Suppression auto quand quantité = 1 et clic -

### ⑤ TOTAUX
```tsx
<div class="space-y-2 border-t pt-3">
  <div class="flex justify-between text-sm">
    <span>Sous-total</span>
    <span>{formatCurrency(subtotal)}</span>
  </div>
  <div class="flex items-center gap-2">
    <span class="text-sm whitespace-nowrap">Remise %</span>
    <Input type="number" min="0" max="100" placeholder="0 %"
           value={discountPercent ?? ""}
           onChange={e => setDiscountPercent(e.target.value ? Number(e.target.value) : null)}
           class="w-20 h-8 text-sm text-right" />
  </div>
  <div class="flex items-center gap-2">
    <span class="text-sm whitespace-nowrap">Remise (DA)</span>
    <Input type="number" min="0" placeholder="0.00 DA"
           value={discountAmount ?? ""}
           onChange={e => setDiscountAmount(e.target.value ? Number(e.target.value) : null)}
           class="w-24 h-8 text-sm text-right" />
  </div>
  <Separator />
  <div class="flex justify-between font-bold text-lg">
    <span>TOTAL</span>
    <span>{formatCurrency(total)}</span>
  </div>
</div>
```
- TVA supprimée
- Deux champs remise : % et montant fixe
- Utilisables ensemble ou séparément
- Si vide → aucune remise

### ⑥ BOUTON ENCAISSER
```tsx
<Button
  class="w-full h-14 text-lg font-bold mt-auto"
  disabled={cart.length === 0}
  onClick={() => setShowCheckout(true)}
>
  <span>ENCAISSER</span>
  <span class="ml-auto">{formatCurrency(total)}</span>
</Button>
```
- `mt-auto` pour coller en bas
- Texte à gauche, montant à droite
- Désactivé si panier vide

---

## Layout du panneau complet

```tsx
<div class="h-screen sticky top-0 flex flex-col bg-card border-l shadow-lg p-4">
  {/* ① Adhérent - fixed */}
  <div class="flex-shrink-0">{MemberSection}</div>

  {/* ② Recherche produit - fixed */}
  <div class="flex-shrink-0 mt-2">{ProductSearch}</div>

  {/* ③ QR Code - fixed */}
  <div class="flex-shrink-0 mt-2">{QRScanner}</div>

  {/* ④ Liste panier - scrollable */}
  <div class="flex-1 overflow-y-auto min-h-0 my-3">{CartItems}</div>

  {/* ⑤ Totaux - fixed */}
  <div class="flex-shrink-0">{Totals}</div>

  {/* ⑥ Bouton encaisser - fixed */}
  <div class="flex-shrink-0 mt-2">{CheckoutButton}</div>
</div>
```

---

## Mobile (responsive)

- Desktop (>1024px) : `lg:col-span-1` avec `h-screen sticky top-0`
- Mobile (<1024px) : Bouton flottant "🛒 Panier (N)" ouvre un `Sheet` (Drawer droit)

```tsx
{/* Mobile trigger */}
<div class="lg:hidden fixed bottom-4 right-4 z-40">
  <Button class="h-14 w-14 rounded-full shadow-lg" onClick={() => setMobileCartOpen(true)}>
    <ShoppingCart class="h-6 w-6" />
    {cart.length > 0 && <Badge class="absolute -top-1 -right-1">{cart.length}</Badge>}
  </Button>
</div>

{/* Mobile drawer */}
<Sheet open={mobileCartOpen} onOpenChange={setMobileCartOpen}>
  <SheetContent side="right" class="w-[85vw] p-0">
    {/* Même structure que le panier desktop */}
  </SheetContent>
</Sheet>
```

---

## i18n : nouvelles clés à ajouter dans `en.ts`

```ts
pos.memberNumber: "N° {id}",
pos.discountPercent: "Remise %",
pos.discountAmount: "Remise (DA)",
pos.scanPlaceholder: "📷 Scanner QR code, code-barres ou RFID...",
pos.checkoutButton: "ENCAISSER",
pos.noMember: "Aucun adhérent sélectionné",
pos.memberNotFound: "Adhérent non trouvé",
pos.searchProduct: "Rechercher un produit...",
pos.subscriptionActive: "Abonnement actif",
pos.daysLeft: "{days}j restants",
pos.scanResult: "Code scanné : {code}",
```

---

## Récapitulatif des modifications

| Aspect | Changement |
|---|---|
| **State** | Remplace `discount` par `discountPercent` + `discountAmount` ; ajoute `qrInput`, `panelProductSearch`, `selectedMember`, `mobileCartOpen` |
| **Calcul total** | `total = subtotal - (subtotal × discountPercent / 100) - discountAmount` (inchangé pour le backend) |
| **Members query** | Ajoute `photo_url` au select ; nouvelle query pour subscription du membre sélectionné |
| **Layout panneau** | `h-screen sticky top-0 flex flex-col` au lieu de `Card.sticky top-4` |
| **Section adhérent** | Déplacée en haut du panneau ; ajout photo + abonnement |
| **Section recherche produit** | Nouvelle ; filtre local + suggestions |
| **Section QR/RFID** | Nouveau champ de saisie ; lookup produit par barcode, membre par RFID |
| **Liste panier** | Seule zone scrollable (`flex-1 overflow-y-auto`) ; tous les autres blocs sont `flex-shrink-0` |
| **Totaux** | TVA supprimée ; remise % et remise DA séparées |
| **Bouton** | `ENCAISSER` + montant à droite ; `mt-auto` ; désactivé si panier vide |
| **Mobile** | FAB en bas à droite ouvre Sheet (drawer) ; contenu identique |
| **Aucun impact** | Backend, RPCs, Supabase, types, stock, paiements, historique |
