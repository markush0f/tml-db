import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connectDbHub } from "../mcp/client";
import { createQuerySession } from "../mcp/query";
import { initializeDemoDatabase, sqliteDsn } from "../mcp/config";
import { testRender } from "@opentui/solid";
import type { Renderable, TextareaRenderable, ScrollBoxRenderable } from "@opentui/core";
import { App } from "./app";
import { ResultsPanel, safeCell } from "./components/ResultsPanel";
import { QueryError, type QueryResult, type QuerySession } from "../mcp";
type View = Awaited<ReturnType<typeof testRender>>;
function find(view: View, id: string): Renderable {
  const visit = (node: Renderable): Renderable | undefined => node.id === id ? node : node.getChildren().map((child) => visit(child as Renderable)).find(Boolean);
  const node = visit(view.renderer.root); if (!node) throw new Error(id); return node;
}
async function draw(view: View) { await Bun.sleep(10); await view.renderOnce(); return view.captureCharFrame(); }
async function click(view: View, id: string) { const node = find(view, id); await view.mockMouse.click(node.x, node.y); return draw(view); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((yes) => { resolve = yes; }); return { promise, resolve }; }
const result: QueryResult = { durationMs: 12, statements: [{ sql: "SELECT 1", columns: ["n"], rows: [[1]], count: 1, truncated: false }] };
test("Ctrl+Enter consume evento, captura buffer y evita duplicados; vacío y terminal pequeña no ejecutan", async () => {
  const pending = deferred<QueryResult>(); const calls: string[] = [];
  const view = await testRender(() => <App connect={async () => ({ close: async () => {}, execute: async (sql) => { calls.push(sql); return pending.promise; } })} />, { width: 80, height: 24, useMouse: true });
  try {
    await draw(view);
    const editor = find(view, "query-editor") as TextareaRenderable;
    editor.setText("SELECT 1"); await draw(view);
    await view.mockInput.pressKeys(["\x1b[13;5u"]); await draw(view);
    expect(calls).toEqual(["SELECT 1"]); expect(editor.plainText).toBe("SELECT 1");
    await view.mockInput.pressKeys(["\x1b[13;5u"]); await draw(view); expect(calls).toHaveLength(1);
    expect(view.captureCharFrame()).toContain("Ejecutando…");
    editor.setText("SELECT 2"); pending.resolve(result); await draw(view);
    expect(view.captureCharFrame()).toContain("1 filas"); expect(editor.plainText).toBe("SELECT 2");
    editor.setText("   "); await draw(view); await click(view, "execute-button"); expect(calls).toHaveLength(1);
    editor.setText("SELECT 3"); view.resize(30, 16); await draw(view);
    await view.mockInput.pressKeys(["\x1b[13;5u"]); await draw(view); expect(calls).toHaveLength(1);
  } finally { await view.dispose(); }
});
test("conexión pendiente, fallo seguro y reconexión no ejecutan automáticamente", async () => {
  const pending = deferred<QuerySession>(); let attempts = 0; let calls = 0;
  const view = await testRender(() => <App connect={async () => { attempts++; if (attempts === 1) return pending.promise; return { close: async () => {}, execute: async () => { calls++; return result; } }; }} />, { width: 80, height: 24, useMouse: true });
  try {
    expect(await draw(view)).toContain("Conectando…"); await click(view, "execute-button"); expect(calls).toBe(0);
    pending.resolve({ close: async () => {}, execute: async () => { throw new QueryError("timeout"); } }); await draw(view);
    expect(await click(view, "execute-button")).toContain("Reconectar");
    await view.mockInput.pressKeys(["\x1b[13;5u"]); await draw(view);
    expect(attempts).toBe(2); expect(calls).toBe(0); expect(view.captureCharFrame()).toContain("Ejecuta una consulta");
    expect(await click(view, "execute-button")).toContain("1 filas");
  } finally { await view.dispose(); }
});
test("error SQL elimina filas anteriores y permite corregir sin reconectar", async () => {
  let calls = 0; let connections = 0;
  const view = await testRender(() => <App connect={async () => { connections++; return { close: async () => {}, execute: async () => { if (++calls === 2) throw new QueryError("readonly"); return result; } }; }} />, { width: 80, height: 24, useMouse: true });
  try {
    await draw(view); expect(await click(view, "execute-button")).toContain("1 filas");
    expect(await click(view, "execute-button")).toContain("solo se permiten");
    expect(view.captureCharFrame()).not.toContain("1 filas");
    expect(await click(view, "execute-button")).toContain("1 filas"); expect(connections).toBe(1);
  } finally { await view.dispose(); }
});
test("conexión fallida ofrece reconectar y no filtra excepciones", async () => {
  const view = await testRender(() => <App connect={async () => { throw new Error("password=secret"); }} />, { width: 80, height: 24 });
  try { const frame = await draw(view); expect(frame).toContain("Reconectar"); expect(frame).not.toContain("secret"); } finally { await view.dispose(); }
});
test("resultados anchos, múltiples, vacíos y celdas seguras con scroll horizontal", async () => {
  const columns = Array.from({ length: 8 }, (_, i) => `column_${i}`);
  const data: QueryResult = { durationMs: 1, statements: [
    { sql: "wide", columns, rows: [["á😀", null, { key: "value" }, "a\nb\t\x1b[31m", "four", "five", "six", "last"]], count: 1, truncated: true },
    { sql: "empty", columns: [], rows: [], count: 0, truncated: false },
  ] };
  let selected: unknown;
  const view = await testRender(() => <ResultsPanel width={40} height={18} results={data} focused selectedRow={null} onFocus={() => {}} onSelectRow={(row) => { selected = row; }} />, { width: 40, height: 20, useMouse: true });
  try {
    const frame = await draw(view); expect(frame).toContain("Resultado 1"); expect(frame).toContain("Resultado 2"); expect(frame).toContain("Sin filas"); expect(frame).toContain("Límite de 200 filas alcanzado"); expect(frame).not.toContain("\x1b");
    await click(view, "result-row-0-0"); expect(selected).toEqual({ statementIndex: 0, rowIndex: 0 });
    const rows = find(view, "result-rows") as ScrollBoxRenderable;
    rows.scrollBy({ x: 100, y: 0 }); await draw(view); expect(rows.scrollLeft).toBeGreaterThan(0);
    expect(safeCell("a\n\t\x1b\u009b")).toBe("a\\n\\t\\u001b\\u009b");
    expect(safeCell(null)).toBe("NULL"); expect(safeCell(undefined)).toBe("");
  } finally { await view.dispose(); }
});

test("recorrido completo con SQLite temporal: ejecutar, corregir, vacío, resize y cierre del hijo", async () => {
  const directory = await mkdtemp(join(tmpdir(), "tml-ui-real-"));
  const path = join(directory, "demo.sqlite");
  await initializeDemoDatabase(path);
  let connection: Awaited<ReturnType<typeof connectDbHub>> | undefined;
  const view = await testRender(() => <App connect={async () => {
    connection = await connectDbHub({ dsn: sqliteDsn(path) });
    return createQuerySession(connection);
  }} />, { width: 120, height: 40, useMouse: true });
  async function waitFor(text: string) {
    for (let i = 0; i < 200; i++) { if ((await draw(view)).includes(text)) return; }
    throw new Error(`No apareció: ${text}\n${view.captureCharFrame()}`);
  }
  async function query(sql: string, expected: string) {
    (find(view, "query-editor") as TextareaRenderable).setText(sql); await draw(view);
    await click(view, "execute-button"); await waitFor(expected);
  }
  try {
    await waitFor("Conectado"); expect(view.captureCharFrame()).not.toContain("Ana");
    await query("SELECT * FROM users LIMIT 200;", "Ana");
    await query("SELECT * FROM missing_table;", "Revisa el SQL");
    expect(view.captureCharFrame()).not.toContain("Ana");
    await query("SELECT * FROM users WHERE 1=0;", "Sin filas");
    await query("DELETE FROM users;", "solo se permiten");
    await query("SELECT * FROM users;", "Marta");
    for (const [width, height] of [[80, 24], [40, 20], [120, 40]]) {
      view.resize(width!, height!); expect(await draw(view)).toContain("Ana");
    }
    const pid = connection!.pid!;
    view.mockInput.pressKey("c", { ctrl: true });
    for (let i = 0; i < 100 && !view.renderer.isDestroyed; i++) await Bun.sleep(10);
    expect(view.renderer.isDestroyed).toBe(true);
    expect(() => process.kill(pid, 0)).toThrow();
  } finally { await view.dispose(); await connection?.close(); await rm(directory, { recursive: true, force: true }); }
}, 20_000);
