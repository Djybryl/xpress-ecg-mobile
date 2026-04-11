# Plan d'implémentation — Application mobile multi-profils
## Xpress ECG · `xpress-ecg-mobile`

> Dernière mise à jour : avril 2026

**Phase 1 (socle)** : implémentée dans le dépôt — groupe `app/(medecin)/`, routage par rôle (`homeRouteForRole`), garde `useRoleGuard`, stubs `(cardiologue)` / `(secretaire)` / `(admin)`.

---

## Vue d'ensemble de ce qui existe déjà

Avant les phases, voici ce que le code actuel fournit **gratuitement** :

| Élément | État | Fichier |
|---|---|---|
| `UserRole` avec 4 rôles | ✅ Déjà défini | `src/types/user.ts` |
| `AuthProvider` + biométrie | ✅ Complet | `src/providers/AuthProvider.tsx` |
| `login.tsx` | ✅ Existant | `app/(auth)/login.tsx` |
| `ThemeProvider` + dark mode | ✅ Complet | `src/providers/ThemeProvider.tsx` |
| `apiClient.ts` + token refresh | ✅ Complet | `src/lib/apiClient.ts` |
| Écrans médecin (5 onglets) | ✅ Fonctionnels | `app/(medecin)/` |

> ~~**Point bloquant**~~ : corrigé — `app/index.tsx` et la connexion redirigent vers `homeRouteForRole(user.role)`.

---

## Phase 1 — Socle structurel
**Durée estimée : ~1 jour**
**Objectif : migrer sans rien casser, poser l'architecture multi-rôles.**

### 1.1 Renommer le groupe médecin

```
app/(tabs)/    →    app/(medecin)/
```

Tous les fichiers bougent, aucun code modifié. Le comportement reste identique pour le médecin.

### 1.2 Routage par rôle dans `app/index.tsx`

Le fichier actuel redirige toujours vers `/(tabs)`. Il devient le **hub de routage central** :

```typescript
// app/index.tsx — après modification
if (user) {
  switch (user.role) {
    case 'medecin':      router.replace('/(medecin)'); break;
    case 'cardiologue':  router.replace('/(cardiologue)'); break;
    case 'secretaire':   router.replace('/(secretaire)'); break;
    case 'admin':        router.replace('/(admin)'); break;
  }
}
```

### 1.3 Garde de rôle dans chaque `_layout.tsx`

Chaque groupe de routes reçoit un garde qui bloque l'accès si le rôle ne correspond pas :

```typescript
// Pattern réutilisé dans chaque _layout.tsx de groupe
if (!loading && user?.role !== 'cardiologue') {
  router.replace('/');
  return null;
}
```

### 1.4 Créer des stubs pour les 3 autres groupes

Trois fichiers `_layout.tsx` + `index.tsx` minimalistes (écran "En construction") pour valider que le routing fonctionne. Aucune vraie fonctionnalité.

### 1.5 Composants utilitaires partagés

Extraire dans `src/components/shared/` :

| Composant | Description |
|---|---|
| `RoleGuard.tsx` | Wrapper de protection par rôle |
| `TabBarLayout.tsx` | Layout de tab bar configurable (évite de dupliquer 300 lignes par rôle) |
| `ProfileScreen.tsx` | L'écran profil est identique pour tous les rôles |

### Résultat attendu

Le médecin fonctionne dans `/(medecin)`, les autres rôles voient un écran stub sécurisé. Architecture prête pour les phases suivantes.

---

## Phase 2 — Profil Cardiologue
**Durée estimée : ~4 jours**
**Objectif : interface d'interprétation ECG mobile.**

### Structure des fichiers

```
app/(cardiologue)/
├── _layout.tsx          ← TabBar : Tableau de bord | File ECG | Rapports | Profil
├── index.tsx            ← Dashboard : stats du mois + 3 derniers ECG à traiter
├── queue.tsx            ← File d'attente : ECG assignés, filtre urgence
├── interpret/
│   └── [id].tsx         ← Interprétation d'un ECG : image + zones de saisie
├── commissions.tsx      ← Ratio Give&Get + historique commissions
└── profile.tsx          ← Réutilise ProfileScreen partagé
```

### Hooks à créer

| Hook | Endpoint backend | Usage |
|---|---|---|
| `useEcgQueue` | `GET /ecg-records?assigned_to=me` | File d'attente du cardiologue |
| `useInterpretEcg` | `GET /ecg-records/:id` + `PATCH /ecg-records/:id/interpret` | Lecture + soumission diagnostique |
| `useCommissions` | `GET /economy/me` (partiellement existant) | Ratio et commissions |

### Priorité d'implémentation des écrans

1. **`queue.tsx`** — cœur du travail du cardiologue
2. **`interpret/[id].tsx`** — depuis la file, tap sur un ECG ouvre l'interprétation
3. **`index.tsx`** — dashboard construit avec les données déjà récupérées
4. **`commissions.tsx`** — en dernier, logique plus complexe

### Résultat attendu

Le cardiologue peut se connecter, voir sa file d'attente et soumettre une interprétation depuis l'appli mobile.

---

## Phase 3 — Profil Secrétaire
**Durée estimée : ~3 jours**
**Objectif : back-office de validation des inscriptions.**

### Structure des fichiers

```
app/(secretaire)/
├── _layout.tsx          ← TabBar : Tableau de bord | Inscriptions | Abonnements | Profil
├── index.tsx            ← Dashboard : compteurs en attente
├── registrations.tsx    ← Liste + validation/rejet inscriptions médecins
├── subscriptions.tsx    ← Gestion abonnements et quotas
└── profile.tsx          ← Réutilise ProfileScreen partagé
```

### Hooks à créer

| Hook | Endpoint backend | Usage |
|---|---|---|
| `usePendingRegistrations` | `GET /admin/pending-doctors` | Liste inscriptions à valider |
| `useValidateRegistration` | `PATCH /admin/doctors/:id/validate` | Action de validation |
| `useSubscriptions` | `GET /admin/subscriptions` | Gestion abonnements |

### Spécificité de l'écran `registrations.tsx`

Pattern swipe-to-approve / swipe-to-reject sur des cartes, avec confirmation modale avant action. Identique aux outils de modération classiques.

### Résultat attendu

La secrétaire peut valider les inscriptions et gérer les abonnements depuis son téléphone.

---

## Phase 4 — Profil Admin
**Durée estimée : ~2 jours**
**Objectif : tableau de bord analytique et supervision de la plateforme.**

### Structure des fichiers

```
app/(admin)/
├── _layout.tsx          ← TabBar : Dashboard | Utilisateurs | Paramètres | Profil
├── index.tsx            ← KPIs clés : MAU, ECG du jour, revenus, taux d'interprétation
├── users.tsx            ← Liste tous les utilisateurs, recherche, désactivation
├── settings.tsx         ← Paramètres plateforme (quotas globaux, maintenance)
└── profile.tsx          ← Réutilise ProfileScreen partagé
```

### Hooks à créer

| Hook | Endpoint backend |
|---|---|
| `useAdminStats` | `GET /admin/stats` |
| `useUsersList` | `GET /admin/users` + `PATCH /admin/users/:id` |

### Résultat attendu

L'admin supervise la plateforme depuis mobile avec les KPIs essentiels.

---

## Phase 5 — Polissage & Qualité
**Durée estimée : ~2 jours**
**Objectif : cohérence, robustesse, préparation EAS Build.**

### 5.1 Composants partagés manquants

| Composant | Utilisation |
|---|---|
| `EmptyState.tsx` | Illustration + message quand une liste est vide (toutes les files) |
| `StatCard.tsx` | Carte de statistique réutilisable entre les 4 dashboards |
| `ConfirmModal.tsx` | Confirmation avant action destructive (validation, rejet, désactivation) |

### 5.2 Gestion des erreurs globale

- Toast / Snackbar global dans le root `_layout.tsx`
- Écran d'erreur réseau avec bouton "Réessayer"

### 5.3 Notifications push par rôle

| Rôle | Déclencheur |
|---|---|
| Médecin | Rapport disponible |
| Cardiologue | Nouvel ECG assigné |
| Secrétaire | Nouvelle inscription à valider |
| Admin | Alerte seuil critique |

### 5.4 `eas.json` multi-profils

Un seul build EAS, profils de configuration par environnement (dev, staging, production).

---

## Structure cible complète

```
xpress-ecg-mobile/
├── app/
│   ├── _layout.tsx                   ← AuthProvider + ThemeProvider (inchangé)
│   ├── index.tsx                     ← Hub de routage par rôle (modifié)
│   │
│   ├── (auth)/
│   │   └── login.tsx                 ← EXISTANT (inchangé)
│   │
│   ├── (medecin)/                    ← RENOMMÉ depuis (tabs)
│   │   ├── _layout.tsx               ← + garde de rôle
│   │   ├── index.tsx
│   │   ├── requests.tsx
│   │   ├── new-ecg.tsx
│   │   ├── reports.tsx
│   │   └── profile.tsx
│   │
│   ├── (cardiologue)/                ← À CRÉER — Phase 2
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── queue.tsx
│   │   ├── interpret/[id].tsx
│   │   ├── commissions.tsx
│   │   └── profile.tsx
│   │
│   ├── (secretaire)/                 ← À CRÉER — Phase 3
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── registrations.tsx
│   │   ├── subscriptions.tsx
│   │   └── profile.tsx
│   │
│   └── (admin)/                      ← À CRÉER — Phase 4
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── users.tsx
│       ├── settings.tsx
│       └── profile.tsx
│
└── src/
    ├── lib/
    │   └── apiClient.ts              ← PARTAGÉ — inchangé
    ├── providers/
    │   ├── AuthProvider.tsx          ← PARTAGÉ — inchangé
    │   └── ThemeProvider.tsx         ← PARTAGÉ — inchangé
    ├── components/
    │   └── shared/
    │       ├── RoleGuard.tsx         ← NOUVEAU
    │       ├── TabBarLayout.tsx      ← NOUVEAU
    │       ├── ProfileScreen.tsx     ← EXTRAIT
    │       ├── EmptyState.tsx        ← NOUVEAU
    │       ├── StatCard.tsx          ← NOUVEAU
    │       └── ConfirmModal.tsx      ← NOUVEAU
    ├── hooks/
    │   ├── useEcgList.ts             ← EXISTANT
    │   ├── useEconomyMe.ts           ← EXISTANT
    │   ├── useEcgQueue.ts            ← NOUVEAU — Phase 2
    │   ├── useInterpretEcg.ts        ← NOUVEAU — Phase 2
    │   ├── useCommissions.ts         ← NOUVEAU — Phase 2
    │   ├── usePendingRegistrations.ts← NOUVEAU — Phase 3
    │   ├── useSubscriptions.ts       ← NOUVEAU — Phase 3
    │   ├── useAdminStats.ts          ← NOUVEAU — Phase 4
    │   └── useUsersList.ts           ← NOUVEAU — Phase 4
    └── types/
        └── user.ts                   ← PARTAGÉ — inchangé (4 rôles déjà définis)
```

---

## Séquence recommandée

```
Semaine 1 :  Phase 1 (1j)  +  Phase 2 (4j)
Semaine 2 :  Phase 3 (3j)  +  Phase 4 (2j)
Semaine 3 :  Phase 5 (2j)  +  tests  +  build EAS
```

**Effort total estimé : ~14 jours/développeur**, en implémentation Cursor assistée.

---

## Point de départ recommandé

La **Phase 1 est entièrement mécanique** — renommage, modifications structurelles, aucune logique métier nouvelle. Elle peut être complétée en une seule session Cursor et valide l'ensemble de l'architecture avant d'engager les phases suivantes.
