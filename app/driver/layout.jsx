// The driver app (DASHBOARD BRIEF #7): same origin as the owner's dashboard, its
// own install. A phone that adds /driver to the Home Screen gets "Driver" with
// the green tile and opens straight on /driver - never the owner's dashboard.
export const metadata = {
  title: 'Cahyana Driver',
  description: 'Jobs, earnings and chat for Cahyana drivers.',
  manifest: '/driver.webmanifest',
  icons: {
    icon: [{ url: '/icons/driver-favicon-32.png', sizes: '32x32', type: 'image/png' }],
    apple: [{ url: '/icons/driver-apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: { capable: true, title: 'Driver', statusBarStyle: 'default' },
};

export default function DriverLayout({ children }) {
  return children;
}
