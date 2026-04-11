# Phase A1 — Configuration capture ECG (permissions & produit)

Statut : **réalisée** (textes, plugins Expo, politique fichier).  
Toute modification ici implique une **nouvelle development build** (`eas build --profile development`) pour prendre effet côté natif.

---

## Objectif

Préparer **légalement et techniquement** la future chaîne **scanner document + galerie** : messages utilisateur clairs en français, permissions alignées iOS / Android, règles produit pour les fichiers image (sans implémenter encore le code métier).

---

## Permissions par brique

| Brique | iOS (Info.plist) | Android |
|--------|------------------|---------|
| **Scanner document** (`react-native-document-scanner-plugin`) | `NSCameraUsageDescription` via config plugin | `CAMERA` |
| **Caméra** (`expo-camera`) | idem (même usage métier) | `CAMERA`, `RECORD_AUDIO` si requis par la stack |
| **Galerie** (`expo-image-picker`) | `NSPhotoLibraryUsageDescription` | Stockage / `READ_MEDIA_IMAGES` (API 33+) selon fusion Expo |
| **Micro** (image picker) | Désactivé côté config (`microphonePermission: false`) pour limiter les demandes inutiles sur une app photo ECG | `RECORD_AUDIO` non ajouté par ce plugin si `false` |

Les libellés affichés à l’utilisateur sont définis dans **`app.json`** → `expo.plugins`.

---

## Libellés FR harmonisés (marque **Xpress ECG**)

- Caméra (scanner / prise de vue / choix caméra) : formulation unique ou équivalente pour éviter la confusion App Store.
- Photothèque : accès limité au choix d’**images** d’ECG.

---

## Politique fichier (cible produit — implémentation code phases suivantes)

| Sujet | Décision |
|--------|----------|
| Format de sortie recommandé | **JPEG** (compatibilité upload / backend) |
| Orientation | Corriger via **expo-image-manipulator** (EXIF) pour la galerie ; scanner natif gère la perspective |
| Taille / poids | À borner avant upload (phase ultérieure) : par ex. **grande dimension ≤ ~3000 px**, qualité JPEG ~0.85 — **valeurs indicatives**, à valider avec le backend |
| EXIF | En production, envisager **strip** partiel des métadonnées (vie privée) — hors scope A1 |

---

## Fichiers touchés (phase A1)

- `app.json` — plugins `expo-image-picker`, textes, permissions Android complétées si besoin.
- Ce document — référence pour A2 / A3.

---

*Dernière mise à jour : 2026-04-07.*
