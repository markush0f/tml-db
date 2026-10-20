import { spawn } from "node:child_process";
import { dbHubLaunch } from "./config";

// Standalone stdio entrypoint for MCP clients. Never write logs to stdout.
try {
  const launch = await dbHubLaunch();
  const child = spawn(launch.command, launch.args, {
    cwd: launch.cwd,
    env: launch.env,
    stdio: "inherit",
  });
  const interrupt = () => {
    child.kill("SIGINT");
  };
  const terminate = () => {
    child.kill("SIGTERM");
  };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", terminate);
  try {
    process.exitCode = await new Promise<number>((resolve, reject) => {
      child.once("error", () =>
        reject(new Error("No se pudo iniciar DBHub. Comprueba Node.js >= 22.5.0 y bun install.")),
      );
      child.once("exit", (code, signal) => resolve(code ?? (signal === "SIGINT" ? 130 : 143)));
    });
  } finally {
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "No se pudo iniciar DBHub local.");
  process.exitCode = 1;
}
