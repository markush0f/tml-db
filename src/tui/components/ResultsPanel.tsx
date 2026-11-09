import { createMemo, For, Show } from "solid-js";
import { measureEditText } from "@opentui/core";
import type { QueryResult, QueryTable } from "../../db";
import { icons } from "../icons";
import { theme } from "../theme";
import { PanelHeading } from "./PanelHeading";

export interface RowSelection {
  readonly statementIndex: number;
  readonly rowIndex: number;
}
interface Props {
  readonly height: number;
  readonly width: number;
  readonly results: QueryResult | null;
  readonly message?: string;
  readonly tableName?: string;
  readonly focused: boolean;
  readonly selectedRow: RowSelection | null;
  readonly onFocus: () => void;
  readonly onSelectRow: (selection: RowSelection) => void;
}
export function safeCell(value: unknown): string {
  const text =
    value === null
      ? "NULL"
      : value === undefined
        ? ""
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
  return text.replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g, (char) =>
    char === "\n"
      ? "\\n"
      : char === "\r"
        ? "\\r"
        : char === "\t"
          ? "\\t"
          : `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}
const cellWidth = (text: string) => measureEditText(text, { widthMethod: "wcwidth" });
function fitCell(text: string, width: number) {
  if (cellWidth(text) <= width) return text + " ".repeat(width - cellWidth(text));
  let output = "";
  for (const char of text) {
    if (cellWidth(output + char) > width - 1) break;
    output += char;
  }
  return output + "…" + " ".repeat(Math.max(0, width - 1 - cellWidth(output)));
}
function tableView(table: QueryTable, availableWidth: number) {
  const columns = [" ", ...table.columns.map((column) => `${icons.column} ${safeCell(column)}`)];
  const rows = table.rows.map((row) => [icons.row, ...row.map(safeCell)]);
  const widths = columns.map((column, i) =>
    Math.min(40, Math.max(4, cellWidth(column), ...rows.map((row) => cellWidth(row[i] ?? "")))),
  );
  // Keep the row marker compact; spread unused space across the data columns.
  const naturalWidth = widths.reduce((sum, width) => sum + width + 3, 0) + 1;
  const extra = Math.max(0, availableWidth - naturalWidth);
  const dataColumns = widths.length - 1;
  if (dataColumns > 0) {
    for (let i = 1; i < widths.length; i++) {
      widths[i]! += Math.floor(extra / dataColumns) + (i <= extra % dataColumns ? 1 : 0);
    }
  }
  const rowText = (cells: readonly string[]) =>
    `│ ${widths.map((width, i) => fitCell(cells[i] ?? "", width)).join(" │ ")} │`;
  const rule = (left: string, middle: string, right: string) =>
    left + widths.map((width) => "─".repeat(width + 2)).join(middle) + right;
  return {
    columns: rowText(columns),
    rows: rows.map(rowText),
    top: rule("┌", "┬", "┐"),
    divider: rule("├", "┼", "┤"),
    bottom: rule("└", "┴", "┘"),
    width: widths.reduce((sum, width) => sum + width + 3, 0) + 1,
  };
}
export function ResultsPanel(props: Props) {
  // Panel padding takes two cells; the vertical scrollbar takes one.
  const availableWidth = () => Math.max(1, props.width - 3);
  const tables = createMemo(
    () => props.results?.statements.map((table) => tableView(table, availableWidth())) ?? [],
  );
  const contentWidth = () => Math.max(availableWidth(), ...tables().map((table) => table.width));
  const summary = () =>
    props.results
      ? ` · ${props.results.statements.reduce((sum, table) => sum + table.rows.length, 0)} filas · ${Math.round(props.results.durationMs)} ms`
      : "";
  return (
    <box
      id="results-panel"
      width={props.width}
      height={props.height}
      flexShrink={0}
      flexDirection="column"
      backgroundColor={theme.background}
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
      onMouseDown={(event) => {
        if (event.button === 0) props.onFocus();
      }}
    >
      <PanelHeading label="Resultados" icon={icons.row} focused={props.focused} width={props.width}>
        <text height={1} flexShrink={1} minWidth={0} wrapMode="none" selectable={false}>
          <span style={{ fg: theme.accent }}>
            {props.tableName ? `· ${icons.table} ${safeCell(props.tableName)}` : ""}
          </span>
          <span style={{ fg: theme.muted }}>{summary()}</span>
        </text>
      </PanelHeading>
      <Show when={props.tableName}>
        <text height={1} flexShrink={0} fg={theme.muted} wrapMode="none">
          Vista previa · hasta 200 filas
        </text>
      </Show>
      <scrollbox
        id="result-rows"
        flexGrow={1}
        minHeight={0}
        scrollX
        scrollY
        verticalScrollbarOptions={{ visible: true }}
        focused={props.focused}
        contentOptions={{ flexDirection: "column", minWidth: contentWidth() }}
        scrollbarOptions={{
          trackOptions: { foregroundColor: theme.border, backgroundColor: theme.background },
        }}
      >
        <Show when={props.message}>
          <text
            width={Math.max(1, props.width - 4)}
            height={props.results ? 1 : Math.max(1, props.height - 2)}
            paddingTop={props.results ? 0 : Math.max(0, Math.floor((props.height - 6) / 2))}
            textAlign="center"
            fg={theme.muted}
          >
            {props.message}
          </text>
        </Show>
        <Show when={props.results?.statements.length === 0}>
          <text fg={theme.muted}>Consulta completada sin resultados tabulares</text>
        </Show>
        <For each={props.results?.statements}>
          {(table, statementIndex) => (
            <box width={contentWidth()} flexShrink={0} flexDirection="column">
              <Show when={(props.results?.statements.length ?? 0) > 1}>
                <text height={1} fg={theme.accent}>{`Resultado ${statementIndex() + 1}`}</text>
              </Show>
              <Show when={table.truncated}>
                <text height={1} fg={theme.accent}>
                  Límite de 200 filas alcanzado
                </text>
              </Show>
              <Show
                when={table.rows.length > 0}
                fallback={
                  <text height={1} fg={theme.muted}>
                    {table.columns.length === 0
                      ? `Sin filas devueltas · Completada (${table.count} filas notificadas)`
                      : "Sin filas"}
                  </text>
                }
              >
                <Show when={props.height >= 7}>
                  <text
                    height={1}
                    flexShrink={0}
                    wrapMode="none"
                    fg={theme.border}
                    selectable={false}
                  >
                    {tables()[statementIndex()]!.top}
                  </text>
                </Show>
                <text
                  width={tables()[statementIndex()]!.width}
                  height={1}
                  flexShrink={0}
                  wrapMode="none"
                  fg={theme.text}
                  bg={theme.selected}
                >
                  <b>{tables()[statementIndex()]!.columns}</b>
                </text>
                <text
                  height={1}
                  flexShrink={0}
                  wrapMode="none"
                  fg={theme.border}
                  selectable={false}
                >
                  {tables()[statementIndex()]!.divider}
                </text>
                <For each={tables()[statementIndex()]!.rows}>
                  {(row, rowIndex) => (
                    <text
                      id={`result-row-${statementIndex()}-${rowIndex()}`}
                      width={tables()[statementIndex()]!.width}
                      height={1}
                      flexShrink={0}
                      wrapMode="none"
                      fg={
                        props.selectedRow?.statementIndex === statementIndex() &&
                        props.selectedRow.rowIndex === rowIndex()
                          ? theme.accent
                          : theme.text
                      }
                      bg={
                        props.selectedRow?.statementIndex === statementIndex() &&
                        props.selectedRow.rowIndex === rowIndex()
                          ? theme.selected
                          : theme.background
                      }
                      onMouseDown={(event) => {
                        if (event.button === 0)
                          props.onSelectRow({
                            statementIndex: statementIndex(),
                            rowIndex: rowIndex(),
                          });
                      }}
                    >
                      {row}
                    </text>
                  )}
                </For>
                <text
                  height={1}
                  flexShrink={0}
                  wrapMode="none"
                  fg={theme.border}
                  selectable={false}
                >
                  {tables()[statementIndex()]!.bottom}
                </text>
              </Show>
            </box>
          )}
        </For>
      </scrollbox>
    </box>
  );
}
