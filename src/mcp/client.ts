import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dbHubLaunch, type DbHubOptions } from "./config";

/** Owns one local DBHub process. Always close in finally (or use await using). */
export async function connectDbHub(options: DbHubOptions = {}) {
  const launch = await dbHubLaunch(options);
  const transport = new StdioClientTransport({ ...launch, stderr: "pipe" });
  // Drain DBHub diagnostics without leaking DSNs or credentials to the TUI.
  transport.stderr?.on("data", () => {});
  const client = new Client({ name: "tml-db", version: "0.1.0" }, { capabilities: {} });
  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    try {
      await client.close();
    } finally {
      await transport.close();
    }
  }
  try {
    await client.connect(transport, { timeout: options.timeoutMs ?? 15_000 });
  } catch {
    await close();
    throw new Error(
      "No se pudo conectar a DBHub local. Comprueba Node.js >= 22.5.0, bun install, config/connections.toml y .env en la raíz del proyecto.",
    );
  }
  return {
    client,
    writeEnabled: launch.writeEnabled,
    sqlDialect: launch.sqlDialect,
    pid: transport.pid,
    close,
    [Symbol.asyncDispose]: close,
  };
}
