import { spawn, type ChildProcess } from "node:child_process";
import type { SearchQualityConfig } from "../config/schema.js";
export async function runCommand(command: string, cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["inherit", "pipe", "inherit"],
      env: process.env,
    });
    child.stdout?.pipe(process.stderr);
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Command failed (${code}): ${command}`)),
    );
  });
}
export const startCommand = (command: string, cwd: string) => {
  const child = spawn(command, {
    cwd,
    shell: true,
    stdio: ["inherit", "pipe", "inherit"],
    env: process.env,
  });
  child.stdout?.pipe(process.stderr);
  return child;
};
export async function waitForUrl(
  url: string,
  config: SearchQualityConfig,
  child: ChildProcess,
) {
  const deadline = Date.now() + config.build.startupTimeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`Preview command exited before ${url} became available`);
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (r.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
