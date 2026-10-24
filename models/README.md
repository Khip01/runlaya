# models/ - Direktori model Laya

Setiap subfolder di direktori ini = satu model terdaftar.
Nama folder menjadi `model_id` yang dikirim saat request.

## Struktur folder model

```
models/
  <model-id>/
    manifest.json        <- metadata (opsional, untuk dokumentasi)
    rl_agent_config.json <- wajib
    tokenizer.json       <- wajib (atau tokenizer/tokenizer.json)
    encoder.onnx         <- wajib
    encoder.onnx.data    <- jika ada (bobot terpisah)
    head.onnx            <- wajib
    head.onnx.data       <- jika ada (bobot terpisah)
```

## manifest.json (opsional)

```json
{
  "id": "laya-base",
  "name": "Laya Base",
  "description": "Model dasar Laya tanpa fine-tuning.",
  "created": "2026-10-24",
  "notes": "Baseline untuk eksperimen A-B-C-D."
}
```

Tanpa manifest, model tetap terdaftar dengan `name` = nama folder.

## Cara memasang model

1. Buat folder baru, misal `models/laya-finetuned-a/`.
2. Copy file model ONNX ke dalamnya.
3. (Opsional) tulis `manifest.json`.
4. Model langsung terlihat di `GET /v1/models` tanpa restart.

## Catatan

- Isi folder ini TIDAK di-commit ke git (terlalu besar).
- `GET /v1/models` selalu scan ulang direktori, jadi model baru langsung terdeteksi.
- Setelah mengganti file model yang sudah pernah dipakai,
  panggil `POST /v1/models/<id>/unload` agar model dimuat ulang dari disk.
