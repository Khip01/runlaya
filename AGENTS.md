# AGENTS.md - runlaya

Inference API plug-and-play untuk model Laya ONNX.
Project ini adalah "cangkang": model Laya (fine-tuned atau belum) bisa
dipasang-cabut tanpa ubah kode. Parameter inferensi dikirim per-request.

## Stack (terkunci)

- TypeScript strict ESM (tsconfig: ES2022, NodeNext, `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noEmit`).
- Fastify + TypeBox (JSON schema) + Scalar (`@scalar/fastify-api-reference`).
- `laya-ts` via submodule `vendor/laya` (sparse checkout `laya-ts/`).
- Node.js >= 20 (dikembangkan dengan Node 24).

## Perintah penting

| Perintah | Fungsi |
|---|---|
| `npm install --ignore-scripts` | Install dependensi (WAJIB pakai `--ignore-scripts`) |
| `npm run setup:laya` | Build `laya-ts` dari submodule (sekali setelah clone) |
| `npm start` | Jalankan server |
| `npm run typecheck` | Cek tipe, jalan sebelum commit |

Submodule:

```bash
git submodule update --init   # jika lupa --recurse-submodules saat clone
```

## Struktur

```
runlaya/
  models/            <- direktori model (per subfolder), ISI TIDAK DI-COMMIT
  src/
    server.ts        <- bootstrap Fastify + swagger + Scalar
    types.ts         <- tipe bersama
    lib/
      registry.ts    <- scan models/, baca manifest, cek file wajib
      engine.ts      <- cache Agent, predict/predictBatch
      auth.ts        <- cek Bearer token
    routes/
      models.ts      <- GET /v1/models, GET /v1/models/:id, POST /v1/models/:id/unload
      predict.ts     <- POST /v1/predict, POST /v1/predict/batch
  vendor/laya/       <- submodule (jangan diedit langsung)
  API.md             <- referensi API dengan contoh respons nyata
  README.md          <- panduan pemakaian
```

## Konsep desain (WAJIB dipertahankan)

1. Engine netral: TANPA threshold, TANPA knowledge base, TANPA LLM.
   Output mentah Laya yang dikembalikan; keputusan threshold urusan pemanggil.
2. Semua parameter `questions` (type, instructions, criteria) dikirim
   per-request. Jangan hardcode criteria di kode.
3. Multi-model: `models/<model-id>/`, dipilih via field `model` di request.
   Lazy load + cache di memori (`src/lib/engine.ts`).
4. `manifest.json` bersifat opsional; folder tanpa manifest tetap terdaftar.
5. Auth Bearer token (`API_TOKEN`), sama polanya dengan `hello-polinema`.
6. Gaya API: REST custom `/v1/*`. Bukan OpenAI-compatible.

## Model Laya

File wajib di folder model (didefinisikan `laya-ts`):
- `rl_agent_config.json`
- `tokenizer.json` (atau `tokenizer/tokenizer.json`)
- `encoder.onnx` (+ `encoder.onnx.data` jika bobot terpisah)
- `head.onnx` (+ `head.onnx.data` jika bobot terpisah)

Tipe pertanyaan Laya:
- `choice` -> pilih satu label dari `criteria` (klasifikasi)
- `noul` -> probabilitas 0..1 pernyataan benar
- `score` -> nilai 0..n dengan `legend`

## Konvensi

- Bahasa Indonesia untuk deskripsi API, komentar, dan pesan error.
- TANPA em dash (U+2014) dan emoji di output, kode, dan commit.
- Commit: Conventional Commits, wajib GPG-signed, minta ACC user sebelum commit.
- Secret di `.env` (git-ignored). `.env.example` kosong tanpa rahasia.
- File `.sh` atau script baru wajib `git update-index --chmod=+x`.
- Jangan ubah `vendor/laya/` langsung; itu submodule upstream.

## Konteks skripsi

Project ini dipakai untuk eksperimen A-B-C-D penelitian skripsi:
fine-tuning Laya mengurangi ketergantungan pada `criteria`.
Eksperimen cukup ganti model (`model`) dan `criteria` di request,
tanpa ubah kode. Dataset dan catatan penelitian ada di repo
`Khip01/private_thesis_needs`.

## Proyek terkait

| Lokasi | Isi |
|---|---|
| `../hello-polinema/` | Chatbot API yang akan dikonversi memakai engine ini |
