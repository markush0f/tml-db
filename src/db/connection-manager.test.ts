import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createConnectionManager } from "./connection-manager";
import { parseConnectionCatalog } from "./connections";
import { dbHubLaunch } from "../mcp/config";
import { systemCredentials, type CredentialStore } from "./credentials";
const directories: string[] = [];
afterEach(async () => {
  for (const dir of directories.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "tml-connections-"));
  directories.push(dir);
  const filename = join(dir, "connections.toml");
  await writeFile(filename, 'active = "demo"\n[connections.demo]\ndemo = true\n');
  const values = new Map<string, string>();
  const credentials: CredentialStore = {
    get: async (name) => values.get(name) ?? null,
    set: async (name, value) => {
      values.set(name, value);
    },
    delete: async (name) => {
      values.delete(name);
    },
  };
  return {
    filename,
    values,
    credentials,
    manager: createConnectionManager({ filename, credentials }),
  };
}
test("registro, sustitución y borrado guardan únicamente referencias y eliminan secretos", async () => {
  const { filename, values, manager } = await setup();
  const dsn = "postgres://user:super-secret@localhost/db";
  await manager.save("dev", dsn);
  let text = await readFile(filename, "utf8");
  expect(text).not.toContain(dsn);
  expect(text).not.toContain("super-secret");
  const first = parseConnectionCatalog(text).connections.dev!.secretRef!;
  expect(values.get(first)).toBe(dsn);
  expect((await manager.list()).connections).toEqual([
    { name: "demo", kind: "demo" },
    { name: "dev", kind: "llavero" },
  ]);
  await expect(manager.save("dev", dsn)).rejects.toThrow("Ya existe");
  await manager.save("dev", "postgres://user:new-secret@localhost/db", true);
  expect(values.has(first)).toBe(false);
  expect(values.size).toBe(1);
  await manager.remove("dev");
  expect(values.size).toBe(0);
  expect((await manager.list()).connections.length).toBe(1);
  await expect(manager.remove("demo")).rejects.toThrow("última");
});
test("rechaza nombres, DSN y configuraciones ambiguas sin mostrar credenciales", async () => {
  const { manager, filename } = await setup();
  await expect(manager.save("bad.name", "postgres://private")).rejects.toThrow("Nombre");
  await expect(manager.save("dev", "private-password")).rejects.toThrow("URL no válida");
  expect(() =>
    parseConnectionCatalog('active="dev"\n[connections.dev]\nsecret_ref="abc"\ndsn_env="DSN"'),
  ).toThrow("no válida");
  expect(() =>
    parseConnectionCatalog('active="dev"\n[connections.dev]\nsecret_ref="abc"\ndemo=true'),
  ).toThrow("no válida");
  await writeFile(filename + ".lock", "");
  await expect(manager.save("dev", "postgres://localhost/db")).rejects.toThrow("bloquear");
});
test("llavero bloqueado no modifica el catálogo ni usa almacenamiento inseguro", async () => {
  const { filename, credentials } = await setup();
  const before = await readFile(filename, "utf8");
  credentials.set = async () => {
    throw new Error("Llavero bloqueado");
  };
  const manager = createConnectionManager({ filename, credentials });
  await expect(manager.save("dev", "postgres://private@localhost/db")).rejects.toThrow("bloqueado");
  expect(await readFile(filename, "utf8")).toBe(before);
});
test("resuelve solo el secreto seleccionado y lo entrega por entorno, no argumentos", async () => {
  const { filename } = await setup();
  await writeFile(
    filename,
    'active="other"\n[connections.other]\ndsn_env="MISSING_UNUSED_ENV"\n[connections.dev]\nsecret_ref="unit-test-ref"\n',
  );
  const previous = systemCredentials.get;
  const calls: string[] = [];
  systemCredentials.get = async (ref) => {
    calls.push(ref);
    return "postgres://user:private@localhost/db";
  };
  try {
    const launch = await dbHubLaunch({ connectionsFile: filename, connectionName: "dev" });
    expect(calls).toEqual(["unit-test-ref"]);
    expect(launch.env.DBHUB_DSN).toContain("private");
    expect(launch.args.join(" ")).not.toContain("private");
    systemCredentials.get = async () => null;
    await expect(dbHubLaunch({ connectionsFile: filename, connectionName: "dev" })).rejects.toThrow(
      "No hay credenciales",
    );
    await expect(
      dbHubLaunch({ connectionsFile: filename, connectionName: "unknown" }),
    ).rejects.toThrow("ya no existe");
  } finally {
    systemCredentials.get = previous;
  }
});
test("el fallo al eliminar un secreto conserva la conexión para reintentar", async () => {
  const { manager, credentials, filename } = await setup();
  await manager.save("dev", "postgres://localhost/db");
  const before = await readFile(filename, "utf8");
  credentials.delete = async () => {
    throw new Error("Llavero bloqueado");
  };
  await expect(manager.remove("dev")).rejects.toThrow("bloqueado");
  expect(await readFile(filename, "utf8")).toBe(before);
});
