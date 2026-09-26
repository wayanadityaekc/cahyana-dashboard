# Edit konten dari dashboard - panduan buat Wayan

Ini buat lu, bukan buat Claude. Isinya: cara pakai, dan **apa yang harus dicek
kalau ada apa-apa** - biar lu gak nunggu gua.

---

## 1. Cara kerjanya (penting ngerti ini dulu)

Situs `cahyanaubudexperience.com` itu **static export**: semua tulisan
di-*bake* jadi HTML pas build. Itu yang bikin Google bisa baca kontennya.
Jadi kalau tulisan diambil dari database pas halaman dibuka, Google **gak
lihat apa-apa** - SEO-nya ilang.

Makanya edit dari dashboard **bukan** nulis ke database. Yang kejadian:

```
lu ngetik di dashboard
   -> Save draft        (nyimpen di server, belum ke situs)
   -> Publish           (bikin COMMIT ke repo CUE, branch main)
   -> GitHub Actions build  (~3 menit)
   -> Hostinger dapet   -> situs berubah
```

**Jadi gak instan. Sekitar 3 menit.** Dashboard-nya ngasih tau status
build-nya, jadi lu gak perlu nebak.

Efek sampingnya bagus: tiap edit ada di **git history**. Salah ngetik =
bisa dibalikin, lengkap sama siapa & kapan.

---

## 2. Yang bisa & gak bisa diedit

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

## 3. Kalau ada apa-apa - urutan ngeceknya

### "Content"-nya error / gak mau kebuka

1. Cek dulu **API-nya udah punya fitur ini apa belum**: buka
   `https://cahyana-api-production.up.railway.app/api/admin/content/legal`
   (login pakai ADMIN_USER / ADMIN_PASS).
   - Jawaban **404 "Unknown content"** = kode-nya belum nyampe `main` di
     `cahyana-api`. Itu bukan rusak, itu belum di-merge.
   - Jawaban **503 "not switched on"** = **3 variable di Railway belum diisi**:
     `CONTENT_GITHUB_TOKEN`, `CONTENT_REPO`, `CONTENT_BRANCH`. Lihat bagian 4.
   - Jawaban **200** = API-nya sehat, masalahnya di dashboard.

### "Save draft" jalan, tapi "Publish" gagal

Baca **pesan errornya**, dia nyebut alasannya:
- *"the file changed on the site since you started editing"* = ada yang
  ngubah file itu di GitHub sesudah lu mulai ngetik. **Reload dashboard,
  ketik ulang.** Ini sengaja - biar editan lu gak nimpa punya orang.
- *"this is not one of the fields you can edit"* = lu nyentuh field yang
  dikunci (lihat tabel di atas). Bukan bug.
- *"Not Found"* dari GitHub = **token-nya gak punya izin nulis** ke repo CUE.
  Bikin token baru (bagian 4).

### Udah Publish, tapi situs masih tulisan lama

1. Di dashboard, lihat baris **"Last publish"**.
   - `success` = situs udah dapet. Coba **hard refresh** (Ctrl+Shift+R).
   - `failure` = **build-nya gagal**, situs masih di tulisan lama (itu bener,
     bukan setengah-setengah). Klik **build log**, atau bilang ke gua.
   - `queued` / `in_progress` = tunggu, belum 3 menit.
2. Kalau `success` tapi tetep lama: cek commit-nya beneran ada di
   https://github.com/wayanadityaekc/CUE/commits/main

### Mau balikin tulisan ke yang lama

Semua edit itu commit. Buka
https://github.com/wayanadityaekc/CUE/commits/main - cari commit
*"Edit tour details from the dashboard"*, terus **Revert**. Build jalan
lagi, ~3 menit.

---

## 4. Token GitHub (sekali doang, ini yang belum diisi)

Dashboard butuh izin nulis ke repo CUE. Caranya:

1. GitHub -> Settings -> Developer settings ->
   **Personal access tokens** -> **Fine-grained tokens** -> Generate new.
2. **Repository access**: `Only select repositories` -> pilih
   **`wayanadityaekc/CUE` DOANG**. Jangan "All repositories".
3. **Permissions** -> Repository permissions -> **Contents: Read and write**.
   Cukup itu. Jangan kasih yang lain.
4. Expiration: 90 hari (nanti diperbarui; kalau expired, gejalanya
   *"Not Found"* di langkah Publish).
5. Copy token-nya, terus di **Railway** -> project `cahyana-api` -> Variables:

```
CONTENT_GITHUB_TOKEN = <token yang barusan>
CONTENT_REPO         = wayanadityaekc/CUE
CONTENT_BRANCH       = main
```

**Token-nya jangan di-paste ke chat, jangan ditulis di kode.** Langsung ke
Railway aja. Kalau kesebar: hapus di GitHub, bikin baru.

Kenapa cuma repo CUE & cuma Contents: kalau token-nya ke-bocor, yang bisa
diapa-apain cuma repo itu, dan cuma isi file-nya.

---

## 5. File-file yang kepakai (kalau lu mau ngintip)

| Di mana | File | Isinya |
|---|---|---|
| `cahyana-api` | `content.js` | **Aturannya.** `EDITABLE` = daftar file + field yang boleh diedit. Mau nambah yang bisa diedit? Di sini. |
| `cahyana-api` | `tools/content-test.js` | Tes-nya (56 assertion). Jalanin: `node tools/content-test.js` |
| `cahyana-dashboard` | `components/admin/ContentPanel.jsx` | Tampilan editornya |
| `CUE` | `content/shared/legal.json` | Tulisan halaman legal |
| `CUE` | `content/tours/tours.json` | Tulisan halaman tour |

**Kenapa `.json`, bukan `.js`:** dashboard cuma boleh nulis **data**, jangan
pernah **kode**. Satu karakter nyasar di file `.js` = build-nya mati, seluruh
situs gak ke-update. Kalau `.json` yang isinya aneh, paling jelek ya
tulisannya kebaca aneh - situsnya tetep hidup.

---

## 6. Kalau mau nambah yang bisa diedit

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
