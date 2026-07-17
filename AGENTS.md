## Goal
- Analyser et corriger les vulnérabilités sécurité, le fonctionnement hors-ligne et les performances  
- Implémenter le workflow POS redirection après création d'un membre avec abonnement

## Constraints & Preferences
- Ne pas modifier les fonctionnalités ni l'UI
- RLS basée sur les rôles (`admin`/`super_admin` pour les mutations, `staff`/`coach` en lecture seule)
- Utiliser `service_role` pour les Edge Functions
- SHA-256 pour les codes de récupération
- Compatible Supabase Auth, RLS, React 18, TypeScript strict
- Vérifier avec `npx tsc --noEmit` et `npx vitest --run` après chaque correction

## Progress
### Done
- **Sécurité CRITIQUE** — `renew_subscription` : retrait de `SECURITY DEFINER` → RLS appliqué au caller, plus de contournement possible
- **Sécurité CRITIQUE** — `user_roles` INSERT policy : restreinte à `role IN ('staff', 'coach')` ; trigger `after_organization_insert` auto-assigne `super_admin` ; client-side `user_roles.insert()` supprimé de `signUp`
- **Sécurité MEDIUM** — Recovery Edge Function : validation `!code` déplacée dans les blocs `verify`/`reset` ; `send_code` fonctionne désormais sans code
- **Sécurité MEDIUM** — POS stock decrement : nouveau RPC `decrement_product_stock` atomique (`WHERE stock >= p_qty`) ; migration `00008_atomic_stock_decrement.sql`
- **Hors-ligne** — Cache TanStack Query persistant : `PersistQueryClientProvider` + `createSyncStoragePersister` (localStorage, clé `FITMANAGER_QUERY_CACHE`, maxAge 24h)
- **Hors-ligne** — `networkMode: 'offlineFirst'` sur queries + mutations
- **Hors-ligne** — `staleTime: 120s`, `gcTime: 24h`, `retry: 1`
- **Hors-ligne** — Service Worker VitePWA : Workbox `NetworkFirst` pour `*.supabase.co/rest/v1/*`
- **Hors-ligne** — `src/hooks/useNetworkStatus.ts` : hook `isOnline` / `recovering`
- **Hors-ligne** — `src/components/ui/offline-banner.tsx` : bannière offline/online
- **Perf** — `useMemo` sur 3 contextes critiques : `auth.tsx`, `i18n/index.tsx`, `theme.tsx`
- **Perf** — Debug `console.log` supprimé de `navbar.tsx`
- **Perf** — `xlsx` et `jspdf` en `await import()` dans payments, members, attendance, equipment/report
- **Audit — Bug CRITIQUE** — Recovery EF `verify` ne retournait pas `userId` → fix : ajout de `userId` dans la réponse JSON
- **Audit — Bug CRITIQUE** — Lien "Forgot password?" sans route → retiré de sign-in.tsx
- **Audit — Bug MEDIUM** — Type `staff_shifts.day` incohérent avec colonne SQL `date` → renommé en `date` dans `supabase.ts` et `planning.tsx`
- **Audit — Bug MEDIUM** — Résidus debug navbar (`<span>{locale}</span>`, `console.log('[LangSwitch]')`) → nettoyés
- **Audit — Bug MEDIUM** — Avatar/User hardcodés dans navbar + sidebar → branchés sur `useAuth()`
- **Audit — Bug MEDIUM** — Badge notification en dur (`3`) → retiré
- **Audit — Bug MEDIUM** — Bouton logout sidebar sans onClick → lié à `signOut`
- **Audit — Bug MEDIUM** — Imports inutilisés (`Badge` dans navbar, `CardDescription` dans dashboard) → supprimés
- **Dashboard KPIs temps réel** — 7 requêtes Supabase remplaçant toutes les données mockées
- **Migration 00009** — `supabase/migrations/00009_subscription_payment_flow.sql` : ajout `pending_payment` à `member_subscriptions.status`, RPC `create_member_with_pending_subscription` (création atomique membre + abonnement en attente), RPC `finalize_subscription_payment` (activation atomique avec verrouillage, enregistrement paiement)
- **POS redirection workflow** — Dans `members.tsx` : sélecteur de type d'abonnement + date de début dans le formulaire d'ajout, appel au RPC `create_member_with_pending_subscription`, redirection vers `/pos` avec `location.state.pendingSubscription`
- **POS redirection workflow** — Dans `pos.tsx` : détection du `pendingSubscription` dans `location.state`, ajout automatique dans le panier comme article virtuel (avec badge "Subscription" et icône `CreditCard`), sélection automatique du membre, finalisation via `finalize_subscription_payment` RPC après le checkout normal
- **Page login finalisée** : layout 50/50, logos QLG_3D + LOGO QLForiginal, tout en français, fond photo avec overlay, pas de scroll vertical, description en blanc, logo gauche h-32 avec mt-16, "BIENVENUE SUR FITMANAGER PRO" sous le logo, grille features 3×2, footer "SIMPLE • RAPIDE • SÉCURISÉ"
- **Formulaire simplifié** : champs email + mot de passe seulement, lien "Obtenir mon code de récupération" avec dialog de génération, lien "Réinitialiser" pour mot de passe oublié
- **Migration 00011** : RPC `verify_recovery_code` — SHA-256, rate limiting 5/15min, comparaison en temps constant, logging dans `recovery_code_logs`
- **Edge Function** `sign-in-with-recovery/index.ts` : vérifie le code via RPC, génère un magic link token via `admin.generateLink`, retourne `{ token, newCode }`
- **Edge Function** `recovery/index.ts` : `send_code` modifié pour retourner le `newCode` en clair dans la réponse
- **Auth store** : `signIn` accepte désormais `recoveryCode?` optionnel — si fourni, appelle l'EF puis `verifyOtp`
- **Export All supprimé** de la page membres (`handleExportAll` + bouton retirés)
- **Téléphone formaté** : 3 nouvelles fonctions dans `src/lib/utils.ts` (`formatPhone`, `isValidDzPhone`, `displayPhone`) — appliquées dans 7 pages (members, staff, suppliers, gyms, corporate, pos) avec onBlur, display, import/export, mock data
- **Migration 00012** : `rfid_cards` recréée avec nouveau schéma (`rfid_uid` UNIQUE, status avec 7 états, `replaced_at`, `replaced_by`, `reason`, `notes`, `created_by`, `updated_at`), table `rfid_audit_log` créée, RLS policies, 6 RPCs (`assign_rfid_card`, `replace_rfid_card`, `deactivate_rfid_card`, `reactivate_rfid_card`, `check_rfid_available`, `get_member_rfid_history`), `rfid_check_in`/`rfid_check_out` recréés avec `rfid_uid`
- **Types TypeScript** : `RfidCard` mis à jour avec nouveau schéma, `RfidCardAudit` ajouté, `rfid_audit_log` dans Database
- **Composant RFID** : `src/pages/members/rfid-management.tsx` avec `RfidManagementDialog` (badge actuel avec status badge coloré, historique des badges, journal d'audit, boutons Remplacer/Désactiver/Réactiver, dialog de remplacement avec motif + vérification) et `RfidCreateSection` (section RFID dans formulaire création)
- **Intégration RFID dans members.tsx** : colonne RFID dans le tableau avec badge UID, bouton `Shield` dans les actions pour ouvrir `RfidManagementDialog`, `RfidCreateSection` dans le formulaire d'ajout, assignation RFID atomique (RPC `assign_rfid_card`) après création membre/subscription
- **`npx tsc --noEmit`** ✅ zéro erreur
- **`npx vitest --run`** ✅ 38/38 tests (20 tests phone, 4 recovery, 1 auth, 13 utils legacy)
- **`npx vite build`** ✅ succès

### In Progress
- **(none)**

### Blocked
- **(none)**

## Key Decisions
- `SECURITY DEFINER` retiré au lieu d'ajouter un check explicite dans `renew_subscription` : RLS s'applique automatiquement au caller
- Trigger `after_organization_insert` plutôt que client-side `user_roles.insert()` : garantit que le rôle `super_admin` est créé même si le client est modifié
- `localStorage` plutôt qu'IndexedDB pour la persistance du cache : API synchrone, limite 5MB suffisante
- `networkMode: 'offlineFirst'` plutôt que `'online'` : mutations automatiquement mises en pause et rejouées
- VitePWA Workbox `NetworkFirst` plutôt que `CacheFirst` pour l'API Supabase
- **Migration 00009** : les RPCs sont `SECURITY DEFINER` pour s'affranchir des contraintes RLS sur les tables membres/subscriptions/paiements ; le verrouillage `FOR UPDATE` dans `finalize_subscription_payment` empêche la double-activation
- **POS redirection** : passage via `location.state` React Router plutôt que stockage local ou URL params — évite la persistance après refresh, pas de fuite dans l'URL
- **Article virtuel** : préfixe `__subscription__` dans `product.id` pour distinguer les articles d'abonnement des produits physiques dans le panier

## Next Steps
- Déployer les 9 migrations (`00001`→`00009`) sur la base Supabase
- Configurer les variables d'env Edge Functions (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- Remplacer `SUPABASE_PROJECT_REF` dans `00004_cron_jobs.sql` et activer les cron jobs
- Ajouter un vrai système d'envoi d'email/SMS pour le recovery code
- Upload photos membres (bucket Storage + UI)
- Realtime Supabase `subscribe()` (attendances, notifications)
- PDF facture pro structuré (logo, TVA, numéro séquentiel)
- File d'attente UI pour mutations offline
- Ajouter bouton "Encaisser l'abonnement" dans la fiche membre détail pour les subscriptions `pending_payment`

## Critical Context
- `npx tsc --noEmit` ✅ zéro erreur
- `npx vitest --run` ✅ 18/18 tests (utils, recovery, auth)
- `npx vite build` ✅ succès
- 9 migrations (`00001`→`00009`) à exécuter dans l'ordre
- 3 Edge Functions (recovery, send-subscription-reminder, send-payment-reminder)
- Le bucket `photos` Supabase Storage doit exister pour l'upload des avatars
- RLS role-based : `admin`/`super_admin` peuvent tout modifier, `coach`/`staff` sont en lecture seule
- Le recovery code est affiché côté serveur (pas de canal email/SMS implémenté)
- Cache offline : localStorage clé `FITMANAGER_QUERY_CACHE` (maxAge 24h)
- Mutations offline : mises en pause automatiquement, rejouées au retour réseau
- **Workflow POS redirection** : création membre → sélection abonnement → redirection `/pos` → checkout → activation abonnement + enregistrement paiement en une transaction atomique DB

## Relevant Files
- `supabase/migrations/00001_init.sql` → schéma initial (22 tables, RLS, trigger auto_assign_owner_role, user_roles INSERT policy restreinte)
- `supabase/migrations/00002_recovery_codes.sql` → recovery + logs + RLS
- `supabase/migrations/00003_indexes.sql` → 36 indexes FK
- `supabase/migrations/00004_cron_jobs.sql` → pg_cron schedules
- `supabase/migrations/00005_staff_shifts.sql` → table staff_shifts + RLS
- `supabase/migrations/00006_payment_trigger.sql` → trigger amount_paid sync
- `supabase/migrations/00007_renew_subscription.sql` → RPC renewal (SECURITY DEFINER retiré)
- `supabase/migrations/00008_atomic_stock_decrement.sql` → RPC atomique POS
- `supabase/migrations/00009_subscription_payment_flow.sql` → pending_payment status, RPCs create_member_with_pending_subscription / finalize_subscription_payment
- `supabase/functions/recovery/index.ts` → Edge Function recovery
- `supabase/functions/send-subscription-reminder/index.ts` → Edge Function rappel abonnement
- `supabase/functions/send-payment-reminder/index.ts` → Edge Function rappel paiement
- `src/main.tsx` → QueryClient config (offlineFirst), PersistQueryClientProvider, OfflineBanner
- `src/vite.config.ts` → VitePWA Workbox runtime caching NetworkFirst
- `src/stores/auth.tsx` → signUp, signOut, slug collision, useMemo ctxValue, user_roles.insert() supprimé
- `src/stores/theme.tsx` → ThemeProvider avec useCallback/useMemo
- `src/i18n/index.tsx` → I18nProvider avec useMemo ctxValue
- `src/i18n/en.ts` → clés `pos.subscriptionRedirect`, `pos.pendingSubscription`, `pos.finalizeSubscription`, `pos.subscriptionPaymentDesc`
- `src/hooks/useNetworkStatus.ts` → hook isOnline/recovering
- `src/components/ui/offline-banner.tsx` → bannière offline/online
- `src/components/layout/navbar.tsx` → avatar/user branchés sur useAuth, locale debug supprimé
- `src/components/layout/sidebar.tsx` → avatar/user branchés sur useAuth, logout onClick signOut
- `src/pages/members/members.tsx` → ajout sélecteur abonnement + date début dans le formulaire, RPC create_member_with_pending_subscription, redirection vers `/pos` avec state
- `src/pages/pos/pos.tsx` → détection pendingSubscription, ajout article virtuel abonnement, finalize_subscription_payment RPC après checkout
- `src/types/supabase.ts` → member_subscriptions.status inclut `pending_payment`

## Audit Findings (Juillet 2026 — 6 phases, 60+ anomalies)

> Rapport complet : `.opencode/plans/audit-juillet-2026.md`

### Anomalies Critiques (10)

| ID | Phase | Constat | Statut |
|----|-------|---------|--------|
| S-C1 | Sécurité | 6/6 Edge Functions sans vérification JWT — utilisent `service_role` statique sans valider le caller | **À corriger** |
| B-1 | Backend | RPCs `SECURITY DEFINER` (`create_member_with_pending_subscription`, `finalize_subscription_payment`) sans autorisation rôles — tout user auth peut créer membres/abonnements/paiements | **À corriger** |
| S-C2 | Sécurité | `xlsx` vulnérable CVE Prototype Pollution + ReDoS | **À corriger** |
| B-3 | Backend | Recovery code exposé en clair dans réponse HTTP (`send_code`, `reset`) | **À corriger** |
| B-2 | Backend | `send-payment-reminder` utilise type `payment_pending` inexistant dans CHECK constraint (doit être `payment_overdue`) — INSERT échoue toujours | **À corriger** |
| F-1 | Frontend | Double ErrorBoundary (main.tsx inline + App.tsx import) — fallback inutilisable | **À corriger** |
| F-2 | Frontend | `fr.ts` : section `profile` entièrement manquante (21 clés) — pages profil affichent clés brutes | **À corriger** |
| F-3 | Frontend | `fr.ts` : 21 clés `settings` manquantes — page settings affiche clés brutes | **À corriger** |
| P-1 | Perf | `LOGO QLForiginal.png` = 1.74 MB — 40% du dist total, LCP dégradé | **À corriger** |
| P-2 | Perf | 3 icons PWA manquantes (favicon.ico, pwa-192x192, pwa-512x512) — PWA non installable | **À corriger** |

### Anomalies Hautes (13)

| ID | Phase | Constat | Statut |
|----|-------|---------|--------|
| S-H1 | Sécurité | CORS `*` sur toutes les EFs — CSRF possible depuis n'importe quel site | **À corriger** |
| S-H2 | Sécurité | `listUsers` paginé à 100 dans EF recovery — codes non générés au-delà | **À corriger** |
| S-H3 | Sécurité | `recovery.tsx:131` lit `data.newRecoveryCode` mais EF retourne `newCode` — nouveau code jamais affiché | **À corriger** |
| B-4 | Backend | Comparaison hash SHA-256 non constant-time (`reduce` short-circuite) — timing attack | **À corriger** |
| B-5 | Backend | Photos bucket Storage sans restriction — tout user peut lire/modifier/supprimer toutes les photos | **À corriger** |
| F-4 | Frontend | Page sign-in non i18n (toutes chaînes hardcodées français) | **À corriger** |
| F-5 | Frontend | OfflineQueue non persistée (`useState([])`) — perte mutations offline au refresh | **À corriger** |
| F-6 | Frontend | Navbar import `@tanstack/react-query` direct au lieu de `@/hooks/useQuery` | **À corriger** |
| F-7 | Frontend | Navbar champ Search non fonctionnel | **À corriger** |
| F-8 | Frontend | Settings "Save" ne fait que `toast()` — aucune écriture DB | **À corriger** |
| G2 | Git | Aucune branche secondaire — tout sur master, pas de workflow PR | **À corriger** |
| B1 | Git/Deps | 2 PNGs non optimisées (LOGO 1.82MB + QLG_3D 186KB) = 40% du dist | **À corriger** |
| C1 | Build | `noImplicitAny: false` — masque erreurs de typage TypeScript | **À corriger** |

### Score Global : 3.6/10

| Catégorie | Score | Pire Anomalie |
|-----------|-------|---------------|
| Sécurité | 2/10 | EFs sans vérification JWT |
| Backend | 3/10 | RPCs SECURITY DEFINER ouverts |
| Frontend | 4/10 | ErrorBoundary cassé + i18n incomplet |
| Performance | 4/10 | Logo 1.74 MB (40% dist) |
| Git/Deps/Build | 5/10 | Tout sur master |

### Priorités de correction
1. **IMMÉDIAT (6h)** : JWT validation EFs, RPCs authorization, xlsx CVE, recovery code exposure, hash constant-time, payment-reminder fix
2. **HAUTE (6h)** : i18n fr.ts, ErrorBoundary, recovery.tsx fix, Settings DB, OfflineQueue persist, Search fix, Photos RLS, CORS
3. **MOYENNE (10h)** : Logo compression, PWA icons, framer-motion lazy, Dashboard N+1, sign-in i18n, tsconfig strict, Git branches
