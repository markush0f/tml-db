import { For } from "solid-js";
import type { ResultPreview } from "../demo-data";
import { fit, theme } from "../theme";

interface Props {
  readonly height: number;
  readonly width: number;
  readonly compact: boolean;
  readonly results: ResultPreview;
  readonly focused: boolean;
  readonly selectedRow: number | null;
  readonly onFocus: () => void;
  readonly onSelectRow: (index: number) => void;
}

export function ResultsPanel(props: Props) {
  const widths = () => props.compact ? [4, Math.max(4, props.width - 11)] : [4, 9, Math.max(4, props.width - 23)];
  const row = (cells: readonly string[]) => widths().map((width, index) => fit(cells[index] ?? "", width).padEnd(width)).join(" | ");
  return (
    <box id="results-panel" width={props.width} height={props.height} flexShrink={0} flexDirection="column" paddingLeft={1} paddingRight={1} overflow="hidden"
      onMouseDown={(event) => { if (event.button === 0) props.onFocus(); }}>
      <text height={1} flexShrink={0} wrapMode="none" selectable={false} fg={props.focused ? theme.accent : theme.text}><b>Resultados</b><span style={{ fg: theme.muted }}>{` · ${props.results.rows.length} filas de ejemplo`}</span></text>
      <text height={1} flexShrink={0} wrapMode="none" selectable={false} fg={theme.muted}>{row(props.results.columns)}</text>
      <scrollbox id="result-rows" flexGrow={1} minHeight={0} scrollX={false} focused={props.focused} contentOptions={{ flexDirection: "column" }}>
        <For each={props.results.rows}>{(cells, index) => (
          <text id={`result-row-${index()}`} height={1} flexShrink={0} wrapMode="none" fg={props.selectedRow === index() ? theme.accent : theme.text}
            bg={props.selectedRow === index() ? theme.selected : theme.surface}
            onMouseDown={(event) => { if (event.button === 0) props.onSelectRow(index()); }}>{row(cells)}</text>
        )}</For>
      </scrollbox>
    </box>
  );
}
