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
| Phase 0 — build native | `eas.json` profil `development` ; dépendances `expo-dev-client`, `react-native-document-scanner-plugin`, `expo-image-manipulator`. Voir `docs/PHASE0-DEV-BUILD.md`. |
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
| `app.json` | `usesCleartextTraffic` (Android) |
| `package.json` | Scripts `start`, `start:usb`, ports Expo |

---

## Historique des sessions

### 2026-04-07 — Phase 0 option A (development build)

- Ajout **expo-dev-client**, **expo-image-manipulator** (préparation galerie / EXIF), **react-native-document-scanner-plugin** (config plugin + message caméra FR dans `app.json`).
- Fichier **eas.json** (profils `development`, `preview`, `production`).
- Scripts **`npm run start:usb:devclient`** et **`npm run start:devclient`** ; `start-expo-usb.cjs` accepte `--dev-client`.
- Suite côté développeur : `eas login`, lier le projet, **`eas build --profile development --platform android`**, installer l’APK, lancer Metro avec `--dev-client`. Détail : `docs/PHASE0-DEV-BUILD.md`.

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

- Ajouter un fichier `.env.example` (sans secrets) avec `EXPO_PUBLIC_API_URL` commenté.
- Endpoint de **health** documenté pour tester depuis le navigateur du téléphone (IP LAN) ou `curl` sur le PC.
- En production : HTTPS et suppression / révision de `usesCleartextTraffic`.

---

*Dernière mise à jour du document : 2026-04-07.*
