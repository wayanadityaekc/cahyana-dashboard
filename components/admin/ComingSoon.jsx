import { CARD, HEAD, NOTE } from '@/components/ui/panelClasses';

// A page that exists but has no rules yet (DASHBOARD BRIEF #8: Villas >
// Discounts and Ratings). It reads the same data nobody has: no sample numbers,
// no fake rows, no form that pretends to save. The owner decides the rules and
// tells us; until then this says so.
export default function ComingSoon({ title, children, Icon }) {
  return (
    <section className={`${CARD} max-w-[640px]`} data-coming-soon={title}>
      <h2 className={HEAD}>{Icon ? <Icon strokeWidth={1.7} aria-hidden="true" /> : null}{title}</h2>
      <p className={NOTE}>{children}</p>
      <p className={NOTE}><strong className="text-green">Not switched on.</strong> Nothing on this page changes any price, booking or review yet.</p>
    </section>
  );
}
