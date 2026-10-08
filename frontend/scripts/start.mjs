import { cpSync, existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const frontend = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const destination = path.join(frontend, ".next", "standalone", "frontend");
const server = path.join(destination, "server.js");
if (!existsSync(server)) throw new Error("Run npm run build before npm run start.");
if (!realpathSync(destination).startsWith(realpathSync(frontend) + path.sep)) {
  throw new Error("Standalone output must remain inside the frontend directory.");
}
for (const [source, target] of [["public", "public"], [".next/static", ".next/static"]]) {
  cpSync(path.join(frontend, source), path.join(destination, target), { recursive: true });
}
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 2) {
  if (args[index] === "--hostname") process.env.HOSTNAME = args[index + 1];
  else if (args[index] === "--port" && /^\d+$/.test(args[index + 1] ?? "")) {
    process.env.PORT = args[index + 1];
  } else throw new Error("Supported start options: --hostname HOST --port PORT.");
}
process.env.HOSTNAME ||= "127.0.0.1";
process.env.PORT ||= "3000";
await import(pathToFileURL(server).href);
