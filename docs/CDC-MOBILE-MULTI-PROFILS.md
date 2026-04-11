# Cahier des Charges — Extension Multi-Profils de l'Application Mobile Xpress ECG

**Version** : 1.0  
**Date** : Avril 2026  
**Dépôt** : `xpress-ecg-mobile`  
**Stack** : Expo SDK 54 · React Native 0.81.5 · expo-router v6 · TypeScript

---

## Table des matières

1. [Contexte et objectifs](#1-contexte-et-objectifs)
2. [État de l'art — Ce qui existe déjà](#2-état-de-lart--ce-qui-existe-déjà)
3. [Décision d'architecture](#3-décision-darchitecture)
4. [Refactoring de la structure de navigation](#4-refactoring-de-la-structure-de-navigation)
5. [Authentification et routage par rôle](#5-authentification-et-routage-par-rôle)
6. [Profil Médecin — mise à niveau](#6-profil-médecin--mise-à-niveau)
7. [Profil Cardiologue — à créer](#7-profil-cardiologue--à-créer)
8. [Profil Secrétaire — à créer](#8-profil-secrétaire--à-créer)
9. [Profil Admin — à créer](#9-profil-admin--à-créer)
10. [Composants partagés](#10-composants-partagés)
11. [Thème et identité visuelle par rôle](#11-thème-et-identité-visuelle-par-rôle)
12. [Sécurité et permissions](#12-sécurité-et-permissions)
13. [Structure cible des fichiers](#13-structure-cible-des-fichiers)
14. [Plan de migration et priorités](#14-plan-de-migration-et-priorités)
15. [Critères d'acceptation](#15-critères-dacceptation)

---

## 1. Contexte et objectifs

### 1.1 Constat

L'application mobile `xpress-ecg-mobile` couvre actuellement uniquement le profil **Médecin prescripteur**. Les trois autres profils de l'application web (`cardiologue`, `secretaire`, `admin`) n'ont pas d'équivalent mobile, obligeant ces utilisateurs à passer par un navigateur.

### 1.2 Objectif

Étendre l'application mobile pour couvrir les **quatre profils utilisateurs** de la plateforme Xpress ECG dans un **unique dépôt et un unique build**, en préservant l'intégralité des fonctionnalités existantes du médecin.

### 1.3 Principes directeurs

| Principe | Description |
|----------|-------------|
| **Monorepo mobile** | Un seul dépôt, un seul build EAS, un seul APK/IPA distribué |
| **Routage basé sur le rôle** | expo-router gère l'isolation par groupes de routes `(role)/` |
| **Code partagé maximal** | Auth, API client, thème, composants génériques : une seule implémentation |
| **Mobile-first** | Les écrans sont conçus pour les contraintes mobiles (pas un portage direct du web) |
| **Parité fonctionnelle progressive** | Fonctions essentielles d'abord, fonctions avancées en phases ultérieures |

---

## 2. État de l'art — Ce qui existe déjà

### 2.1 Infrastructure déjà en place (à conserver tel quel)

| Fichier / Module | Description | Statut |
|-----------------|-------------|--------|
| `src/lib/apiClient.ts` | Client HTTP avec JWT, refresh automatique, gestion d'erreurs | ✅ Complet |
| `src/providers/AuthProvider.tsx` | Context React, login, biométrie, restauration de session | ✅ Complet |
| `src/providers/ThemeProvider.tsx` | Thème clair/sombre, préférence persistée | ✅ Complet |
| `src/theme/joyful.ts` | Palette de couleurs complète (clair/sombre + neutres) | ✅ Complet |
| `src/types/user.ts` | Types `UserSession`, `UserRole`, mapping des rôles API | ✅ Complet |
| `src/hooks/useEcgList.ts` | Liste des ECG avec filtres | ✅ Complet |
| `src/hooks/useReportList.ts` | Liste des rapports, marquer lu/lu | ✅ Complet |
| `src/hooks/useEconomyMe.ts` | Quota gratuit, données de souscription | ✅ Complet |
| `src/hooks/usePatientList.ts` | Liste des patients | ✅ Complet |
| `src/lib/saveReportPdf.ts` | Téléchargement PDF local (sans partage système) | ✅ Complet |
| `src/components/ECGImageCapture.tsx` | Capture et correction d'image ECG | ✅ Complet |
| `app/(auth)/login.tsx` | Page de connexion avec biométrie | ✅ Complet |
| `app/(tabs)/` | 5 écrans médecin (accueil, demandes, nouvel ECG, rapports, profil) | ✅ Complet |

### 2.2 Application web de référence (portage mobile à prévoir)

Les fonctionnalités existantes côté web (`Xpress-ECG-CLEAN`) constituent la **référence métier** pour chaque profil :

- **Cardiologue** : `AnalyzeECG.tsx`, `PendingECG.tsx`, `CompletedECG.tsx`, `Dashboard.tsx`, `Statistics.tsx`
- **Secrétaire** : `ECGInbox.tsx`, `ECGAssignment.tsx`, `ReportSending.tsx`, `Dashboard.tsx`, `RoutingRules.tsx`
- **Admin** : `Dashboard.tsx`, `UserManagement.tsx`, `Statistics.tsx`, `Emoluments.tsx`, `TarifSettings.tsx`, `HospitalManagement.tsx`, `ActivityLogs.tsx`

### 2.3 Ce qui doit changer

- Le groupe `app/(tabs)/` est actuellement dédié implicitement au médecin ; il doit être renommé `app/(medecin)/` et le routage centralisé dans `app/index.tsx` doit router par rôle.
- `app/index.tsx` redirige actuellement tous les utilisateurs connectés vers `/(tabs)`, sans distinction de rôle.

---

## 3. Décision d'architecture

### 3.1 Architecture choisie : Monorepo avec groupes de routes par rôle

```
Connexion → AuthProvider identifie le rôle → app/index.tsx route vers /(role)/
```

Chaque profil est un **groupe de routes isolé** dans expo-router (`(medecin)`, `(cardiologue)`, `(secretaire)`, `(admin)`). Ils partagent le même `AuthProvider`, le même `apiClient`, le même thème.

### 3.2 Justification technique

- **expo-router v6** avec groupes de routes `(role)/` supporte nativement cette architecture.
- **Isolation complète** : un cardiologue ne peut pas accéder aux routes médecin, même en manipulant l'URL.
- **Guard systématique** : chaque `(role)/_layout.tsx` vérifie que `user.role === 'role'` et redirige sinon.
- **Shared code** : les hooks, types, providers et composants génériques restent dans `src/`.

### 3.3 Authentification — Architecture de sécurité

```
┌─────────────────────────────────────────────────────┐
│                   app/_layout.tsx                    │
│         AuthProvider + ThemeProvider + Stack         │
└─────────────────────────────────────────────────────┘
                          │
              ┌───────────▼───────────┐
              │     app/index.tsx     │  ← Point d'entrée unique
              │  Routage par rôle     │
              └───────────────────────┘
         ┌──────────┬──────────┬──────────┬──────────┐
         ▼          ▼          ▼          ▼          ▼
   (auth)/    (medecin)/  (cardiologue)/ (secretaire)/ (admin)/
   login.tsx  _layout.tsx  _layout.tsx   _layout.tsx   _layout.tsx
              ↕ garde rôle ↕ garde rôle  ↕ garde rôle  ↕ garde rôle
```

**Garde de sécurité dans chaque `_layout.tsx`** :
```typescript
// Pattern appliqué dans chaque layout de rôle
if (!user || user.role !== 'cardiologue') {
  router.replace('/');  // Retour au routeur central
  return null;
}
```

---

## 4. Refactoring de la structure de navigation

### 4.1 Migration de `(tabs)/` vers `(medecin)/`

La première étape de mise en œuvre est un **renommage pur**, sans modification fonctionnelle :

| Avant | Après |
|-------|-------|
| `app/(tabs)/_layout.tsx` | `app/(medecin)/_layout.tsx` |
| `app/(tabs)/index.tsx` | `app/(medecin)/index.tsx` |
| `app/(tabs)/new-ecg.tsx` | `app/(medecin)/new-ecg.tsx` |
| `app/(tabs)/requests.tsx` | `app/(medecin)/requests.tsx` |
| `app/(tabs)/reports.tsx` | `app/(medecin)/reports.tsx` |
| `app/(tabs)/profile.tsx` | `app/(medecin)/profile.tsx` |

### 4.2 Nouveau `app/index.tsx` — routeur central

```typescript
// Logique de routage central (non-code, description)
// Si loading → afficher splash
// Si non connecté → /(auth)/login
// Si connecté :
//   role === 'medecin'      → /(medecin)
//   role === 'cardiologue'  → /(cardiologue)
//   role === 'secretaire'   → /(secretaire)
//   role === 'admin'        → /(admin)
//   autre                   → /(auth)/login (sécurité)
```

---

## 5. Authentification et routage par rôle

### 5.1 Flux d'authentification complet

```
Ouverture app
    │
    ├── SecureStore contient session + token valide ?
    │       ├── OUI → restaurer session en mémoire → router central (sans re-login)
    │       │         refresh silencieux de /auth/me en arrière-plan
    │       └── NON → afficher login.tsx
    │
    ├── Login manuel (email + mot de passe)
    │       ├── POST /auth/login → accessToken + refreshToken + user
    │       ├── Stocker tokens dans Keychain (expo-secure-store)
    │       ├── Stocker session utilisateur chiffrée
    │       └── Router central → groupe de routes du rôle
    │
    ├── Login biométrique (Face ID / Empreinte)
    │       ├── Vérifier que session et token existent encore
    │       ├── Authentification locale (expo-local-authentication)
    │       ├── Valider token via GET /auth/me
    │       └── Router central → groupe de routes du rôle
    │
    └── Expiration de session
            ├── apiClient intercepte 401
            ├── Tentative de refresh via POST /auth/refresh
            ├── Succès → nouveau token, requête rejouée
            └── Échec → logout silencieux → login.tsx
```

### 5.2 Améliorations de la page de connexion

La page `login.tsx` actuelle est commune à tous les rôles — elle reste telle quelle. Aucune modification nécessaire : le routage post-connexion se fait dans `app/index.tsx` selon le rôle retourné par le backend.

**Bonnes pratiques à vérifier / renforcer :**

- [ ] Masquer le mot de passe par défaut, icône toggle
- [ ] Tentatives échouées : blocage temporaire côté UI (3 tentatives → 30 secondes)
- [ ] Message d'erreur générique (ne pas révéler si l'email existe)
- [ ] Lien "Mot de passe oublié" → ouvre navigateur vers la PWA
- [ ] Proposition biométrique automatique si disponible et session précédente valide
- [ ] Accessibilité : labels ARIA, navigation clavier, contraste suffisant

### 5.3 Gestion des tokens (existant, à documenter)

| Token | Stockage | Durée de vie |
|-------|----------|-------------|
| `accessToken` | `expo-secure-store` (Keychain iOS / Keystore Android) | Courte (définie par le backend) |
| `refreshToken` | `expo-secure-store` | Longue |
| Session utilisateur | `expo-secure-store` (JSON chiffré) | Persistée jusqu'à logout |

---

## 6. Profil Médecin — mise à niveau

> Le profil médecin est **déjà fonctionnel**. Cette section décrit les améliorations souhaitées.

### 6.1 Écrans existants (conservés)

| Écran | Route | État |
|-------|-------|------|
| Tableau de bord | `/(medecin)/` | ✅ Fonctionnel |
| Mes demandes ECG | `/(medecin)/requests` | ✅ Fonctionnel |
| Nouvelle demande ECG | `/(medecin)/new-ecg` | ✅ Fonctionnel |
| Mes rapports | `/(medecin)/reports` | ✅ Fonctionnel (PDF téléchargeable) |
| Profil & paramètres | `/(medecin)/profile` | ✅ Fonctionnel |

### 6.2 Améliorations à prévoir

| Amélioration | Priorité | Référence web |
|-------------|----------|---------------|
| Historique complet des demandes avec filtres avancés | Moyenne | `History.tsx` |
| Fiche patient avec historique ECG | Moyenne | `Patients.tsx` |
| Justificatifs de qualification (upload de documents) | Haute | `PrescriberDocuments.tsx` |
| Indication visuelle du statut de vérification (vérifié / provisoire / rejeté) | Haute | `PrescriberBanner` |

---

## 7. Profil Cardiologue — à créer

### 7.1 Identité visuelle

Couleur principale : **violet/indigo** — différenciateur fort du médecin (bleu/indigo actuel).  
Suggestion : `primaryDark: #6d28d9`, `primary: #7c3aed`, `primaryLight: #8b5cf6`.

### 7.2 Écrans à créer

#### Onglet 1 — File d'attente (`/(cardiologue)/`)
**Référence web** : `PendingECG.tsx`

| Élément | Description |
|---------|-------------|
| Compteur en temps réel | Nombre d'ECG en attente d'analyse |
| Timer par ECG | Affiche le délai restant (15 min par défaut) |
| Carte ECG résumée | Patient (anonymisé), urgence, heure de réception |
| Bouton "Prendre en charge" | Verrouille l'ECG pour ce cardiologue |
| Indicateur d'urgence | Badge rouge clignotant pour ECG urgents |
| Rafraîchissement automatique | Pull-to-refresh + rafraîchissement toutes les 30s |

#### Onglet 2 — Analyse ECG (`/(cardiologue)/interpret`)
**Référence web** : `AnalyzeECG.tsx` (écran le plus complexe)

> ⚠️ **Contrainte mobile forte** : L'interface d'analyse web est conçue pour un grand écran (1200px+). Sur mobile, une **version simplifiée et adaptée** est requise.

| Élément | Description |
|---------|-------------|
| Visualisation tracé | Affichage du tracé ECG en plein écran paysage (rotation forcée) |
| Navigation entre dérivations | Swipe horizontal entre les 12 dérivations |
| Interprétation vocale | Dictée vocale pour saisir l'interprétation (optionnel) |
| Formulaire de mesures | Champs : FC, PR, QRS, QTc, axe — clavier numérique |
| Case à cocher isNormal | ECG normal / anormal |
| Champ conclusion | Éditeur texte multi-lignes |
| Validation | Bouton "Valider et envoyer" avec confirmation |
| Mode hors-ligne | Brouillon local si connexion perdue |

#### Onglet 3 — Analyses terminées (`/(cardiologue)/completed`)
**Référence web** : `CompletedECG.tsx`

| Élément | Description |
|---------|-------------|
| Liste des ECG analysés | Triée par date décroissante |
| Filtres | Période, type (normal/anormal), urgence |
| Téléchargement PDF | Rapport généré par le web, téléchargé localement |
| Statistiques rapides | Total du mois, taux normal/anormal |

#### Onglet 4 — Ratio Give & Get (`/(cardiologue)/ratio`)
**Référence web** : Émoluments, statistiques cardiologue

| Élément | Description |
|---------|-------------|
| Ratio Give&Get du mois | Visuel circulaire (ECG analysés / ECG envoyés) |
| Historique mensuel | Graphique barre sur 6 mois |
| Émoluments cumulés | Montant total du mois en cours |
| Comparaison pairs | Position relative (anonymisée) |

#### Onglet 5 — Profil cardiologue (`/(cardiologue)/profile`)

Même structure que le profil médecin, adapté :
- Signature numérique (affichage et modification)
- Spécialité et qualifications
- Statistiques d'activité

### 7.3 Hooks à créer pour le cardiologue

| Hook | Description |
|------|-------------|
| `useEcgQueue` | File d'attente ECG temps réel, prise en charge |
| `useEcgAnalysis` | ECG actuellement en cours d'analyse, mutations |
| `useCardiologistStats` | Statistiques du cardiologue (ratio, émoluments) |

---

## 8. Profil Secrétaire — à créer

### 8.1 Identité visuelle

Couleur principale : **teal/cyan** — rôle de coordination et de flux.  
Suggestion : `primaryDark: #0f766e`, `primary: #0d9488`, `primaryLight: #14b8a6`.

### 8.2 Écrans à créer

#### Onglet 1 — Tableau de bord (`/(secretaire)/`)
**Référence web** : `secretaire/Dashboard.tsx`

| Élément | Description |
|---------|-------------|
| Compteurs de flux | ECG en attente d'assignation, en cours, terminés aujourd'hui |
| Alertes | ECG non assignés depuis > X minutes |
| Raccourcis | Accès rapide aux files d'assignation |
| Activité récente | 5 dernières actions (assignations, envois) |

#### Onglet 2 — File d'assignation (`/(secretaire)/inbox`)
**Référence web** : `ECGInbox.tsx` + `ECGAssignment.tsx`

| Élément | Description |
|---------|-------------|
| Liste des ECG à assigner | Non assignés, triés par ancienneté |
| Assigner un cardiologue | Liste déroulante ou bottom sheet avec cardiologues disponibles |
| Indicateur de disponibilité | Cardiologue libre / occupé / hors ligne |
| Filtres | Urgence, établissement, type |

#### Onglet 3 — Envoi de rapports (`/(secretaire)/sending`)
**Référence web** : `ReportSending.tsx`

| Élément | Description |
|---------|-------------|
| Rapports prêts à envoyer | Liste des rapports validés non encore envoyés |
| Envoi en lot | Sélection multiple et envoi groupé |
| Historique d'envoi | Rapports envoyés avec accusé |
| Aperçu PDF | Prévisualisation avant envoi |
| Partage | Email, WhatsApp, ou autre |

#### Onglet 4 — Patients (`/(secretaire)/patients`)
**Référence web** : `secretaire/Patients.tsx`

| Élément | Description |
|---------|-------------|
| Recherche patient | Par nom, ID, téléphone |
| Fiche patient | Historique ECG, rapports |
| Modification | Corriger les informations patient |

#### Onglet 5 — Profil secrétaire (`/(secretaire)/profile`)

Même structure que les autres profils.

### 8.3 Hooks à créer pour la secrétaire

| Hook | Description |
|------|-------------|
| `useEcgInbox` | File des ECG à assigner, mutations d'assignation |
| `useCardiologistAvailability` | Liste des cardiologues et leur disponibilité |
| `useReportSending` | Rapports à envoyer, envoi, historique |

---

## 9. Profil Admin — à créer

> Le profil admin mobile est une version **allégée et orientée supervision**. Les actions lourdes (paramétrage tarifs, gestion hôpitaux) restent sur le web.

### 9.1 Identité visuelle

Couleur principale : **slate/gris profond** — autorité et neutralité.  
Suggestion : `primaryDark: #334155`, `primary: #475569`, `primaryLight: #64748b`.

### 9.2 Écrans à créer

#### Onglet 1 — Dashboard analytique (`/(admin)/`)
**Référence web** : `admin/Dashboard.tsx` + `Statistics.tsx`

| Élément | Description |
|---------|-------------|
| KPIs temps réel | ECG du jour, revenus, utilisateurs actifs |
| Graphique activité | Courbe d'activité sur 7 jours |
| Alertes système | Problèmes critiques (quota dépassé, cardiologues inactifs) |
| Accès rapide | Lien vers les sections clés |

#### Onglet 2 — Utilisateurs (`/(admin)/users`)
**Référence web** : `UserManagement.tsx`

| Élément | Description |
|---------|-------------|
| Liste des utilisateurs | Tous rôles confondus, avec statut |
| Recherche et filtres | Par rôle, statut, établissement |
| Actions rapides | Activer / Suspendre / Réinitialiser mot de passe |
| Détail utilisateur | Fiche, rôle, dates, activité |

#### Onglet 3 — Vérifications (`/(admin)/verifications`)
**Référence web** : `PrescriberVerification.tsx`

| Élément | Description |
|---------|-------------|
| Dossiers en attente | Médecins à vérifier (documents justificatifs) |
| Visualisation pièces jointes | Ouverture des documents uploadés |
| Décision | Approuver / Rejeter avec commentaire |
| Notifications automatiques | Envoi automatique à l'utilisateur |

#### Onglet 4 — Rapports financiers (`/(admin)/finance`)
**Référence web** : `FinancialReports.tsx` + `Emoluments.tsx`

| Élément | Description |
|---------|-------------|
| Récapitulatif mensuel | Revenus, émoluments, marges |
| Par établissement | Décomposition par hôpital |
| Export | Partager le récapitulatif en PDF |

#### Onglet 5 — Profil admin (`/(admin)/profile`)

Même structure, avec accès à la version web pour les actions avancées.

### 9.3 Hooks à créer pour l'admin

| Hook | Description |
|------|-------------|
| `useAdminStats` | KPIs, activité, alertes |
| `useUserManagement` | CRUD utilisateurs |
| `usePrescriberVerification` | Dossiers justificatifs, décisions |
| `useFinancialSummary` | Rapports financiers |

---

## 10. Composants partagés

Ces composants sont communs à plusieurs profils et doivent être placés dans `src/components/shared/`.

| Composant | Description | Utilisé par |
|-----------|-------------|-------------|
| `RoleAvatar` | Avatar avec initiales (sans "Dr") et badge rôle | Tous |
| `StatCard` | Carte de statistique (valeur + label + couleur) | Tous |
| `EmptyState` | Écran vide avec icône, texte et CTA | Tous |
| `ConfirmBottomSheet` | Feuille de confirmation avant action critique | Tous |
| `FilterChips` | Chips de filtre horizontal (scroll) | Tous |
| `TimeAgoText` | Texte de date relative formaté en français | Tous |
| `PdfPreviewSheet` | Bottom sheet d'aperçu PDF avec download | Médecin, Secrétaire |
| `EcgCard` | Carte résumé d'un ECG avec statut | Médecin, Cardiologue, Secrétaire |
| `PatientCard` | Carte résumé d'un patient | Médecin, Secrétaire |
| `QuotaBadge` | Badge compact quota restant | Médecin |
| `RoleGuard` | Composant HoC de garde de rôle | Tous layouts |
| `NetworkBanner` | Bannière hors-ligne/erreur réseau | Tous |

---

## 11. Thème et identité visuelle par rôle

Le système de thème `joyful.ts` existant est déjà structuré pour supporter des variantes. Il doit être étendu avec une **palette par rôle**.

| Rôle | Couleur primaire | Couleur accent | Gradient barre |
|------|-----------------|----------------|----------------|
| **Médecin** | Indigo `#4f46e5` | Violet `#7c3aed` | Indigo → Violet (existant) |
| **Cardiologue** | Violet `#7c3aed` | Fuchsia `#a21caf` | Violet → Fuchsia |
| **Secrétaire** | Teal `#0d9488` | Cyan `#0891b2` | Teal → Cyan |
| **Admin** | Slate `#475569` | Gris `#64748b` | Slate → Blue-gray |

La fonction `getJoyfulColors(role, isDark)` devra accepter un paramètre `role` optionnel.

---

## 12. Sécurité et permissions

### 12.1 Isolation des routes par rôle

Chaque `(role)/_layout.tsx` contient une **garde impérative** :
- Vérifie `user.role === 'role'`
- Vérifie que le token est valide (via `AuthProvider`)
- Redirige vers `/` en cas d'accès non autorisé
- Affiche un loader pendant la vérification initiale

### 12.2 Permissions Android / iOS supplémentaires

Selon les rôles :

| Permission | Rôle(s) concerné(s) | Usage |
|-----------|---------------------|-------|
| `CAMERA` | Médecin, Secrétaire | Capture ECG, scan documents |
| `READ_MEDIA_IMAGES` | Médecin, Secrétaire, Cardiologue | Accès galerie |
| `WRITE_EXTERNAL_STORAGE` | Tous | Sauvegarde PDF (Android < 10) |
| Notifications push | Tous | Alertes temps réel |
| `NSPhotoLibraryAddUsage` | Médecin, Secrétaire | iOS — sauvegarde image |
| `UIFileSharingEnabled` | Tous | iOS — accès app Fichiers |

### 12.3 Données sensibles

- Les données de santé ne sont **jamais** écrites en clair sur le disque (uniquement via `expo-secure-store` chiffré ou en mémoire).
- Les PDF téléchargés sont stockés dans `documentDirectory` de l'app (non accessible aux autres apps sur iOS).
- Le token d'accès n'est jamais loggué.

### 12.4 Timeout de session

L'app doit demander une ré-authentification (biométrie ou mot de passe) si :
- L'app revient en premier plan après **> 15 minutes** d'inactivité (configurable)
- Le refresh token est expiré

---

## 13. Structure cible des fichiers

```
xpress-ecg-mobile/
├── app/
│   ├── _layout.tsx                    ← AuthProvider + ThemeProvider + Stack
│   ├── index.tsx                      ← Routeur central par rôle (refactorisé)
│   │
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx                  ← Existant (inchangé)
│   │
│   ├── (medecin)/                     ← Renommé depuis (tabs)
│   │   ├── _layout.tsx                ← Garde role=medecin + Tabs
│   │   ├── index.tsx                  ← Dashboard médecin (existant)
│   │   ├── new-ecg.tsx                ← Existant
│   │   ├── requests.tsx               ← Existant
│   │   ├── reports.tsx                ← Existant
│   │   ├── patients.tsx               ← À créer
│   │   └── profile.tsx                ← Existant
│   │
│   ├── (cardiologue)/                 ← À créer
│   │   ├── _layout.tsx                ← Garde role=cardiologue + Tabs
│   │   ├── index.tsx                  ← File d'attente ECG
│   │   ├── interpret.tsx              ← Interface d'analyse
│   │   ├── completed.tsx              ← ECG terminés
│   │   ├── ratio.tsx                  ← Ratio & émoluments
│   │   └── profile.tsx
│   │
│   ├── (secretaire)/                  ← À créer
│   │   ├── _layout.tsx                ← Garde role=secretaire + Tabs
│   │   ├── index.tsx                  ← Dashboard
│   │   ├── inbox.tsx                  ← File ECG à assigner
│   │   ├── sending.tsx                ← Envoi de rapports
│   │   ├── patients.tsx               ← Gestion patients
│   │   └── profile.tsx
│   │
│   └── (admin)/                       ← À créer
│       ├── _layout.tsx                ← Garde role=admin + Tabs
│       ├── index.tsx                  ← Dashboard analytique
│       ├── users.tsx                  ← Gestion utilisateurs
│       ├── verifications.tsx          ← Vérifications prescripteurs
│       ├── finance.tsx                ← Rapports financiers
│       └── profile.tsx
│
├── src/
│   ├── components/
│   │   ├── shared/                    ← Composants communs (cf. §10)
│   │   ├── medecin/                   ← Composants spécifiques médecin
│   │   ├── cardiologue/               ← Composants spécifiques cardiologue
│   │   ├── secretaire/                ← Composants spécifiques secrétaire
│   │   └── admin/                     ← Composants spécifiques admin
│   │
│   ├── hooks/
│   │   ├── shared/                    ← Hooks communs
│   │   ├── useEcgList.ts              ← Existant
│   │   ├── useReportList.ts           ← Existant
│   │   ├── useEconomyMe.ts            ← Existant
│   │   ├── usePatientList.ts          ← Existant
│   │   ├── useEcgQueue.ts             ← À créer (cardiologue)
│   │   ├── useEcgAnalysis.ts          ← À créer (cardiologue)
│   │   ├── useCardiologistStats.ts    ← À créer (cardiologue)
│   │   ├── useEcgInbox.ts             ← À créer (secrétaire)
│   │   ├── useReportSending.ts        ← À créer (secrétaire)
│   │   ├── useAdminStats.ts           ← À créer (admin)
│   │   ├── useUserManagement.ts       ← À créer (admin)
│   │   └── usePrescriberVerification.ts ← À créer (admin)
│   │
│   ├── lib/
│   │   ├── apiClient.ts               ← Existant (inchangé)
│   │   └── saveReportPdf.ts           ← Existant (inchangé)
│   │
│   ├── providers/
│   │   ├── AuthProvider.tsx           ← Existant (inchangé)
│   │   └── ThemeProvider.tsx          ← À étendre pour couleurs par rôle
│   │
│   ├── theme/
│   │   └── joyful.ts                  ← À étendre avec palettes par rôle
│   │
│   └── types/
│       ├── user.ts                    ← Existant (inchangé)
│       ├── ecg.ts                     ← À créer (types ECG communs)
│       └── economy.ts                 ← À créer (types quota/abonnement)
│
├── app.json                           ← Permissions iOS + Android mises à jour
├── eas.json
└── package.json
```

---

## 14. Plan de migration et priorités

### Phase 0 — Refactoring non fonctionnel (Prérequis)
> Aucun changement de comportement visible par l'utilisateur.

| # | Tâche | Effort |
|---|-------|--------|
| 0.1 | Renommer `app/(tabs)/` → `app/(medecin)/` | XS |
| 0.2 | Mettre à jour `app/index.tsx` : routage central par rôle | XS |
| 0.3 | Ajouter garde de rôle dans `app/(medecin)/_layout.tsx` | XS |
| 0.4 | Créer les dossiers `src/components/{shared,cardiologue,secretaire,admin}/` | XS |
| 0.5 | Extraire composants réutilisables dans `src/components/shared/` | S |

### Phase 1 — Profil Cardiologue (Priorité haute)
> Le cardiologue est le profil le plus critique opérationnellement.

| # | Tâche | Effort |
|---|-------|--------|
| 1.1 | Créer `app/(cardiologue)/_layout.tsx` avec garde + tabs | S |
| 1.2 | `/(cardiologue)/index.tsx` — File d'attente ECG | M |
| 1.3 | `/(cardiologue)/interpret.tsx` — Interface analyse (vue simplifiée) | XL |
| 1.4 | `/(cardiologue)/completed.tsx` — ECG terminés | M |
| 1.5 | `/(cardiologue)/ratio.tsx` — Ratio & émoluments | M |
| 1.6 | `/(cardiologue)/profile.tsx` — Profil avec signature | S |
| 1.7 | Hooks `useEcgQueue`, `useEcgAnalysis`, `useCardiologistStats` | M |

### Phase 2 — Profil Secrétaire (Priorité haute)
| # | Tâche | Effort |
|---|-------|--------|
| 2.1 | Créer `app/(secretaire)/_layout.tsx` avec garde + tabs | S |
| 2.2 | `/(secretaire)/index.tsx` — Dashboard | M |
| 2.3 | `/(secretaire)/inbox.tsx` — File ECG à assigner | M |
| 2.4 | `/(secretaire)/sending.tsx` — Envoi de rapports | M |
| 2.5 | `/(secretaire)/patients.tsx` — Gestion patients | S |
| 2.6 | Hooks `useEcgInbox`, `useReportSending` | M |

### Phase 3 — Profil Admin (Priorité moyenne)
| # | Tâche | Effort |
|---|-------|--------|
| 3.1 | Créer `app/(admin)/_layout.tsx` avec garde + tabs | S |
| 3.2 | `/(admin)/index.tsx` — Dashboard analytique | M |
| 3.3 | `/(admin)/users.tsx` — Gestion utilisateurs | M |
| 3.4 | `/(admin)/verifications.tsx` — Vérifications prescripteurs | M |
| 3.5 | `/(admin)/finance.tsx` — Rapports financiers | M |
| 3.6 | Hooks admin | M |

### Phase 4 — Améliorations médecin (Priorité basse)
| # | Tâche | Effort |
|---|-------|--------|
| 4.1 | `/(medecin)/patients.tsx` — Fiche patient complète | M |
| 4.2 | Justificatifs de qualification (upload) | L |
| 4.3 | Historique filtré avancé | S |

**Légende effort** : XS < 2h · S < 1j · M 1-3j · L 3-5j · XL > 5j

---

## 15. Critères d'acceptation

### Authentification

- [ ] Un utilisateur peut se connecter avec email + mot de passe (tous rôles)
- [ ] Un utilisateur peut se connecter par biométrie si session précédente valide
- [ ] Après connexion, l'utilisateur est redirigé vers le bon groupe de routes selon son rôle
- [ ] Un cardiologue qui tente d'accéder à `/(medecin)/` est redirigé vers `/(cardiologue)/`
- [ ] Un token expiré déclenche un refresh silencieux, ou un retour au login
- [ ] La déconnexion efface tous les tokens et la session du Keychain

### Navigation

- [ ] Chaque profil a sa propre barre d'onglets adaptée à ses fonctions
- [ ] Le style (couleurs, icônes) de la barre d'onglets est différent par rôle
- [ ] Le splash screen s'affiche pendant la restauration de session (max 4s)

### Fonctionnel — Cardiologue

- [ ] La file d'attente ECG se rafraîchit en temps réel (pull-to-refresh minimum)
- [ ] Le cardiologue peut prendre en charge un ECG et saisir une interprétation
- [ ] Le rapport est transmis au médecin après validation
- [ ] L'écran ratio affiche les données du mois en cours

### Fonctionnel — Secrétaire

- [ ] La secrétaire peut voir les ECG non assignés et les assigner à un cardiologue
- [ ] La secrétaire peut envoyer les rapports validés aux médecins

### Fonctionnel — Admin

- [ ] L'admin peut voir les KPIs de la plateforme
- [ ] L'admin peut approuver ou rejeter un dossier prescripteur
- [ ] L'admin peut activer ou suspendre un utilisateur

### Qualité

- [ ] Aucune donnée de santé n'est stockée en clair sur le disque
- [ ] L'application fonctionne en mode dégradé (hors-ligne) pour la consultation
- [ ] Les écrans s'adaptent à tous les formats (iPhone SE → iPhone Pro Max, Android)
- [ ] Support du mode sombre pour tous les nouveaux écrans
- [ ] Aucune régression sur les fonctionnalités médecin existantes

---

*Cahier des charges établi sur la base de l'existant du dépôt `xpress-ecg-mobile` (commit `7c1c789`) et de l'application web de référence `Xpress-ECG-CLEAN` (commit `295fb28`).*
