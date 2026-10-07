import { spawn } from "node:child_process";
import { existsSync, realpathSync, mkdirSync, readFileSync, readdirSync, lstatSync, watch } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = realpathSync(fileURLToPath(new URL("..", import.meta.url)));
const development = JSON.parse(readFileSync(path.join(root, "config", "development.json"), "utf8"));
const frontendUrl = `http://${development.frontend.host}:${development.frontend.port}`;
const backendUrl = `http://${development.backend.host}:${development.backend.port}`;
const windows = process.platform === "win32";
const python = path.join(root, "backend", ".venv", windows ? "Scripts/python.exe" : "bin/python");
const next = path.join(root, "frontend", "node_modules", "next", "dist", "bin", "next");
for (const target of [python, next]) {
  if (!existsSync(target)) throw new Error("Install frontend dependencies and create backend/.venv first. See README.");
  if (!realpathSync(target).toLowerCase().startsWith(root.toLowerCase() + path.sep)) throw new Error("Runtime path must stay inside the repository.");
}
if (process.argv.includes("--check")) {
  console.log(`Root dev configuration valid: frontend ${frontendUrl}; backend ${backendUrl}, automatic source reload.`);
  process.exit(0);
}
const temporaryDirectory = path.join(root, ".local", "tmp");
mkdirSync(temporaryDirectory, { recursive: true });
const env = { ...process.env, TEMP: temporaryDirectory, TMP: temporaryDirectory, NEXT_TELEMETRY_DISABLED: "1", BACKEND_API_URL: backendUrl };
const children = new Set();
let stopping = false;
let heartbeat;
let backendWatcher;
let reloadTimer;
let backendChild;
let reloading = false;
let reloadPending = false;
const intentionalStops = new WeakSet();
const backendSource = path.join(root, "backend", "app");
const sourceVersions = new Map();
function sourceVersion(file) {
  try {
    const metadata = lstatSync(file);
    return metadata.isFile() ? `${metadata.mtimeMs}:${metadata.size}` : null;
  } catch { return null; }
}
function rememberSources(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "__pycache__") rememberSources(file);
    else if (entry.isFile() && entry.name.endsWith(".py")) sourceVersions.set(file, sourceVersion(file));
  }
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeat);
  clearTimeout(reloadTimer);
  backendWatcher?.close();
  for (const child of children) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    if (windows && child.pid) spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    else child.kill("SIGTERM");
  }
  process.exitCode = code;
}
function launch(executable, args, cwd) {
  const child = spawn(executable, args, { cwd, env, stdio: "inherit", windowsHide: true });
  children.add(child);
  child.on("error", () => stop(1));
  child.on("exit", code => {
    children.delete(child);
    if (!intentionalStops.has(child)) stop(code ?? 1);
  });
  return child;
}
function startBackend() {
  if (stopping) return;
  backendChild = launch(python, ["-m", "uvicorn", "app.main:app", "--host", development.backend.host, "--port", String(development.backend.port)], path.join(root, "backend"));
}
async function reloadBackend() {
  if (stopping) return;
  if (reloading) { reloadPending = true; return; }
  reloading = true;
  try {
    const previous = backendChild;
    if (previous && previous.exitCode === null && previous.signalCode === null) {
      intentionalStops.add(previous);
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("The owned backend did not stop for reload.")), 5000);
        previous.once("exit", () => { clearTimeout(timeout); resolve(); });
        // This is a held child-process handle, not a listener PID discovered on the machine.
        previous.kill();
      });
    }
    if (!stopping) { startBackend(); console.log("Reloaded the project backend after a Python source change."); }
  } catch (error) {
    console.error(error.message);
    stop(1);
  } finally {
    reloading = false;
    if (reloadPending && !stopping) { reloadPending = false; void reloadBackend(); }
  }
}
async function request(url) {
  try { return await fetch(url, { signal: AbortSignal.timeout(2500), redirect: "error" }); }
  catch { return null; }
}
async function backendReady() {
  const health = await request(`${backendUrl}/health`);
  if (!health?.ok || (await health.json().catch(() => null))?.status !== "ok") return false;
  const schema = await request(`${backendUrl}/openapi.json`);
  const data = await schema?.json().catch(() => null);
  return data?.info?.title === "InterviewAI API" && Boolean(data.paths?.["/api/auth/me"]);
}
async function existingFrontend() {
  const response = await request(`${frontendUrl}/register`);
  if (!response) return false;
  const page = await response.text();
  if (!response.ok || !page.includes("InterviewAI") || !page.includes("Create your account")) {
    throw new Error(`A different service is using ${frontendUrl}; it was left untouched.`);
  }
  // Reuse a running InterviewAI dev server rather than terminating a process we do not own.
  // next dev reloads next.config.ts when the shared API destination changes.
  for (let attempt = 0; attempt < 20; attempt++) {
    if (stopping) return false;
    const proxy = await request(`${frontendUrl}/api/auth/me`);
    const data = await proxy?.json().catch(() => null);
    if (proxy?.status === 401 && data?.detail === "Please sign in to continue.") return true;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("The existing InterviewAI frontend has not loaded the configured API proxy; it was left untouched.");
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
try {
  if (await backendReady()) console.log(`Reusing healthy InterviewAI backend at ${backendUrl}.`);
  else if (!stopping) {
    startBackend();
    // The launcher owns reloads to avoid a stalled Windows Uvicorn reload subprocess.
    rememberSources(backendSource);
    backendWatcher = watch(backendSource, { recursive: true }, (_, filename) => {
      if (!filename?.endsWith(".py") || filename.includes("__pycache__")) return;
      const file = path.resolve(backendSource, filename);
      if (!file.startsWith(backendSource + path.sep)) return;
      const version = sourceVersion(file);
      if (sourceVersions.get(file) === version) return;
      sourceVersions.set(file, version);
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => { void reloadBackend(); }, 300);
    });
  }
  for (let attempt = 0; !(await backendReady()); attempt++) {
    if (stopping) break;
    if (attempt >= 40) throw new Error("The project backend did not become ready.");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!stopping) {
    const reuseFrontend = await existingFrontend();
    if (!stopping) {
      if (reuseFrontend) console.log(`Reusing running InterviewAI frontend at ${frontendUrl}.`);
      else launch(process.execPath, [next, "dev", "--hostname", development.frontend.host, "--port", String(development.frontend.port)], path.join(root, "frontend"));
      console.log(`InterviewAI frontend: ${frontendUrl}; backend: ${backendUrl}; docs: ${backendUrl}/docs`);
      // A reused service must never be killed by this launcher. Keep the launcher alive even
      // when both healthy services were already running so Ctrl+C remains predictable.
      heartbeat = setInterval(() => {}, 60000);
      process.on("exit", () => clearInterval(heartbeat));
    }
  }
} catch (error) {
  console.error(error.message);
  stop(1);
}
