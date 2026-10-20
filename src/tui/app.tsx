import { createEffect, createSignal, Show } from "solid-js";
import type { MouseEvent } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { DatabaseSidebar } from "./components/DatabaseSidebar";
import { QueryPanel } from "./components/QueryPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { AssistantPanel } from "./components/AssistantPanel";
import { ResizeHandle } from "./components/ResizeHandle";
import { demoWorkspace } from "./demo-data";
import { fit, theme } from "./theme";
import { clamp, MIN_ASSISTANT_HEIGHT, MIN_QUERY_HEIGHT, MIN_RESULTS_HEIGHT, workspaceLayout, type LayoutPreferences } from "./workspace-layout";

type Focus = "query" | "results" | "assistant" | "filter" | "sidebar";
type Split = "sidebar" | "results" | "assistant";
interface Drag {
  kind: Split;
  x: number;
  y: number;
  sidebar: number;
  results: number;
  assistant: number;
}

export function App() {
  const renderer = useRenderer();
  const dimensions = useTerminalDimensions();
  const [preferences, setPreferences] = createSignal<LayoutPreferences>({});
  const [focus, setFocus] = createSignal<Focus>("query");
  const [query, setQuery] = createSignal(demoWorkspace.query);
  const [draft, setDraft] = createSignal("");
  const [filter, setFilter] = createSignal("");
  const [selectedTable, setSelectedTable] = createSignal("users");
  const [selectedRow, setSelectedRow] = createSignal<number | null>(null);
  const [collapsed, setCollapsed] = createSignal<ReadonlySet<string>>(new Set(demoWorkspace.schemas.filter((schema) => !schema.expanded).map((schema) => schema.name)));
  const [drag, setDrag] = createSignal<Drag | null>(null);
  const layout = () => workspaceLayout(dimensions().width, dimensions().height, preferences());
  const tooSmall = () => dimensions().width < 40 || dimensions().height < 20;

  function stopDrag() {
    setDrag(null);
    renderer.setMousePointer("default");
  }
  function startDrag(kind: Split, event: MouseEvent) {
    const current = layout();
    setDrag({ kind, x: event.x, y: event.y, sidebar: current.sidebarWidth, results: current.resultsHeight, assistant: current.assistantHeight });
    renderer.setMousePointer(kind === "sidebar" ? "col-resize" : "row-resize");
  }
  function moveDrag(event: MouseEvent) {
    const current = drag();
    if (!current) return;
    event.preventDefault();
    event.stopPropagation();
    if (current.kind === "sidebar") {
      setPreferences((previous) => ({ ...previous, sidebar: clamp(current.sidebar + event.x - current.x, 18, Math.max(40, dimensions().width) - 38) }));
    } else if (current.kind === "results") {
      const max = layout().bodyHeight - 2 - MIN_QUERY_HEIGHT - layout().assistantHeight;
      setPreferences((previous) => ({ ...previous, results: clamp(current.results - (event.y - current.y), MIN_RESULTS_HEIGHT, max) }));
    } else {
      // Move the lower divider without moving the editor/results divider.
      const assistant = clamp(current.assistant - (event.y - current.y), MIN_ASSISTANT_HEIGHT, current.assistant + current.results - MIN_RESULTS_HEIGHT);
      setPreferences((previous) => ({ ...previous, assistant, results: current.results + current.assistant - assistant }));
    }
  }

  // A terminal resize ends pointer capture and never drops edited text.
  createEffect(() => {
    dimensions();
    stopDrag();
  });
  createEffect(() => {
    if (layout().compact && (focus() === "filter" || focus() === "sidebar")) setFocus("query");
  });

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      renderer.destroy();
    } else if (key.name === "escape") {
      key.preventDefault();
      stopDrag();
      setFocus("query");
    } else if (key.name === "tab") {
      key.preventDefault();
      const order: Focus[] = layout().compact ? ["query", "results", "assistant"] : ["query", "results", "assistant", "filter", "sidebar"];
      const index = order.indexOf(focus());
      setFocus(order[(index + (key.shift ? -1 : 1) + order.length) % order.length]!);
    }
  });

  return (
    <box width="100%" height="100%" backgroundColor={theme.background} flexDirection="column" overflow="hidden"
      onMouseDrag={moveDrag} onMouseDragEnd={(event) => { moveDrag(event); stopDrag(); }} onMouseUp={() => { if (drag()) stopDrag(); }}>
      <Show when={tooSmall()}>
        <box flexDirection="column" padding={1} overflow="hidden">
          <text wrapMode="none" fg={theme.accent}>Terminal pequeña</text>
          <text wrapMode="none" fg={theme.text}>Mínimo: 40×20</text>
          <text wrapMode="none" fg={theme.muted}>Ctrl+C: salir</text>
          <text wrapMode="none" fg={theme.accent} selectable={false} onMouseDown={(event) => { if (event.button === 0) renderer.destroy(); }}>[Salir]</text>
        </box>
      </Show>
      <box visible={!tooSmall()} width="100%" height="100%" border borderStyle="rounded" borderColor={theme.border} flexDirection="column" overflow="hidden">
        <box height={1} flexShrink={0} flexDirection="row" justifyContent="space-between">
          <text height={1} wrapMode="none" fg={theme.accent} selectable={false}>{` ${layout().compact ? demoWorkspace.connectionName : "tml-db"} · DEMO`}</text>
          <text id="exit-button" height={1} width={8} fg={theme.muted} selectable={false}
            onMouseDown={(event) => { if (event.button === 0) renderer.destroy(); }}>[Salir]</text>
        </box>
        <box height={layout().bodyHeight} flexShrink={0} flexDirection="row" overflow="hidden">
          <Show when={!layout().compact}>
            <DatabaseSidebar width={layout().sidebarWidth - 1} connectionName={demoWorkspace.connectionName} schemas={demoWorkspace.schemas} selectedTable={selectedTable()}
              collapsed={collapsed()} filter={filter()} focused={!tooSmall() && focus() === "sidebar"} filterFocused={!tooSmall() && focus() === "filter"}
              onFocus={() => setFocus("sidebar")} onFilterFocus={() => setFocus("filter")} onFilter={setFilter} onSelect={setSelectedTable}
              onToggle={(name) => setCollapsed((previous) => { const next = new Set(previous); if (next.has(name)) next.delete(name); else next.add(name); return next; })} />
            <ResizeHandle id="sidebar-resizer" vertical length={layout().bodyHeight} active={drag()?.kind === "sidebar"} onStart={(event) => startDrag("sidebar", event)} />
          </Show>
          <box width={layout().mainWidth} height="100%" backgroundColor={theme.surface} flexDirection="column" overflow="hidden">
            <QueryPanel height={layout().queryHeight} query={query()} focused={!tooSmall() && focus() === "query"} onFocus={() => setFocus("query")} onChange={setQuery} />
            <ResizeHandle id="results-resizer" length={layout().mainWidth} active={drag()?.kind === "results"} onStart={(event) => startDrag("results", event)} />
            <ResultsPanel height={layout().resultsHeight} width={layout().mainWidth} compact={layout().mainWidth < 56} results={demoWorkspace.results}
              focused={!tooSmall() && focus() === "results"} selectedRow={selectedRow()} onFocus={() => setFocus("results")} onSelectRow={setSelectedRow} />
            <ResizeHandle id="assistant-resizer" length={layout().mainWidth} active={drag()?.kind === "assistant"} onStart={(event) => startDrag("assistant", event)} />
            <AssistantPanel height={layout().assistantHeight} width={layout().mainWidth} message={demoWorkspace.assistantMessage} draft={draft()}
              focused={!tooSmall() && focus() === "assistant"} onFocus={() => setFocus("assistant")} onChange={setDraft} />
          </box>
        </box>
        <text height={1} flexShrink={0} wrapMode="none" fg={theme.muted} selectable={false}>{fit(dimensions().width < 100 ? " Arrastra bordes · Tab · Ctrl+C: salir" : " Datos ficticios · Sin conexión · Arrastra bordes para ajustar · Tab: foco · Ctrl+C: salir", dimensions().width - 2)}</text>
      </box>
      <Show when={drag()}>
        <box id="resize-capture" position="absolute" left={0} top={0} width="100%" height="100%" zIndex={100} shouldFill={false}
          onMouseDrag={moveDrag} onMouseDragEnd={(event) => { moveDrag(event); stopDrag(); }}
          onMouseUp={(event) => { moveDrag(event); stopDrag(); }} />
      </Show>
    </box>
  );
}
