import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ModelInfo, ModelManifest } from "../types.ts";

/** File wajib yang harus ada di folder model agar bisa dipakai. */
const REQUIRED_FILES = ["rl_agent_config.json", "encoder.onnx", "head.onnx"];

/** Lokasi tokenizer yang diterima laya-ts (salah satu cukup). */
const TOKENIZER_CANDIDATES = ["tokenizer.json", "tokenizer/tokenizer.json"];

export function getModelsDir(): string {
  return process.env["MODELS_DIR"] ?? fileURLToPath(new URL("../../models/", import.meta.url));
}

async function isFile(p: string): Promise<boolean> {
  try {
    const st = await stat(p);
    return st.isFile();
  } catch {
    return false;
  }
}

async function isDir(p: string): Promise<boolean> {
  try {
    const st = await stat(p);
    return st.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Baca manifest.json dari folder model.
 * Manifest bersifat opsional: folder tanpa manifest tetap terdaftar
 * dengan fallback dari nama folder, supaya model tinggal di-copy saja.
 */
async function readManifest(modelDir: string, id: string): Promise<ModelManifest> {
  const base: ModelManifest = {
    id,
    name: id,
    description: "",
    created: "",
    notes: "",
  };

  try {
    const raw = JSON.parse(await readFile(path.join(modelDir, "manifest.json"), "utf8"));
    if (typeof raw !== "object" || raw === null) return base;
    const m = raw as Record<string, unknown>;
    return {
      id,
      name: typeof m["name"] === "string" && m["name"] ? m["name"] : base.name,
      description: typeof m["description"] === "string" ? m["description"] : "",
      created: typeof m["created"] === "string" ? m["created"] : "",
      notes: typeof m["notes"] === "string" ? m["notes"] : "",
    };
  } catch {
    return base;
  }
}

async function missingFilesOf(modelDir: string): Promise<string[]> {
  const missing: string[] = [];
  for (const f of REQUIRED_FILES) {
    if (!(await isFile(path.join(modelDir, f)))) missing.push(f);
  }
  let hasTokenizer = false;
  for (const c of TOKENIZER_CANDIDATES) {
    if (await isFile(path.join(modelDir, c))) {
      hasTokenizer = true;
      break;
    }
  }
  if (!hasTokenizer) missing.push("tokenizer.json");
  return missing;
}

async function toInfo(modelDir: string, id: string, loadedIds: ReadonlySet<string>): Promise<ModelInfo> {
  const manifest = await readManifest(modelDir, id);
  const missingFiles = await missingFilesOf(modelDir);
  return {
    ...manifest,
    ready: missingFiles.length === 0,
    missingFiles,
    loaded: loadedIds.has(id),
  };
}

/** Scan direktori model: setiap subfolder = satu model terdaftar. */
export async function scanModels(loadedIds: ReadonlySet<string>): Promise<ModelInfo[]> {
  const root = getModelsDir();
  if (!(await isDir(root))) return [];

  const entries = await readdir(root, { withFileTypes: true });
  const infos: ModelInfo[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    infos.push(await toInfo(path.join(root, e.name), e.name, loadedIds));
  }
  infos.sort((a, b) => a.id.localeCompare(b.id));
  return infos;
}

/** Ambil info satu model; null jika tidak terdaftar. */
export async function getModel(id: string, loadedIds: ReadonlySet<string>): Promise<ModelInfo | null> {
  const modelDir = path.join(getModelsDir(), id);
  if (!(await isDir(modelDir))) return null;
  return toInfo(modelDir, id, loadedIds);
}

/** Path absolut folder model. */
export function modelDirOf(id: string): string {
  return path.join(getModelsDir(), id);
}
