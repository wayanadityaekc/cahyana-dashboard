import './globals.css';

export const metadata = {
  title: 'Cahyana Dashboard',
  description: 'Owner dashboard for Cahyana Ubud Experience - bookings and prices.',
  // Nothing here belongs in a search result. This is not the security boundary
  // (that is the API), it just keeps a sign-in form out of Google.
  robots: { index: false, follow: false },
};

export const viewport = { width: 'device-width', initialScale: 1 };

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
      </head>
      <body>{children}</body>
    </html>
  );
}
