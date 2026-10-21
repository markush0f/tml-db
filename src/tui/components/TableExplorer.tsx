import { createMemo, createSignal, For, Show } from "solid-js";
import type { DatabaseTable, TableCatalog } from "../../db";
import type { ColumnState } from "../query-session";
import { fit, theme } from "../theme";

export function TableExplorer(props: {
  width: number;
  status: "idle" | "loading" | "ready" | "error";
  catalog: TableCatalog | null;
  filterFocused: boolean;
  onFilterFocus: () => void;
  columns: ColumnState;
  disabled: boolean;
  onSelectTable: (table: DatabaseTable) => void;
}) {
  const [filter, setFilter] = createSignal("");
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set());
  const label = (value: string, width = props.width) =>
    fit(value.replace(/[\x00-\x1f\x7f-\x9f]/g, "?"), width);
  const groups = createMemo(() => {
    const schemas = new Map<string, string[]>();
    for (const table of props.catalog?.tables ?? []) {
      if (!`${table.schema}.${table.name}`.toLowerCase().includes(filter().toLowerCase())) continue;
      if (!schemas.has(table.schema)) schemas.set(table.schema, []);
      schemas.get(table.schema)!.push(table.name);
    }
    return [...schemas].map(([schema, tables]) => ({ schema, tables }));
  });
  function toggle(schema: string) {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(schema)) next.delete(schema);
      else next.add(schema);
      return next;
    });
  }
  return (
    <box id="table-explorer" flexGrow={1} minHeight={0} flexDirection="column" overflow="hidden">
      <input
        id="table-filter"
        flexShrink={0}
        width="100%"
        value={filter()}
        placeholder="Filtrar…"
        focused={props.filterFocused}
        textColor={theme.text}
        placeholderColor={theme.muted}
        backgroundColor={theme.surface}
        focusedBackgroundColor={theme.selected}
        cursorColor={theme.accent}
        onInput={setFilter}
        onMouseDown={(event) => {
          if (event.button === 0) props.onFilterFocus();
        }}
      />
      <text height={1} marginTop={1} flexShrink={0} fg={theme.text} wrapMode="none">
        {label(`ENTIDADES${props.catalog ? ` · ${props.catalog.tables.length}` : ""}`)}
      </text>
      <scrollbox
        id="connection-tables"
        flexGrow={1}
        minHeight={0}
        scrollX={false}
        contentOptions={{ flexDirection: "column" }}
        scrollbarOptions={{
          trackOptions: { foregroundColor: theme.border, backgroundColor: theme.surface },
        }}
      >
        <Show
          when={props.status === "ready"}
          fallback={
            <text fg={theme.muted}>
              {props.status === "loading"
                ? "Cargando tablas…"
                : props.status === "error"
                  ? "Error al cargar. Pulsa ↻"
                  : "Sin conexión"}
            </text>
          }
        >
          <Show
            when={groups().length}
            fallback={<text fg={theme.muted}>{filter() ? "Sin coincidencias" : "Sin tablas"}</text>}
          >
            <For each={groups()}>
              {(group) => (
                <>
                  <text
                    id={`schema-${group.schema}`}
                    height={1}
                    flexShrink={0}
                    fg={theme.muted}
                    wrapMode="none"
                    selectable={false}
                    onMouseDown={(event) => {
                      if (event.button === 0) toggle(group.schema);
                    }}
                  >
                    <span style={{ fg: theme.border }}>
                      {collapsed().has(group.schema) ? "› ▪ " : "⌄ ▪ "}
                    </span>
                    {label(group.schema || "Sin esquema", props.width - 4)}
                  </text>
                  <Show when={!collapsed().has(group.schema)}>
                    <For each={group.tables}>
                      {(name) => {
                        const selected = () =>
                          props.columns.table?.schema === group.schema &&
                          props.columns.table.name === name;
                        const nameWidth = () => Math.max(4, Math.floor((props.width - 6) * 0.55));
                        const typeWidth = () => Math.max(1, props.width - 6 - nameWidth());
                        return (
                          <>
                            <text
                              id={`table-${group.schema}-${name}`}
                              height={1}
                              flexShrink={0}
                              wrapMode="none"
                              fg={selected() ? theme.accent : theme.muted}
                              bg={selected() ? theme.selected : theme.surface}
                              selectable={false}
                              onMouseDown={(event) => {
                                if (event.button === 0 && !props.disabled)
                                  props.onSelectTable({ schema: group.schema, name });
                              }}
                            >
                              <span style={{ fg: theme.border }}>{selected() ? " ⌄ " : " › "}</span>
                              <span style={{ fg: theme.accent }}>▦</span>{" "}
                              {label(name, props.width - 5)}
                            </text>
                            <Show when={selected()}>
                              <Show
                                when={props.columns.status === "ready"}
                                fallback={
                                  <text height={1} flexShrink={0} fg={theme.muted} wrapMode="none">
                                    {label(
                                      props.columns.status === "error"
                                        ? "    Error. Pulsa tabla"
                                        : "    Cargando columnas…",
                                    )}
                                  </text>
                                }
                              >
                                <Show
                                  when={props.columns.catalog?.columns.length}
                                  fallback={
                                    <text height={1} flexShrink={0} fg={theme.muted}>
                                      {label("    Sin columnas")}
                                    </text>
                                  }
                                >
                                  <For each={props.columns.catalog?.columns}>
                                    {(column) => (
                                      <box
                                        height={1}
                                        flexShrink={0}
                                        flexDirection="row"
                                        overflow="hidden"
                                      >
                                        <text width={5} fg={theme.border} selectable={false}>
                                          {"   │ "}
                                        </text>
                                        <text width={nameWidth()} fg={theme.muted} wrapMode="none">
                                          {label(column.name, nameWidth())}
                                        </text>
                                        <text
                                          width={typeWidth() + 1}
                                          fg={theme.muted}
                                          wrapMode="none"
                                        >{` ${label(column.type || "—", typeWidth())}`}</text>
                                      </box>
                                    )}
                                  </For>
                                </Show>
                                <Show when={props.columns.catalog?.truncated}>
                                  <text height={1} flexShrink={0} fg={theme.muted}>
                                    {label("    Columnas: límite 1000")}
                                  </text>
                                </Show>
                              </Show>
                            </Show>
                          </>
                        );
                      }}
                    </For>
                  </Show>
                </>
              )}
            </For>
          </Show>
        </Show>
      </scrollbox>
      <Show when={props.catalog?.truncated}>
        <text fg={theme.muted} flexShrink={0}>
          Lista parcial · límite 1000
        </text>
      </Show>
    </box>
  );
}
