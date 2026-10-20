import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import {
  loadConnectionCatalog,
  parseConnectionCatalog,
  type ConnectionCatalog,
} from "./connections";
import { localEnvironment, resolvedConnectionsPath } from "./config";
import { systemCredentials, type CredentialStore } from "./credentials";

export interface ConnectionSummary {
  name: string;
  kind: "llavero" | "entorno" | "demo";
}
export interface ConnectionList {
  active: string;
  connections: ConnectionSummary[];
}
export interface ConnectionManager {
  list(): Promise<ConnectionList>;
  save(name: string, dsn: string, replace?: boolean): Promise<void>;
  remove(name: string): Promise<void>;
}
function serialize(catalog: ConnectionCatalog): string {
  const lines = [`active = ${JSON.stringify(catalog.active)}`, ""];
  for (const [name, entry] of Object.entries(catalog.connections)) {
    lines.push(
      `[connections.${name}]`,
      entry.demo
        ? "demo = true"
        : entry.secretRef
          ? `secret_ref = ${JSON.stringify(entry.secretRef)}`
          : `dsn_env = ${JSON.stringify(entry.dsnEnv)}`,
      "",
    );
  }
  const text = lines.join("\n");
  parseConnectionCatalog(text);
  return text;
}
export function createConnectionManager(
  options: { filename?: string; credentials?: CredentialStore } = {},
): ConnectionManager {
  const store = options.credentials ?? systemCredentials;
  async function load(filename: string): Promise<ConnectionCatalog> {
    const existing = await loadConnectionCatalog(filename);
    if (existing) return existing;
    const local = await localEnvironment();
    return {
      active: "local",
      connections: {
        local:
          process.env.DBHUB_DSN || local.DBHUB_DSN
            ? { demo: false, dsnEnv: "DBHUB_DSN" }
            : { demo: true },
      },
    };
  }
  async function mutate(
    action: (
      catalog: ConnectionCatalog,
      persist: (next: ConnectionCatalog) => Promise<void>,
    ) => Promise<void>,
  ) {
    const filename = await resolvedConnectionsPath(options.filename);
    await mkdir(dirname(filename), { recursive: true });
    let lock;
    try {
      lock = await open(`${filename}.lock`, "wx", 0o600);
    } catch {
      throw new Error(
        "No se pudo bloquear el catálogo. Comprueba permisos u otra instancia abierta.",
      );
    }
    const temp = `${filename}.${randomUUID()}.tmp`;
    try {
      const catalog = await load(filename);
      await action(catalog, async (next) => {
        try {
          const file = await open(temp, "wx", 0o600);
          try {
            await file.writeFile(serialize(next));
            await file.sync();
          } finally {
            await file.close();
          }
          await rename(temp, filename);
        } catch {
          throw new Error("No se pudo guardar el catálogo de conexiones. Comprueba los permisos.");
        }
      });
    } finally {
      await unlink(temp).catch(() => {});
      await lock.close();
      await unlink(`${filename}.lock`).catch(() => {});
    }
  }
  return {
    async list() {
      const catalog = await load(await resolvedConnectionsPath(options.filename));
      return {
        active: catalog.active,
        connections: Object.entries(catalog.connections).map(([name, entry]) => ({
          name,
          kind: entry.demo ? "demo" : entry.secretRef ? "llavero" : "entorno",
        })),
      };
    },
    async save(name, dsn, replace = false) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(name))
        throw new Error("Nombre: usa de 1 a 64 letras, números, guiones o guiones bajos.");
      if (
        !/^(postgres(ql)?|mysql|mariadb|sqlserver|sqlite):\/\/\S+$/i.test(dsn) ||
        dsn.length > 2000
      )
        throw new Error(
          "URL no válida. Usa postgres://, mysql://, mariadb://, sqlserver:// o sqlite:// (máximo 2000 caracteres).",
        );
      await mutate(async (catalog, persist) => {
        const old = catalog.connections[name];
        if (old && !replace)
          throw new Error(
            "Ya existe ese nombre. Selecciona la conexión para sustituir sus credenciales.",
          );
        if (!old && replace) throw new Error("La conexión ya no existe. Actualiza la lista.");
        const ref = randomUUID();
        await store.set(ref, dsn);
        try {
          await persist({
            ...catalog,
            connections: { ...catalog.connections, [name]: { demo: false, secretRef: ref } },
          });
        } catch (error) {
          try {
            await store.delete(ref);
          } catch {
            throw new Error(
              "No se guardó el catálogo y no se pudo limpiar el secreto nuevo. Revísalo bajo tml-db en el gestor del sistema.",
            );
          }
          throw error;
        }
        if (
          old?.secretRef &&
          !Object.entries(catalog.connections).some(
            ([other, entry]) => other !== name && entry.secretRef === old.secretRef,
          )
        ) {
          try {
            await store.delete(old.secretRef);
          } catch {
            throw new Error(
              "Conexión guardada; no se pudo borrar el secreto anterior del llavero. Revísalo en el gestor del sistema.",
            );
          }
        }
      });
    },
    async remove(name) {
      await mutate(async (catalog, persist) => {
        const old = catalog.connections[name];
        if (!old) throw new Error("La conexión ya no existe.");
        const connections = { ...catalog.connections };
        delete connections[name];
        const names = Object.keys(connections);
        if (!names.length)
          throw new Error("No se puede eliminar la última conexión. Añade otra primero.");
        // Delete the credential first; restore it if persisting the catalog fails.
        const ref =
          old.secretRef &&
          !Object.values(connections).some((entry) => entry.secretRef === old.secretRef)
            ? old.secretRef
            : undefined;
        const secret = ref ? await store.get(ref) : null;
        if (ref) await store.delete(ref);
        try {
          await persist({
            active: catalog.active === name ? names[0]! : catalog.active,
            connections,
          });
        } catch (error) {
          if (ref && secret) await store.set(ref, secret);
          throw error;
        }
      });
    },
  };
}
