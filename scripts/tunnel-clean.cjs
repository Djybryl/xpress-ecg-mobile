/**
 * Lance Metro en mode tunnel et redemarre automatiquement si l'URL
 * contient un underscore (_), lequel viole RFC 952/1123 et bloque
 * Android (java.lang.IllegalArgumentException: Invalid input to toASCII).
 *
 * Usage : node scripts/tunnel-clean.cjs [args expo supplémentaires]
 * Ex    : node scripts/tunnel-clean.cjs --dev-client
 */

'use strict';
const { spawn, execSync } = require('child_process');
const path = require('path');

const MAX_ATTEMPTS = 15;
const POLL_DELAY_MS = 500;
const URL_PATTERN = /https?:\/\/[\w.-]+-\d+\.exp\.direct/;

const root = path.join(__dirname, '..');
const extraArgs = process.argv.slice(2);

function killNgrok() {
  try {
    execSync('taskkill /F /IM ngrok.exe', { stdio: 'pipe', timeout: 6000 });
  } catch { /* pas de ngrok en vie */ }
  // Laisse 1 seconde pour liberer les ports
  try {
    execSync('timeout /t 1 /nobreak >nul', { stdio: 'pipe', shell: true, timeout: 4000 });
  } catch { /* ignore */ }
}

function killPort(port) {
  try {
    const out = execSync(
      `netstat -aon | findstr ":${port}" | findstr "LISTENING"`,
      { encoding: 'utf8', timeout: 5000 },
    );
    for (const line of out.trim().split('\n')) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        try { execSync(`taskkill /PID ${pid} /F`, { timeout: 5000 }); } catch { /* already dead */ }
      }
    }
  } catch { /* port libre */ }
}

function tryOnce(attempt) {
  return new Promise((resolve) => {
    console.log(`\n[tunnel-clean] Tentative ${attempt}/${MAX_ATTEMPTS} — lancement Metro tunnel…`);

    killNgrok();
    killPort(19000);

    const child = spawn(
      'npx',
      ['expo', 'start', '--tunnel', '--dev-client', ...extraArgs],
      {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: true,
        cwd: root,
        env: { ...process.env },
      },
    );

    let buffer = '';
    let foundUrl = null;
    let decided = false;

    function decide(good, url) {
      if (decided) return;
      decided = true;
      if (good) {
        // Bonne URL : on passe stdout/stderr en mode direct et on laisse Metro tourner
        console.log(`\n[tunnel-clean] ✅  URL valide : ${url}`);
        console.log('[tunnel-clean]     Scan le QR code ci-dessus avec Expo Go / Dev Client.\n');
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
        child.on('exit', (code) => process.exit(code ?? 0));
        resolve(true);
      } else {
        // Mauvaise URL : on tue l'enfant et on réessaie
        console.log(`[tunnel-clean] ❌  URL invalide (underscore) : ${url}`);
        console.log('[tunnel-clean]     Arrêt et relance…\n');
        child.kill('SIGKILL');
        setTimeout(() => resolve(false), 1500);
      }
    }

    function onData(chunk) {
      const text = chunk.toString();
      process.stdout.write(text); // affiche quand meme pendant la recherche

      buffer += text;
      const match = buffer.match(URL_PATTERN);
      if (match && !decided) {
        foundUrl = match[0];
        const hasUnderscore = foundUrl.split('/')[2].includes('_');
        decide(!hasUnderscore, foundUrl);
      }
    }

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);

    child.on('exit', (code) => {
      if (!decided) resolve(false);
    });

    // Timeout de securite : si pas d'URL apres 90s → echec
    setTimeout(() => {
      if (!decided) {
        console.log('[tunnel-clean] Timeout (90 s) sans URL. Relance…');
        child.kill('SIGKILL');
        resolve(false);
      }
    }, 90_000);
  });
}

async function main() {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const ok = await tryOnce(i);
    if (ok) return; // Metro tourne avec URL propre
  }
  console.error(`\n[tunnel-clean] Echec apres ${MAX_ATTEMPTS} tentatives.`);
  console.error('Solution de secours : USB + adb reverse tcp:19000 tcp:19000');
  process.exit(1);
}

main();
