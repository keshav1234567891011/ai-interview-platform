import { spawn } from "node:child_process";
import { existsSync, realpathSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
const windows = process.platform === "win32";
const python = path.join(root, "backend", ".venv", windows ? "Scripts/python.exe" : "bin/python");
const next = path.join(root, "frontend", "node_modules", "next", "dist", "bin", "next");
for (const target of [python, next]) {
  if (!existsSync(target)) throw new Error("Install frontend dependencies and create backend/.venv first. See README.");
  if (!realpathSync(target).toLowerCase().startsWith(root.toLowerCase() + path.sep)) throw new Error("Runtime path must stay inside the repository.");
}
if (process.argv.includes("--check")) {
  console.log("Root dev configuration valid: frontend localhost:3000; backend localhost:8000, --reload.");
  process.exit(0);
}
const temporaryDirectory = path.join(root, ".local", "tmp");
mkdirSync(temporaryDirectory, { recursive: true });
const env = { ...process.env, TEMP: temporaryDirectory, TMP: temporaryDirectory, NEXT_TELEMETRY_DISABLED: "1" };
const children = [
  spawn(process.execPath, [next, "dev", "--hostname", "localhost", "--port", "3000"], { cwd: path.join(root, "frontend"), env, stdio: "inherit" }),
  spawn(python, ["-m", "uvicorn", "app.main:app", "--reload", "--reload-dir", "app", "--host", "127.0.0.1", "--port", "8000"], { cwd: path.join(root, "backend"), env, stdio: "inherit" }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (windows && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exitCode = code;
}
for (const child of children) { child.on("error", () => stop(1)); child.on("exit", code => stop(code ?? 1)); }
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
