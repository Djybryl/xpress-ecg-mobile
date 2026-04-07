/**
 * Metro via USB : adb reverse. Evite stdio inherit avec npm/PowerShell
 * (erreur "redirection de l entree n est pas prise en charge").
 */
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const port = process.env.EXPO_USB_PORT || '19002';

/** Charge .env pour lire EXPO_PUBLIC_API_URL avant adb reverse API */
function loadDotEnv() {
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

/** Port backend a rediriger si URL = localhost ou 127.0.0.1 */
function getLocalApiPortForReverse() {
  const url = (process.env.EXPO_PUBLIC_API_URL || '').trim();
  const m = url.match(/^https?:\/\/(127\.0\.0\.1|localhost):(\d+)(\/|$)/i);
  if (m) return m[2];
  return null;
}

loadDotEnv();

function sleepSync(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* attente sans timeout.exe (evite soucis sous npm) */
  }
}

function killPort(p) {
  try {
    const r = spawnSync('cmd.exe', ['/c', `netstat -aon | findstr ":${p}" | findstr "LISTENING"`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 8000,
    });
    const out = (r.stdout || '').trim();
    if (!out) return;
    const pids = new Set();
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      spawnSync('taskkill', ['/PID', pid, '/F'], {
        stdio: 'ignore',
        windowsHide: true,
        timeout: 8000,
      });
      console.log('  Port ' + p + ' : processus ' + pid + ' termine.');
    }
    if (pids.size > 0) sleepSync(1500);
  } catch { /* libre */ }
}

function adbWorks(adbExe) {
  const r = spawnSync(adbExe, ['version'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    timeout: 10000,
  });
  return r.status === 0;
}

function parseAdbDevices(adbExe) {
  const r = spawnSync(adbExe, ['devices'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    timeout: 15000,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  const out = (r.stdout || '') + '\n' + (r.stderr || '');
  const lines = out.split(/\r?\n/);
  const devices = [];
  let unauthorized = false;
  for (const line of lines) {
    const t = line.trim();
    if (/\tunauthorized\b/.test(t)) unauthorized = true;
    if (/\tdevice\s*$/.test(t)) devices.push(t);
  }
  return { devices, unauthorized };
}

function runAdb(adbExe, args, label) {
  const r = spawnSync(adbExe, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    encoding: 'utf8',
    timeout: 25000,
  });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    console.error('');
    console.error('Echec : ' + label + ' (code ' + (r.status != null ? r.status : '?') + ')');
    return false;
  }
  return true;
}

/**
 * ADB_PATH peut etre le dossier platform-tools OU le chemin complet vers adb.exe
 */
function expandAdbPath(raw) {
  const p = raw.replace(/^"|"$/g, '').trim();
  if (!p || !fs.existsSync(p)) return null;
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    const exe = path.join(p, process.platform === 'win32' ? 'adb.exe' : 'adb');
    return fs.existsSync(exe) ? exe : null;
  }
  return p;
}

function resolveAdb() {
  if (process.env.ADB_PATH) {
    const expanded = expandAdbPath(process.env.ADB_PATH);
    if (expanded && adbWorks(expanded)) return expanded;
  }

  const sdkRoots = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT].filter(Boolean);
  for (const base of sdkRoots) {
    const exe = path.join(base, 'platform-tools', 'adb.exe');
    if (fs.existsSync(exe) && adbWorks(exe)) return exe;
  }

  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
    'C:\\Program Files\\Android\\Android Studio\\sdk\\platform-tools\\adb.exe',
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Android', 'Android Studio', 'sdk', 'platform-tools', 'adb.exe'),
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c) && adbWorks(c)) return c;
  }

  const where = spawnSync('where.exe', ['adb'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 8000,
  });
  if (where.status === 0 && where.stdout) {
    const first = where.stdout.trim().split(/\r?\n/)[0];
    if (first && fs.existsSync(first) && adbWorks(first)) return first;
  }

  return null;
}

killPort(port);

const adb = resolveAdb();
if (!adb) {
  console.error('');
  console.error('adb.exe introuvable ou ne repond pas.');
  console.error('');
  console.error('1) Telechargez "SDK Platform-Tools for Windows" :');
  console.error('   https://developer.android.com/tools/releases/platform-tools');
  console.error('');
  console.error('2) Decompressez le dossier platform-tools quelque part, par ex. :');
  console.error('   C:\\Android\\platform-tools\\');
  console.error('');
  console.error('3) Dans PowerShell AVANT npm run start:usb :');
  console.error('   $env:ADB_PATH = "C:\\...\\platform-tools"');
  console.error('   ou le fichier complet : ...\\platform-tools\\adb.exe');
  console.error('');
  process.exit(1);
}

console.log('');
console.log('Utilisation de adb : ' + adb);
console.log('');
console.log('===================================================================');
console.log('  MODE USB (adb reverse)');
console.log('===================================================================');
console.log('');
console.log('  1) Telephone branche en USB (mode transfert fichiers / MTP si demande)');
console.log('  2) Options developpeur : debogage USB active');
console.log('  3) Accepter la cle RSA sur le telephone');
console.log('');

const deviceCheck = parseAdbDevices(adb);
if (deviceCheck.unauthorized) {
  console.error('');
  console.error('Telephone en "unauthorized" : deverrouillez l ecran et acceptez');
  console.error('"Autoriser le debogage USB" sur le telephone, puis relancez.');
  process.exit(1);
}
if (deviceCheck.devices.length === 0) {
  console.error('');
  console.error('Aucun appareil vu par adb (liste vide). Tant que "adb devices"');
  console.error('n affiche pas une ligne se terminant par "device", reverse est impossible.');
  console.error('');
  console.error('Essayez dans l ordre :');
  console.error('  - Autre cable USB (beaucoup ne font que la charge, pas les donnees)');
  console.error('  - Autre port USB du PC (preferer USB direct, sans hub)');
  console.error('  - Sur le telephone : notification USB -> Mode "Transfert de fichiers" / MTP');
  console.error('  - Options dev : "Revocation des autorisations de debogage USB" puis rebrancher');
  console.error('  - Pilotes : Gestionnaire de peripheriques Windows -> telephone / Android');
  console.error('    (Samsung : Samsung USB Driver ; Xiaomi : Mi USB ; Google : OK par defaut)');
  console.error('');
  console.error('Test manuel dans cmd (meme dossier platform-tools) :');
  console.error('  adb kill-server');
  console.error('  adb start-server');
  console.error('  adb devices');
  console.error('Vous devez voir un ID + le mot "device" (pas "unauthorized").');
  console.error('');
  process.exit(1);
}

if (!runAdb(adb, ['reverse', 'tcp:' + port, 'tcp:' + port], 'adb reverse Metro')) {
  console.error('Verifiez cable USB, debogage USB, et une seule appareil USB.');
  process.exit(1);
}

console.log('');
console.log('>>> adb reverse tcp:' + port + ' tcp:' + port + '  (Metro) — OK');

const apiPort = getLocalApiPortForReverse();
if (apiPort) {
  if (!runAdb(adb, ['reverse', 'tcp:' + apiPort, 'tcp:' + apiPort], 'adb reverse API')) {
    console.error('Echec reverse du port API ' + apiPort + '. La connexion login echouera.');
    process.exit(1);
  }
  console.log('>>> adb reverse tcp:' + apiPort + ' tcp:' + apiPort + '  (API -> PC) — OK');
  console.log('');
  console.log('  Verifiez que le backend tourne sur ce PC : http://127.0.0.1:' + apiPort);
  console.log('  EXPO_PUBLIC_API_URL=' + (process.env.EXPO_PUBLIC_API_URL || ''));
} else {
  const u = process.env.EXPO_PUBLIC_API_URL || '';
  console.log('');
  console.log('  EXPO_PUBLIC_API_URL=' + (u || '(non defini)'));
  console.log('  Pas de reverse API (utilisez 127.0.0.1:PORT ou localhost:PORT dans .env pour USB).');
}

process.env.REACT_NATIVE_PACKAGER_HOSTNAME = '127.0.0.1';
process.env.EXPO_METRO_PORT = port;

console.log('');
console.log('>>> Dans Expo Go : exp://127.0.0.1:' + port);
console.log('');
console.log('===================================================================');
console.log('');

const child = spawn('npx', ['expo', 'start', '--port', port, '--localhost'], {
  stdio: 'inherit',
  shell: true,
  cwd: root,
  env: { ...process.env },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
