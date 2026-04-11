/**
 * Detection IPv4 locales + URLs exp:// pour Expo Go (sortie ASCII pour PowerShell Windows).
 */
const os = require('os');
const { execSync } = require('child_process');

function getPort() {
  return process.env.EXPO_METRO_PORT || process.env.RCT_METRO_PORT || '19000';
}

function getIPv4s() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const fam = net.family === 'IPv4' || net.family === 4 ? 'IPv4' : null;
      if (fam && !net.internal) {
        results.push({ name, address: net.address });
      }
    }
  }
  return results;
}

function score(ip) {
  if (ip.startsWith('192.168.')) return 4;
  if (ip.startsWith('10.')) return 3;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 16 && n <= 31) return 2;
  }
  return 1;
}

function getSortedAddresses() {
  return getIPv4s().sort((a, b) => score(b.address) - score(a.address));
}

function printFirewallHint(port) {
  console.log('');
  console.log('Si Expo Go affiche "Failed to download" / erreur reseau :');
  console.log('');
  console.log('  A) Ouvrez PowerShell EN ADMINISTRATEUR et executez :');
  console.log('');
  console.log(
    '     New-NetFirewallRule -DisplayName "Expo-Metro-' +
      port +
      '" -Direction Inbound -Action Allow -Protocol TCP -LocalPort ' +
      port,
  );
  console.log('');
  console.log('  B) Cable USB + ADB (fiable avec hotspot) :');
  console.log('       npm run start:usb');
  console.log('');
  console.log('  C) Ou tunnel (si votre reseau le permet) :');
  console.log('       npm run start:tunnel');
  console.log('');
}

/**
 * @param {{ includeQr?: boolean; prestart?: boolean }} opts
 */
function printExpoGoUrls(opts = {}) {
  const { includeQr = false, prestart = false } = opts;
  const addrs = getSortedAddresses();
  const port = getPort();

  if (prestart) {
    console.log('');
    console.log('===================================================================');
    console.log('  EXPO GO : Metro va afficher "Waiting on http://localhost:' + port + '"');
    console.log('  -> C est normal : localhost = ce PC, pas pour le telephone.');
    console.log('');
    console.log('  IMPORTANT : si apres ouverture dans Expo Go vous ne voyez JAMAIS');
    console.log('  une ligne "Android Bundling..." dans ce terminal, le telephone');
    console.log('  n atteint pas Metro. Souvent : le PC est sur le hotspot du telephone');
    console.log('  et Android bloque le telephone (hote) vers le PC (client).');
    console.log('  Dans ce cas utilisez :  npm run start:usb  (cable USB + depannage ADB).');
    console.log('');
    console.log('  Essayez UNE de ces URLs dans Expo Go (menu : saisir l URL) :');
    console.log('===================================================================');
    console.log('');
  } else {
    console.log('');
    console.log('===================================================================');
    console.log('  EXPO GO - Copier UNE URL (Metro doit tourner, port ' + port + ')');
    console.log('===================================================================');
    console.log('');
  }

  if (addrs.length === 0) {
    console.log('Aucune IPv4 locale. Verifiez Wi-Fi / partage de connexion.');
    console.log('Essayez : npm run start:tunnel');
    console.log('');
    return;
  }

  addrs.forEach(({ name, address }) => {
    console.log('  Carte : ' + name);
    console.log('  exp://' + address + ':' + port);
    console.log('');
  });

  const best = addrs[0];
  const url = 'exp://' + best.address + ':' + port;
  console.log('  >>> Priorite (meilleure carte reseau detectee) : ' + url);
  console.log('');

  if (addrs.length > 1) {
    console.log('  Si ca echoue, testez les autres lignes exp:// ci-dessus.');
    console.log('');
  }

  printFirewallHint(port);

  if (includeQr) {
    console.log('QR (Android, terminal avec polices Unicode) :');
    console.log('');
    try {
      execSync(`npx --yes qrcode-terminal "${url}"`, {
        stdio: 'inherit',
        shell: true,
        cwd: require('path').join(__dirname, '..'),
      });
    } catch {
      console.log('QR indisponible. Copiez l URL en texte.');
      console.log('');
    }
  }

  if (prestart) {
    console.log('===================================================================');
    console.log('  Laissez cette fenetre ouverte - Metro demarre ci-dessous.');
    console.log('===================================================================');
    console.log('');
  }
}

function printTunnelBanner(port) {
  console.log('');
  console.log('===================================================================');
  console.log('  MODE TUNNEL');
  console.log('');
  console.log('  N utilisez PAS les URLs exp:// avec IP locale (192.168 / 10.x).');
  console.log('  L URL exp://....exp.direct apparait APRES "Tunnel ready." (patience ~2 min).');
  console.log('');
  console.log('  OU TROUVER L URL / QR :');
  console.log('  - Faites DEFILER le terminal vers le HAUT : ligne "Metro waiting on" + URL soulignee.');
  console.log('  - Cliquez DANS la fenetre du terminal puis touche ** c ** (reafficher le QR projet).');
  console.log('  - Touche ** ? ** : liste des raccourcis Expo.');
  console.log('  - Si le QR est vide ou casse : PowerShell -> chcp 65001 puis relancer, ou utiliser cmd.exe');
  console.log('    ou Windows Terminal (police monospace). Eviter terminal integre Cursor si besoin.');
  console.log('');
  console.log('  Conseils si echec : npx expo login | VPN desactive | reseau stable');
  console.log('  Android USB : si erreur ADB, debranchez le cable ou installez adb reverse.');
  console.log('');
  console.log('  Port Metro local : ' + port);
  console.log('===================================================================');
  console.log('');
}

module.exports = { getPort, getIPv4s, getSortedAddresses, printExpoGoUrls, printTunnelBanner };
