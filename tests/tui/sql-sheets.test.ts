import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSqlSheets, initialSheets, nextSheetName, sheetName, validateSheets } from "../../src/tui/sql-sheets";
import { createSqlSheetStore, memorySqlSheetStore } from "../../src/tui/sql-sheet-store";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}

describe("modelo de hojas SQL", () => {
  test("CRUD, nombres únicos, selección y última hoja vacía", async () => {
    const state = createSqlSheets(memorySqlSheetStore());
    await state.load();
    const first = state.active().id;
    expect(state.active().sql).toBe("SELECT * FROM users LIMIT 200;");
    state.create("  Reporte  ");
    const second = state.active().id;
    state.updateSql(second, "SELECT 2;");
    state.rename(second, "Ventas");
    expect(state.active()).toEqual({ id: second, name: "Ventas", sql: "SELECT 2;" });
    state.select(first);
    expect(state.active().sql).toContain("users");
    expect(() => state.create("VENTAS")).toThrow("Ya existe");
    state.remove(first);
    expect(state.active().id).toBe(second);
    state.remove(second);
    expect(state.active().name).toBe("Hoja 1");
    expect(state.active().sql).toBe("");
    expect(state.active().id).not.toBe(second);
    expect(nextSheetName(state.document().sheets)).toBe("Hoja 2");
    state.select("missing"); state.remove("missing");
    expect(state.document().sheets).toHaveLength(1);
    await state.flush(); state.dispose();
  });
  test("borrar selecciona siguiente o anterior sin cambiar activa al borrar otra", async () => {
    const state = createSqlSheets(memorySqlSheetStore()); await state.load();
    const first = state.active().id;
    state.create("Dos"); const second = state.active().id;
    state.create("Tres"); const third = state.active().id;
    state.select(second); state.remove(second); expect(state.active().id).toBe(third);
    state.remove(third); expect(state.active().id).toBe(first);
    state.create("Cuatro"); const fourth = state.active().id;
    state.remove(first); expect(state.active().id).toBe(fourth);
    await state.flush(); state.dispose();
  });
  test("valida Unicode, espacios y controles sin prohibir nombres internacionales", () => {
    expect(sheetName("  Résumé 日本  ", [])).toBe("Résumé 日本");
    expect(sheetName("😀".repeat(80), [])).toBe("😀".repeat(80));
    for (const name of ["", "  ", "x\nx", "x\u001bx", "x\u202ex", "x\u2028x", "a".repeat(81)])
      expect(() => sheetName(name, [])).toThrow();
  });
  test("normaliza activa ausente y documento vacío; rechaza documentos inválidos", () => {
    const doc = initialSheets();
    expect(validateSheets({ ...doc, activeSheetId: "missing" }).activeSheetId).toBe(doc.activeSheetId);
    expect(validateSheets({ version: 1, activeSheetId: "", sheets: [] }).sheets[0]!.sql).toBe("");
    for (const invalid of [null, {}, { ...doc, version: 2 }, { ...doc, sheets: [doc.sheets[0], doc.sheets[0]] }, { ...doc, sheets: [{...doc.sheets[0], sql: 7}] }, { ...doc, sheets: [doc.sheets[0], { ...doc.sheets[0], id: "other" }] }]) expect(() => validateSheets(invalid)).toThrow();
  });
  test("serializa y coalesce guardados sin permitir que gane un snapshot antiguo", async () => {
    const gate = deferred<void>(); const writes: string[] = [];
    const state = createSqlSheets({ load: async () => null, save: async doc => {
      writes.push(doc.sheets.find(s => s.id === doc.activeSheetId)!.sql);
      if (writes.length === 1) await gate.promise;
    }});
    await state.load();
    state.updateSql(state.active().id, "old");
    const pending = state.flush();
    state.updateSql(state.active().id, "middle");
    state.updateSql(state.active().id, "new");
    expect(writes).toEqual(["old"]);
    gate.resolve(); expect(await pending).toBe(true);
    expect(writes).toEqual(["old", "new"]);
    expect(state.status()).toBe("saved"); state.dispose();
  });
  test("debounce de 400 ms y flush al salir sin esperar el temporizador", async () => {
    let writes = 0;
    const state = createSqlSheets({ load: async () => null, save: async () => { writes++; }});
    await state.load(); state.updateSql(state.active().id, "one");
    await Bun.sleep(100); state.updateSql(state.active().id, "two");
    expect(writes).toBe(0); await Bun.sleep(450); expect(writes).toBe(1);
    state.updateSql(state.active().id, "three"); await state.flush(); expect(writes).toBe(2); state.dispose();
  });
  test("error de escritura mantiene SQL y permite reintentar", async () => {
    let failing = true;
    const state = createSqlSheets({ load: async () => null, save: async () => { if (failing) throw new Error("secret path"); }});
    await state.load(); state.updateSql(state.active().id, "SELECT 'private';");
    expect(await state.flush()).toBe(false); expect(state.status()).toBe("error");
    expect(state.message()).not.toContain("secret"); expect(state.active().sql).toContain("private");
    failing = false; expect(await state.retry()).toBe(true); expect(state.status()).toBe("saved"); state.dispose();
  });
  test("carga fallida bloquea guardados; restablecer exige backup y conserva ediciones", async () => {
    let writes = 0, backups = 0, failBackup = true;
    const state = createSqlSheets({ load: async () => { throw new Error("bad"); }, save: async () => { writes++; }, backup: async () => { backups++; if (failBackup) throw new Error("disk full"); }});
    await state.load(); state.updateSql(state.active().id, "unsaved");
    expect(await state.flush()).toBe(false); expect(writes).toBe(0);
    await state.retry(); expect(state.active().sql).toBe("unsaved");
    expect(await state.reset()).toBe(false); expect(state.blocked()).toBe(true); expect(writes).toBe(0);
    failBackup = false; expect(await state.reset()).toBe(true);
    expect(backups).toBe(2); expect(writes).toBe(1); expect(state.active().sql).toBe("unsaved"); state.dispose();
  });
});

describe("archivo local de hojas", () => {
  test("ausente, round-trip, permisos privados y reemplazo atómico sin temporales", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tml-sheets-"));
    try {
      const filename = join(dir, "workspace", "sql-sheets.json"); const store = createSqlSheetStore(filename);
      expect(await store.load()).toBeNull();
      const doc = initialSheets("select 'á';"); await store.save(doc);
      expect(await store.load()).toEqual(doc);
      await store.save({ ...doc, sheets: [{...doc.sheets[0]!, sql: "new"}] });
      expect((await store.load())!.sheets[0]!.sql).toBe("new");
      expect(await readdir(join(dir, "workspace"))).toEqual(["sql-sheets.json"]);
      expect((await stat(filename)).mode & 0o777).toBe(0o600);
      expect((await stat(join(dir, "workspace"))).mode & 0o777).toBe(0o700);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  test("corrupción y versión desconocida no se sobrescriben; backup antes de restablecer", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tml-sheets-"));
    try {
      for (const text of ["broken json", JSON.stringify({version: 99})]) {
        const filename = join(dir, "sheets.json"); await Bun.write(filename, text);
        const state = createSqlSheets(createSqlSheetStore(filename));
        await state.load(); state.updateSql(state.active().id, "new sql");
        expect(await state.flush()).toBe(false); expect(await Bun.file(filename).text()).toBe(text);
        expect(await state.reset()).toBe(true);
        const backups = (await readdir(dir)).filter(f => f.endsWith(".bak"));
        expect(await Promise.all(backups.map(f => Bun.file(join(dir, f)).text()))).toContain(text);
        expect((await createSqlSheetStore(filename).load())!.sheets[0]!.sql).toBe("new sql"); state.dispose();
      }
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  test("fallo al escribir no destruye el destino", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tml-sheets-"));
    try {
      const filename = join(dir, "sheets.json"); const store = createSqlSheetStore(filename);
      const doc = initialSheets(); await store.save(doc);
      const invalid = { ...doc, sheets: [{...doc.sheets[0]!, sql: BigInt(7)}] };
      await expect(store.save(invalid as unknown as typeof doc)).rejects.toThrow();
      expect(await store.load()).toEqual(doc); expect(await readdir(dir)).toEqual(["sheets.json"]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
