import { For } from "solid-js";
import type { SchemaPreview } from "../demo-data";
import { fit, theme } from "../theme";

interface Props {
  readonly width: number;
  readonly connectionName: string;
  readonly schemas: readonly SchemaPreview[];
  readonly selectedTable: string;
}

export function DatabaseSidebar(props: Props) {
  const label = (text: string) => fit(text, props.width - 3);
  return (
    <box width={props.width} height="100%" flexShrink={0} border={["right"]} borderColor={theme.border} backgroundColor={theme.surface} paddingLeft={1} paddingRight={1} overflow="hidden" flexDirection="column">
      <text height={1} wrapMode="none" fg={theme.text} bg={theme.selected}>{label(props.connectionName)}</text>
      <text height={1} wrapMode="none" fg={theme.muted}>{label("Filtro (no disponible)")}</text>
      <box height={1} flexShrink={0} />
      <text height={1} wrapMode="none" fg={theme.muted}>{`Entidades · ${props.schemas.reduce((sum, schema) => sum + schema.tables.length, 0)}`}</text>
      <For each={props.schemas}>{(schema) => <>
        <text height={1} wrapMode="none" fg={theme.text}>{label(`${schema.expanded ? "v" : ">"} ${schema.name}`)}</text>
        <For each={schema.expanded ? schema.tables : []}>{(table) => (
          <text height={1} wrapMode="none" fg={table === props.selectedTable ? theme.accent : theme.muted} bg={table === props.selectedTable ? theme.selected : theme.surface}>
            {label(`  ${table === props.selectedTable ? ">" : "-"} ${table}`)}
          </text>
        )}</For>
      </>}</For>
    </box>
  );
}
