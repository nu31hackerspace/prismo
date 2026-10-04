import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import path from "node:path";

const distDir = path.resolve(import.meta.dirname, "../dist");
const port = process.env.PORT ?? "5173";

const runtimeEnv = {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  PUBLIC_MQTT_URL: process.env.PUBLIC_MQTT_URL ?? "",
};

console.log(`> Client starting (commit ${process.env.COMMIT_SHA ?? "unknown"})`);
for (const [key, value] of Object.entries(runtimeEnv)) {
  if (value) {
    console.log(`> ${key}=${value}`);
  } else {
    console.warn(`> WARNING: ${key} is not set`);
  }
}

writeFileSync(path.join(distDir, "env.js"), `window.__ENV__ = ${JSON.stringify(runtimeEnv)};\n`);
console.log(`> Wrote runtime config to ${path.join(distDir, "env.js")}`);

const server = spawn("serve", ["-s", distDir, "-l", port], { stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code, signal) => {
  console.log(`> Client server exited (code ${code}, signal ${signal})`);
  process.exit(code ?? 0);
});
