/**
 * Detecte l'IP du PC sur le reseau local du partage de connexion du telephone.
 * Les plages typiques de hotspot sont :
 *   Android : 192.168.43.x
 *   iPhone  : 172.20.10.x
 *   Generique : 192.168.x.x
 *
 * Retourne l'IP la plus probable pour joindre le PC depuis le telephone.
 */
const os = require('os');

function getAllIPv4() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      const isIPv4 = net.family === 'IPv4' || net.family === 4;
      if (isIPv4 && !net.internal) {
        results.push({ name, address: net.address, netmask: net.netmask });
      }
    }
  }
  return results;
}

function scoreForHotspot(ip) {
  if (ip.startsWith('192.168.43.')) return 100; // Android hotspot classique
  if (ip.startsWith('172.20.10.')) return 90;   // iPhone hotspot classique
  if (ip.startsWith('192.168.137.')) return 85;  // Windows ICS (partage connexion USB)
  if (ip.startsWith('192.168.')) return 70;
  if (ip.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) return 50;
  if (ip.startsWith('10.')) return 20;           // souvent CGNAT operateur, rarement hotspot
  return 1;
}

const addrs = getAllIPv4();

if (addrs.length === 0) {
  console.error('Aucune IPv4 locale trouvee.');
  process.exit(1);
}

addrs.sort((a, b) => scoreForHotspot(b.address) - scoreForHotspot(a.address));

console.log('');
console.log('=== TOUTES LES INTERFACES RESEAU IPv4 ===');
console.log('');
addrs.forEach(({ name, address, netmask }) => {
  const sc = scoreForHotspot(address);
  const hint =
    sc >= 85
      ? ' <-- HOTSPOT (tres probable)'
      : sc >= 50
      ? ' <-- reseau local (possible)'
      : ' <-- operateur/VPN (peu probable pour hotspot)';
  console.log('  ' + name.padEnd(30) + address.padEnd(20) + 'masque ' + netmask + hint);
});
console.log('');

const best = addrs[0];
if (scoreForHotspot(best.address) < 50) {
  console.log('ATTENTION : aucune adresse typique de hotspot detectee.');
  console.log('L IP ' + best.address + ' (' + best.name + ') ressemble a du CGNAT operateur.');
  console.log('');
  console.log('Solutions :');
  console.log('  1) Branchez le telephone en USB (partage connexion USB) → IP 192.168.137.x');
  console.log('  2) Connectez PC et telephone sur le meme Wi-Fi (box) → IP 192.168.x.x');
  console.log('  3) Forcez l IP manuellement : dans .env ajoutez REACT_NATIVE_PACKAGER_HOSTNAME=<IP>');
  console.log('');
} else {
  console.log('IP recommandee pour Expo Go : ' + best.address);
  console.log('(carte : ' + best.name + ')');
  console.log('');
  console.log('Utilisation : lancez :');
  console.log('');
  console.log('  $env:REACT_NATIVE_PACKAGER_HOSTNAME="' + best.address + '"; npm start');
  console.log('');
  console.log('Puis dans Expo Go, saisir : exp://' + best.address + ':8082');
  console.log('');
}

// Affiche pour injection
process.stdout.write('BEST_IP=' + best.address);
