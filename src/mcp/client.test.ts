import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { connectDbHub } from "./client";
import { defaultDemoPath, initializeDemoDatabase, projectDirectory, sqliteDsn } from "../db/config";
import { dbHubLaunch } from "./config";

let directory: string;
let dsn: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "tml-db-mcp-"));
  const database = join(directory, "demo.sqlite");
  await initializeDemoDatabase(database);
  // Reinitializing never duplicates the sample rows.
  await initializeDemoDatabase(database);
  dsn = sqliteDsn(database);
  await writeFile(
    join(directory, "connections.toml"),
    'active = "test"\n[connections.test]\ndsn_env = "DBHUB_DSN"\n',
  );
});
afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

function text(result: Record<string, unknown>) {
  if (!Array.isArray(result.content)) throw new Error("Expected MCP content array");
  return (result.content as Array<{ type: string; text?: string }>)
    .filter((item) => item.type === "text")
    .map((item) => item.text ?? "")
    .join("\n");
}

test("conecta con DBHub real local, descubre herramientas, esquemas y filas", async () => {
  const connection = await connectDbHub({ dsn });
  try {
    const tools = (await connection.client.listTools()).tools.map((tool) => tool.name);
    expect(tools).toEqual(expect.arrayContaining(["execute_sql", "search_objects"]));
    const objects = await connection.client.callTool({
      name: "search_objects",
      arguments: { object_type: "table", pattern: "users" },
    });
    expect(objects.isError).not.toBe(true);
    expect(text(objects)).toContain("users");
    const result = await connection.client.callTool({
      name: "execute_sql",
      arguments: { sql: "SELECT id, name FROM users ORDER BY id;" },
    });
    expect(result.isError).not.toBe(true);
    const payload = JSON.parse(text(result));
    expect(payload.success).toBe(true);
    expect(payload.data.statements[0].rows).toEqual([
      { id: 1, name: "Ana" },
      { id: 2, name: "Luis" },
      { id: 3, name: "Marta" },
    ]);
  } finally {
    await connection.close();
  }
  await connection.close(); // Idempotent shutdown; no orphaned Node server.
  expect(() => process.kill(connection.pid!, 0)).toThrow();
}, 20_000);

test("bloquea escrituras en el servidor y mantiene los datos", async () => {
  const connection = await connectDbHub({ dsn });
  try {
    const denied = await connection.client.callTool({
      name: "execute_sql",
      arguments: { sql: "DELETE FROM users;" },
    });
    expect(denied.isError === true || JSON.parse(text(denied)).success === false).toBe(true);
    const result = await connection.client.callTool({
      name: "execute_sql",
      arguments: { sql: "SELECT COUNT(*) AS total FROM users;" },
    });
    expect(JSON.parse(text(result)).data.statements[0].rows[0].total).toBe(3);
    const limited = await connection.client.callTool({
      name: "execute_sql",
      arguments: {
        sql: "WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<500) SELECT n FROM seq;",
      },
    });
    expect(limited.isError).not.toBe(true);
    expect(JSON.parse(text(limited)).data.statements[0].rows.length).toBeLessThanOrEqual(200);
  } finally {
    await connection.close();
  }
}, 20_000);

test("credenciales solo en entorno; no hay puerto ni HTTP", async () => {
  const secret = "postgres://reader:NOT_A_REAL_PASSWORD@127.0.0.1:5432/example";
  const launch = await dbHubLaunch({ dsn: secret });
  expect(launch.command).toBe("node");
  expect(launch.args).toContain("stdio");
  expect(launch.args).not.toContain("http");
  expect(launch.args.join(" ")).not.toContain(secret);
  expect(launch.env.DBHUB_DSN).toBe(secret);
  expect(launch.cwd).toBe(projectDirectory);
  expect(launch.args.at(-1)).toBe(resolve(projectDirectory, "config/dbhub.toml"));
  expect(defaultDemoPath).toBe(resolve(projectDirectory, "data/dbhub/demo.sqlite"));
});

test("fallo de conexión acotado sin mostrar DSN ni contraseña", async () => {
  await expect(
    connectDbHub({ dsn: "invalid://reader:DO_NOT_LOG_ME@localhost/db", timeoutMs: 3_000 }),
  ).rejects.toThrow("No se pudo conectar a DBHub local.");
}, 10_000);

test("entrypoint stdio independiente funciona desde otro directorio y cierra el hijo", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("./server.ts", import.meta.url))],
    cwd: directory,
    env: {
      ...getDefaultEnvironment(),
      DBHUB_DSN: dsn,
      DBHUB_CONNECTIONS_FILE: join(directory, "connections.toml"),
    },
    stderr: "pipe",
  });
  transport.stderr?.on("data", () => {});
  const client = new Client({ name: "tml-db-test", version: "1.0.0" });
  let pid: number | null = null;
  try {
    await client.connect(transport, { timeout: 10_000 });
    pid = transport.pid;
    expect(pid).not.toBeNull();
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain("search_objects");
  } finally {
    await client.close();
    await transport.close();
  }
  expect(() => process.kill(pid!, 0)).toThrow();
}, 20_000);
