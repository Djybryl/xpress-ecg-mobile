# Xpress ECG Mobile — Application Médecin Prescripteur

Application mobile React Native / Expo dédiée aux médecins prescripteurs pour la gestion des demandes ECG et la consultation des rapports.

## Stack technique

- **Expo SDK 51** (Managed Workflow)
- **expo-router v3** (navigation basée sur le système de fichiers)
- **React Native 0.74**
- **NativeWind v4** (Tailwind CSS pour React Native)
- **expo-secure-store** (tokens JWT en Keychain natif)
- **expo-camera / expo-image-picker** (capture ECG)
- **expo-local-authentication** (Face ID / Empreinte)
- **expo-notifications** (notifications push)

## Prérequis

- Node.js 18+
- Expo Go (iOS / Android) ou simulateur
- Backend `xpress-ecg-backend` démarré

## Installation

```bash
cd xpress-ecg-mobile
npm install
```

## Lancement

```bash
# Expo Go (scan QR code)
npm start

# Simulateur iOS
npm run ios

# Émulateur Android
npm run android
```

## Configuration

Copier `.env` et adapter l'URL :

```
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000   # IP LAN pour tester sur appareil physique
```

## Structure

```
app/
  _layout.tsx          → Layout racine (AuthProvider + navigation)
  index.tsx            → Redirection auto (auth ou tabs)
  (auth)/
    login.tsx          → Écran de connexion + biométrie
  (tabs)/
    _layout.tsx        → Barre d'onglets
    index.tsx          → Dashboard (stats + résumé)
    requests.tsx       → Demandes ECG (liste + filtres)
    new-ecg.tsx        → Nouvelle demande (3 étapes)
    reports.tsx        → Rapports (lecture + PDF)
    profile.tsx        → Profil + quota + RGPD

src/
  lib/apiClient.ts     → Client HTTP (adapté mobile, SecureStore)
  providers/AuthProvider.tsx
  hooks/useEcgList.ts
  hooks/useReportList.ts
  hooks/usePatientList.ts
  types/user.ts
```

## Build production (EAS)

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production
eas build --platform ios --profile production
```
