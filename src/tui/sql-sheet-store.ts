import { mkdir, open, rename, unlink, copyFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSheets, type SqlSheetsDocument } from "./sql-sheets";

export interface SqlSheetStore {
  load(): Promise<SqlSheetsDocument | null>;
  save(document: SqlSheetsDocument): Promise<void>;
  /** Preserve the unreadable original before explicitly replacing it. */
  backup?(): Promise<void>;
}
export function createSqlSheetStore(filename = fileURLToPath(new URL("../../data/workspace/sql-sheets.json", import.meta.url))): SqlSheetStore {
  return {
    async load() {
      try { return validateSheets(JSON.parse(await Bun.file(filename).text())); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    },
    async save(document) {
      await mkdir(dirname(filename), { recursive: true, mode: 0o700 });
      const temp = `${filename}.${crypto.randomUUID()}.tmp`;
      try {
        const file = await open(temp, "wx", 0o600);
        try { await file.writeFile(JSON.stringify(document, null, 2) + "\n"); await file.sync(); }
        finally { await file.close(); }
        await rename(temp, filename);
      } finally { await unlink(temp).catch(() => {}); }
    },
    async backup() {
      await copyFile(filename, `${filename}.${Date.now()}.${crypto.randomUUID()}.bak`, constants.COPYFILE_EXCL);
    },
  };
}

/** Explicitly injected in renderer tests; no user's workspace is touched. */
export function memorySqlSheetStore(initial: SqlSheetsDocument | null = null): SqlSheetStore {
  let value = initial ? structuredClone(initial) : null;
  return {
    async load() { return value ? structuredClone(value) : null; },
    async save(document) { value = structuredClone(document); },
  };
}
