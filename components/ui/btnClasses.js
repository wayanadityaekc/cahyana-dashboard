// Shared button utility-strings (migrasi Fase 2, TW-A12 #333). Satu sumber DRY
// buat primitif tombol yang dulu class CSS di style.css — komponen import string
// ini biar tetep self-contained (bawa style-nya) tanpa nyalin CSS.
//

// ---------------------------------------------------------------------------
// BTN_SM = the ONE size every action button on this site uses (Sep 2026, Wayan
// picked "A" from a measured sheet: "semua small", plus "make sure semua text
// align center, margin bottom top center juga").
//
// GEOMETRY ONLY. Colour, width, display and transition stay with each caller -
// the same split MENU_ROW_BOX uses, and for the same reason: one shape, many
// roles. Callers MUST bring their own flex display (inline-flex / flex), or the
// items-center/justify-center below do nothing. Display is deliberately NOT in
// here: it would collide with callers that need flex vs inline-flex vs a
// breakpoint-scoped display, and in Tailwind the winner is CSS order, not the
// order the classes were written in.
//
//   height  --btn-h 2.1rem (33.6px), a token of its own - see style.css
//   text    --fs-small 0.8rem (12.8px) via text-small
//   radius  --r-sm 8px via rounded-sm. That is ALSO what shadcn rounded-md
//           computes to, so following shadcn here costs no new number.
//   centre  BOTH axes: items-center + justify-center + text-center, and py-0 so
//           no leftover vertical padding can push the label off-centre.
//           leading-none removes the line-box slack that made short labels sit low.
//
// WHEN ADDING A BUTTON: import this, do not re-type the numbers. And when you
// convert an old one, DELETE its old h-/py-/px-/text-/rounded- classes - adding
// BTN_SM next to them does not override them (CSS order decides, not class order).
export const BTN_SM =
  'items-center justify-center text-center leading-none whitespace-nowrap ' +
  'h-[var(--btn-h)] py-0 px-4 rounded-sm text-small font-semibold';

// BTN_PILL = ghost/secondary pill ("View all …", "Add a program", "Sign out",
// review CTA). Mirror 1:1 dari `.btn-pill` (+ :hover) di style.css: outline gold,
// bg putih, teks gold-d, isi gold pas hover. (border butuh warna eksplisit —
// Preflight OFF; text-h3 = --fs-h3 14px; transition pakai token --dur.)
export const BTN_PILL =
  `inline-flex ${BTN_SM} [border:1px_solid_var(--color-gold)] ` +
  'bg-white text-gold-d font-body no-underline ' +
  '[transition:background-color_var(--dur)_ease,color_var(--dur)_ease,scale_var(--dur-fast)_var(--ease)] hover:bg-gold hover:text-white';
