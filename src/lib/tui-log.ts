/**
 * Styled terminal logging (TUI-like boxes) for debugging the API.
 * Request and response bodies are printed in readable, colored boxes
 * instead of raw JSON dumps, so the traffic to the Laya model is easy
 * to inspect while the server runs.
 *
 * Colors are disabled when stdout is not a TTY or NO_COLOR is set.
 */

const useColor = Boolean(process.stdout.isTTY) && !process.env["NO_COLOR"];

const CODES = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  magenta: "\u001b[35m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
} as const;

function paint(code: string, text: string): string {
  return useColor ? `${code}${text}${CODES.reset}` : text;
}

export const style = {
  red: (t: string) => paint(CODES.red, t),
  green: (t: string) => paint(CODES.green, t),
  yellow: (t: string) => paint(CODES.yellow, t),
  blue: (t: string) => paint(CODES.blue, t),
  magenta: (t: string) => paint(CODES.magenta, t),
  cyan: (t: string) => paint(CODES.cyan, t),
  gray: (t: string) => paint(CODES.gray, t),
  bold: (t: string) => paint(CODES.bold, t),
  dim: (t: string) => paint(CODES.dim, t),
};

export type StyleName = keyof typeof style;

function visibleLen(s: string): number {
  return s.replace(/\u001b\[[0-9;]*m/g, "").length;
}

const BOX_WIDTH = 78;

/**
 * Render a bordered box. Each line is clipped to fit the box width.
 * ANSI codes inside the lines are accounted for when measuring width.
 */
export function renderBox(color: StyleName, title: string, lines: string[]): string {
  const paintFn = style[color];
  const innerWidth = BOX_WIDTH - 2;

  const titleText = title ? `─ ${title} ` : "";
  const topPad = "─".repeat(Math.max(0, innerWidth - visibleLen(titleText)));
  const out: string[] = [paintFn(`┌${titleText}${topPad}┐`)];

  for (const line of lines) {
    let clipped = line;
    if (visibleLen(line) > innerWidth) {
      clipped = line.replace(/\u001b\[[0-9;]*m/g, "").slice(0, innerWidth - 1) + "…";
    }
    const pad = " ".repeat(Math.max(0, innerWidth - visibleLen(clipped)));
    out.push(`${paintFn("│")}${clipped}${pad}${paintFn("│")}`);
  }

  out.push(paintFn(`└${"─".repeat(innerWidth)}┘`));
  return out.join("\n");
}

/** Collapse whitespace and cut a single line to the given length. */
export function oneLine(text: string, max = 60): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

/** Wrap text to the given width. Long words are hard-split, never truncated. */
function wrapText(text: string, width: number): string[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat === "") return [];

  const lines: string[] = [];
  let current = "";
  for (const word of flat.split(" ")) {
    let w = word;
    while (w.length > width) {
      if (current !== "") {
        lines.push(current);
        current = "";
      }
      lines.push(w.slice(0, width));
      w = w.slice(width);
    }
    if (current === "") {
      current = w;
    } else if (current.length + 1 + w.length <= width) {
      current += ` ${w}`;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

/**
 * Render a value as readable lines: short values stay on the `key:` line,
 * long values wrap below it instead of being cut off.
 */
function valueLines(keyPrefix: string, text: string, indent: number, maxInline = 60): string[] {
  const pad = " ".repeat(indent);
  const flat = text.replace(/\s+/g, " ").trim();
  const fitsInline =
    flat.length <= maxInline && visibleLen(pad + keyPrefix) + flat.length <= BOX_WIDTH - 2;
  if (fitsInline) return [`${pad}${keyPrefix}${flat}`];

  const width = Math.max(24, BOX_WIDTH - 4 - (indent + 2));
  const lines: string[] = [];
  if (keyPrefix.trim() !== "") lines.push(`${pad}${keyPrefix.trimEnd()}`);
  for (const line of wrapText(flat, width)) lines.push(`${pad}  ${line}`);
  return lines;
}

function isPrimitive(value: unknown): value is string | number | boolean | null {
  return (
    value === null || ["string", "number", "boolean"].includes(typeof value)
  );
}

/**
 * Describe a request/response body as short readable lines.
 * Objects show their keys and values, arrays show their size and first items.
 */
export function describeBody(body: unknown, indent = 0, keyPrefix = ""): string[] {
  const pad = " ".repeat(indent);

  if (body === undefined) return [];
  if (isPrimitive(body)) {
    if (typeof body === "string") return valueLines(keyPrefix, body, indent);
    return [`${pad}${keyPrefix}${String(body)}`];
  }
  if (Array.isArray(body)) {
    const lines = [`${pad}${keyPrefix}${style.dim(`[${body.length} items]`)}`];
    for (const item of body.slice(0, 4)) {
      lines.push(...describeBody(item, indent + 2, ""));
    }
    if (body.length > 4) {
      lines.push(`${pad}  ${style.dim(`… ${body.length - 4} more`)}`);
    }
    return lines;
  }

  const record = body as Record<string, unknown>;
  const lines: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) continue;
    lines.push(...describeBody(value, indent, `${style.cyan(key)}: `));
  }
  return lines.length > 0 ? lines : [`${pad}${keyPrefix}${style.dim("(empty)")}`];
}

export function statusColor(status: number): StyleName {
  if (status >= 500) return "red";
  if (status >= 400) return "yellow";
  return "green";
}

/** Print an incoming HTTP request box. Starts a new cycle after a divider. */
export function logRequest(method: string, path: string, body: unknown): void {
  console.log(`\n${style.dim("=".repeat(BOX_WIDTH))}`);
  const lines = [
    `${style.bold(`${method} ${path}`)}`,
    ...describeBody(body, 0),
  ];
  console.log(renderBox("cyan", "REQUEST", lines));
}

/** Print an outgoing HTTP response box. */
export function logResponse(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  body: unknown,
): void {
  const tag = statusColor(status);
  const lines = [
    `${style.bold(`${method} ${path}`)}  ${style[tag](`→ ${status}`)}  ${style.dim(`${durationMs} ms`)}`,
    ...describeBody(body, 0),
  ];
  console.log(renderBox(tag, "RESPONSE", lines));
}

/** Print a box for a call to another service (for example runlaya). */
export function logUpstream(
  label: string,
  detail: string,
  durationMs: number,
  body: unknown,
): void {
  const lines = [
    `${style.bold(detail)}  ${style.dim(`${durationMs} ms`)}`,
    ...describeBody(body, 0),
  ];
  console.log(renderBox("magenta", label, lines));
}

/** Print an error box. */
export function logError(where: string, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.log(renderBox("red", "ERROR", [`${style.bold(where)}  ${oneLine(message, 60)}`]));
}

// ---------------------------------------------------------------
// Laya model call logging
// ---------------------------------------------------------------

function describeCriteria(criteria: unknown): string {
  if (Array.isArray(criteria)) {
    return criteria.map((c) => String(c)).join(", ");
  }
  if (typeof criteria === "object" && criteria !== null) {
    return Object.keys(criteria as Record<string, unknown>).join(", ");
  }
  return String(criteria ?? "");
}

function describeQuestions(questions: Record<string, unknown>): string[] {
  const lines: string[] = [style.bold("questions:")];
  for (const [qid, raw] of Object.entries(questions)) {
    const q = (raw ?? {}) as Record<string, unknown>;
    const type = String(q["type"] ?? "?");
    const instructions = q["instructions"] !== undefined ? String(q["instructions"]) : "";
    const criteria = q["criteria"] !== undefined ? describeCriteria(q["criteria"]) : "";

    lines.push(`  ${style.cyan(qid)} ${style.yellow(`[${type}]`)}`);
    if (instructions) {
      lines.push(...valueLines("", `"${instructions}"`, 4, 52).map((l) => style.dim(l)));
    }
    if (criteria) {
      lines.push(...valueLines("criteria: ", criteria, 4, 48).map((l) => style.dim(l)));
    }
  }
  return lines;
}

function describeAnswer(qid: string, raw: unknown): string[] {
  const a = (raw ?? {}) as Record<string, unknown>;
  const type = String(a["type"] ?? "?");
  const conf = typeof a["confidence"] === "number" ? `  conf ${a["confidence"].toFixed(4)}` : "";

  let main = "";
  if (type === "choice") {
    main = `→ ${style.bold(`"${String(a["choice"] ?? "?")}"`)}`;
  } else if (type === "noul") {
    main = `→ ${style.bold(String((a["noul"] as number | undefined)?.toFixed(4) ?? "?"))}`;
  } else if (type === "score") {
    main = `→ ${style.bold(String((a["score"] as number | undefined)?.toFixed(4) ?? "?"))}`;
  }

  const lines = [`  ${style.cyan(qid)} ${style.yellow(`[${type}]`)} ${main}${style.dim(conf)}`];

  const probs = a["probabilities"];
  if (typeof probs === "object" && probs !== null) {
    const shown = Object.entries(probs as Record<string, number>)
      .map(([k, v]) => `${k} ${v.toFixed(4)}`)
      .join(", ");
    lines.push(`    probs: ${style.dim(oneLine(shown, 48))}`);
  }
  const legend = a["legend"];
  if (typeof legend === "object" && legend !== null) {
    const shown = Object.entries(legend as Record<string, string>)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ");
    lines.push(`    legend: ${style.dim(oneLine(shown, 46))}`);
  }
  return lines;
}

/**
 * Log one Laya predict call. Without `answers` it prints the outgoing
 * request (text + questions), with `answers` it prints the model result.
 */
export function logModelCall(
  model: string,
  text: string,
  questions: Record<string, unknown>,
  answers?: Record<string, unknown>,
  durationMs?: number,
): void {
  if (answers === undefined) {
    const lines = [
      `${style.bold("model: ")}${model}`,
      ...valueLines(`${style.bold("text: ")}`, `"${text}"`, 0),
      ...describeQuestions(questions),
    ];
    console.log(renderBox("blue", "MODEL REQUEST", lines));
    return;
  }

  const lines = [
    ...Object.entries(answers).flatMap(([qid, raw]) => describeAnswer(qid, raw)),
    `${style.dim(`duration: ${durationMs ?? 0} ms`)}`,
  ];
  console.log(renderBox("green", "MODEL RESULT", lines));
}

/** Log a batch predict call. Answers are shown compactly, one line per text. */
export function logModelBatchCall(
  model: string,
  count: number,
  questions: Record<string, unknown>,
  results?: Array<{ answers: Record<string, unknown> }>,
  durationMs?: number,
): void {
  if (results === undefined) {
    const lines = [
      `${style.bold("model: ")}${model}`,
      `${style.bold("texts: ")}${style.dim(`${count} items`)}`,
      ...describeQuestions(questions),
    ];
    console.log(renderBox("blue", "MODEL BATCH REQUEST", lines));
    return;
  }

  const lines: string[] = [];
  for (const [i, r] of results.entries()) {
    const summary = Object.entries(r.answers)
      .map(([qid, raw]) => {
        const a = (raw ?? {}) as Record<string, unknown>;
        const type = String(a["type"] ?? "?");
        const value =
          type === "choice"
            ? `"${String(a["choice"] ?? "?")}"`
            : type === "noul"
              ? String((a["noul"] as number | undefined)?.toFixed(3) ?? "?")
              : String((a["score"] as number | undefined)?.toFixed(3) ?? "?");
        return `${qid}=${value}`;
      })
      .join("  ");
    lines.push(`  ${style.dim(`#${i + 1}`)} ${summary}`);
  }
  lines.push(`${style.dim(`duration: ${durationMs ?? 0} ms`)}`);
  console.log(renderBox("green", "MODEL BATCH RESULT", lines));
}
