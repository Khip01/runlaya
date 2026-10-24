# runlaya

Inference API plug-and-play untuk model Laya ONNX.
Daftarkan model Anda (fine-tuned atau belum) ke direktori `models/`, lalu
jalankan prediksi `choice` / `score` / `noul` dengan parameter per-request.
Tanpa ubah kode.

## Fitur

- Plug and play: copy folder model ONNX, langsung terdaftar tanpa restart.
- Multi-model: banyak model sekaligus, pilih via field `model` di request.
- Parameter per-request: tipe pertanyaan, instruksi, dan `criteria` dikirim
  di body request, sehingga cocok untuk eksperimen (criteria lengkap vs minimal).
- Output mentah tanpa threshold: `choice` (label + probabilities + confidence),
  `noul` (angka 0..1), `score` (angka). Keputusan threshold ada di pemanggil.
- Batch: prediksi banyak teks sekaligus untuk evaluasi dataset.
- Dokumentasi API interaktif di `/docs` (Scalar).

## Instalasi

Prasyarat: Node.js >= 20, git.

```bash
git clone --recurse-submodules https://github.com/Khip01/runlaya.git
cd runlaya
npm install --ignore-scripts
npm run setup:laya    # build laya-ts dari submodule vendor/
```

Jika lupa `--recurse-submodules`:

```bash
git submodule update --init
npm run setup:laya
```

## Konfigurasi

```bash
cp .env.example .env
```

| Variabel | Wajib | Default | Keterangan |
|---|---|---|---|
| `API_TOKEN` | ya | - | Token Bearer untuk autentikasi API |
| `PORT` | tidak | 3000 | Port server |
| `MODELS_DIR` | tidak | `./models/` | Direktisi berisi subfolder model |

## Menjalankan

```bash
npm start
```

Server berjalan di `http://localhost:3000`, dokumentasi di `http://localhost:3000/docs`.

## Memasang model

Satu folder = satu model. Nama folder menjadi `model_id`.

```
models/
  laya-base/
    manifest.json        (opsional)
    rl_agent_config.json
    tokenizer.json
    encoder.onnx (+ .onnx.data jika ada)
    head.onnx (+ .onnx.data jika ada)
  laya-finetuned-a/
    ...
```

Detail lengkap di [models/README.md](models/README.md).

## Contoh pemakaian

Daftar model:

```bash
curl -H "Authorization: Bearer $API_TOKEN" http://localhost:3000/v1/models
```

Prediksi (semua parameter dikirim per-request):

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "laya-base",
    "text": "Berapa biaya pendaftaran di Polinema?",
    "questions": {
      "topik": {
        "type": "choice",
        "instructions": "Pesan pengguna termasuk kategori yang mana?",
        "criteria": {
          "pendaftaran": "Pertanyaan tentang pendaftaran kuliah.",
          "luar-topik": "Bukan tentang Polinema."
        }
      }
    }
  }'
```

Respons:

```json
{
  "model": "laya-base",
  "answers": {
    "topik": {
      "type": "choice",
      "choice": "pendaftaran",
      "probabilities": { "pendaftaran": 0.9984, "luar-topik": 0.0016 },
      "confidence": 0.9911,
      "answer_confidence": 0.9984,
      "action": { "act_probability": 1 }
    }
  },
  "usage": { "input_tokens": 105, "output_tokens": 0 }
}
```

Contoh lain (tipe `noul` dan `score`, batch, error handling) ada di [API.md](API.md).

## Endpoint

| Method | Path | Fungsi |
|---|---|---|
| GET | `/v1/models` | Daftar model terpasang |
| GET | `/v1/models/:id` | Detail satu model |
| POST | `/v1/models/:id/unload` | Keluarkan model dari memori |
| POST | `/v1/predict` | Prediksi satu teks |
| POST | `/v1/predict/batch` | Prediksi banyak teks |

Detail di [API.md](API.md).

## Pengembangan

```bash
npm run typecheck
```

Panduan untuk AI agent ada di [AGENTS.md](AGENTS.md).

## Lisensi

Apache-2.0
