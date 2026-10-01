import './globals.css';
import './theme.css';
import PwaRegister from '@/components/PwaRegister';
import UpdatePrompt from '@/components/UpdatePrompt';

export const metadata = {
  title: 'Cahyana Dashboard',
  description: 'Owner dashboard for Cahyana Ubud Experience - bookings and prices.',
  // Nothing here belongs in a search result. This is not the security boundary
  // (that is the API), it just keeps a sign-in form out of Google.
  robots: { index: false, follow: false },
  // In metadata, not hard-coded in <head>, so /driver can swap all three for its
  // own (DASHBOARD BRIEF #7: a second installable app on the same origin).
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: 'Dashboard', statusBarStyle: 'default' },
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
        <meta name="theme-color" content="#ffffff" />
        {/* Older iPhones only open standalone with this exact name. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      {/* Room for the bottom bar, reserved only where the bar exists. Measured:
          the bar is 65px since it took the site's book-bar paddings. */}
      <body className="max-[993px]:pb-[68px]">
        <PwaRegister />
        {children}
        <UpdatePrompt />
      </body>
    </html>
  );
}
