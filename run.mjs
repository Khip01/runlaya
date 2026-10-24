#!/usr/bin/env node
// Cross-platform launcher for runlaya.
// Keep this file dependency-free and safe on both POSIX and Windows.
// Platform-specific entry points live in ./run (bash) and ./run.cmd (cmd).

import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
process.chdir(ROOT);

const useColor = Boolean(process.stdout.isTTY) && !process.env["NO_COLOR"];
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const info = (msg) => console.log(`${paint("32", "[info]")} ${msg}`);
const warn = (msg) => console.log(`${paint("33", "[warn]")} ${msg}`);
const fail = (msg) => {
  console.error(`${paint("31", "[error]")} ${msg}`);
  process.exit(1);
};

function run(cmd, args) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (res.error) fail(`Failed to run ${cmd}: ${res.error.message}`);
  if (res.status !== 0) fail(`${cmd} ${args.join(" ")} exited with code ${res.status}.`);
}

// ---------------------------------------------------------------
// 1. Node.js check
// ---------------------------------------------------------------
const major = Number(process.versions.node.split(".")[0]);
if (Number.isNaN(major) || major < 20) {
  fail(`Node.js >= 20 is required, found ${process.version}.`);
}
info(`Node.js detected: ${process.version}`);
if (major < 24) {
  warn("Node.js 24+ is recommended (built-in TypeScript execution).");
}

// ---------------------------------------------------------------
// 2. .env bootstrap
// ---------------------------------------------------------------
const ENV_PATH = path.join(ROOT, ".env");
if (!existsSync(ENV_PATH)) {
  const template = readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const token = randomBytes(24).toString("hex");
  const content = template.replace(/^API_TOKEN=.*$/m, `API_TOKEN=${token}`);
  writeFileSync(ENV_PATH, content, { mode: 0o600 });
  info(".env created with a generated API_TOKEN:");
  info(`  API_TOKEN=${token}`);
  warn("Save this token somewhere safe, every request needs it.");
} else {
  info(".env found.");
}

// ---------------------------------------------------------------
// 3. Dependencies
// ---------------------------------------------------------------
if (!existsSync(path.join(ROOT, "node_modules"))) {
  info("Dependencies missing, installing (npm install --ignore-scripts)...");
  run("npm", ["install", "--ignore-scripts"]);
} else {
  info("Dependencies are installed.");
}

// ---------------------------------------------------------------
// 4. laya-ts submodule
// ---------------------------------------------------------------
const LAYA_DIR = path.join(ROOT, "vendor", "laya", "laya-ts");
if (!existsSync(path.join(LAYA_DIR, "package.json"))) {
  info("laya-ts submodule missing, initializing (git submodule update --init)...");
  run("git", ["submodule", "update", "--init"]);
}

// ---------------------------------------------------------------
// 5. laya-ts build
// ---------------------------------------------------------------
if (!existsSync(path.join(LAYA_DIR, "dist", "index.js"))) {
  info("laya-ts is not built yet, building (npm run setup:laya)...");
  run("npm", ["run", "setup:laya"]);
} else {
  info("laya-ts is built.");
}

// ---------------------------------------------------------------
// 6. Free port (auto-increment)
// ---------------------------------------------------------------
function readDefaultPort() {
  try {
    const env = readFileSync(ENV_PATH, "utf8");
    const match = env.match(/^PORT=(\d+)$/m);
    if (match) return Number(match[1]);
  } catch {
    // fall through to default
  }
  return 3000;
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => server.close(() => resolve(true)));
    server.listen(port, "0.0.0.0");
  });
}

async function findFreePort(start) {
  for (let port = start; port < start + 20; port += 1) {
    if (await isPortFree(port)) return port;
  }
  return null;
}

const wantedPort = readDefaultPort();
const port = await findFreePort(wantedPort);
if (port === null) {
  fail(`No free port found in range ${wantedPort}-${wantedPort + 19}.`);
}
if (port !== wantedPort) {
  warn(`Port ${wantedPort} is in use, using ${port} instead.`);
}

// ---------------------------------------------------------------
// 7. Models directory hint
// ---------------------------------------------------------------
const modelsDir = process.env["MODELS_DIR"] ?? path.join(ROOT, "models");
try {
  const subdirs = readdirSync(modelsDir, { withFileTypes: true }).filter((e) =>
    e.isDirectory(),
  );
  if (subdirs.length === 0) {
    warn("No models installed yet, see models/README.md for how to add one.");
  } else {
    info(`Models installed: ${subdirs.map((e) => e.name).join(", ")}`);
  }
} catch {
  warn("Models directory not found, see models/README.md.");
}

// ---------------------------------------------------------------
// 8. Start server
// ---------------------------------------------------------------
info(`Starting runlaya on port ${port}...`);
info(`API documentation: http://localhost:${port}/docs`);
info("Press Ctrl+C to stop.");

const child = spawn(process.execPath, ["src/server.ts"], {
  stdio: "inherit",
  env: { ...process.env, PORT: String(port) },
});

const forward = (signal) => {
  if (!child.killed) child.kill(signal);
};
process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("exit", (code, signal) => {
  console.log("");
  info("Server stopped.");
  process.exit(signal ? 0 : (code ?? 0));
});
