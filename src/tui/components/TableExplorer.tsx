import { createMemo, For, Show } from "solid-js";
import type { TableCatalog } from "../../db";
import { fit, theme } from "../theme";

export function TableExplorer(props: {
  width: number;
  status: "idle" | "loading" | "ready" | "error";
  catalog: TableCatalog | null;
  disabled: boolean;
  onRefresh: () => void;
}) {
  const label = (value: string) => fit(value.replace(/[\x00-\x1f\x7f-\x9f]/g, "?"), props.width);
  const groups = createMemo(() => {
    const schemas = new Map<string, string[]>();
    for (const table of props.catalog?.tables ?? []) {
      if (!schemas.has(table.schema)) schemas.set(table.schema, []);
      schemas.get(table.schema)!.push(table.name);
    }
    return [...schemas].map(([schema, tables]) => ({ schema, tables }));
  });
  return (
    <box
      id="table-explorer"
      flexGrow={1}
      minHeight={0}
      flexDirection="column"
      marginTop={1}
      overflow="hidden"
    >
      <text height={1} flexShrink={0} fg={theme.text} wrapMode="none">
        {label(`Tablas${props.catalog ? ` · ${props.catalog.tables.length}` : ""}`)}
      </text>
      <scrollbox
        id="connection-tables"
        flexGrow={1}
        minHeight={0}
        scrollX={false}
        contentOptions={{ flexDirection: "column" }}
        scrollbarOptions={{
          trackOptions: { foregroundColor: theme.border, backgroundColor: theme.background },
        }}
      >
        <Show
          when={props.status === "ready"}
          fallback={
            <text fg={theme.muted}>
              {props.status === "loading"
                ? "Cargando tablas…"
                : props.status === "error"
                  ? "No se pudieron cargar las tablas"
                  : "Sin conexión"}
            </text>
          }
        >
          <Show when={groups().length} fallback={<text fg={theme.muted}>Sin tablas</text>}>
            <For each={groups()}>
              {(group) => (
                <>
                  <text height={1} flexShrink={0} fg={theme.text} wrapMode="none">
                    {label(group.schema || "Sin esquema")}
                  </text>
                  <For each={group.tables}>
                    {(name) => (
                      <text height={1} flexShrink={0} wrapMode="none" fg={theme.muted}>
                        {label(`  ${name}`)}
                      </text>
                    )}
                  </For>
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
      <text
        id="refresh-tables"
        height={1}
        flexShrink={0}
        fg={props.disabled ? theme.muted : theme.accent}
        wrapMode="none"
        selectable={false}
        onMouseDown={(event) => {
          if (event.button === 0 && !props.disabled) props.onRefresh();
        }}
      >
        {label("[Actualizar]")}
      </text>
    </box>
  );
}
