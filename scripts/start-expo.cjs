/**
 * Force la bonne IP dans le manifeste Expo, puis lance Metro.
 *
 * Le probleme historique : sans REACT_NATIVE_PACKAGER_HOSTNAME, Expo ecrit
 * "127.0.0.1" dans le manifeste → le telephone essaie de telecharger
 * le bundle JS depuis lui-meme → echec.
 *
 * Defaut sans arguments : --lan (demarrage Metro plus rapide que --tunnel / ngrok).
 * Hors reseau local : npm run start:tunnel
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const DEFAULT_PORT = 19000;

const expoArgs = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['start', '--port', String(DEFAULT_PORT), '--lan'];

let port = String(DEFAULT_PORT);
const pIdx = expoArgs.indexOf('--port');
if (pIdx >= 0 && expoArgs[pIdx + 1]) {
  port = String(expoArgs[pIdx + 1]);
}

const useTunnel = expoArgs.includes('--tunnel');

/* ── Tue tout processus restant sur le port avant de lancer Metro ── */
function killPort(p) {
  try {
    const out = execSync(
      `netstat -aon | findstr ":${p}" | findstr "LISTENING"`,
      { encoding: 'utf8', timeout: 5000 },
    );
    const pids = new Set();
    for (const line of out.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { timeout: 5000 });
        console.log('  Tue le processus ' + pid + ' qui occupait le port ' + p);
      } catch { /* already dead */ }
    }
    if (pids.size > 0) {
      execSync('timeout /t 2 /nobreak >nul', { timeout: 5000 });
    }
  } catch {
    /* port is free */
  }
}

killPort(port);

process.env.EXPO_METRO_PORT = port;

/* ── Force l'IP dans le manifeste Expo ── */
if (!useTunnel && !process.env.REACT_NATIVE_PACKAGER_HOSTNAME) {
  const bestIp = detectBestLanIp();
  if (bestIp) {
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME = bestIp;
    console.log('');
    console.log('>>> REACT_NATIVE_PACKAGER_HOSTNAME = ' + bestIp);
    console.log('    (Expo ecrira cette IP dans le manifeste pour le telephone)');
  }
}

const { printExpoGoUrls, printTunnelBanner } = require('./expo-local-urls.cjs');

if (useTunnel) {
  printTunnelBanner(port);
} else {
  printExpoGoUrls({ includeQr: false, prestart: true });
}

const child = spawn('npx', ['expo', ...expoArgs], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: { ...process.env },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});

/* ── Detection IP ── */
function detectBestLanIp() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if ((net.family === 'IPv4' || net.family === 4) && !net.internal) {
        addrs.push(net.address);
      }
    }
  }
  if (addrs.length === 0) return null;

  function sc(ip) {
    if (ip.startsWith('192.168.43.')) return 100;
    if (ip.startsWith('172.20.10.'))  return 90;
    if (ip.startsWith('192.168.137.')) return 85;
    if (ip.startsWith('192.168.'))    return 70;
    if (ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return 50;
    if (ip.startsWith('10.'))         return 30;
    return 1;
  }
  addrs.sort((a, b) => sc(b) - sc(a));
  return addrs[0];
}
