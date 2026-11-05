import { expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  connectionDsn,
  connectionEngines,
  type ConnectionFields,
} from "../../src/tui/connection-form";

const fields: ConnectionFields = {
  engine: 0,
  host: "localhost",
  port: "5432",
  user: "alice",
  password: "secret",
  database: "app",
};

test("construye URLs por motor con puerto y credenciales escapadas", () => {
  for (const [engine, option] of connectionEngines.entries()) {
    if (option.scheme === "sqlite") continue;
    const dsn = connectionDsn({
      ...fields,
      engine,
      port: option.port,
      user: "user@name",
      password: "p@ss:/?#%",
      database: "my_db",
    });
    const url = new URL(dsn);
    expect(url.protocol).toBe(`${option.scheme}:`);
    expect(decodeURIComponent(url.username)).toBe("user@name");
    expect(decodeURIComponent(url.password)).toBe("p@ss:/?#%");
    expect(url.port).toBe(option.port);
    expect(url.pathname).toBe("/my_db");
  }
});
test("admite contraseña vacía y base predeterminada", () => {
  expect(connectionDsn({ ...fields, password: "", database: "" })).toBe(
    "postgres://alice:@localhost:5432/",
  );
});
test("SQLite utiliza archivo sin credenciales de red", () => {
  expect(connectionDsn({ ...fields, engine: 4, database: "/tmp/app.sqlite" })).toBe(
    "sqlite:///tmp/app.sqlite",
  );
  expect(connectionDsn({ ...fields, engine: 4, database: "app.sqlite" })).toBe(
    `sqlite://${resolve("app.sqlite")}`,
  );
  expect(connectionDsn({ ...fields, engine: 4, database: ":memory:" })).toBe("sqlite:///:memory:");
});
test("validación de host y puerto no expone la contraseña", () => {
  for (const invalid of [
    { host: "postgres://localhost" },
    { host: "server/db" },
    { port: "0" },
    { port: "65536" },
    { port: "3306oops" },
    { user: "" },
    { host: "::1" },
    { database: "a b" },
    { database: "a?b" },
  ]) {
    expect(() => connectionDsn({ ...fields, ...invalid })).toThrow();
    try {
      connectionDsn({ ...fields, ...invalid });
    } catch (error) {
      expect(String(error)).not.toContain(fields.password);
    }
  }
});
