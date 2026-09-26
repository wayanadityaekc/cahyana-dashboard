// The one page the worker keeps. Reached only when the network itself failed,
// so it says the true thing: nothing here can be read offline, because all of
// it lives on the server behind a session.
export const metadata = {
  title: 'Offline | Cahyana Dashboard',
  robots: { index: false, follow: false },
};

export default function Offline() {
  return (
    <main className="max-w-[560px] mx-auto px-[var(--container-x)] py-[var(--space-5)]">
      <h1 className="font-head font-medium tracking-[-0.01em] text-display text-green m-0 mb-[0.3rem]">
        You are offline
      </h1>
      <p className="font-body text-body text-muted m-0">
        Bookings, prices and chat all live on the server, so none of it can be
        shown without a connection. Try again once you have signal.
      </p>
    </main>
  );
}
