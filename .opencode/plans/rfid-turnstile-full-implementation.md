# Plan complet — Anti-fraude RFID + Gestion pannes tourniquet

## Ordre d'implémentation
1. Migration 00010
2. Types supabase.ts
3. RPCs (déjà dans la migration)
4. Refonte Kiosk
5. Refonte Access Control
6. Modif Attendance
7. Modif Dashboard
8. i18n
9. Vérifications

---

## 1. Migration `00010_rfid_turnstile.sql`

```sql
-- Extend members status
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'blocked'));

-- rfid_cards
CREATE TABLE rfid_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
  card_uid TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lost', 'stolen', 'expired')),
  issued_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- rfid_read_logs
CREATE TABLE rfid_read_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_uid TEXT NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  terminal TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('check-in', 'check-out', 'denied')),
  result TEXT NOT NULL CHECK (result IN ('granted', 'denied', 'pending')),
  reason TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ DEFAULT now()
);

-- turnstile_status
CREATE TABLE turnstile_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  terminal TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'offline', 'fault')),
  last_heartbeat TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, terminal)
);

-- manual_validations
CREATE TABLE manual_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('breakdown', 'maintenance', 'emergency', 'test', 'other')),
  reason_detail TEXT,
  terminal TEXT,
  validated_at TIMESTAMPTZ DEFAULT now()
);

-- Alter attendance
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'rfid'
    CHECK (source IN ('rfid', 'manual', 'app'));
ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS access_control_id UUID
    REFERENCES access_control(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rfid_cards_card_uid ON rfid_cards(card_uid);
CREATE INDEX IF NOT EXISTS idx_rfid_cards_member_id ON rfid_cards(member_id);
CREATE INDEX IF NOT EXISTS idx_rfid_read_logs_card_uid ON rfid_read_logs(card_uid);
CREATE INDEX IF NOT EXISTS idx_rfid_read_logs_read_at ON rfid_read_logs(read_at);
CREATE INDEX IF NOT EXISTS idx_turnstile_status_org ON turnstile_status(organization_id);
CREATE INDEX IF NOT EXISTS idx_manual_validations_org ON manual_validations(organization_id);
CREATE INDEX IF NOT EXISTS idx_manual_validations_date ON manual_validations(validated_at);
CREATE INDEX IF NOT EXISTS idx_attendance_source ON attendance(source);

-- RLS rfid_cards
ALTER TABLE rfid_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view rfid_cards" ON rfid_cards FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)));
CREATE POLICY "Admins can manage rfid_cards" ON rfid_cards FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)
    AND ue.role IN ('admin', 'super_admin')));

-- RLS rfid_read_logs
ALTER TABLE rfid_read_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view rfid_read_logs" ON rfid_read_logs FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue JOIN members m ON m.id = rfid_read_logs.member_id
    WHERE ue.user_id = auth.uid() AND ue.organization_id = m.organization_id));
CREATE POLICY "Admins can manage rfid_read_logs" ON rfid_read_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id IN (SELECT organization_id FROM members WHERE id = member_id)
    AND ue.role IN ('admin', 'super_admin')));

-- RLS turnstile_status
ALTER TABLE turnstile_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view turnstile_status" ON turnstile_status FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid() AND ue.organization_id = turnstile_status.organization_id));
CREATE POLICY "Admins can manage turnstile_status" ON turnstile_status FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid() AND ue.organization_id = turnstile_status.organization_id
    AND ue.role IN ('admin', 'super_admin')));

-- RLS manual_validations
ALTER TABLE manual_validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view manual_validations" ON manual_validations FOR SELECT
  USING (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid() AND ue.organization_id = manual_validations.organization_id));
CREATE POLICY "Staff can insert manual_validations" ON manual_validations FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles ue WHERE ue.user_id = auth.uid()
    AND ue.organization_id = manual_validations.organization_id
    AND ue.role IN ('admin', 'super_admin', 'staff')));
```

## 2. RPCs (dans la même migration)

### rfid_check_in(p_card_uid TEXT, p_terminal TEXT) RETURNS JSONB
- SECURITY DEFINER
- Étapes:
  1. Debounce 3s (vérifie rfid_read_logs même card < 3s)
  2. Verrouille rfid_cards FOR UPDATE
  3. Vérifie card.status = 'active'
  4. Vérifie card.expires_at > NOW() ou NULL
  5. Verrouille members FOR UPDATE
  6. Vérifie member.status NOT IN ('suspended', 'blocked', 'inactive')
  7. Vérifie abonnement actif (status = 'active' AND date OK)
  8. Vérifie pas de check_in sans check_out
  9. Vérifie turnstile_status
     - Online → crée attendance (source='rfid'), return granted
     - Offline/Fault → return pending (pas d'attendance créée)
  - Journalise chaque étape dans rfid_read_logs

### rfid_check_out(p_card_uid TEXT, p_terminal TEXT) RETURNS JSONB
- Debounce 3s
- Trouve attendance active
- Update check_out
- Update member.last_visit

### manual_check_in(p_member_id, p_user_id, p_reason, p_terminal, p_reason_detail) RETURNS JSONB
- Vérifie rôle (admin/super_admin/staff)
- Vérifie motif valide
- Vérifie member non suspendu/bloqué
- Vérifie abonnement actif
- Vérifie pas de check-in actif
- Crée attendance (source='manual')
- Insère manual_validations
- Journalise rfid_read_logs

### turnstile_heartbeat(p_organization_id, p_terminal, p_status) RETURNS JSONB
- UPSERT turnstile_status

### get_turnstile_dashboard(p_organization_id) RETURNS JSONB
- total_terminals, online, offline, fault, manual_validations_today, manual_validations_total

---

## 3. Types (`src/types/supabase.ts`)

Ajouter dans Database.public.Tables :
- rfid_cards (Row/Insert/Update)
- rfid_read_logs (Row/Insert/Update)
- turnstile_status (Row/Insert/Update)
- manual_validations (Row/Insert/Update)

Modifier :
- members.status → ajouter 'suspended' | 'blocked'
- attendance → ajouter source + access_control_id

Ajouter les type exports :
- export type RfidCard = ...
- export type RfidReadLog = ...
- export type TurnstileStatus = ...
- export type ManualValidation = ...

---

## 4. Kiosk (`kiosk.tsx`) — REFONTE COMPLÈTE

Structure :
```
<PageHeader title kiosk desc />
<Card>
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left: RFID Input + Status -->
    <div className="lg:col-span-2">
      <div>Turnstile Status indicator (4 states)</div>
      <div>RFID Input field + "Scan" button</div>
      <div>OR Member search fallback</div>
      <div>Result display (granted/denied/pending)</div>
    </div>
    <!-- Right: Recent logs -->
    <div>
      <h3>Recent RFID reads</h3>
      <ScrollArea>list of last 10 logs</ScrollArea>
    </div>
  </div>
</Card>

<!-- Manual Validation Dialog (admin/staff only) -->
<Dialog>
  <Button "VALIDATION MANUELLE" />
  <DialogContent>
    member search + reason select + detail text + confirm
  </DialogContent>
</Dialog>
```

### État
- cardUid: string
- scanResult: { status, reason, member_name } | null
- isScanning: boolean
- recentLogs: RfidReadLog[]
- turnstileStats: dashboard object
- memberSearch: string
- selectedMemberId: string
- manualReason: string
- manualDetail: string
- showManualDialog: boolean
- showSuccess: boolean

### Queries/Mutations
- rfidCheckInMutation → supabase.rpc('rfid_check_in')
- rfidCheckOutMutation → supabase.rpc('rfid_check_out')
- manualCheckInMutation → supabase.rpc('manual_check_in')
- turnstileDashboard query → supabase.rpc('get_turnstile_dashboard')
- Recent logs query → supabase.from('rfid_read_logs').select('*, member:members(first_name, last_name)').order('read_at', { ascending: false }).limit(10)

### i18n keys
```
kiosk.rfidPlaceholder: "Scanner le badge RFID..."
kiosk.scan: "Scan"
kiosk.scanning: "Scan en cours..."
kiosk.granted: "Accès autorisé"
kiosk.denied: "Accès refusé"
kiosk.pending: "En attente du tourniquet"
kiosk.reason: "Motif"
kiosk.manualValidation: "VALIDATION MANUELLE"
kiosk.manualConfirm: "Confirmer la validation manuelle"
kiosk.manualReason: "Motif de la validation"
kiosk.manualDetail: "Détail (optionnel)"
kiosk.manualBreakdown: "Panne"
kiosk.manualMaintenance: "Maintenance"
kiosk.manualEmergency: "Urgence"
kiosk.manualTest: "Test"
kiosk.manualOther: "Autre"
kiosk.selectReason: "Sélectionner un motif"
kiosk.recentReads: "Lectures récentes"
kiosk.noRecentReads: "Aucune lecture récente"
kiosk.turnstileOnline: "Tourniquet connecté"
kiosk.turnstileOffline: "Tourniquet hors ligne"
kiosk.turnstileFault: "Tourniquet en panne"
kiosk.turnstileManual: "Validation manuelle active"
kiosk.searchMember: "Rechercher un adhérent..."
kiosk.selectMember: "Sélectionner un adhérent"
kiosk.manualSuccess: "Validation manuelle effectuée"
kiosk.welcomeBack: "Bienvenue {name}"
kiosk.checkOutSuccess: "Check-out effectué"
kiosk.checkOut: "Check-Out"
```

---

## 5. Access Control (`access-control.tsx`) — CONVERSION DB

### Structure
```
<PageHeader title="Contrôle d'accès" />
<Tabs>
  <Tab "Dashboard">
    <div className="grid grid-cols-4 gap-4">
      <Card> Tourniquet connecté: {N} </Card>
      <Card> Tourniquet hors ligne: {N} </Card>
      <Card> Tourniquet en panne: {N} </Card>
      <Card> Validations manuelles aujourd'hui: {N} </Card>
    </div>
    <Card title="Validations manuelles du jour">
      <Table> user, member, reason, detail, terminal, date </Table>
    </Card>
  </Tab>
  <Tab "Tourniquets">
    <Table> name, type, terminal, status, last_heartbeat, actions (edit/toggle) </Table>
  </Tab>
  <Tab "Historique">
    <div>Filters: date range, reason, user</div>
    <Table> list of manual_validations </Table>
    <Button> Export Excel </Button>
  </Tab>
</Tabs>
```

### Queries
- turnstileDashboard → supabase.rpc('get_turnstile_dashboard', { p_organization_id: orgId })
- turnstileList → supabase.from('turnstile_status').select('*').eq('organization_id', orgId)
- manualValidations → supabase.from('manual_validations').select('*, member:members(first_name,last_name), user:auth.users(id,email)').eq('organization_id', orgId).order('validated_at', { ascending: false })
- accessControl → supabase.from('access_control').select('*').eq('organization_id', orgId)

### Mutations
- upsert access_control device
- toggle active
- heartbeat update (simulation)

### i18n keys
```
accessControl.dashboard: "Tableau de bord"
accessControl.turnstiles: "Tourniquets"
accessControl.history: "Historique"
accessControl.connected: "Connecté"
accessControl.offline: "Hors ligne"
accessControl.fault: "En panne"
accessControl.manualActive: "Validation manuelle active"
accessControl.validationsToday: "Validations manuelles aujourd'hui"
accessControl.terminal: "Terminal"
accessControl.lastHeartbeat: "Dernier battement"
accessControl.reason: "Motif"
accessControl.validatedBy: "Validé par"
accessControl.member: "Adhérent"
accessControl.detail: "Détail"
accessControl.date: "Date"
accessControl.export: "Export Excel"
accessControl.noData: "Aucune donnée"
```

---

## 6. Attendance (`attendance.tsx`) — MODIFS

- Ajouter filtre source stateless: 'all' | 'rfid' | 'manual' | 'app'
- Ajouter colonne source dans les tableaux
- Badge "MANUEL" (bg-orange) pour source='manual'
- Badge "RFID" (bg-blue) pour source='rfid'
- Badge "APP" (bg-green) pour source='app'

### i18n keys
```
attendance.source: "Source"
attendance.rfid: "RFID"
attendance.manual: "Manuel"
attendance.app: "Application"
attendance.all: "Toutes"
```

---

## 7. Dashboard (`dashboard.tsx`) — AJOUT WIDGETS

Ajouter dans la grille des KPIs:

```tsx
// Dans le dashboard, ajouter les queries:
const { data: turnstileStats } = useQuery({
  queryKey: ['turnstile-dashboard', orgId],
  queryFn: async () => {
    const { data } = await (supabase.rpc as any)('get_turnstile_dashboard', { p_organization_id: orgId })
    return data as { total_terminals: number; online: number; offline: number; fault: number; manual_validations_today: number; manual_validations_total: number }
  },
  enabled: !!orgId,
})
```

Ajouter un composant statut tourniquet dans la grille :
- 4 petites cartes (connected/offline/fault/manual validation)

### i18n keys
```
dashboard.turnstileStatus: "État du tourniquet"
dashboard.turnstileOnline: "Connecté"
dashboard.turnstileOffline: "Hors ligne"
dashboard.turnstileFault: "En panne"
dashboard.manualValidations: "Validations manuelles"
dashboard.today: "aujourd'hui"
```

---

## 8. Fichiers modifiés

1. `supabase/migrations/00010_rfid_turnstile.sql` — CRÉATION
2. `src/types/supabase.ts` — MODIFICATION
3. `src/pages/check-in-kiosk/kiosk.tsx` — RÉÉCRITURE COMPLÈTE
4. `src/pages/access-control/access-control.tsx` — RÉÉCRITURE COMPLÈTE
5. `src/pages/attendance/attendance.tsx` — MODIFICATION
6. `src/pages/dashboard/dashboard.tsx` — MODIFICATION
7. `src/i18n/en.ts` — AJOUT DE CLÉS

---

## 9. Vérifications finales
- `npx tsc --noEmit` ✅
- `npx vitest --run` ✅
- `npx vite build` ✅
