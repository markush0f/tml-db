import { createSignal } from "solid-js";
import type { SqlSheetStore } from "./sql-sheet-store";

export interface SqlSheet { id: string; name: string; sql: string }
export interface SqlSheetsDocument { version: 1; activeSheetId: string; sheets: SqlSheet[] }
export function initialSheets(sql = "SELECT * FROM users LIMIT 200;"): SqlSheetsDocument {
  const sheet = { id: crypto.randomUUID(), name: "Hoja 1", sql };
  return { version: 1, activeSheetId: sheet.id, sheets: [sheet] };
}
export function sheetName(name: string, sheets: SqlSheet[], except?: string): string {
  const trimmed = name.trim();
  if (!trimmed || [...trimmed].length > 80 || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(name))
    throw new Error("Usa entre 1 y 80 caracteres, sin controles ni saltos de línea.");
  if (sheets.some(s => s.id !== except && s.name.toLowerCase() === trimmed.toLowerCase()))
    throw new Error("Ya existe una hoja con ese nombre.");
  return trimmed;
}
export function nextSheetName(sheets: SqlSheet[]) {
  let n = 1;
  while (sheets.some(s => s.name.toLowerCase() === `hoja ${n}`)) n++;
  return `Hoja ${n}`;
}
export function validateSheets(value: unknown): SqlSheetsDocument {
  if (!value || typeof value !== "object") throw new Error("Invalid sheets");
  const doc = value as SqlSheetsDocument;
  if (doc.version !== 1 || !Array.isArray(doc.sheets) || (doc.activeSheetId !== undefined && typeof doc.activeSheetId !== "string")) throw new Error("Invalid sheets");
  const sheets: SqlSheet[] = [];
  for (const item of doc.sheets) {
    if (!item || typeof item.id !== "string" || !item.id || typeof item.name !== "string" || typeof item.sql !== "string" || sheets.some(s => s.id === item.id)) throw new Error("Invalid sheet");
    sheets.push({ id: item.id, name: sheetName(item.name, sheets), sql: item.sql });
  }
  if (!sheets.length) return initialSheets("");
  return { version: 1, sheets, activeSheetId: sheets.some(s => s.id === doc.activeSheetId) ? doc.activeSheetId : sheets[0]!.id };
}

/** One write at a time. Changes during a write are coalesced into the next snapshot. */
export function createSqlSheets(store: SqlSheetStore) {
  const [document, setDocument] = createSignal(initialSheets());
  const [loading, setLoading] = createSignal(true);
  const [status, setStatus] = createSignal<"saved" | "saving" | "dirty" | "error">("saved");
  const [blocked, setBlocked] = createSignal(false);
  const [message, setMessage] = createSignal("");
  let revision = 0, saved = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writing: Promise<boolean> | undefined;
  let loadFailed = false;
  async function load() {
    setLoading(true);
    try {
      const loaded = await store.load();
      // Never replace edits made in the temporary workspace when retrying a failed load.
      if (!loadFailed || revision === 0) setDocument(loaded ? validateSheets(loaded) : initialSheets());
      setBlocked(false); setMessage("");
      setStatus(revision === saved ? "saved" : "dirty");
      loadFailed = false;
    } catch {
      loadFailed = true;
      setBlocked(true); setStatus("error");
      setMessage("No se pudieron cargar las hojas. El archivo original está protegido.");
    } finally { setLoading(false); }
  }
  async function flush(): Promise<boolean> {
    clearTimeout(timer);
    if (loading() || blocked()) return false;
    if (writing) return writing;
    writing = (async () => {
      try {
        while (saved < revision) {
          const current = revision, snapshot = document();
          setStatus("saving");
          await store.save(snapshot);
          saved = current;
        }
        setStatus("saved"); setMessage("");
        return true;
      } catch {
        setStatus("error"); setMessage("No se pudieron guardar las hojas. Tu SQL sigue en memoria.");
        return false;
      }
    })();
    try { return await writing; } finally { writing = undefined; }
  }
  function change(next: SqlSheetsDocument, immediate = true) {
    setDocument(next); revision++; setStatus(blocked() ? "error" : "dirty");
    clearTimeout(timer);
    if (immediate) void flush(); else timer = setTimeout(() => void flush(), 400);
  }
  const active = () => document().sheets.find(s => s.id === document().activeSheetId)!;
  function select(id: string) {
    if (document().sheets.some(s => s.id === id) && id !== document().activeSheetId)
      change({ ...document(), activeSheetId: id });
  }
  function create(name: string) {
    const sheet = { id: crypto.randomUUID(), name: sheetName(name, document().sheets), sql: "" };
    change({ ...document(), activeSheetId: sheet.id, sheets: [...document().sheets, sheet] });
  }
  function rename(id: string, name: string) {
    const clean = sheetName(name, document().sheets, id);
    change({ ...document(), sheets: document().sheets.map(s => s.id === id ? { ...s, name: clean } : s) });
  }
  function updateSql(id: string, sql: string) {
    if (!document().sheets.some(s => s.id === id && s.sql !== sql)) return;
    change({ ...document(), sheets: document().sheets.map(s => s.id === id ? { ...s, sql } : s) }, false);
  }
  function remove(id: string) {
    const doc = document(), index = doc.sheets.findIndex(s => s.id === id);
    if (index < 0) return;
    const sheets = doc.sheets.filter(s => s.id !== id);
    change(sheets.length ? { ...doc, sheets, activeSheetId: doc.activeSheetId === id ? sheets[Math.min(index, sheets.length - 1)]!.id : doc.activeSheetId } : initialSheets(""));
  }
  async function retry() { if (blocked()) await load(); return flush(); }
  async function reset() {
    if (!blocked() || !store.backup) return false;
    try { await store.backup(); setBlocked(false); revision++; return await flush(); }
    catch { setMessage("No se pudo conservar el original. El guardado sigue bloqueado."); return false; }
  }
  function dispose(save = true) { clearTimeout(timer); if (save) void flush(); }
  return { document, active, loading, status, blocked, message, load, flush, select, create, rename, updateSql, remove, retry, reset, dispose };
}
export type SqlSheetsController = ReturnType<typeof createSqlSheets>;
