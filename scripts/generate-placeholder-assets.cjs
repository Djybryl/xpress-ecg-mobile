/**
 * Génère des PNG de remplacement pour Expo (icône, splash, favicon, etc.).
 * Exécuter : node scripts/generate-placeholder-assets.cjs
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const BRAND = { r: 79, g: 70, b: 229, a: 255 }; // #4f46e5

function fillPng(width, height, color, outPath) {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (width * y + x) << 2;
      png.data[i] = color.r;
      png.data[i + 1] = color.g;
      png.data[i + 2] = color.b;
      png.data[i + 3] = color.a;
    }
  }
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

function notificationIconWhiteOnTransparent(size, outPath) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (size * y + x) << 2;
      const cx = size / 2;
      const cy = size / 2;
      const r = size * 0.35;
      const d = Math.hypot(x - cx, y - cy);
      const inCircle = d < r;
      png.data[i] = 255;
      png.data[i + 1] = 255;
      png.data[i + 2] = 255;
      png.data[i + 3] = inCircle ? 255 : 0;
    }
  }
  fs.writeFileSync(outPath, PNG.sync.write(png));
}

const root = path.join(__dirname, '..');
const assets = path.join(root, 'assets');
fs.mkdirSync(assets, { recursive: true });

fillPng(1024, 1024, BRAND, path.join(assets, 'icon.png'));
fillPng(1024, 1024, BRAND, path.join(assets, 'adaptive-icon.png'));
fillPng(1284, 2778, BRAND, path.join(assets, 'splash.png'));
fillPng(48, 48, BRAND, path.join(assets, 'favicon.png'));
notificationIconWhiteOnTransparent(96, path.join(assets, 'notification-icon.png'));

console.log('Assets générés dans ./assets/');
