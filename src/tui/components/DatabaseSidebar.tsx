import { For, Show } from "solid-js";
import type { SchemaPreview } from "../demo-data";
import { fit, theme } from "../theme";

interface Props {
  readonly width: number;
  readonly connectionName: string;
  readonly schemas: readonly SchemaPreview[];
  readonly selectedTable: string;
  readonly collapsed: ReadonlySet<string>;
  readonly filter: string;
  readonly focused: boolean;
  readonly filterFocused: boolean;
  readonly onFocus: () => void;
  readonly onFilterFocus: () => void;
  readonly onFilter: (value: string) => void;
  readonly onToggle: (schema: string) => void;
  readonly onSelect: (table: string) => void;
}

export function DatabaseSidebar(props: Props) {
  const label = (text: string) => fit(text, props.width - 2);
  const tables = (schema: SchemaPreview) =>
    schema.tables.filter((table) => table.toLowerCase().includes(props.filter.toLowerCase()));
  return (
    <box
      id="database-sidebar"
      width={props.width}
      height="100%"
      flexShrink={0}
      backgroundColor={theme.surface}
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
      flexDirection="column"
    >
      <text
        height={1}
        flexShrink={0}
        wrapMode="none"
        fg={theme.text}
        bg={theme.selected}
        selectable={false}
      >
        {label(props.connectionName)}
      </text>
      <input
        id="table-filter"
        flexShrink={0}
        width="100%"
        value={props.filter}
        placeholder="Filtrar tablas…"
        focused={props.filterFocused}
        textColor={theme.text}
        placeholderColor={theme.muted}
        backgroundColor={theme.surface}
        focusedBackgroundColor={theme.selected}
        cursorColor={theme.accent}
        onInput={props.onFilter}
        onMouseDown={(event) => {
          if (event.button === 0) props.onFilterFocus();
        }}
      />
      <text
        height={1}
        flexShrink={0}
        wrapMode="none"
        selectable={false}
        fg={props.focused || props.filterFocused ? theme.accent : theme.muted}
      >
        {`Entidades · ${props.schemas.reduce((sum, schema) => sum + tables(schema).length, 0)}`}
      </text>
      <scrollbox
        id="schema-tree"
        flexGrow={1}
        minHeight={0}
        scrollX={false}
        focused={props.focused}
        contentOptions={{ flexDirection: "column" }}
        onMouseDown={(event) => {
          if (event.button === 0) props.onFocus();
        }}
        scrollbarOptions={{
          trackOptions: { foregroundColor: theme.border, backgroundColor: theme.surface },
        }}
      >
        <Show
          when={!props.filter || props.schemas.some((schema) => tables(schema).length)}
          fallback={
            <text height={1} fg={theme.muted}>
              Sin coincidencias
            </text>
          }
        >
          <For each={props.schemas.filter((schema) => !props.filter || tables(schema).length > 0)}>
            {(schema) => (
              <>
                <text
                  id={`schema-${schema.name}`}
                  height={1}
                  flexShrink={0}
                  wrapMode="none"
                  fg={theme.text}
                  selectable={false}
                  onMouseDown={(event) => {
                    if (event.button === 0) {
                      props.onFocus();
                      props.onToggle(schema.name);
                    }
                  }}
                >
                  {label(`${props.collapsed.has(schema.name) ? ">" : "v"} ${schema.name}`)}
                </text>
                <Show when={!props.collapsed.has(schema.name)}>
                  <For each={tables(schema)}>
                    {(table) => (
                      <text
                        id={`table-${schema.name}-${table}`}
                        height={1}
                        flexShrink={0}
                        wrapMode="none"
                        selectable={false}
                        fg={table === props.selectedTable ? theme.accent : theme.muted}
                        bg={table === props.selectedTable ? theme.selected : theme.surface}
                        onMouseDown={(event) => {
                          if (event.button === 0) {
                            props.onFocus();
                            props.onSelect(table);
                          }
                        }}
                      >
                        {label(`  ${table === props.selectedTable ? ">" : "-"} ${table}`)}
                      </text>
                    )}
                  </For>
                </Show>
              </>
            )}
          </For>
        </Show>
      </scrollbox>
    </box>
  );
}
