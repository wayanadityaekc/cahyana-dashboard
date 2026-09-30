// The push notification's own images (DASHBOARD BRIEF #5 Q1: "the same bell
// icon ... for both the Settings menu and the actual push notification icon").
//
// Rendered FROM lucide-react's Bell, not redrawn, so the notification and the
// Settings row are literally the same glyph at the same stroke:
//   - bell-192.png  the notification icon: soft-black bell (--color-gold) on a
//                   white tile, which reads on light and dark notification shades.
//   - bell-badge-96.png  Android's status-bar badge: white on transparent. Android
//                   paints it from alpha only, so any colour would be thrown away.
// iOS ignores both and shows the home-screen tile; nothing to do there.
//
//   node tools/make-bell-icons.js      (then commit public/icons/bell-*.png)
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Bell } = require('lucide-react');
const sharp = require('sharp');
const path = require('path');

const OUT = path.join(__dirname, '..', 'public', 'icons');
const svg = (color) => renderToStaticMarkup(React.createElement(Bell, { size: 24, strokeWidth: 2, color }))
  .replace('<svg ', '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ');

(async () => {
  const glyph = (color, px) => sharp(Buffer.from(svg(color)), { density: 72 * (px / 24) }).resize(px, px).png().toBuffer();
  // Notification icon: bell at 62% of a white 192 tile.
  const g = await glyph('#22201c', 120);
  await sharp({ create: { width: 192, height: 192, channels: 4, background: '#ffffff' } })
    .composite([{ input: g, left: 36, top: 36 }]).png().toFile(path.join(OUT, 'bell-192.png'));
  // Badge: white bell, transparent ground.
  const b = await glyph('#ffffff', 72);
  await sharp({ create: { width: 96, height: 96, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: b, left: 12, top: 12 }]).png().toFile(path.join(OUT, 'bell-badge-96.png'));
  console.log('wrote bell-192.png, bell-badge-96.png');
})();
