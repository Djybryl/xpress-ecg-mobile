# Phase 0 — Development build (option A)

Objectif : pouvoir installer une **application Xpress ECG** contenant le code natif (`react-native-document-scanner-plugin`, `expo-dev-client`) et la connecter à Metro comme Expo Go, **sans** utiliser l’Expo Go du Store pour ce flux.

---

## Déjà fait dans le dépôt (automatique)

- Dépendances npm : `expo-dev-client`, `expo-image-manipulator`, `react-native-document-scanner-plugin`.
- `app.json` : plugin document scanner avec le texte FR : *« Xpress-ECG a besoin d'accéder à votre caméra pour photographier les ECG. »*
- `eas.json` : profil **`development`** (`developmentClient: true`, APK Android interne).
- Scripts : `npm run start:devclient`, `npm run start:usb:devclient` (USB + `--dev-client`).

---

## À faire de votre côté

### 1. Compte Expo et EAS CLI

1. Créer / utiliser un compte sur [expo.dev](https://expo.dev).
2. Dans le dossier `xpress-ecg-mobile` :

   ```bash
   npx eas-cli login
   ```

   (ou installez `eas-cli` globalement si vous préférez.)

### 2. Lier le projet à EAS (une fois)

```bash
cd "…\xpress-ecg-mobile"
npx eas-cli build:configure
```

Répondez aux questions ; cela peut ajouter un **`projectId`** dans `app.json` sous `expo.extra.eas` — **committez** ce changement ensuite.

### 3. Première build Android (development)

```bash
npx eas-cli build --profile development --platform android
```

- Attendez la fin sur les serveurs Expo (ou build local si vous maîtrisez `eas build --local`).
- Téléchargez l’**APK** et installez-le sur le téléphone (autoriser « sources inconnues » si demandé).

### 4. Lancer Metro pour le dev client

- **USB** (comme avant, avec `adb`) :

  ```bash
  npm run start:usb:devclient
  ```

- **Sans** script USB :

  ```bash
  npm run start:devclient
  ```

Ouvrez le projet depuis l’**app Xpress ECG** installée (icône du projet), pas depuis Expo Go.

### 5. iOS (plus tard, si besoin)

- Compte **Apple Developer** (payant) requis pour un build installable sur iPhone physique.
- Commande type : `npx eas-cli build --profile development --platform ios`.

---

## Rappels

- Tant que la **development build** n’est pas installée, le **scanner document** ne sera pas utilisable en conditions réelles.
- Après chaque changement **uniquement JavaScript/TypeScript**, un **nouveau build n’est pas nécessaire** ; rechargez depuis le dev client.
- Après ajout / mise à jour d’un **module natif** ou d’un **config plugin**, il faut **reconstruire** une development build.

---

*Dernière mise à jour : 2026-04-07.*
