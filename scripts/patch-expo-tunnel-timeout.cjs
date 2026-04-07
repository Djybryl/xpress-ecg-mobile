/**
 * Expo CLI impose 10s pour etablir le tunnel ngrok — trop court sur reseaux lents.
 * Passe a 120s (reapplique apres chaque npm install via postinstall).
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'start',
  'server',
  'AsyncNgrok.js',
);

if (!fs.existsSync(target)) {
  console.warn('[patch-expo-tunnel-timeout] Fichier introuvable (npm install d abord) :', target);
  process.exit(0);
}

let s = fs.readFileSync(target, 'utf8');
const from = 'const TUNNEL_TIMEOUT = 10 * 1000;';
const to = 'const TUNNEL_TIMEOUT = 120 * 1000;';

if (s.includes(to)) {
  process.exit(0);
}
if (!s.includes(from)) {
  console.warn('[patch-expo-tunnel-timeout] Pattern Expo CLI change — patch non applique.');
  process.exit(0);
}

s = s.replace(from, to);
fs.writeFileSync(target, s);
console.log('[patch-expo-tunnel-timeout] Delai tunnel ngrok : 120 s (au lieu de 10 s).');
