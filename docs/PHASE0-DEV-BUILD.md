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

## URL à saisir dans la development build (écran « serveur local »)

Ce champ sert à joindre **Metro** (bundler JavaScript), **pas** l’API backend.

| À mettre | Exemple |
|----------|---------|
| **Oui** | `exp://127.0.0.1:19002` (même **port** que dans le terminal après `npm run start:usb:devclient`) |
| **Non** | `http://127.0.0.1:3001` → c’est l’**API** (`EXPO_PUBLIC_API_URL` dans `.env`), pas Metro |

Si l’app demande sans `exp://`, essayez `127.0.0.1:19002` selon l’UI.

---

## Mode tunnel (Metro sans USB / sans LAN fiable)

Quand le téléphone sert de **point d’accès** au PC ou que le Wi‑Fi ne permet pas d’atteindre l’IP locale du PC, le **tunnel Expo** fait passer le bundler Metro par les serveurs Expo (via ngrok), ce qui fonctionne sur **4G / hotspot**.

### Prérequis

- Compte **Expo** (même que pour EAS) : `npx expo login` si besoin.
- Connexion Internet sur le PC (via le partage du téléphone ou autre).

### Commande (development build)

Dans le dossier `xpress-ecg-mobile` :

```bash
npm run start:tunnel:devclient
```

Équivalent manuel :

```bash
npx expo start --tunnel --dev-client --port 19000
```

### Déroulement

1. Le terminal affiche un **QR code** et une URL du type `exp://…@…` ou un lien **https://u.expo.dev/…** (selon la version).
2. Sur le téléphone, ouvrez **Xpress ECG** (dev build) et saisissez l’**URL du serveur de développement** indiquée par Expo (souvent bouton « copier » dans le terminal ou scan du QR).

#### Le QR ou l’URL n’apparaissent pas dans PowerShell

- **Faites défiler** le terminal vers le **haut** : cherchez une ligne du type **`Metro waiting on`** avec une **URL soulignée** (`exp://…@…exp.direct…`) — c’est souvent **au-dessus** du dernier message.
- Cliquez **dans** la fenêtre du terminal (pour le focus), puis touche **`c`** : Expo **réaffiche** le QR du projet (raccourci pas toujours listé en mode compact).
- Touche **`?`** : liste des commandes.
- **Encodage** : dans **cmd** avec UTF-8, depuis le dossier du projet : `npm run start:tunnel:devclient:utf8` (script qui fait `chcp 65001` puis le tunnel).
- **Terminal intégré Cursor** : parfois le QR ne s’affiche pas correctement → essayez **PowerShell** ou **Invite de commandes** **en dehors** de Cursor, ou **Windows Terminal**.
3. La première utilisation du tunnel peut demander d’accepter les **conditions ngrok** dans le terminal (taper `Y`).
4. Le premier chargement peut être **plus lent** qu’en USB ou LAN.

### Limites

- Le tunnel ne remplace **pas** l’**API backend** : `EXPO_PUBLIC_API_URL` doit toujours être joignable depuis le téléphone (souvent **USB + `adb reverse`** vers `http://127.0.0.1:3001`, ou un tunnel séparé type ngrok sur le port 3001).
- Gratuit : quotas / débit ngrok peuvent varier ; en cas d’échec, relancer `npm run start:tunnel:devclient`.

### Erreur « ngrok tunnel took too long to connect »

Expo attend par défaut **10 s** pour ngrok — souvent **trop court** en 4G / point d’accès. Le projet applique un patch **120 s** via `postinstall` → `scripts/patch-expo-tunnel-timeout.cjs` (fichier cible : `expo/node_modules/@expo/cli/.../AsyncNgrok.js`).

Après un `npm install`, si l’erreur revient : `node scripts/patch-expo-tunnel-timeout.cjs`. Vérifiez aussi **VPN désactivé**, réseau stable, et `npx expo login` effectué.

---

## Rappels

- Tant que la **development build** n’est pas installée, le **scanner document** ne sera pas utilisable en conditions réelles.
- Après chaque changement **uniquement JavaScript/TypeScript**, un **nouveau build n’est pas nécessaire** ; rechargez depuis le dev client.
- Après ajout / mise à jour d’un **module natif** ou d’un **config plugin**, il faut **reconstruire** une development build.

---

## Dépannage EAS : « Failed to resolve plugin … react-native-document-scanner-plugin »

Sur le serveur de build, `npm ci` n’installe que ce qui est listé dans **`dependencies`** du **`package.json`**. Si le plugin est dans `app.json` mais **absent** de `package.json`, le module n’existe pas dans `node_modules` et la phase *Read app config* échoue.

Vérifiez que figurent bien (versions alignées Expo 54) :

- `expo-dev-client`
- `expo-image-manipulator`
- `react-native-document-scanner-plugin`

Puis committez **`package.json`** et **`package-lock.json`** et relancez `eas build`.

---

*Dernière mise à jour : 2026-04-07.*
