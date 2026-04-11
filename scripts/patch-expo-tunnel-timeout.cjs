/**
 * Expo CLI impose 10s pour etablir le tunnel ngrok — trop court sur reseaux lents / hotspot.
 * Passe a 120s (reapplique apres chaque npm install via postinstall).
 *
 * SDK 54 : @expo/cli est souvent sous node_modules/expo/node_modules/@expo/cli/
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const candidates = [
  path.join(root, 'node_modules', 'expo', 'node_modules', '@expo', 'cli', 'build', 'src', 'start', 'server', 'AsyncNgrok.js'),
  path.join(root, 'node_modules', '@expo', 'cli', 'build', 'src', 'start', 'server', 'AsyncNgrok.js'),
];

const target = candidates.find((p) => fs.existsSync(p));

if (!target) {
  console.warn('[patch-expo-tunnel-timeout] AsyncNgrok.js introuvable (npm install d abord). Chemins testes :');
  candidates.forEach((p) => console.warn('  -', p));
  process.exit(0);
}

let s = fs.readFileSync(target, 'utf8');
const from = 'const TUNNEL_TIMEOUT = 10 * 1000;';
const to = 'const TUNNEL_TIMEOUT = 120 * 1000;';

if (s.includes(to)) {
  process.exit(0);
}
if (!s.includes(from)) {
  console.warn('[patch-expo-tunnel-timeout] Pattern Expo CLI change — patch non applique :', target);
  process.exit(0);
}

s = s.replace(from, to);
fs.writeFileSync(target, s);
console.log('[patch-expo-tunnel-timeout] Delai tunnel ngrok : 120 s —', target);
