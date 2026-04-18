const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('metro-config');
const { withNativeWind } = require('nativewind/metro');
const { FileStore } = require('metro-cache');

const config = getDefaultConfig(__dirname);
const withWind = withNativeWind(config, { input: './global.css' });

/**
 * Nombre de workers Metro (transformations parallèles).
 * Défaut Expo/Metro : souvent (nb CPU - 1). Vous pouvez forcer via la variable d'environnement
 * EXPO_METRO_MAX_WORKERS (ex. 6) si la machine a assez de RAM — peut accélérer un peu le rebundling.
 */
const maxWorkersEnv = process.env.EXPO_METRO_MAX_WORKERS;
const maxWorkers =
  maxWorkersEnv !== undefined && maxWorkersEnv !== ''
    ? Math.min(16, Math.max(1, parseInt(maxWorkersEnv, 10) || 1))
    : undefined;

/**
 * Cache Metro dans le dépôt (dossier .metro-cache) plutôt que uniquement %TEMP% :
 * moins sensible au nettoyage agressif du dossier temporaire et souvent plus fluide
 * sous Windows (antivirus, indexation).
 */
module.exports = mergeConfig(withWind, {
  cacheStores: [
    new FileStore({ root: path.join(__dirname, '.metro-cache') }),
  ],
  ...(maxWorkers !== undefined ? { maxWorkers } : {}),
});
