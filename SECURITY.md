## Vulnérabilités npm connues et acceptées

### postcss < 8.5.10 — moderate (GHSA-qx2v-qp2m-jg93)
- Chemin : expo → @expo/cli → @expo/metro-config → postcss
- Contexte : outil de build Metro uniquement — jamais embarqué
  dans l'APK ni exécuté sur le téléphone de l'utilisateur.
- Impact réel : nul — la vulnérabilité XSS CSS ne s'applique
  pas à React Native (pas de rendu HTML/CSS navigateur).
- Fix disponible : npm audit fix --force installerait expo@49
  (breaking change — rétrograderait de SDK 54 à SDK 49).
- Décision : acceptée jusqu'à ce qu'Expo publie une version
  de @expo/metro-config avec postcss >= 8.5.10.
- Date : 09 mai 2026
- Référence audit projet : Audit #8 mobile (statut aligné
  avec Audit #9 frontend — 6 vulnérabilités build-only).
