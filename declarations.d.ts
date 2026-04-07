// Déclarations de modules Expo sans fichiers .d.ts séparés
declare module 'expo-status-bar';
declare module 'expo-splash-screen';
declare module 'expo-secure-store';
declare module 'expo-local-authentication';
declare module 'expo-image-picker';
declare module 'expo-document-picker';
declare module 'expo-haptics';
declare module 'expo-sharing';
declare module 'expo-file-system';

// Variables d'environnement Expo (EXPO_PUBLIC_*)
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
  }
}

// Assure que process.env est accessible
declare const process: {
  env: {
    EXPO_PUBLIC_API_URL?: string;
    [key: string]: string | undefined;
  };
};
