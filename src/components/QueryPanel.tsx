import { For } from "solid-js";
import { theme } from "../theme";

interface Props {
  readonly height: number;
  readonly query: string;
}

export function QueryPanel(props: Props) {
  const lines = () => props.query.split("\n");
  return (
    <box height={props.height} flexShrink={0} flexDirection="column" overflow="hidden" paddingLeft={1} paddingRight={1}>
      <text height={1} fg={theme.text}><b>Consultas</b></text>
      <For each={Array.from({ length: Math.max(0, props.height - 1) }, (_, i) => i)}>{(index) => {
        const line = () => lines()[index] ?? "";
        const keyword = () => line().match(/^(SELECT|FROM|LIMIT)\b/)?.[0] ?? "";
        return (
          <box height={1} flexShrink={0} flexDirection="row" overflow="hidden">
            <text width={4} height={1} fg={theme.muted}>{String(index + 1).padStart(2, " ") + "  "}</text>
            <text height={1} flexGrow={1} minWidth={0} wrapMode="none" truncate fg={theme.text}>
              <span style={{ fg: theme.accent }}>{keyword()}</span>{line().slice(keyword().length)}
            </text>
          </box>
        );
      }}</For>
    </box>
  );
}
