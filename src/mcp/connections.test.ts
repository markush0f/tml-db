import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { catalogDsn, defaultConnectionsPath, loadConnectionCatalog, parseConnectionCatalog } from "./connections";
import { dbHubLaunch, defaultDemoPath, projectDirectory, sqliteDsn } from "./config";
let directory: string;
beforeAll(async () => { directory = await mkdtemp(join(tmpdir(), "tml-connections-")); });
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });
const text = 'active = "dev"\n[connections.dev]\ndsn_env = "TEST_CATALOG_DSN"\n[connections.prod]\ndsn_env = "UNSET_PROD_DSN"\n[connections.demo]\ndemo = true\n';

test("catálogo con varias conexiones y resolución exclusiva de la activa", () => {
  const catalog = parseConnectionCatalog(text);
  expect(catalog.active).toBe("dev");
  expect(Object.keys(catalog.connections)).toEqual(["dev", "prod", "demo"]);
  expect(catalogDsn(catalog, { TEST_CATALOG_DSN: "sqlite:///tmp/test.sqlite" })).toBe("sqlite:///tmp/test.sqlite");
  expect(catalogDsn(parseConnectionCatalog(text.replace('active = "dev"', 'active = "demo"')), {})).toBeUndefined();
  for (const value of [undefined, "", "  "]) {
    expect(() => catalogDsn(catalog, { TEST_CATALOG_DSN: value })).toThrow("Falta la variable de entorno");
  }
});
test("rechaza TOML inválido, activa inexistente, credenciales y campos ambiguos sin filtrarlos", () => {
  const invalid = ["active = [", "", 'active="missing"\n[connections.demo]\ndemo=true',
    'active="x"\n[connections.x]\ndsn="postgres://user:SECRET@host/db"',
    'active="x"\n[connections.x]\ndemo=true\ndsn_env="DSN"',
    'active="x"\n[connections.x]\ndsn_env="${SECRET}"',
    'active="x"\n[connections.x]\ndemo=false',
    'active="x"\n[connections.x]\ndsn_env="DSN"\npassword="SECRET"',
    'active="x"\n[connections.x]\ndsn_env="DSN"\n[connections.other]\ndsn_env=123',
  ];
  for (const value of invalid) {
    try { parseConnectionCatalog(value); throw new Error("Expected rejection"); }
    catch (error) { expect((error as Error).message).toContain("Configuración de conexiones no válida"); expect((error as Error).message).not.toContain("SECRET"); }
  }
  expect(parseConnectionCatalog('active="__proto__"\n[connections.__proto__]\ndemo=true').connections.__proto__!.demo).toBe(true);
});
test("carga desde fichero, detecta ausencia y errores de lectura", async () => {
  const path = join(directory, "valid.toml"); await writeFile(path, text);
  expect((await loadConnectionCatalog(path))?.active).toBe("dev");
  expect(await loadConnectionCatalog(join(directory, "missing.toml"))).toBeNull();
  const folder = join(directory, "folder"); await mkdir(folder);
  await expect(loadConnectionCatalog(folder)).rejects.toThrow("No se pudo leer");
  expect(defaultConnectionsPath).toBe(join(projectDirectory, "config/connections.toml"));
});
test("DSN explícita prevalece e ignora ficheros; fichero explícito ausente no usa demo", async () => {
  const missing = join(directory, "absent.toml");
  expect((await dbHubLaunch({ dsn: "sqlite:///tmp/explicit.sqlite", connectionsFile: missing })).env.DBHUB_DSN).toBe("sqlite:///tmp/explicit.sqlite");
  await expect(dbHubLaunch({ connectionsFile: missing })).rejects.toThrow("No existe el fichero");
  await expect(dbHubLaunch({ dsn: " " })).rejects.toThrow("DSN explícita");
});
test("launcher elige activa, relee cambios y permite ruta de catálogo por entorno", async () => {
  const path = join(directory, "launch.toml");
  await writeFile(path, text);
  async function launch(catalogPath: string | undefined, extraEnv: Record<string, string> = {}) {
    const subprocess = Bun.spawn([process.execPath, "-e", `import {dbHubLaunch} from ${JSON.stringify(join(projectDirectory, "src/mcp/config.ts"))};
      try { const launch = await dbHubLaunch(${catalogPath === undefined ? "{}" : JSON.stringify({ connectionsFile: catalogPath })}); console.log(JSON.stringify({dsn:launch.env.DBHUB_DSN,args:launch.args})); }
      catch(error) { console.error(error.message); process.exitCode=1; }`], {
      cwd: directory, env: { ...process.env, DBHUB_CONNECTIONS_FILE: "", TEST_CATALOG_DSN: "sqlite:///tmp/selected.sqlite", DBHUB_DSN: "sqlite:///tmp/legacy.sqlite", ...extraEnv }, stdout: "pipe", stderr: "pipe",
    });
    const stdout = await new Response(subprocess.stdout).text(); const stderr = await new Response(subprocess.stderr).text();
    return { code: await subprocess.exited, stdout, stderr };
  }
  const selected = await launch(path); expect(selected.code).toBe(0);
  expect(JSON.parse(selected.stdout).dsn).toBe("sqlite:///tmp/selected.sqlite");
  expect(JSON.parse(selected.stdout).args.join(" ")).not.toContain("selected.sqlite");
  await writeFile(path, text.replace('active = "dev"', 'active = "demo"'));
  expect(JSON.parse((await launch(path)).stdout).dsn).toBe(sqliteDsn(defaultDemoPath));
  await writeFile(path, text);
  const missingVariable = await launch(path, { TEST_CATALOG_DSN: "" });
  expect(missingVariable.code).toBe(1); expect(missingVariable.stderr).toContain("Falta la variable");
  const byEnv = await launch(undefined, { DBHUB_CONNECTIONS_FILE: path });
  expect(JSON.parse(byEnv.stdout).dsn).toBe("sqlite:///tmp/selected.sqlite");
});
