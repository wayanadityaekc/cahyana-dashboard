# Edit konten & atur review dari dashboard - panduan buat Wayan

Ini buat lu, bukan buat Claude. Isinya: cara pakai, dan **apa yang harus dicek
kalau ada apa-apa** - biar lu gak nunggu gua.

---

## 1. Cara kerjanya (penting ngerti ini dulu)

Situs `cahyanaubudexperience.com` itu **static export**: semua tulisan
di-*bake* jadi HTML pas build. Itu yang bikin Google bisa baca kontennya.
Jadi kalau tulisan diambil dari database pas halaman dibuka, Google **gak
lihat apa-apa** - SEO-nya ilang.

Makanya edit dari dashboard **bukan** nulis ke database. Dia bikin **commit**
ke repo CUE. Ada **dua setelan**, dan bedanya cuma satu variable di Railway:

### Mode A - langsung live
`CONTENT_BRANCH` = `CONTENT_BASE_BRANCH` (dua-duanya `main`)

```
lu ngetik -> Save draft -> Publish -> commit ke main
   -> GitHub Actions build (~3 menit) -> Hostinger -> situs berubah
```

### Mode B - lewat branch draft  <- INI YANG DIPAKAI SEKARANG
`CONTENT_BRANCH=content-draft`, `CONTENT_BASE_BRANCH=main`

```
lu ngetik -> Save draft -> Publish -> commit ke content-draft
   -> SITUS BELUM BERUBAH
   -> lu baca diff-nya -> merge ke main
   -> build (~3 menit) -> situs berubah
```

**Kenapa B**: dua hal sekaligus. (1) Lu lihat perubahannya **sebelum** dia
bisa nyampe situs. (2) Kalau token-nya bocor, yang dia sentuh branch draft,
bukan branch yang di-deploy.

**Batas yang jujur soal (2):** token fine-grained GitHub **gak bisa**
dibatesin per-branch. Jadi token yang bocor secara teknis masih bisa push ke
`main`. Yang bikin ini beneran **ditegakin** cuma **ruleset di `main`**
(GitHub -> repo CUE -> Settings -> **Rules** -> Rulesets). CUE itu repo
**private**, jadi ketersediaan ruleset tergantung plan GitHub lu - itu yang
perlu lu cek sendiri. Tanpa ruleset, mode B tetep berguna buat (1).

Efek sampingnya bagus di dua mode: tiap edit ada di **git history**. Salah
ngetik = bisa dibalikin, lengkap sama siapa & kapan.

---

## 2. Cara nge-merge draft-nya (mode B)

Sesudah Publish, dashboard **gak** nampilin status build - dia nampilin
**"awaiting merge"** + link diff-nya. Itu bukan error, itu emang nunggu lu.

1. Klik link-nya, atau buka
   https://github.com/wayanadityaekc/CUE/compare/main...content-draft
2. Baca diff-nya. **Ijo = kalimat baru, merah = yang dibuang.**
3. Kalau oke: **Create pull request** -> **Merge pull request**.
4. Build jalan ~3 menit, **baru** situs berubah.
5. Kalau gak oke: tutup PR-nya, balik ke dashboard, edit lagi, Publish lagi.

**Kenapa langkah 5 aman:** tiap Publish, branch draft-nya **di-reset dulu
dari `main`**. Jadi draft yang jelek gak numpuk - Publish berikutnya nimpa
dia. Branch draft isinya selalu "situs sekarang + satu perubahan".

---

## 3. Yang bisa & gak bisa diedit

### Bisa
| Bagian | Isinya |
|---|---|
| **Legal pages** | Terms, Privacy, Cancellation - judul, sub, paragraf, meta description |
| **Tour details** | Blurb di bawah judul, cerita tiap stop, What's included, Not included, meta description |

Khusus **What's included / Not included**: barisnya bisa **ditambah &
dihapus** (tombol `Add a line` / tombol `X`). Batasnya 1-20 baris.

### GAK bisa, dan ini DISENGAJA

| Yang dikunci | Kenapa |
|---|---|
| **Nama tour** | Dibaca 4 tempat lain: breadcrumb, kartu di halaman listing, key review, dan JSON-LD (SEO). Diganti dari sini = 4 benda itu melenceng. |
| **`bookItem`** | Ini **key katalog harga**. Diganti = harganya bukan berubah nama, tapi **ILANG**. |
| **Foto, ukuran foto, refId** | Itu struktur, bukan tulisan. |
| **Nambah/hapus STOP** | Satu stop bawa foto + ukuran + refId. Gak bisa "diketik". |
| **Nambah/hapus paragraf di halaman legal** | Sama alasannya: itu ngubah halaman, bukan kata-katanya. |

Kalau lu butuh salah satu di atas, itu kerjaan di repo - bilang aja ke gua.

**Server yang nolak, bukan tampilannya.** Jadi walau ada bug di tampilan
dashboard, dia tetep gak bisa ngerusak harga.

---

## 4. Kalau ada apa-apa - urutan ngeceknya

### "Content"-nya error / gak mau kebuka

1. Cek dulu **API-nya udah punya fitur ini apa belum**: buka
   `https://cahyana-api-production.up.railway.app/api/admin/content/legal`
   (login pakai ADMIN_USER / ADMIN_PASS).
   - Jawaban **404 "Unknown content"** = kode-nya belum nyampe `main` di
     `cahyana-api`. Itu bukan rusak, itu belum di-merge.
   - Jawaban **503 "not switched on"** = **variable di Railway belum diisi**.
     Lihat bagian 5.
   - Jawaban **200** = API-nya sehat, masalahnya di dashboard.

### "Save draft" jalan, tapi "Publish" gagal

Baca **pesan errornya**, dia nyebut alasannya:
- *"the file changed on the site since you started editing"* = ada yang
  ngubah file itu di GitHub sesudah lu mulai ngetik. **Reload dashboard,
  ketik ulang.** Ini sengaja - biar editan lu gak nimpa punya orang.
- *"this is not one of the fields you can edit"* = lu nyentuh field yang
  dikunci (lihat tabel di atas). Bukan bug.
- *"Not Found"* dari GitHub = **token-nya gak punya izin nulis** ke repo CUE,
  atau token-nya udah **expired**. Bikin token baru (bagian 5).

### Udah Publish, tapi situs masih tulisan lama

Cek dulu lu di mode mana (bagian 1).

**Mode B (sekarang):** itu **normal**. Situs berubah sesudah lu **merge**
(bagian 2). Dashboard nulis "awaiting merge", bukan status build.

**Mode A:** di dashboard, lihat baris **"Last publish"**.
   - `success` = situs udah dapet. Coba **hard refresh** (Ctrl+Shift+R).
   - `failure` = **build-nya gagal**, situs masih di tulisan lama (itu bener,
     bukan setengah-setengah). Klik **build log**, atau bilang ke gua.
   - `queued` / `in_progress` = tunggu, belum 3 menit.

Kalau `success` tapi tetep lama: cek commit-nya beneran ada di
https://github.com/wayanadityaekc/CUE/commits/main

### Mau balikin tulisan ke yang lama

Semua edit itu commit. Buka
https://github.com/wayanadityaekc/CUE/commits/main - cari commit
*"Edit tour details from the dashboard"*, terus **Revert**. Build jalan
lagi, ~3 menit.

---

## 5. Token GitHub (sekali doang)

Dashboard butuh izin nulis ke repo CUE. Caranya:

1. Buka langsung: https://github.com/settings/personal-access-tokens/new
   (atau GitHub -> Settings -> Developer settings ->
   **Personal access tokens** -> **Fine-grained tokens** -> Generate new)
2. **Resource owner**: akun lu sendiri (`wayanadityaekc`).
3. **Repository access**: `Only select repositories` -> pilih
   **`wayanadityaekc/CUE` DOANG**. Jangan "All repositories".
4. **Permissions** -> Repository permissions -> **Contents: Read and write**.
   (Metadata: Read-only ke-tambah sendiri, itu normal.) Cukup itu, jangan
   kasih yang lain.
5. **Expiration**: 1 tahun. Kalau expired, gejalanya *"Not Found"* di langkah
   Publish - itu token, bukan kode yang rusak.
6. Generate, terus **copy token-nya** (cuma keliatan sekali).
7. Di **Railway** -> project `cahyana-api` -> Variables:

```
CONTENT_GITHUB_TOKEN = <token yang barusan>
CONTENT_REPO         = wayanadityaekc/CUE
CONTENT_BRANCH       = content-draft
CONTENT_BASE_BRANCH  = main
```

Mau **mode A** (langsung live)? Set `CONTENT_BRANCH = main`. Tapi kalau
gitu, biar status build-nya kebaca di dashboard, token-nya butuh satu izin
lagi: **Actions: Read-only**.

**Token-nya jangan di-paste ke chat, jangan ditulis di kode.** Langsung ke
Railway aja. Kalau kesebar: hapus di GitHub, bikin baru.

Kenapa cuma repo CUE & cuma Contents: kalau token-nya ke-bocor, yang bisa
diapa-apain cuma repo itu, dan cuma isi file-nya.

---

## 6. File-file yang kepakai (kalau lu mau ngintip)

| Di mana | File | Isinya |
|---|---|---|
| `cahyana-api` | `content.js` | **Aturannya.** `EDITABLE` = daftar file + field yang boleh diedit. Mau nambah yang bisa diedit? Di sini. |
| `cahyana-api` | `tools/content-test.js` | Tes-nya (73 assertion). Jalanin: `node tools/content-test.js` |
| `cahyana-dashboard` | `components/admin/ContentPanel.jsx` | Tampilan editornya |
| `CUE` | `content/shared/legal.json` | Tulisan halaman legal |
| `CUE` | `content/tours/tours.json` | Tulisan halaman tour |

**Kenapa `.json`, bukan `.js`:** dashboard cuma boleh nulis **data**, jangan
pernah **kode**. Satu karakter nyasar di file `.js` = build-nya mati, seluruh
situs gak ke-update. Kalau `.json` yang isinya aneh, paling jelek ya
tulisannya kebaca aneh - situsnya tetep hidup.

---

## 7. Kalau mau nambah yang bisa diedit

Contoh: mau bisa edit halaman destinasi juga.

1. Di `CUE`: pindahin datanya dari `.js` ke `.json` (pola yang sama kayak
   `tours.json`).
2. Di `cahyana-api/content.js`: tambah entry di `EDITABLE` - path file-nya,
   `label`, dan `fields` (**cuma field yang beneran tulisan**, jangan
   masukin key harga / nama / foto).
3. Di `cahyana-dashboard`: tambah ke `KINDS`, tambah renderer-nya.
4. Jalanin `node tools/content-test.js` + harness `verify-content.mjs`.

Langkah 2 itu yang paling penting: **`fields` itu allowlist**. Field yang
gak didaftarin = otomatis DITOLAK. Jadi kalau lupa, gejalanya "gak bisa
diedit" - bukan "diam-diam ngerusak harga".

---

## 8. Atur review (tab **Reviews**)

Tamu **publish review langsung ke situs**. Gerbangnya udah jalan di server
sebelum review-nya dibikin: dia harus login, booking-nya punya dia,
tanggalnya udah lewat, dan booking-nya beneran jalan (`new` / `paid`). Jadi
tab ini **bukan** buat nyetujuin - dia buat **nurunin lagi** kalau ISI-nya
masalah: kasar, spam, atau nomor HP orang keketik di kotak publik.

- **3 tab**: All / On the site / Hidden.
- **Hide** = review-nya ilang dari situs **dan dari rata-rata bintang**.
- **Put back** = balikin.
- **Gak ada tombol Delete, dan itu disengaja.** Hide gak ngapus apa-apa -
  barisnya + tulisannya tetep ada di database. Jadi salah hide bisa
  dibalikin. Kalau lu beneran mau bisa ngapus permanen, bilang ke gua -
  tapi gua saranin jangan.
- Ini **gak** lewat GitHub & **gak** ada build. Langsung ke database,
  efeknya **instan** di situs.
