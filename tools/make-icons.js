// Home-screen icons for the dashboard, derived from the site's own icon.
//
// WHY DERIVE RATHER THAN DRAW. Both apps end up on the same phone, and two
// identical tiles under two labels is a daily annoyance. But inventing a second
// mark is design work nobody asked for, so this keeps the SAME monogram and
// swaps only the tile: the site is the brand gold, the dashboard is the brand
// soft-black (--color-gold, #22201c). Two colours that already exist, one
// recognisable family, no artwork invented.
//
// The source is two-colour by construction (see the favicon section in CUE's
// CLAUDE.md), so the remap is a clean split on brightness rather than a filter:
// bright pixels are the monogram and stay white, everything else becomes the
// tile. Alpha is forced opaque - iOS and Android composite a transparent icon
// themselves, usually onto black, and round the corners for you.
//
//   node tools/make-icons.js ../CUE/public/assets/icons/icon-512.png
//   node tools/make-icons.js ../CUE/public/assets/icons/icon-512.png --driver
//
// --driver (DASHBOARD BRIEF #7): the driver app's tiles, prefixed "driver-", on
// the brand CTA green (--color-cta, #3d5c46). Wayan has BOTH apps on one phone;
// a third colour that already exists keeps the three tiles telling apart.
//
// Not a CI gate. Run it by hand if the logo ever changes, then commit the output.
const sharp = require('sharp');
const path = require('path');

const DRIVER = process.argv.includes('--driver');
const TILE = DRIVER
  ? [0x3d, 0x5c, 0x46]               // --color-cta, the brand green (driver app)
  : [0x22, 0x20, 0x1c];              // --color-gold, the brand's soft black
const OUT = path.join(__dirname, '..', 'public', 'icons');
const PREFIX = DRIVER ? 'driver-' : '';
const SIZES = [
  ['icon-512.png', 512],
  ['icon-192.png', 192],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
];

async function main() {
  const src = process.argv[2];
  if (!src) { console.error('usage: node tools/make-icons.js <source.png>'); process.exit(1); }

  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const mark = lum > 170;                       // the monogram, measured against a 2-colour source
    data[i] = mark ? 255 : TILE[0];
    data[i + 1] = mark ? 255 : TILE[1];
    data[i + 2] = mark ? 255 : TILE[2];
    data[i + 3] = 255;                            // opaque: the OS draws the corners
  }

  const base = sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } });
  for (const [name, size] of SIZES) {
    await base.clone().resize(size, size, { kernel: 'lanczos3' })
      .png({ palette: true, colours: 16 })        // two colours in, so a palette is exact and small
      .toFile(path.join(OUT, PREFIX + name));
    console.log(`${PREFIX}${name}  ${size}x${size}`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
