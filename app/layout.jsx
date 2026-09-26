import './globals.css';
import PwaRegister from '@/components/PwaRegister';

export const metadata = {
  title: 'Cahyana Dashboard',
  description: 'Owner dashboard for Cahyana Ubud Experience - bookings and prices.',
  // Nothing here belongs in a search result. This is not the security boundary
  // (that is the API), it just keeps a sign-in form out of Google.
  robots: { index: false, follow: false },
};

export const viewport = { width: 'device-width', initialScale: 1 };

// Installable from the home screen. The tile is the SITE's monogram on the
// brand soft-black instead of the gold - both apps land on the same phone, and
// two identical tiles under two labels is a daily annoyance. See
// tools/make-icons.js; nothing was drawn, only the tile colour swapped.

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Self-hosted, preloaded: one font file, one request, no third party
            watching who opens the dashboard. */}
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Dashboard" />
      </head>
      {/* Room for the bottom bar, reserved only where the bar exists. */}
      <body className="standalone:max-[993px]:pb-[56px]">
        <PwaRegister />
        {children}</body>
    </html>
  );
}
