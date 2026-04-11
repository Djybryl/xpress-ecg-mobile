# Procédure — lancer l’application sur le téléphone (Xpress ECG mobile)

Document autonome : enchaînement **étape par étape** pour tester l’app sur un **appareil physique**, en tenant compte des évolutions du projet (**development build**, tunnel Metro, API distante ou locale).  
Pour le détail EAS et la phase 0, voir aussi [`PHASE0-DEV-BUILD.md`](./PHASE0-DEV-BUILD.md).

---

## 1. Ce dont vous avez besoin (une fois)

| Élément | Rôle |
|--------|------|
| **Node.js** + dépendances installées | Dans `xpress-ecg-mobile` : `npm install` |
| **Compte Expo** | `npx expo login` (tunnel Metro) ; EAS pour les builds |
| **Development build Android** installée sur le téléphone | APK issue de `eas build --profile development` — l’app s’appelle typiquement **Xpress ECG** (pas Expo Go du Store pour le flux complet scanner / natif) |
| **Backend Xpress ECG** qui tourne sur le PC | Port habituel **3001** (vérifier la console au démarrage du serveur) |
| **Câble USB + débogage USB** (option A) | Pour `adb reverse` et connexion Metro fiable |
| **ngrok** (option B, sans USB / sans LAN vers le PC) | Tunnel **séparé** vers le port du backend pour que le téléphone joigne l’API |

> **Important :** le **tunnel Expo** ne remplace pas l’API : il sert à joindre **Metro** (le bundler JS). L’URL **`EXPO_PUBLIC_API_URL`** dans `.env` doit pointer vers un hôte **joignable depuis le téléphone** (USB + `127.0.0.1`, IP LAN du PC, ou URL **https** ngrok vers le backend).

---

## 2. Choisir un mode réseau

### Mode A — USB (recommandé si le téléphone est branché au PC)

- Metro et, si l’URL API est `http://127.0.0.1:PORT` ou `http://localhost:PORT`, le **port du backend** sont renvoyés vers le PC via **adb reverse** (script du projet).
- Fichier `.env` typique :

  ```env
  EXPO_PUBLIC_API_URL=http://127.0.0.1:3001
  ```

  (Remplacez **3001** par le port réel du backend.)

### Mode B — Pas d’USB (hotspot téléphone, Wi‑Fi qui n’atteint pas le PC, etc.)

1. **Metro** : utiliser le **tunnel Expo** (voir étape 5B).
2. **API** : le téléphone ne peut pas utiliser `127.0.0.1` du PC. Solutions courantes :
   - **ngrok** (ou équivalent) : `ngrok http 3001` → copier l’URL **https** affichée ;
   - mettre dans `.env` :  
     `EXPO_PUBLIC_API_URL=https://VOTRE-SOUS-DOMAINE.ngrok-free.dev`  
     (sans slash final ; pas de `/api/v1` — le client mobile l’ajoute tout seul.)

Après **chaque** changement de `.env`, **redémarrer Metro** (idéalement avec `--clear` — voir étape 7).

---

## 3. Démarrer le backend sur le PC

1. Ouvrir un terminal dans le dépôt **backend**.
2. Lancer le serveur comme d’habitude (ex. `npm run dev` ou script équivalent).
3. Noter le **port** d’écoute (ex. **3001**) et vérifier que l’API répond (navigateur ou outil HTTP sur le PC).

Si vous utilisez **ngrok**, lancez-le **sur le même port** que le backend (ex. `ngrok http 3001`) et mettez à jour `.env` avec l’URL **https** fournie par ngrok.

---

## 4. Brancher et préparer le téléphone (mode USB)

1. Activer les **options développeur** et le **débogage USB** (Android).
2. Brancher le câble ; accepter l’autorisation USB si demandé.
3. Sur le PC : `adb devices` — l’appareil doit apparaître en **device** (pas `unauthorized`).  
   Si `adb` est introuvable : installer **Android SDK Platform-Tools** ou définir `ADB_PATH` vers le dossier contenant `adb.exe` (voir journal de travail).

---

## 5. Lancer Metro (bundler) — development build

Toujours depuis le dossier **`xpress-ecg-mobile`**.

### 5A — USB + development build (le plus simple au bureau)

```bash
npm run start:usb:devclient
```

Le script configure **adb reverse** pour le port Metro **et**, si `.env` contient une URL `127.0.0.1` / `localhost` avec un port, pour ce **port API** aussi.

Ensuite, sur le téléphone : ouvrir l’app **Xpress ECG** (dev build) et se connecter au serveur de développement (souvent **même réseau / exp://** selon l’écran). Si l’app demande une URL : utiliser celle indiquée dans le terminal (**Metro waiting on**), du type `exp://127.0.0.1:XXXXX` — **pas** l’URL du backend.

### 5B — Sans USB : tunnel Metro + development build

```bash
npm run start:tunnel:devclient
```

- Se connecter avec le compte Expo si demandé.
- Accepter les conditions **ngrok** dans le terminal si c’est la première fois (`Y`).
- Copier / scanner l’URL ou le QR affiché pour ouvrir le projet dans la **dev build** (pas dans Expo Go, si vous utilisez les modules natifs du projet).

Si le **QR** ou les caractères spéciaux posent problème dans le terminal : essayer **Windows Terminal** / **cmd** hors IDE, ou le script `npm run start:tunnel:devclient:utf8` (UTF-8).

### 5C — Sans script USB (Metro seul, à configurer vous‑même pour adb)

```bash
npm run start:devclient
```

Utile si vous gérez **adb reverse** manuellement ou testez sur émulateur.

---

## 6. Vérifier que l’app charge les données backend

1. L’écran de connexion ou le tableau de bord doit afficher les **données réelles** (pas d’erreur réseau permanente).
2. Si les listes restent vides sans message : vérifier **`.env`**, **port backend**, **ngrok actif** (mode B), et que le backend autorise les requêtes depuis l’URL utilisée (CORS / host si applicable).

---

## 7. Quand redémarrer Metro (et avec `--clear`)

| Situation | Action |
|-----------|--------|
| Changement de **`EXPO_PUBLIC_API_URL`** ou autre variable **`EXPO_PUBLIC_*`** | Arrêter Metro (`Ctrl+C`), relancer la commande de l’étape 5 ; en cas de doute : `npx expo start ... --clear` (en reprenant les mêmes options : `--dev-client`, `--tunnel`, port **19000** si vous les utilisez). |
| Changement uniquement de **fichiers .ts / .tsx** | Souvent **rechargement** dans l’app suffit (Fast Refresh) ; si comportement bizarre → redémarrer Metro avec `--clear`. |

Les variables `EXPO_PUBLIC_*` sont **figées au moment du bundle** : sans redémarrage Metro, le téléphone garde l’ancienne URL d’API.

---

## 8. Intégrer les **évolutions** de l’application

| Type de changement | Sur le téléphone |
|--------------------|------------------|
| **JavaScript / TypeScript** uniquement | Pas de nouvelle installation : recharger depuis la dev build (Metro connecté). |
| **`app.json`** : plugin natif, permissions, `usesCleartextTraffic`, etc. | Nouvelle **`eas build --profile development`** puis réinstallation de l’**APK** sur l’appareil. |
| Nouveau module **natif** npm | Idem : **rebuild** development + réinstallation. |
| Mise à jour **Expo SDK** majeure | Suivre le guide Expo + **rebuild** + tests complets. |

Après `git pull` contenant des changements **natifs**, prévoir systématiquement un **nouveau build** avant de valider sur téléphone.

---

## 9. Rappel des commandes utiles (référence)

| Objectif | Commande |
|----------|----------|
| Metro USB + dev client | `npm run start:usb:devclient` |
| Metro tunnel + dev client | `npm run start:tunnel:devclient` |
| Metro dev client (localhost) | `npm run start:devclient` |
| Diagnostic réseau / Expo (si scripts présents) | `npm run expo:diag`, `npm run net:diag` |

---

## 10. Dépannage rapide

- **« Serveur non disponible » / pas de données** : `.env` (URL + port), backend démarré, ngrok aligné sur le bon port (mode B), puis **redémarrer Metro** avec `--clear`.
- **`localhost` sur le téléphone** : sans USB + reverse, `localhost` = le téléphone, pas le PC → utiliser IP LAN ou ngrok.
- **Tunnel Metro trop long à démarrer** : le projet patch le timeout ngrok côté Expo (`postinstall`) ; vérifier VPN, réseau, `npx expo login`.
- **Port Metro déjà utilisé** : fermer l’ancienne fenêtre Metro ou libérer le port (souvent **19000** dans ce projet).

---

## 11. Phases produit (lien avec la roadmap)

Les phases **A1** (permissions / capture) et suivantes (**A2** correction image, **A3** composant capture, **A4** flux nouvel ECG) sont décrites dans [`JOURNAL-TRAVAIL-MOBILE.md`](./JOURNAL-TRAVAIL-MOBILE.md) et [`PHASE-A1-CAPTURE-CONFIG.md`](./PHASE-A1-CAPTURE-CONFIG.md). Toute évolution listée au §8 qui touche les plugins ou permissions nécessite un **nouveau build** pour être visible sur le téléphone.

---

*Document créé pour faciliter la mise en route à chaque session. Dernière mise à jour : 2026-04-07.*
