import { For, Show } from "solid-js";
import { measureEditText } from "@opentui/core";
import type { QueryResult, QueryTable } from "../../mcp";
import { theme } from "../theme";

export interface RowSelection { readonly statementIndex: number; readonly rowIndex: number }
interface Props {
  readonly height: number;
  readonly width: number;
  readonly results: QueryResult | null;
  readonly message?: string;
  readonly focused: boolean;
  readonly selectedRow: RowSelection | null;
  readonly onFocus: () => void;
  readonly onSelectRow: (selection: RowSelection) => void;
}
export function safeCell(value: unknown): string {
  const text = value === null ? "NULL" : value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return text.replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g, (char) => char === "\n" ? "\\n" : char === "\r" ? "\\r" : char === "\t" ? "\\t" : `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
const cellWidth = (text: string) => measureEditText(text, { widthMethod: "wcwidth" });
function fitCell(text: string, width: number) {
  if (cellWidth(text) <= width) return text + " ".repeat(width - cellWidth(text));
  let output = "";
  for (const char of text) { if (cellWidth(output + char) > width - 1) break; output += char; }
  return output + "…" + " ".repeat(Math.max(0, width - 1 - cellWidth(output)));
}
function tableView(table: QueryTable) {
  const columns = table.columns.map(safeCell);
  const rows = table.rows.map((row) => row.map(safeCell));
  const widths = columns.map((column, i) => Math.min(40, Math.max(4, cellWidth(column), ...rows.map((row) => cellWidth(row[i] ?? "")))));
  const rowText = (cells: readonly string[]) => widths.map((width, i) => fitCell(cells[i] ?? "", width)).join(" | ");
  return { columns: rowText(columns), rows: rows.map(rowText), width: widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * 3 };
}
export function ResultsPanel(props: Props) {
  const tables = () => props.results?.statements.map(tableView) ?? [];
  const contentWidth = () => Math.max(1, props.width - 4, ...tables().map((table) => table.width));
  const summary = () => props.results ? ` · ${props.results.statements.reduce((sum, table) => sum + table.rows.length, 0)} filas · ${Math.round(props.results.durationMs)} ms` : "";
  return (
    <box id="results-panel" width={props.width} height={props.height} flexShrink={0} flexDirection="column" paddingLeft={1} paddingRight={1} overflow="hidden"
      onMouseDown={(event) => { if (event.button === 0) props.onFocus(); }}>
      <text height={1} flexShrink={0} wrapMode="none" selectable={false} fg={props.focused ? theme.accent : theme.text}><b>Resultados</b><span style={{ fg: theme.muted }}>{summary()}</span></text>
      <scrollbox id="result-rows" flexGrow={1} minHeight={0} scrollX scrollY focused={props.focused} contentOptions={{ flexDirection: "column", minWidth: contentWidth() }}>
        <Show when={props.message}><text width={Math.max(1, props.width - 4)} fg={theme.muted}>{props.message}</text></Show>
        <Show when={props.results?.statements.length === 0}><text fg={theme.muted}>Consulta completada sin resultados tabulares</text></Show>
        <For each={props.results?.statements}>{(table, statementIndex) => (
          <box width={contentWidth()} flexShrink={0} flexDirection="column">
            <Show when={(props.results?.statements.length ?? 0) > 1}><text height={1} fg={theme.accent}>{`Resultado ${statementIndex() + 1}`}</text></Show>
            <Show when={table.truncated}><text height={1} fg={theme.accent}>Límite de 200 filas alcanzado</text></Show>
            <Show when={table.rows.length > 0} fallback={<text height={1} fg={theme.muted}>Sin filas</text>}>
              <text height={1} wrapMode="none" fg={theme.muted}>{tables()[statementIndex()]!.columns}</text>
              <For each={tables()[statementIndex()]!.rows}>{(row, rowIndex) => (
                <text id={`result-row-${statementIndex()}-${rowIndex()}`} height={1} flexShrink={0} wrapMode="none"
                  fg={props.selectedRow?.statementIndex === statementIndex() && props.selectedRow.rowIndex === rowIndex() ? theme.accent : theme.text}
                  bg={props.selectedRow?.statementIndex === statementIndex() && props.selectedRow.rowIndex === rowIndex() ? theme.selected : theme.surface}
                  onMouseDown={(event) => { if (event.button === 0) props.onSelectRow({ statementIndex: statementIndex(), rowIndex: rowIndex() }); }}>{row}</text>
              )}</For>
            </Show>
          </box>
        )}</For>
      </scrollbox>
    </box>
  );
}
