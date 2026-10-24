# API Reference

Base URL: `http://localhost:3000` (atau sesuai `PORT`).

Dokumentasi interaktif: `http://localhost:3000/docs` (Scalar).
Spesifikasi OpenAPI mentah: `http://localhost:3000/openapi.json`.

## Autentikasi

Semua endpoint `/v1/*` membutuhkan Bearer token:

```
Authorization: Bearer <API_TOKEN>
```

Tanpa token yang valid:

```json
{ "error": "unauthorized", "message": "Token tidak valid atau tidak ada." }
```

## Model

Model didaftarkan dengan menaruh folder di direktori `models/`
(atau `MODELS_DIR`). Nama folder = `model_id`. Detail struktur di
[models/README.md](models/README.md).

---

## GET /v1/models

Daftar semua model terpasang beserta statusnya.

**Response 200**

```json
{
  "models": [
    {
      "id": "laya-base",
      "name": "Laya Base",
      "description": "Model dasar Laya untuk pengujian.",
      "created": "2026-10-24",
      "notes": "Baseline untuk eksperimen.",
      "ready": true,
      "missingFiles": [],
      "loaded": false
    },
    {
      "id": "laya-rusak",
      "name": "laya-rusak",
      "description": "",
      "created": "",
      "notes": "",
      "ready": false,
      "missingFiles": ["rl_agent_config.json", "encoder.onnx", "head.onnx", "tokenizer.json"],
      "loaded": false
    }
  ]
}
```

- `ready`: `true` jika semua file wajib model ada.
- `loaded`: `true` jika model sudah dimuat ke memori.

## GET /v1/models/:id

Detail satu model. Format sama dengan elemen `models` di atas.

**Response 404** (model tidak terdaftar)

```json
{ "error": "model_not_found", "message": "Model \"tidak-ada\" tidak ditemukan di direktori model." }
```

## POST /v1/models/:id/unload

Keluarkan model dari cache memori. Model dimuat ulang otomatis saat dipakai
berikutnya. Gunakan setelah file model diganti di disk.

**Response 200**

```json
{ "id": "laya-base", "unloaded": true }
```

---

## POST /v1/predict

Inferensi satu teks.

**Request body**

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `model` | string | ya | `model_id` (nama folder) |
| `text` | string | ya | Teks masukan, 1-4000 karakter |
| `questions` | object | ya | 1-32 pertanyaan, key = nama field jawaban |

Bentuk satu pertanyaan:

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `type` | `"choice"` \| `"score"` \| `"noul"` | ya | Tipe pertanyaan |
| `instructions` | string | tidak | Instruksi/pertanyaan untuk model |
| `criteria` | object \| array | tidak | Bergantung tipe (lihat bawah) |

`criteria` per tipe:

- `choice`: map `label -> deskripsi` atau array label.
- `score`: array level (misal `["rendah", "sedang", "tinggi"]`).
- `noul`: map `true -> deskripsi`, `false -> deskripsi` (opsional).

**Contoh: `choice`**

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "laya-base",
    "text": "Berapa biaya pendaftaran mahasiswa baru di Polinema?",
    "questions": {
      "topic": {
        "type": "choice",
        "instructions": "Pesan pengguna termasuk kategori topik yang mana dalam konteks informasi Politeknik Negeri Malang (Polinema)?",
        "criteria": {
          "profil": "Pertanyaan tentang profil atau informasi umum Polinema.",
          "jurusan": "Pertanyaan tentang jurusan atau program studi di Polinema.",
          "pendaftaran": "Pertanyaan tentang pendaftaran atau cara masuk kuliah di Polinema.",
          "kontak": "Pertanyaan tentang cara menghubungi Polinema.",
          "luar-topik": "Bukan pertanyaan tentang Polinema."
        }
      }
    }
  }'
```

**Response 200**

```json
{
  "model": "laya-base",
  "answers": {
    "topic": {
      "type": "choice",
      "choice": "pendaftaran",
      "probabilities": {
        "profil": 0.0005,
        "jurusan": 0.0006,
        "pendaftaran": 0.9984,
        "kontak": 0.0002,
        "luar-topik": 0.0004
      },
      "confidence": 0.9911,
      "answer_confidence": 0.9984,
      "action": { "act_probability": 1 }
    }
  },
  "usage": {
    "input_tokens": 105,
    "output_tokens": 0,
    "state_tokens": 10,
    "state_tokens_dropped": 0,
    "truncated": false,
    "truncated_questions": []
  }
}
```

**Contoh: `noul` + `score` dalam satu request**

```bash
curl -X POST http://localhost:3000/v1/predict \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "laya-base",
    "text": "Saya marah sekali dengan layanan ini!",
    "questions": {
      "marah": {
        "type": "noul",
        "instructions": "Apakah pengguna marah?",
        "criteria": { "true": "ya, marah", "false": "tidak" }
      },
      "sentimen": {
        "type": "score",
        "instructions": "Seberapa positif nada pesan ini?",
        "criteria": ["sangat negatif", "netral", "sangat positif"]
      }
    }
  }'
```

**Response 200**

```json
{
  "model": "laya-base",
  "answers": {
    "marah": {
      "type": "noul",
      "noul": 0.9331,
      "confidence": 0.9331,
      "answer_confidence": 0.9331,
      "action": { "act_probability": 1 }
    },
    "sentimen": {
      "type": "score",
      "score": 0.0342,
      "legend": { "0": "sangat negatif", "1": "netral", "2": "sangat positif" },
      "probabilities": { "0": 0.9678, "1": 0.0303, "2": 0.002 },
      "confidence": 0.8636,
      "answer_confidence": 0.9678,
      "action": { "act_probability": 1 }
    }
  },
  "usage": { "input_tokens": 71, "output_tokens": 0, "state_tokens": 7 }
}
```

**Bentuk jawaban per tipe**

- `choice`: `choice` (label terpilih), `probabilities`, `confidence`.
- `noul`: `noul` (angka 0..1). Threshold (misal 0.5) ditentukan pemanggil.
- `score`: `score` (angka), `legend` (mapping level), `probabilities`.

Semua jawaban juga berisi `answer_confidence` dan `action.act_probability`.
Engine TIDAK menerapkan threshold apa pun.

**Error**

| Status | `error` | Keterangan |
|---|---|---|
| 400 | `FST_ERR_VALIDATION` | Body tidak sesuai skema (misal `type` tidak dikenal) |
| 401 | `unauthorized` | Token salah / tidak ada |
| 404 | `model_not_found` | `model_id` tidak terdaftar |
| 422 | `model_not_ready` | File model belum lengkap (`missingFiles` di pesan) |
| 422 | `invalid_questions` | Definisi pertanyaan ditolak Laya |
| 500 | `inference_failed` | Gagal menjalankan inferensi |

Contoh respons:

```json
{ "error": "model_not_ready", "message": "Model \"laya-rusak\" belum siap. File hilang: rl_agent_config.json, encoder.onnx, head.onnx, tokenizer.json." }
```

---

## POST /v1/predict/batch

Inferensi banyak teks dengan pertanyaan yang sama.

**Request body**

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `model` | string | ya | `model_id` |
| `texts` | string[] | ya | 1-256 teks, masing-masing 1-4000 karakter |
| `questions` | object | ya | Sama seperti `/v1/predict` |

**Response 200**

```json
{
  "model": "laya-base",
  "results": [
    {
      "model": "laya-base",
      "answers": {
        "topic": {
          "type": "choice",
          "choice": "lokasi",
          "probabilities": { "lokasi": 0.9943, "luar-topik": 0.0057 },
          "confidence": 0.949,
          "answer_confidence": 0.9943,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 44, "output_tokens": 0 }
    },
    {
      "model": "laya-base",
      "answers": {
        "topic": {
          "type": "choice",
          "choice": "luar-topik",
          "probabilities": { "lokasi": 0.0377, "luar-topik": 0.9623 },
          "confidence": 0.7682,
          "answer_confidence": 0.9623,
          "action": { "act_probability": 1 }
        }
      },
      "usage": { "input_tokens": 42, "output_tokens": 0 }
    }
  ]
}
```

Urutan `results` sama dengan urutan `texts`.
