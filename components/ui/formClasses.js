// Shared form-field utility strings (full-portable migrasi). Didefinisiin SEKALI di
// sini, di-import komponen form biar gak keduplikat & style.css bisa dikecilin.
//
// SATU UKURAN, SATU LABEL (Sep 2026, Wayan pilih "opsi 1" sesudah ngeliat hasil ukur:
// "gua cuma pengen ukuran dan standar yang bagus dan konsisten"). Yang ke-ukur sebelum
// ini, di 11 halaman: field-nya sendiri udah rapi (semua radius 12px, teks 12.8px,
// tinggi 33-34px) TAPI di sekelilingnya nggak - 8 definisi label yang beda, 4 nilai
// padding kiri, dan 2 warna border (salah satunya hex hardcoded, bukan token).
//
// Aturannya: apa pun yang bentuknya field WAJIB dibangun dari string di file ini.
// Jangan nulis ulang angkanya di komponen - itu yang bikin 8 label tadi.

// --- state error ------------------------------------------------------------
// `aria-invalid` udah kepasang di 14 field dari dulu, tapi NOL styling nyangkut ke
// dia: diukur, field yang error itu border/shadow/bg-nya IDENTIK sama field valid,
// jadi satu-satunya penanda cuma teks merah di bawahnya. Ini yang nyalain.
// Pakai bentuk arbitrary `aria-[invalid=true]:` - `aria-invalid` BUKAN salah satu
// varian aria bawaan Tailwind, jadi `aria-invalid:` gak ke-generate sama sekali.
// Nilainya `"true"`/`"false"` (dari `aria-invalid={!!errors.x}`), makanya di-match
// persis ke `=true` - kalau nggak, `aria-invalid="false"` ikut kena merah.
export const FIELD_INVALID =
  'aria-[invalid=true]:[border-color:var(--color-err)] ' +
  'aria-[invalid=true]:[box-shadow:0_0_0_3px_rgba(154,74,63,0.14)]';

// --- the one field box ------------------------------------------------------
// px-3 = 12px. Dulu 4 nilai (0.65/0.7/0.8/0.85rem = 10.4/11.2/12.8/13.6px); 12px
// dipilih karena dia di grid 4px yang sama kayak tangga radius 8/12/16 dan token
// --space 8/16/24, dan gak ada field yang geser lebih dari 1.6px.
// py-0 aman karena tingginya dipatok --field-h: teks input ke-center sendiri.
const FIELD_BOX =
  'h-[var(--field-h)] py-0 px-3 [border:1px_solid_var(--line)] rounded-md ' +
  `font-body text-field text-green bg-white ${FIELD_INVALID}`;

// Text/number/native field polos (dulu `.charter__select` + base grup .field input).
export const FIELD_INPUT = `w-full ${FIELD_BOX}`;

// Textarea: satu-satunya yang BUKAN --field-h (dia tumbuh), jadi dia butuh padding
// vertikal sendiri - tanpa itu teksnya nempel ke border atas.
export const FIELD_AREA =
  'w-full min-h-[130px] py-2 px-3 [border:1px_solid_var(--line)] rounded-md ' +
  `font-body text-field text-green bg-white resize-y ${FIELD_INVALID}`;

// --- the one field label ----------------------------------------------------
// Gantiin 8 definisi: modalClasses.LABEL, CONTACT_LABEL, LABEL di
// AirportTransferForm & TransferPicker, FIELD_LABEL di CharterBuilder & HeroSearch,
// 3 label inline di Navbar, dan `[&_label]:` di ITN_FIELD.
// mb-2 = 8px (dulu 0 / 4.8 / 6.4 / 8px). Bobot 500 & warna --color-green itu yang
// udah ditulis di CLAUDE.md buat label; uppercase+tracking FROM/TO di /transfer
// ikut dilepas - Wayan milih SATU label, bukan dua peran.
export const FIELD_LABEL =
  'block mb-2 font-body text-small font-medium text-green tracking-normal normal-case';
