# Rapport d'Audit Consolidé — FitManager Pro
**Date :** Juillet 2026 | **Périmètre :** 6 phases (Git/Deps/Build, Frontend, Backend, Sécurité, Performance)

---

## 1. Résumé Exécutif

L'audit en 6 phases de FitManager Pro révèle une application fonctionnelle mais portant des vulnérabilités critiques principalement concentrées sur la **sécurité backend** (Edge Functions sans validation JWT, RPCs SECURITY DEFINER ouverts à tout utilisateur authentifié, codes de récupération exposés en clair) et des **dysfonctionnements fonctionnels** (clés i18n manquantes, fallback ErrorBoundary inutilisable, boutons/settings non-opérationnels). La dette technique est notable : couverture de test faible (38 tests pour 20+ pages), images non optimisées représentant 40% du bundle, et une configuration TypeScript permissive masquant les erreurs de typage.

**Scores par phase (sur 10) :**

| Phase | Score | Détail |
|-------|-------|--------|
| Git/Deps/Build | 5/10 | Tout sur master, images non optimisées, pas de tests d'intégration |
| Frontend | 4/10 | 3 anomalies critiques, 5 hautes — i18n cassé, composants non-opérationnels |
| Backend | 3/10 | 3 anomalies critiques — RPCs ouverts, EF cassée, secret exposé |
| Sécurité | 2/10 | 2 critiques — aucune EF ne valide le JWT, CVE dans xlsx |
| Performance | 4/10 | 2 critiques — logo 1.74 MB, icons PWA manquantes |

---

## 2. Scorecard Global

| Catégorie | Score | Anomalies Critiques | Anomalies Hautes | Pire Anomalie |
|-----------|-------|--------------------|--------------------|---------------|
| Sécurité | 2/10 | 2 | 3 | EFs sans vérification JWT |
| Backend | 3/10 | 3 | 2 | RPCs SECURITY DEFINER ouverts |
| Frontend | 4/10 | 3 | 5 | ErrorBoundary double + i18n cassé |
| Performance | 4/10 | 2 | 1 | Logo 1.74 MB (40% dist) |
| Git/Deps/Build | 5/10 | 0 | 2 | Tout sur master, pas de branches |
| **Global** | **3.6/10** | **10** | **13** | |

---

## 3. Top 10 des Anomalies Critiques

| # | ID | Phase | Constat | Impact |
|---|----|-------|---------|--------|
| 1 | S-C1 | Sécurité | 6/6 Edge Functions sans vérification JWT — utilisent `service_role` statique sans valider le caller | Tout utilisateur authentifié peut invoquer n'importe quelle EF avec les privilèges service_role |
| 2 | B-1 | Backend | RPCs `SECURITY DEFINER` (`create_member_with_pending_subscription`, `finalize_subscription_payment`) sans autorisation rôles | Tout user auth peut créer membres/abonnements/paiements en contournant RLS |
| 3 | S-C2 | Sécurité | `xlsx` (xlsx-js) vulnérable CVE Prototype Pollution + ReDoS | Exécution de code arbitrary via document Excel malveillant |
| 4 | B-3 | Backend | Recovery code exposé en clair dans réponse HTTP (`send_code`, `reset`) | Le code secret est transmis en clair — interception possible sans HTTPS strict |
| 5 | B-2 | Backend | `send-payment-reminder` utilise type `payment_pending` qui n'existe pas dans CHECK constraint (doit être `payment_overdue`) | INSERT échoue à chaque exécution — les rappels ne partent jamais |
| 6 | F-1 | Frontend | Double ErrorBoundary (main.tsx inline + App.tsx import) — fallback inutilisable | Le ErrorBoundary ne catch rien ou les deux se superposent de manière incohérente |
| 7 | F-2 | Frontend | `fr.ts` : section `profile` entièrement manquante (21 clés) | Pages profil affichent des clés brutes `[profile.xxx]` |
| 8 | F-3 | Frontend | `fr.ts` : 21 clés `settings` manquantes | Page settings affiche des clés brutes `[settings.xxx]` |
| 9 | P-1 | Perf | `LOGO QLForiginal.png` = 1.74 MB — 40% du dist total | Temps de chargement initial dégradé, LCP > 3s |
| 10 | P-2 | Perf | 3 icons PWA manquantes (favicon.ico, pwa-192x192, pwa-512x512) | PWA non installable, erreurs console |

---

## 4. Top 15 des Anomalies Hautes

| # | ID | Phase | Constat | Impact |
|---|----|-------|---------|--------|
| 1 | S-H1 | Sécurité | CORS `*` sur toutes les EFs | N'importe quel site peut appeler les EFs — CSRF possible |
| 2 | S-H2 | Sécurité | `listUsers` paginé à 100 dans EF recovery | Récupération limitée aux 100 premiers users — codes non générés au-delà |
| 3 | S-H3 | Sécurité | `recovery.tsx:131` lit `data.newRecoveryCode` mais EF retourne `newCode` | Le nouveau code de récupération n'est jamais affiché après réinitialisation |
| 4 | B-4 | Backend | Comparaison hash SHA-256 non constant-time (`reduce` short-circuite) | Timing attack possible pour deviner le hash |
| 5 | B-5 | Backend | Photos bucket Storage sans restriction de chemin — tout user peut lire/modifier/supprimer toutes les photos | Données membres exposées, suppression massive possible |
| 6 | F-4 | Frontend | Page sign-in non i18n (toutes chaînes hardcodées français) | Application bilingue impossible — sign-in toujours en français |
| 7 | F-5 | Frontend | `OfflineQueue` non persistée (`useState([])`) — perte données au refresh | Mutations offline perdues si l'utilisateur rafraîchit la page |
| 8 | F-6 | Frontend | Navbar import `@tanstack/react-query` direct au lieu de `@/hooks/useQuery` | Chemin d'import non conforme, risque de résolution échouée |
| 9 | F-7 | Frontend | Navbar champ Search non fonctionnel | Recherche dans la navbar ne retourne aucun résultat |
| 10 | F-8 | Frontend | Settings "Save" ne fait que `toast()` — aucune écriture DB | Les modifications settings sont perdues à chaque rechargement |
| 11 | G2 | Git | Aucune branche secondaire — tout sur master | Pas de workflow Git, risque de push direct sur production |
| 12 | B1 | Git/Deps | 2 PNGs non optimisées : LOGO (1.82MB) + QLG_3D (186KB) = 40% du dist | Bundle gonflé, temps de chargement dégradé |
| 13 | C1 | Build | `noImplicitAny: false` — masque erreurs de typage | Erreurs de type silencieuses = bugs potentiels en production |
| 14 | P-3 | Perf | Double `<link rel="manifest">` dans index.html | Navigateur peut charger un manifest vide ou incorrect |
| 15 | P-4 | Perf | `framer-motion` (160 kB) dans bundle principal via App.tsx | Bundle principal gonflé de 160 KB inutilement chargé |

---

## 5. Synthèse par Phase

### Phase 2 — Git / Dépendances / Build
**Ce qui va bien :** Build Vite fonctionne, tests passent, dependencies installées.
**Ce qui va mal :** Tout est sur master (pas de branches), .gitignore minimaliste, `ws` en dépendance runtime suspecte, config TypeScript trop permissive (`noImplicitAny: false`), manifest HTML et lang buggés.

### Phase 3 — Frontend
**Ce qui va bien :** Architecture React propre, hooks personnalisés, i18n en place (même si cassée).
**Ce qui va mal :** 3 anomalies critiques (ErrorBoundary cassé, i18n profils + settings manquants), 5 hautes (sign-in non i18n, offline queue non persistée, search/settings/save cassés). Composants monolithiques (members 921 lignes, dashboard 11 queries séparées).

### Phase 4 — Backend
**Ce qui va bien :** Schéma DB bien structuré, RLS en place, migrations sequencées.
**Ce qui va mal :** 3 critiques (RPCs ouverts, EF cassée, secret exposé), duplication de code SHA-256 entre EFs, inconsistencies auth.role() vs auth.jwt(), sequences non scoped par org.

### Phase 5 — Sécurité
**Ce qui va bien :** Migration `renew_subscription` corrigée, RLS role-based en place.
**Ce qui va mal :** 2 critiques (aucune EF ne valide le JWT, CVE xlsx), CORS `*` partout, comparaison hash non constant-time, token invitation exposé.

### Phase 6 — Performance
**Ce qui va bien :** VitePWA configuré, lazy loading部分实现, cache TanStack Query persistant.
**Ce qui va mal :** Logo 1.74 MB = 40% du dist, 3 icons PWA manquantes, framer-motion en bundle principal, recharts 386 KB, dashboard N+1.

---

## 6. Plan de Correction Recommandé

### Priorité 1 — IMMÉDIAT (sécurité, bloquants fonctionnels)

| # | Anomalie | Effort | Fichiers concernés |
|---|----------|--------|--------------------|
| 1 | **EFs sans vérification JWT** — Ajouter vérification `Authorization` header + JWT decode dans les 6 EFs | 2h | `supabase/functions/*/index.ts` |
| 2 | **RPCs SECURITY DEFINER ouverts** — Ajouter `auth.jwt()->> 'role' IN ('admin','super_admin')` check | 1h | `supabase/migrations/00009*.sql` |
| 3 | **xlsx CVE** — Upgrade `xlsx` vers version corrigée ou remplacer par `exceljs` | 1h | `package.json` |
| 4 | **Recovery code exposé** — Supprimer le `newCode` de la réponse, l'envoyer uniquement par canal sécurisé | 1h | `supabase/functions/recovery/index.ts` |
| 5 | **send-payment-reminder cassée** — Corriger `payment_pending` → `payment_overdue` | 15min | `supabase/functions/send-payment-reminder/index.ts` |
| 6 | **Comparaison hash constant-time** — Utiliser `crypto.timingSafeEqual` | 30min | `supabase/functions/recovery/index.ts` |

### Priorité 2 — HAUTE (fonctionnel cassé)

| # | Anomalie | Effort | Fichiers concernés |
|---|----------|--------|--------------------|
| 7 | **i18n fr.ts manquant** — Ajouter 42 clés (profile + settings) | 1h | `src/i18n/fr.ts` |
| 8 | **ErrorBoundary double** — Supprimer l'un des deux, garder celui de App.tsx | 15min | `src/main.tsx` |
| 9 | **recovery.tsx newRecoveryCode vs newCode** — Corriger le nom de propriété | 10min | `src/pages/recovery.tsx` |
| 10 | **Settings Save cassé** — Brancher sur mutation Supabase | 1h | `src/pages/settings.tsx` |
| 11 | **OfflineQueue non persistée** — Persister dans localStorage | 1h | `src/hooks/useOfflineQueue.ts` |
| 12 | **Navbar Search cassé** — Implémenter la recherche ou retirer le champ | 1h | `src/components/layout/navbar.tsx` |
| 13 | **Photos bucket** — Ajouter RLS policies avec chemin `org_id/user_id/*` | 30min | Migration SQL |
| 14 | **CORS `*`** — Restreindre aux origins autorisés | 30min | `supabase/functions/*/index.ts` |

### Priorité 3 — MOYENNE (performance, UX)

| # | Anomalie | Effort | Fichiers concernés |
|---|----------|--------|--------------------|
| 15 | **Logo 1.74 MB** — Compresser en WebP, max 50KB | 30min | `public/LOGO QLForiginal.png` |
| 16 | **Icons PWA manquantes** — Générer les 3 icons | 30min | `public/` |
| 17 | **framer-motion en bundle** — Lazy load ou supprimer si non utilisé | 1h | `src/App.tsx` |
| 18 | **Dashboard N+1** — Fusionner en une seule RPC | 2h | `src/pages/dashboard.tsx` + migration SQL |
| 19 | **Sign-in non i18n** — Externaliser les chaînes | 1h | `src/pages/auth/sign-in.tsx` |
| 20 | **noImplicitAny: true** — Activer et corriger les erreurs | 2-4h | `tsconfig.json` + fichiers TS |
| 21 | **Branches Git** — Créer `develop` + workflow PR | 30min | Git |
| 22 | **manifest HTML + lang** — Corriger en fr, supprimer double link | 10min | `index.html` |
| 23 | **listUsers pagination** — Implémenter pagination complète | 1h | `supabase/functions/recovery/index.ts` |
| 24 | **Token invitation exposé** — Masquer dans les réponses | 30min | EFs + RPCs |

---

**Total estimé :** ~25-30h de travail pour tout corriger. Priorité 1 (6h) = bloquant sécurité.
