import { For } from "solid-js";
import type { ResultPreview } from "../demo-data";
import { fit, theme } from "../theme";

interface Props {
  readonly height: number;
  readonly width: number;
  readonly compact: boolean;
  readonly results: ResultPreview;
}

export function ResultsPanel(props: Props) {
  const widths = () => props.compact ? [4, Math.max(4, props.width - 11)] : [4, 9, Math.max(4, props.width - 23)];
  const row = (cells: readonly string[]) => widths().map((width, index) => fit(cells[index] ?? "", width).padEnd(width)).join(" | ");
  return (
    <box height={props.height} flexShrink={0} border={["top"]} borderColor={theme.border} flexDirection="column" paddingLeft={1} paddingRight={1} overflow="hidden">
      <text height={1} wrapMode="none" fg={theme.text}><b>Resultados</b><span style={{ fg: theme.muted }}>{` · ${props.results.rows.length} filas de ejemplo`}</span></text>
      <text height={1} wrapMode="none" fg={theme.muted}>{row(props.results.columns)}</text>
      <For each={props.results.rows}>{(cells) => <text height={1} wrapMode="none" fg={theme.text}>{row(cells)}</text>}</For>
    </box>
  );
}
