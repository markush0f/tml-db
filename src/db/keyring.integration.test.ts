import { expect, test } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createConnectionManager } from "./connection-manager";
import { initializeDemoDatabase, sqliteDsn } from "./config";
import { connectQuerySession } from "./query";

// Explicit opt-in: never prompt for the user's keyring in the normal test suite.
const nativeTest = process.env.TML_DB_TEST_KEYRING === "1" ? test : test.skip;
nativeTest(
  "llavero real: registrar SQLite, conectar por referencia, consultar y borrar",
  async () => {
    const dir = await mkdtemp(join(tmpdir(), "tml-keyring-"));
    const filename = join(dir, "connections.toml");
    const manager = createConnectionManager({ filename });
    let saved = false;
    try {
      const database = join(dir, "demo.sqlite");
      await initializeDemoDatabase(database);
      await manager.save("native-test", sqliteDsn(database));
      saved = true;
      expect(await readFile(filename, "utf8")).not.toContain(database);
      const session = await connectQuerySession({
        connectionsFile: filename,
        connectionName: "native-test",
      });
      try {
        expect(
          (await session.execute("SELECT COUNT(*) AS total FROM users")).statements[0]
            ?.rows[0]?.[0],
        ).toBe(3);
      } finally {
        await session.close();
      }
      await manager.remove("native-test");
      saved = false;
      expect((await manager.list()).connections.some((entry) => entry.name === "native-test")).toBe(
        false,
      );
    } finally {
      if (saved) await manager.remove("native-test");
      await rm(dir, { recursive: true, force: true });
    }
  },
  20_000,
);
