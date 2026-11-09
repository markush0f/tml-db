import type { DatabaseEngine } from "../db";

export type IconMode = "nerd-font" | "unicode" | "ascii";
type IconSet = Record<
  | "database"
  | "schema"
  | "table"
  | "column"
  | "row"
  | "query"
  | "assistant"
  | "search"
  | "add"
  | "edit"
  | "delete"
  | "execute"
  | "refresh"
  | "save"
  | "back"
  | "close"
  | "settings"
  | "lock"
  | "write"
  | "user"
  | "server"
  | "link"
  | "file"
  | "warning",
  string
>;

/** Glyphs verified against https://www.nerdfonts.com/cheat-sheet (glyphnames.json).
 * Use the BMP private-use range rather than supplementary Material Design glyphs.
 */
export const iconSets: Record<IconMode, Readonly<IconSet>> = {
  "nerd-font": {
    database: "", // nf-fa-database, U+F1C0
    schema: "", // nf-cod-symbol_namespace, U+EA8B
    table: "", // nf-fa-table, U+F0CE
    column: "", // nf-cod-symbol_field, U+EB5F
    row: "", // nf-cod-list_selection, U+EB85
    query: "\uF120", // nf-fa-terminal
    assistant: "\uF075", // nf-fa-comment
    search: "\uF002", // nf-fa-search
    add: "\uF067", // nf-fa-plus
    edit: "\uF040", // nf-fa-pencil
    delete: "\uF1F8", // nf-fa-trash
    execute: "\uF04B", // nf-fa-play
    refresh: "\uF021", // nf-fa-refresh
    save: "\uF0C7", // nf-fa-save
    back: "\uF060", // nf-fa-arrow_left
    close: "\uF00D", // nf-fa-times
    settings: "\uF085", // nf-fa-cogs
    lock: "\uF023", // nf-fa-lock
    write: "\uF09C", // nf-fa-unlock
    user: "\uF007", // nf-fa-user
    server: "\uF233", // nf-fa-server
    link: "\uF0C1", // nf-fa-link
    file: "\uF15B", // nf-fa-file
    warning: "\uF071", // nf-fa-warning
  },
  unicode: {
    database: "◆",
    schema: "◇",
    table: "▦",
    column: "│",
    row: "≡",
    query: "›",
    assistant: "◌",
    search: "⌕",
    add: "+",
    edit: "✎",
    delete: "×",
    execute: "▷",
    refresh: "↻",
    save: "↓",
    back: "←",
    close: "✕",
    settings: "⚙",
    lock: "▪",
    write: "▫",
    user: "○",
    server: "▤",
    link: "↔",
    file: "□",
    warning: "!",
  },
  ascii: {
    database: "DB",
    schema: "SC",
    table: "TB",
    column: "CL",
    row: "RW",
    query: "SQ",
    assistant: "AI",
    search: "SE",
    add: "AD",
    edit: "ED",
    delete: "RM",
    execute: "GO",
    refresh: "RE",
    save: "SV",
    back: "BK",
    close: "EX",
    settings: "OP",
    lock: "RO",
    write: "WR",
    user: "US",
    server: "SR",
    link: "LN",
    file: "FI",
    warning: "WN",
  },
};

// Configure once before mounting the UI; keep the shared reference stable.
export const icons: IconSet = { ...iconSets.unicode };

export function configureIcons(mode: IconMode): void {
  Object.assign(icons, iconSets[mode]);
}

export function databaseIcon(_engine?: DatabaseEngine | string): string {
  return icons.database;
}

export function parseIconMode(args: readonly string[]): IconMode {
  let mode: IconMode = "unicode";
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    let value: string | undefined;
    if (arg === "--icons") value = args[++i];
    else if (arg.startsWith("--icons=")) value = arg.slice("--icons=".length);
    else throw new Error(`Argumento desconocido: ${arg}`);
    if (value !== "nerd-font" && value !== "unicode" && value !== "ascii") {
      throw new Error("--icons requiere uno de estos valores: nerd-font, unicode, ascii");
    }
    mode = value;
  }
  return mode;
}
