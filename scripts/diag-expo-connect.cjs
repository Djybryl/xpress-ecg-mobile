/**
 * Aide au diagnostic : Metro joignable depuis le PC ?
 * Usage : Metro doit tourner (npm start), puis dans un 2e terminal :
 *   node scripts/diag-expo-connect.cjs
 */
const http = require('http');
const os = require('os');

const port = parseInt(process.env.EXPO_METRO_PORT || '19000', 10);

function getIPv4s() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        out.push({ name, address: net.address });
      }
    }
  }
  return out;
}

function probe(host, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/`, { timeout: timeoutMs }, (res) => {
      res.resume();
      resolve({ ok: true, status: res.statusCode });
    });
    req.on('error', (e) => resolve({ ok: false, err: e.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, err: 'timeout' });
    });
  });
}

async function main() {
  console.log('');
  console.log('=== Diagnostic Expo / Metro (port ' + port + ') ===');
  console.log('');

  const rLocal = await probe('127.0.0.1');
  console.log(
    '127.0.0.1:' + port + '  ->  ' + (rLocal.ok ? 'OK HTTP ' + rLocal.status : 'ECHEC (' + rLocal.err + ')'),
  );
  if (!rLocal.ok) {
    console.log('');
    console.log('Metro ne repond pas en local. Lancez d abord : npm start');
    console.log('');
    process.exit(1);
  }

  const addrs = getIPv4s();
  if (addrs.length === 0) {
    console.log('Aucune IPv4 non-loopback.');
    process.exit(0);
  }

  console.log('');
  for (const { name, address } of addrs) {
    const r = await probe(address);
    console.log(
      address + ' (' + name + ')  ->  ' + (r.ok ? 'OK HTTP ' + r.status : 'ECHEC (' + r.err + ')'),
    );
  }

  console.log('');
  console.log('--- Sur le TELEPHONE (meme Wi-Fi que le PC) ---');
  console.log('Ouvrez le navigateur Chrome et tapez dans la barre d adresse :');
  console.log('');
  const first = addrs[0];
  console.log('  http://' + first.address + ':' + port);
  console.log('');
  console.log('Si la page ne charge PAS : le telephone n atteint pas le PC');
  console.log('(isolation clients sur le hotspot, mauvais reseau, ou mauvaise IP).');
  console.log('');
  console.log('Si la page charge : dans Expo Go utilisez :');
  console.log('  exp://' + first.address + ':' + port);
  console.log('');
  console.log('Si toujours pas de "Bundling" dans le terminal Metro :');
  console.log('  npm run start:usb  (cable USB + exp://127.0.0.1:' + port + ')');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
