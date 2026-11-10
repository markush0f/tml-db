import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import type { Renderable, TextareaRenderable, InputRenderable } from "@opentui/core";
import { measureEditText } from "@opentui/core";
import { App } from "../../src/tui/app";
import { initialSheets, type SqlSheetsDocument } from "../../src/tui/sql-sheets";
import { memorySqlSheetStore, type SqlSheetStore } from "../../src/tui/sql-sheet-store";
import type { QuerySession, QueryResult } from "../../src/db";

type View = Awaited<ReturnType<typeof testRender>>;
const sample: QueryResult = { durationMs: 1, statements: [{ sql: "SELECT", columns: ["id"], rows: [[123]], count: 1, truncated: false }] };
const connect = async (): Promise<QuerySession> => ({ listTables: async () => ({ tables: [], truncated: false }), execute: async () => sample, close: async () => {} });
async function draw(view: View) { await Bun.sleep(15); if (view.renderer.isDestroyed) return ""; await view.renderOnce(); return view.captureCharFrame(); }
function find(view: View, id: string): Renderable {
  function visit(node: Renderable): Renderable | undefined {
    if (node.id === id) return node;
    for (const child of node.getChildren()) { const found = visit(child as Renderable); if (found) return found; }
  }
  const node = visit(view.renderer.root); if (!node) throw new Error(`Missing ${id}`); return node;
}
async function click(view: View, id: string) { const node = find(view, id); await view.mockMouse.click(node.x + 1, node.y + (node.height > 2 ? 1 : 0)); if (!view.renderer.isDestroyed) return draw(view); return ""; }
async function key(view: View, name: string, ctrl = false, shift = false) {
  const sequence: Record<string, string> = { return: "\r", escape: "\x1b", up: "\x1b[A", down: "\x1b[B", right: "\x1b[C", left: "\x1b[D", tab: shift ? "\x1b[Z" : "\t" };
  if (!ctrl && sequence[name]) await view.mockInput.pressKeys([sequence[name]!]);
  else view.mockInput.pressKey(name, { ctrl, shift });
  if (!view.renderer.isDestroyed) return draw(view); return "";
}
function editor(view: View) { return find(view, "query-editor") as TextareaRenderable; }
async function newSheet(view: View, name?: string) {
  await key(view, "o", true); await key(view, "n", true);
  if (name !== undefined) { (find(view, "sheet-name") as InputRenderable).value = name; }
  await key(view, "return"); return draw(view);
}
function bounds(view: View, width: number, height: number) {
  const frame = view.captureCharFrame(); expect(frame.split("\n").length).toBeLessThanOrEqual(height + 1);
  for (const line of frame.trimEnd().split("\n")) expect(measureEditText(line, { widthMethod: "wcwidth" })).toBeLessThanOrEqual(width);
  for (const id of ["sql-sheets-button", "execute-button"]) {
    const node = find(view, id); expect(node.x + node.width).toBeLessThanOrEqual(width - 1);
  }
}

for (const [width, height] of [[120, 40], [80, 24], [40, 20]] as const) {
  test(`hojas CRUD teclado/ratón y límites en ${width}×${height}`, async () => {
    const store = memorySqlSheetStore();
    const view = await testRender(() => <App connect={connect} sheetStore={store} />, { width, height, useMouse: true, exitOnCtrlC: false });
    try {
      await draw(view); bounds(view, width, height);
      const firstEditor = editor(view); const firstText = firstEditor.plainText;
      const frame = await key(view, "o", true);
      expect(frame).toContain("Hojas SQL"); expect(firstEditor.plainText).toBe(firstText);
      await key(view, "n", true); expect(await draw(view)).toContain("Nueva hoja SQL");
      await view.mockInput.typeText(" informe"); await key(view, "return");
      expect(editor(view).plainText).toBe("");
      await view.mockInput.typeText("SELECT 2;"); await draw(view);
      const secondEditor = editor(view);
      expect(secondEditor.plainText).toBe("SELECT 2;");
      await key(view, "o", true); await key(view, "e", true);
      const input = find(view, "sheet-name") as InputRenderable;
      input.value = "Informe"; await draw(view); await key(view, "return");
      expect(await draw(view)).toContain("Informe");
      await key(view, "escape"); await key(view, "o", true); await key(view, "up"); await key(view, "return");
      expect(editor(view)).toBe(firstEditor); expect(editor(view).plainText).toBe(firstText);
      await click(view, "sql-sheets-button");
      const doc = (await store.load())!;
      const second = doc.sheets.find(s => s.name === "Informe")!;
      await click(view, `sheet-row-${second.id}`);
      expect(editor(view)).toBe(secondEditor); expect(editor(view).plainText).toBe("SELECT 2;");
      await key(view, "o", true); await click(view, "sheet-delete");
      expect(await draw(view)).toContain("No se borran");
      await click(view, "sheet-cancel"); expect(await draw(view)).toContain("Informe");
      await key(view, "d", true); await key(view, "right"); await key(view, "return");
      expect(await draw(view)).not.toContain("Informe"); await key(view, "escape");
      expect(editor(view).plainText).toBe(firstText);
      await key(view, "o", true); await key(view, "d", true); await click(view, "sheet-save"); await key(view, "escape");
      expect(editor(view).plainText).toBe(""); bounds(view, width, height);
    } finally { view.renderer.destroy(); }
  });
}

test("cada hoja conserva cursor e historial al alternar y redimensionar", async () => {
  const view = await testRender(() => <App connect={connect} sheetStore={memorySqlSheetStore()} />, { width: 120, height: 40, useMouse: true, exitOnCtrlC: false });
  try {
    await draw(view); const first = editor(view); first.cursorOffset = 6;
    await view.mockInput.typeText(" 99 "); await draw(view); const text = first.plainText, offset = first.cursorOffset;
    await newSheet(view); await view.mockInput.typeText("SELECT 2;"); await draw(view);
    const second = editor(view); const secondText = second.plainText;
    await key(view, "o", true); await key(view, "up"); await key(view, "return");
    expect(editor(view)).toBe(first); expect(first.cursorOffset).toBe(offset);
    expect(first.plainText).toBe(text); await key(view, "z", true);
    expect(first.plainText).not.toBe(text); expect(second.plainText).toBe(secondText);
    await key(view, "y", true); expect(first.plainText).toBe(text);
    view.resize(40, 20); await draw(view); expect(first.plainText).toBe(text); expect(first.cursorOffset).toBe(offset);
    await key(view, "o", true); await key(view, "down"); await key(view, "return");
    expect(editor(view)).toBe(second); expect(second.plainText).toBe(secondText);
  } finally { view.renderer.destroy(); }
});

test("gestor preserva formulario bajo el mínimo y aísla foco; valida nombres", async () => {
  const view = await testRender(() => <App connect={connect} sheetStore={memorySqlSheetStore()} />, { width: 80, height: 24, useMouse: true, exitOnCtrlC: false });
  try {
    await draw(view); const sql = editor(view).plainText;
    await key(view, "o", true); await key(view, "n", true);
    (find(view, "sheet-name") as InputRenderable).value = "HOJA 1";
    await key(view, "return"); expect(await draw(view)).toContain("Ya existe");
    (find(view, "sheet-name") as InputRenderable).value = "Mi informe";
    view.resize(30, 16); expect(await draw(view)).toContain("Terminal pequeña");
    view.resize(80, 24); expect(await draw(view)).toContain("Mi informe");
    expect(editor(view).plainText).toBe(sql);
    await key(view, "return"); expect(editor(view).plainText).toBe("");
  } finally { view.renderer.destroy(); }
});

test("restaura SQL, orden, nombres y hoja activa tras salir y abrir", async () => {
  const store = memorySqlSheetStore();
  const first = await testRender(() => <App connect={connect} sheetStore={store} />, { width: 80, height: 24, exitOnCtrlC: false });
  await draw(first); await newSheet(first); await first.mockInput.typeText("SELECT 42;"); await draw(first);
  first.mockInput.pressKey("c", { ctrl: true }); await Bun.sleep(40);
  expect(first.renderer.isDestroyed).toBe(true);
  const doc = (await store.load())!; expect(doc.sheets).toHaveLength(2);
  const second = await testRender(() => <App connect={connect} sheetStore={store} />, { width: 80, height: 24, exitOnCtrlC: false });
  try { await draw(second); expect(editor(second).plainText).toBe("SELECT 42;"); expect((await store.load())!.activeSheetId).toBe(doc.activeSheetId); }
  finally { second.renderer.destroy(); }
});

test("consulta pendiente conserva origen, permite alternar y bloquea borrar origen", async () => {
  let resolve!: (result: QueryResult) => void; const calls: string[] = [];
  const query = new Promise<QueryResult>(r => { resolve = r; });
  const store = memorySqlSheetStore();
  const view = await testRender(() => <App sheetStore={store} connect={async () => ({ ...await connect(), execute: async sql => { calls.push(sql); return query; } })} />, { width: 120, height: 40, useMouse: true, exitOnCtrlC: false });
  try {
    await draw(view); const original = editor(view).plainText;
    await view.mockInput.pressKeys(["\x1b[13;5u"]); await draw(view);
    await key(view, "o", true); expect(await draw(view)).toContain("No se puede eliminar");
    await key(view, "d", true); expect(await draw(view)).not.toContain("Eliminar hoja");
    await key(view, "n", true); await key(view, "return"); await view.mockInput.typeText("different SQL");
    resolve(sample); const frame = await draw(view);
    expect(calls).toEqual([original]); expect(frame).toContain("Hoja: Hoja 1"); expect(frame).toContain("123");
    await key(view, "o", true); await key(view, "up"); await key(view, "e", true);
    (find(view, "sheet-name") as InputRenderable).value = "Renombrada";
    await key(view, "return"); await key(view, "d", true); await click(view, "sheet-save"); await key(view, "escape");
    expect(await draw(view)).toContain("Hoja: Hoja 1"); expect(editor(view).plainText).toBe("different SQL");
  } finally { resolve(sample); view.renderer.destroy(); }
});

test("muchas hojas desplazan la selección y recuperan el nombre largo", async () => {
  const doc = initialSheets();
  for (let i = 2; i <= 35; i++) doc.sheets.push({id: `id-${i}`, name: `${i} ${"nombre extenso ".repeat(4)}`, sql: `SELECT ${i};`});
  const view = await testRender(() => <App connect={connect} sheetStore={memorySqlSheetStore(doc)} />, { width: 40, height: 20, useMouse: true, exitOnCtrlC: false });
  try {
    await draw(view); await key(view, "o", true);
    for (let i = 0; i < 34; i++) await key(view, "down");
    expect(await draw(view)).toContain("35 nombre");
    await key(view, "return"); expect(editor(view).plainText).toBe("SELECT 35;"); bounds(view, 40, 20);
  } finally { view.renderer.destroy(); }
});

test("salir espera un guardado en curso y no cierra DBHub prematuramente", async () => {
  let resolve!: () => void; const gate = new Promise<void>(r => { resolve = r; });
  let saved: SqlSheetsDocument | undefined; let closed = false;
  const view = await testRender(() => <App connect={async () => ({ ...await connect(), close: async () => { closed = true; } })} sheetStore={{load: async () => null, save: async doc => { await gate; saved = doc; }}} />, { width: 80, height: 24, exitOnCtrlC: false });
  try {
    await draw(view); await view.mockInput.typeText(" -- edit"); await draw(view);
    view.mockInput.pressKey("c", { ctrl: true }); await Bun.sleep(20);
    expect(view.renderer.isDestroyed).toBe(false); expect(closed).toBe(false);
    resolve(); await Bun.sleep(40); expect(view.renderer.isDestroyed).toBe(true); expect(closed).toBe(true);
    expect(saved!.sheets[0]!.sql).toContain("edit");
  } finally { resolve(); if (!view.renderer.isDestroyed) view.renderer.destroy(); }
});

for (const width of [120, 40]) {
  test(`salida fallida ofrece volver, reintentar y descarte explícito en ${width}`, async () => {
    let fail = true, writes = 0;
    const store: SqlSheetStore = {load: async () => null, save: async () => { writes++; if (fail) throw new Error("private"); }};
    const view = await testRender(() => <App connect={connect} sheetStore={store} />, { width, height: 24, useMouse: true, exitOnCtrlC: false });
    try {
      await draw(view); await view.mockInput.typeText("edit"); await draw(view);
      await key(view, "c", true); expect(await draw(view)).toContain("Hojas sin guardar");
      expect(view.renderer.isDestroyed).toBe(false);
      await click(view, "sheets-exit-back"); expect(editor(view).plainText).toContain("edit");
      await key(view, "c", true); await click(view, "sheets-exit-retry"); expect(view.renderer.isDestroyed).toBe(false);
      fail = false; await click(view, "sheets-exit-retry"); await Bun.sleep(25); expect(view.renderer.isDestroyed).toBe(true);
    } finally { if (!view.renderer.isDestroyed) view.renderer.destroy(); }
    fail = true;
    const discardView = await testRender(() => <App connect={connect} sheetStore={store} />, { width, height: 24, useMouse: true, exitOnCtrlC: false });
    try {
      await draw(discardView); await discardView.mockInput.typeText("discard"); await draw(discardView);
      await key(discardView, "c", true); const before = writes;
      await click(discardView, "sheets-exit-discard"); await Bun.sleep(25);
      expect(discardView.renderer.isDestroyed).toBe(true); expect(writes).toBe(before);
    } finally { if (!discardView.renderer.isDestroyed) discardView.renderer.destroy(); }
  });
}

test("Tab/Shift+Tab recorre lista, acciones y formulario sin editar el SQL", async () => {
  const view = await testRender(() => <App connect={connect} sheetStore={memorySqlSheetStore()} />, { width: 40, height: 20, useMouse: true, exitOnCtrlC: false });
  try {
    await draw(view); const original = editor(view).plainText;
    await key(view, "o", true); await key(view, "tab"); await key(view, "return");
    expect(await draw(view)).toContain("Nueva hoja SQL");
    await key(view, "tab", false, true); await key(view, "return");
    expect(editor(view).plainText).toBe("");
    await key(view, "o", true); await key(view, "tab"); await key(view, "tab"); await key(view, "return");
    expect(await draw(view)).toContain("Renombrar hoja");
    (find(view, "sheet-name") as InputRenderable).value = "Nombre nuevo";
    await key(view, "tab"); await key(view, "tab"); await key(view, "return");
    expect(await draw(view)).toContain("Nombre nuevo");
    await key(view, "escape"); await key(view, "o", true); await key(view, "up"); await key(view, "return");
    expect(editor(view).plainText).toBe(original);
  } finally { view.renderer.destroy(); }
});

test("cambiar conexión conserva todas las hojas, limpia resultados y no ejecuta SQL", async () => {
  const doc = initialSheets(); doc.sheets.push({ id: "two", name: "Otra hoja", sql: "SELECT 2;" });
  let executions = 0; const connected: (string | undefined)[] = [];
  const view = await testRender(() => <App sheetStore={memorySqlSheetStore(doc)}
    connections={{ list: async () => ({active: "uno", connections: [{name: "uno", kind: "demo"}, {name: "dos", kind: "demo"}]}), save: async () => {}, remove: async () => {} }}
    connect={async name => { connected.push(name); return {...await connect(), execute: async () => {executions++; return sample;}}; }} />, {width: 120, height: 40, useMouse: true, exitOnCtrlC: false});
  try {
    await draw(view); await view.mockInput.pressKeys(["\x1b[13;5u"]); expect(await draw(view)).toContain("Hoja: Hoja 1");
    await key(view, "o", true); await key(view, "down"); await key(view, "return");
    const second = editor(view); expect(second.plainText).toBe("SELECT 2;");
    await key(view, "k", true); await view.mockInput.typeText("dos"); await key(view, "return");
    const frame = await draw(view); expect(frame).not.toContain("Hoja: Hoja 1"); expect(frame).not.toContain("123");
    expect(editor(view)).toBe(second); expect(connected).toEqual([undefined, "dos"]); expect(executions).toBe(1);
    await key(view, "o", true); await key(view, "up"); await key(view, "return");
    expect(editor(view).plainText).toContain("users"); expect(executions).toBe(1);
  } finally { view.renderer.destroy(); }
});

test("selección y scroll propios sobreviven al cambiar de hoja", async () => {
  const doc = initialSheets(Array.from({length: 60}, (_, i) => `SELECT ${i};`).join("\n"));
  const view = await testRender(() => <App connect={connect} sheetStore={memorySqlSheetStore(doc)} />, {width: 80, height: 24, useMouse: true});
  try {
    await draw(view); const first = editor(view); first.cursorOffset = first.plainText.length;
    await draw(view); const scroll = first.scrollY;
    first.setSelection(first.plainText.length - 5, first.plainText.length);
    const selection = first.getSelection(); expect(scroll).toBeGreaterThan(0); expect(selection).not.toBeNull();
    expect(first.scrollY).toBe(scroll);
    await newSheet(view); await key(view, "o", true); await key(view, "up"); await key(view, "return");
    expect(editor(view)).toBe(first); expect(first.scrollY).toBe(scroll); expect(first.getSelection()).toEqual(selection);
  } finally { view.renderer.destroy(); }
});

test("error al cargar conserva original hasta restablecer y reintentar es accesible", async () => {
  let backups = 0, writes = 0;
  const view = await testRender(() => <App connect={connect} sheetStore={{load: async () => {throw new Error("invalid");}, save: async () => {writes++;}, backup: async () => {backups++;}}} />, { width: 40, height: 20, useMouse: true, exitOnCtrlC: false });
  try {
    await draw(view); await view.mockInput.typeText("temporary"); await draw(view);
    await key(view, "o", true); expect(await draw(view)).toContain("original"); expect(writes).toBe(0);
    await click(view, "sheets-retry"); expect(writes).toBe(0);
    await click(view, "sheets-reset"); expect(backups).toBe(1); expect(writes).toBe(1);
    expect(await draw(view)).toContain("Guardado");
    await key(view, "escape"); expect(editor(view).plainText).toContain("temporary");
  } finally { view.renderer.destroy(); }
});
