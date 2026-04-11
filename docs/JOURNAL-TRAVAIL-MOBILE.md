# Journal de travail — application mobile prescripteur (Expo)

Document vivant : à compléter à chaque session importante (problèmes, décisions, fichiers touchés).  
**Projet :** `xpress-ecg-mobile` — Expo SDK 54, React Native. **Option A** : modules natifs (scanner document) via **development build** ; Expo Go du Store ne suffit plus pour ce flux.

---

## Comment utiliser ce fichier

- Ajouter une entrée datée en tête de la section **Historique des sessions** (plus récent en premier).
- Noter ce qui **marche**, ce qui **bloque**, et les **commandes** ou **variables** à retenir.
- Éviter d’y coller des secrets (mots de passe, clés API).

---

## Ce qui fonctionne (référence rapide)

| Sujet | Détail |
|--------|--------|
| URL API mobile | Variable `EXPO_PUBLIC_API_URL` dans `.env` — **doit être le même port que le backend** (ex. `http://127.0.0.1:3001`). |
| USB + Expo Go | `npm run start:usb` : `adb reverse` pour Metro **et** pour le port API si l’URL est `127.0.0.1` ou `localhost`. |
| USB + dev client | `npm run start:usb:devclient` : idem + `expo start --dev-client` (ouvrir le projet depuis l’**app Xpress ECG** installée, pas Expo Go). |
| Phase 0 — build native | **Terminée** (dev build installée, Metro USB OK). Voir `docs/PHASE0-DEV-BUILD.md`. |
| Phase A1 — capture | Permissions FR + plugin `expo-image-picker` + doc produit. Voir `docs/PHASE-A1-CAPTURE-CONFIG.md`. **Nouvelle `eas build`** requise après changement `app.json`. |
| Défaut API dans le code | `src/lib/apiClient.ts` : repli si pas de `.env` — aligné sur le port backend courant (voir historique). |
| HTTP en dev Android | `android.usesCleartextTraffic: true` dans `app.json` (build natif ; utile pour cohérence). |
| Navigation | `@react-navigation/native` en v7 avec les stacks v7 (éviter le mélange v6/v7). |

---

## Difficultés rencontrées (leçons)

1. **`localhost` sur le téléphone ≠ PC**  
   Sur l’appareil, `localhost` / `127.0.0.1` pointe vers **le téléphone**. Avec USB, on utilise `127.0.0.1:PORT` **et** `adb reverse` pour que ce port soit celui du PC.

2. **Port API désynchronisé**  
   Le web sur PC peut fonctionner (proxy, autre port, autre host) alors que l’app mobile échoue avec *« serveur non disponible »* : souvent **mauvais port** dans `.env` (ex. backend sur **3001**, mobile encore sur **3000**). Le message vient d’un échec réseau (`fetch`), pas d’identifiants invalides.

3. **Variables `EXPO_PUBLIC_*`**  
   Elles sont intégrées au bundle au moment du build Metro : après changement de `.env`, **redémarrer** le serveur Metro ; en cas de doute, `npx expo start ... --clear`.

4. **Bug de syntaxe dans `start-expo-usb.cjs`**  
   Une ligne `text.split(/\n')` était invalide (regex mal fermée) → `SyntaxError: Invalid regular expression`. Corrigé en `text.split(/\r?\n/)` pour gérer CRLF Windows.

5. **Environnement Windows / PowerShell**  
   Définir `ADB_PATH` vers le dossier `platform-tools` (ou `adb.exe`) si `adb` n’est pas dans le `PATH`. Vérifier `adb devices` (statut `device`, pas `unauthorized`).

6. **Wi‑Fi sans USB**  
   Mettre l’**IP LAN du PC** dans `.env` ; le backend doit écouter sur `0.0.0.0` (pas seulement `127.0.0.1`) pour être joignable depuis le téléphone.

---

## Fichiers clés modifiés ou à surveiller

| Fichier | Rôle |
|---------|------|
| `.env` | `EXPO_PUBLIC_API_URL` — **port = port réel du backend** |
| `scripts/start-expo-usb.cjs` | `adb reverse` Metro + API ; lecture du `.env` ; correction `split` lignes |
| `src/lib/apiClient.ts` | `BASE_URL`, timeouts, message *serveur non disponible* |
| `app.json` | Plugins capture (scanner, `expo-camera`, `expo-image-picker`), `usesCleartextTraffic`, `infoPlist` iOS |
| `docs/PHASE-A1-CAPTURE-CONFIG.md` | Permissions & politique fichier (phase A1) |
| `package.json` | Scripts `start`, `start:usb`, ports Expo |

---

## Historique des sessions

### 2026-04-09 — Refonte UX complète du flux ECG — **terminée**

Amélioration en 3 niveaux (quick wins + structurant + premium) sur toute la chaîne.

#### Quick wins
- **A1** : bouton « Caméra » supprimé (doublon du scanner). Reste : **Scanner** (principal) + **Galerie**.
- **D1** : templates contexte clinique transformés en **chips toggle** (plus de concaténation aveugle).
- **E4** : erreurs granulaires — messages dédiés pour quota dépassé, prescripteur non validé, timeout, réseau, fichier trop gros. `getApiErrorAction()` renvoie `retry | upgrade | login`.
- **F1** : `FormData` corrigé en **snake_case** (`patient_name`, `patient_id`, `clinical_context`, `gender`, `date`) aligné sur `CreateEcgInput` du backend.

#### Améliorations structurantes
- **C1+F2** : upload via `XMLHttpRequest` avec **barre de progression** (%) + timeout dédié **120 s** (vs 30 s fetch).
- **B3** : `DateInput` avec **masque automatique** YYYY-MM-DD + validation inline (bordure rouge, message).
- **A4** : **zoom plein écran** sur l'aperçu (Modal + ScrollView `maximumZoomScale: 4`).
- **E1** : **étape 4 récapitulatif dédié** (patient, fichier, urgence, contexte) — envoi depuis cette étape. **Confirmation urgence** (Alert) avant submit.
- **E2** : confirmation modale avant envoi si urgency = `urgent`.

#### Expérience premium
- **A2** : **guide visuel** avant la première capture (3 icônes : éclairage, position, cadrage auto) avec bouton « Compris ».
- **A3** : **indicateur de qualité** image (badge vert / jaune / rouge basé sur la taille du fichier) + haptic warning si qualité faible.
- **A5** : **multi-pages** (jusqu'à 3 pages) — carrousel avec boutons « + Scanner » / « + Galerie », compteur de pages. Pages supplémentaires envoyées via `POST /ecg-records/:id/files`.
- **G1** : **icônes Ionicons** (vectorielles) partout : tab bar, step bar, boutons, badges, champs. Emojis retirés.
- **G2** : **micro-animations** — `ScaleButton` (spring press), `slideAnim` transition entre étapes, fade in du guide, `ProgressBar` animée, fade out à la suppression de page.

#### Fichiers modifiés
| Fichier | Changements |
|---------|------------|
| `src/lib/apiClient.ts` | `uploadWithProgress` (XHR), `getApiErrorAction`, `details` sur `ApiError`, erreurs granulaires, timeout configurable |
| `src/components/ECGImageCapture.tsx` | Refonte complète : scanner + galerie (sans caméra), multi-pages, guide, qualité, zoom, Ionicons, animations |
| `app/(tabs)/new-ecg.tsx` | 4 étapes, chips toggle, DateInput masqué, progress bar, récap dédié, confirmation urgent, snake_case, Ionicons |
| `app/(tabs)/_layout.tsx` | Tab bar : Ionicons au lieu d'emojis |

- **Pas de changement `app.json`** → **pas de nouveau build** requis.
- `@expo/vector-icons` (Ionicons) fourni par Expo — déjà dans `node_modules`.

### 2026-04-09 — Phase A4 (intégration new-ecg) — **terminée**

- **Statut : réalisée** — `app/(tabs)/new-ecg.tsx` refactorisé.
- **Ce qui change :**
  - Imports nettoyés : suppression `ImagePicker` inline, `Image` (préview déplacé dans `ECGImageCapture`).
  - État `ecgFile` unifié : type discriminant `EcgFileState` (`kind: 'image' | 'document'`) — permet les deux chemins d'acquisition sans dupliquer la logique.
  - **Étape 2** : remplacée par `<ECGImageCapture value onCapture onClear />` (scanner / caméra / galerie) + un bouton PDF/DICOM conservé séparément pour les fichiers natifs.
  - Récapitulatif étape 3 : affiche la source (`scanner` / `camera` / `gallery`) et le nom de fichier.
  - `resetForm` : efface `ecgFile` (l'état unifié).
  - `handleSubmit` : passe par `ecgFileForUpload()` pour normaliser les deux kinds en `{ uri, name, type }` avant `FormData`.
- **Pas de changement `app.json`** → pas de nouveau build requis.
- **Chaîne A2 → A3 → A4 complète.**

### 2026-04-09 — Phase A3 (composant ECGImageCapture) — **terminée**

- **Statut : réalisée** — composant `ECGImageCapture` créé dans `src/components/`.
- **Fichier créé :** `src/components/ECGImageCapture.tsx`.
- **Trois modes d'acquisition :**
  - **Scanner document** (`react-native-document-scanner-plugin`) — cadrage auto, deskew, normalisation JPEG A1.
  - **Caméra** (`expo-image-picker launchCameraAsync`) — correction EXIF + redim ≤ 3 000 px + JPEG 0.85.
  - **Galerie** (délégué à `useECGImageCorrection` A2) — même politique.
- **Aperçu** : une fois une image sélectionnée, le composant bascule en vue aperçu (dimensions, source, bouton « Changer »).
- **Interface publique :** props `onCapture(ECGCaptureResult)`, `onClear?()`, `value?` (contrôlé).
- `ECGCaptureResult` étend `ECGImageResult` (A2) + champ `source` + `fileName`.
- **Pas de changement `app.json`** → pas de nouveau build requis.
- **Prochaine étape : A4** — brancher `ECGImageCapture` dans `app/(tabs)/new-ecg.tsx` à la place du code inline.

### 2026-04-09 — Phase A2 (correction image ECG depuis galerie) — **terminée**

- **Statut : réalisée** — hook `useECGImageCorrection` + hook dépendant `useImagePickerPermission`.
- **Fichiers créés :**
  - `src/hooks/useImagePickerPermission.ts` : vérification / demande de permission photothèque (`expo-image-picker`) ; expose `status`, `request`, `check`.
  - `src/hooks/useECGImageCorrection.ts` : enchaîne permission → picker galerie (images uniquement) → correction orientation EXIF → redimensionnement (≤ 3 000 px) → export **JPEG 0.85**. Expose `image`, `processing`, `error`, `pickAndCorrect`, `reset`.
- **Politique A1 respectée** : format JPEG, grande dimension ≤ 3 000 px, qualité 0.85, correction EXIF orientations 3 / 6 / 8 (180° / 90° / -90°).
- **Pas de changement natif** (`app.json` inchangé) → pas de nouveau build requis pour cette phase.
- **Prochaine étape : A3** — composant `ECGImageCapture` (scanner document + aperçu).

### 2026-04-07 — Phase A1 (configuration capture ECG)

- **Statut : réalisée** — harmonisation des textes de permission (marque Xpress ECG), plugin **`expo-image-picker`** (FR + `microphonePermission: false`), **`expo-camera`** avec **`recordAudioAndroid: false`** pour éviter `RECORD_AUDIO` inutile, scanner document aligné sur le même ton.
- **iOS** : `NSPhotoLibraryAddUsageDescription`, libellé micro Info.plist clarifié.
- **Android** : liste `permissions` nettoyée (préfixes `android.permission.`), ajout **`READ_MEDIA_IMAGES`** (API 33+).
- Document **`docs/PHASE-A1-CAPTURE-CONFIG.md`** (table des briques, politique JPEG / taille indicative pour phases suivantes).
- **Important** : après `git pull` de ces changements, refaire une **`eas build --profile development`** pour appliquer les changements natifs sur le téléphone.

### 2026-04-07 — Phase 0 option A (development build) — **terminée**

- Validation : ouverture de l’app via **development build** + Metro (`exp://127.0.0.1:…`), pas seulement configuration théorique.
- Ajout **expo-dev-client**, **expo-image-manipulator**, **react-native-document-scanner-plugin** ; **eas.json** ; scripts **`start:usb:devclient`** / **`start:devclient`**.
- Péripéties utiles : URL Metro ≠ port API **3001** ; ports **19002** parfois occupés (tuer l’ancien Metro ou libérer le port). Détail : `docs/PHASE0-DEV-BUILD.md`.

### 2026-04-07 (sessions regroupées)

- **Contexte :** connexion prescripteur OK sur navigateur PC, échec sur Expo Go avec *« connexion échouée ; serveur non disponible »*.
- **Causes identifiées :**
  - URL API pointant vers un host/port inaccessible depuis le téléphone (`localhost` sans reverse, ou mauvais port).
  - Backend effectivement sur le port **3001** alors que le mobile était configuré en **3000**.
- **Actions :**
  - Alignement `.env` : `EXPO_PUBLIC_API_URL=http://127.0.0.1:3001` (à ajuster si le backend change de port).
  - Repli dans `apiClient.ts` : `localhost:3001` par défaut.
  - Script `start:usb` : correction `loadDotEnv` — `text.split(/\r?\n/)` au lieu de l’expression invalide `split(/\n')`.
- **À faire côté dev à chaque session :** backend démarré sur le bon port → `npm run start:usb` → vérifier les lignes `adb reverse` (Metro + port API) → recharger l’app dans Expo Go ; `--clear` si l’URL API ne semble pas prise en compte.

*(Sessions antérieures — montée Expo SDK 54, Babel / NativeWind, React Navigation v7, écrans prescripteur : voir historique Git / tickets si besoin de détail.)*

---

## Prochaines pistes (optionnel)

- **Phase A2** : hook `useECGImageCorrection` (galerie + `expo-image-manipulator`). ✅ **Fait**
- **Phase A3** : composant `ECGImageCapture` (scanner + preview). ✅ **Fait**
- **Phase A4** : intégration `app/(tabs)/new-ecg.tsx`. ✅ **Fait**
- `.env.example` (sans secrets) ; endpoint **health** backend pour tests mobile ; prod HTTPS / `usesCleartextTraffic`.

---

*Dernière mise à jour du document : 2026-04-09 — phases 0, A1, A2, A3, A4 + refonte UX complète (fait).*
