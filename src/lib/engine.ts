import { Agent, type QuestionDef, type SystemAnswer, type SystemUsage } from "laya-ts";
import { modelDirOf } from "./registry.ts";
import { logModelCall, logModelBatchCall } from "./tui-log.ts";

/**
 * Per-model agent cache (lazy load).
 * A model is loaded on first use, then kept in memory.
 */
const agents = new Map<string, Agent>();
const loading = new Map<string, Promise<Agent>>();

export function loadedModelIds(): ReadonlySet<string> {
  return new Set(agents.keys());
}

export async function getAgent(id: string): Promise<Agent> {
  const cached = agents.get(id);
  if (cached) return cached;

  const inflight = loading.get(id);
  if (inflight) return inflight;

  const promise = Agent.load(modelDirOf(id)).then((agent) => {
    agents.set(id, agent);
    loading.delete(id);
    return agent;
  });
  promise.catch(() => loading.delete(id));
  loading.set(id, promise);
  return promise;
}

/** Drop a model from the cache (for example after its files are replaced on disk). */
export function unloadModel(id: string): boolean {
  loading.delete(id);
  return agents.delete(id);
}

export interface PredictResult {
  model: string;
  answers: Record<string, SystemAnswer>;
  usage: SystemUsage;
}

/**
 * Run inference on a single text with arbitrary question configuration.
 * Raw values are returned: choice -> label + probabilities,
 * noul -> number 0..1, score -> number. Thresholds belong to the caller.
 */
export async function predict(
  id: string,
  text: string,
  questions: Record<string, QuestionDef>,
): Promise<PredictResult> {
  const agent = await getAgent(id);
  logModelCall(id, text, questions);
  const t0 = Date.now();
  const result = await agent.predict(text, questions);
  const answers = result.answers as Record<string, SystemAnswer>;
  logModelCall(id, text, questions, answers, Date.now() - t0);
  return {
    model: id,
    answers,
    usage: result.usage,
  };
}

export async function predictBatch(
  id: string,
  texts: string[],
  questions: Record<string, QuestionDef>,
): Promise<PredictResult[]> {
  const agent = await getAgent(id);
  logModelBatchCall(id, texts.length, questions);
  const t0 = Date.now();
  const results = await agent.predictBatch(texts, questions);
  const mapped = results.map((r) => ({
    model: id,
    answers: r.answers as Record<string, SystemAnswer>,
    usage: r.usage,
  }));
  logModelBatchCall(id, texts.length, questions, mapped, Date.now() - t0);
  return mapped;
}
