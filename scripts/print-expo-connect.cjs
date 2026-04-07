/**
 * URLs exp:// + QR code (Metro doit déjà tourner).
 * Usage : npm run expo:connect
 */
const { printExpoGoUrls } = require('./expo-local-urls.cjs');
printExpoGoUrls({ includeQr: true, prestart: false });
console.log('');
