import { createEffect, createSignal, Show, onMount, onCleanup } from "solid-js";
import type { MouseEvent } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { connectQuerySession } from "../db";
import { createConnectionManager, type ConnectionManager } from "../db/connection-manager";
import { ConnectionPicker } from "./components/ConnectionPicker";
import { TableExplorer } from "./components/TableExplorer";
import { createQueryController, type SessionFactory } from "./query-session";
import { QueryPanel } from "./components/QueryPanel";
import { ResultsPanel, type RowSelection } from "./components/ResultsPanel";
import { AssistantPanel } from "./components/AssistantPanel";
import { ResizeHandle } from "./components/ResizeHandle";
import { demoWorkspace } from "./demo-data";
import { fit, theme } from "./theme";
import {
  clamp,
  MIN_ASSISTANT_HEIGHT,
  MIN_QUERY_HEIGHT,
  MIN_RESULTS_HEIGHT,
  workspaceLayout,
  type LayoutPreferences,
} from "./workspace-layout";

type Focus = "query" | "results" | "assistant";
type Split = "sidebar" | "results" | "assistant";
interface Drag {
  kind: Split;
  x: number;
  y: number;
  sidebar: number;
  results: number;
  assistant: number;
}

export function App(props: { connect?: SessionFactory; connections?: ConnectionManager } = {}) {
  const renderer = useRenderer();
  const dimensions = useTerminalDimensions();
  const [preferences, setPreferences] = createSignal<LayoutPreferences>({});
  const [focus, setFocus] = createSignal<Focus>("query");
  const manager = props.connections ?? createConnectionManager();
  const [picker, setPicker] = createSignal(false);
  const [activeConnection, setActiveConnection] = createSignal("");
  const controller = createQueryController(
    props.connect ?? ((name) => connectQuerySession({ connectionName: name })),
  );
  const canChangeConnection = () =>
    !tooSmall() &&
    state().connection !== "connecting" &&
    state().connection !== "closed" &&
    state().query !== "running";
  function openConnections() {
    if (!canChangeConnection()) return;
    stopDrag();
    setPicker(true);
  }
  function selectConnection(name: string) {
    if (!canChangeConnection()) return;
    setPicker(false);
    setSelectedRow(null);
    setActiveConnection(name);
    void controller.switchConnection(name);
  }
  const state = controller.state;
  const [query, setQuery] = createSignal("SELECT * FROM users LIMIT 200;");
  const [draft, setDraft] = createSignal("");
  const [selectedRow, setSelectedRow] = createSignal<RowSelection | null>(null);
  const [drag, setDrag] = createSignal<Drag | null>(null);
  const layout = () => workspaceLayout(dimensions().width, dimensions().height, preferences());
  const tooSmall = () => dimensions().width < 40 || dimensions().height < 20;

  const actionDisabled = () =>
    tooSmall() ||
    state().connection === "connecting" ||
    state().connection === "closed" ||
    state().query === "running" ||
    (state().connection === "ready" && !query().trim());
  const connectionLabel = () =>
    ({
      connecting: "Conectando…",
      ready: "Conectado · Solo lectura",
      error: "Sin conexión",
      closed: "Cerrando…",
    })[state().connection];
  const resultMessage = () =>
    state().message ||
    (state().connection === "connecting"
      ? "Conectando…"
      : state().query === "running"
        ? "Ejecutando…"
        : state().query === "idle"
          ? "Ejecuta una consulta para ver resultados"
          : "");
  function execute() {
    if (actionDisabled()) return;
    setSelectedRow(null);
    if (state().connection === "error") void controller.reconnect();
    else void controller.execute(query());
  }
  async function exit() {
    await controller.close();
    renderer.destroy();
  }
  const destroyed = () => {
    void controller.close();
  };
  onMount(() => {
    renderer.on("destroy", destroyed);
    void (async () => {
      try {
        const list = await manager.list();
        setActiveConnection(list.active);
      } catch {
        /* The selector provides a safe catalog error. */
      }
      await controller.reconnect();
    })();
  });
  onCleanup(() => {
    renderer.off("destroy", destroyed);
    void controller.close();
  });

  function stopDrag() {
    setDrag(null);
    renderer.setMousePointer("default");
  }
  function startDrag(kind: Split, event: MouseEvent) {
    const current = layout();
    setDrag({
      kind,
      x: event.x,
      y: event.y,
      sidebar: current.sidebarWidth,
      results: current.resultsHeight,
      assistant: current.assistantHeight,
    });
    renderer.setMousePointer(kind === "sidebar" ? "col-resize" : "row-resize");
  }
  function moveDrag(event: MouseEvent) {
    const current = drag();
    if (!current) return;
    event.preventDefault();
    event.stopPropagation();
    if (current.kind === "sidebar") {
      setPreferences((previous) => ({
        ...previous,
        sidebar: clamp(
          current.sidebar + event.x - current.x,
          18,
          Math.max(40, dimensions().width) - 38,
        ),
      }));
    } else if (current.kind === "results") {
      const max = layout().bodyHeight - 2 - MIN_QUERY_HEIGHT - layout().assistantHeight;
      setPreferences((previous) => ({
        ...previous,
        results: clamp(current.results - (event.y - current.y), MIN_RESULTS_HEIGHT, max),
      }));
    } else {
      // Move the lower divider without moving the editor/results divider.
      const assistant = clamp(
        current.assistant - (event.y - current.y),
        MIN_ASSISTANT_HEIGHT,
        current.assistant + current.results - MIN_RESULTS_HEIGHT,
      );
      setPreferences((previous) => ({
        ...previous,
        assistant,
        results: current.results + current.assistant - assistant,
      }));
    }
  }

  // A terminal resize ends pointer capture and never drops edited text.
  createEffect(() => {
    dimensions();
    stopDrag();
  });

  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      void exit();
    } else if (picker()) {
      return;
    } else if (key.ctrl && key.name === "k") {
      key.preventDefault();
      openConnections();
    } else if (key.ctrl && (key.name === "return" || key.name === "enter")) {
      key.preventDefault();
      execute();
    } else if (key.name === "escape") {
      key.preventDefault();
      stopDrag();
      setFocus("query");
    } else if (key.name === "tab") {
      key.preventDefault();
      const order: Focus[] = ["query", "results", "assistant"];
      const index = order.indexOf(focus());
      setFocus(order[(index + (key.shift ? -1 : 1) + order.length) % order.length]!);
    }
  });

  return (
    <box
      width="100%"
      height="100%"
      backgroundColor={theme.background}
      flexDirection="column"
      overflow="hidden"
      onMouseDrag={moveDrag}
      onMouseDragEnd={(event) => {
        moveDrag(event);
        stopDrag();
      }}
      onMouseUp={() => {
        if (drag()) stopDrag();
      }}
    >
      <Show when={tooSmall()}>
        <box flexDirection="column" padding={1} overflow="hidden">
          <text wrapMode="none" fg={theme.accent}>
            Terminal pequeña
          </text>
          <text wrapMode="none" fg={theme.text}>
            Mínimo: 40×20
          </text>
          <text wrapMode="none" fg={theme.muted}>
            Ctrl+C: salir
          </text>
          <text
            wrapMode="none"
            fg={theme.accent}
            selectable={false}
            onMouseDown={(event) => {
              if (event.button === 0) void exit();
            }}
          >
            [Salir]
          </text>
        </box>
      </Show>
      <box
        visible={!tooSmall()}
        width="100%"
        height="100%"
        border
        borderStyle="rounded"
        borderColor={theme.border}
        flexDirection="column"
        overflow="hidden"
      >
        <box height={1} flexShrink={0} flexDirection="row" justifyContent="space-between">
          <text
            height={1}
            width={dimensions().width - 10}
            wrapMode="none"
            fg={theme.accent}
            selectable={false}
            id="connection-header"
            onMouseDown={(event) => {
              if (event.button === 0) openConnections();
            }}
          >
            {fit(
              ` DBHub local${layout().compact ? ` [${activeConnection() || "Conexiones"} v]` : ` · ${activeConnection()}`} · ${connectionLabel()}`,
              dimensions().width - 10,
            )}
          </text>
          <text
            id="exit-button"
            height={1}
            width={8}
            flexShrink={0}
            fg={theme.muted}
            selectable={false}
            onMouseDown={(event) => {
              if (event.button === 0) void exit();
            }}
          >
            [Salir]
          </text>
        </box>
        <box height={layout().bodyHeight} flexShrink={0} flexDirection="row" overflow="hidden">
          <Show when={!layout().compact}>
            <box
              id="database-sidebar"
              width={layout().sidebarWidth - 1}
              height="100%"
              padding={1}
              flexDirection="column"
            >
              <text fg={theme.muted} height={1}>
                Conexión · Ctrl+K
              </text>
              <text
                id="connection-sidebar"
                fg={canChangeConnection() ? theme.accent : theme.muted}
                height={1}
                selectable={false}
                wrapMode="none"
                onMouseDown={(event) => {
                  if (event.button === 0) openConnections();
                }}
              >
                {fit(`[${activeConnection() || "Conexiones"} v]`, layout().sidebarWidth - 3)}
              </text>
              <TableExplorer
                width={layout().sidebarWidth - 3}
                status={
                  state().connection === "connecting" ? "loading" : controller.tables().status
                }
                catalog={controller.tables().catalog}
                disabled={
                  state().connection !== "ready" ||
                  state().query === "running" ||
                  controller.tables().status === "loading"
                }
                onRefresh={() => void controller.refreshTables()}
              />
            </box>
            <ResizeHandle
              id="sidebar-resizer"
              vertical
              length={layout().bodyHeight}
              active={drag()?.kind === "sidebar"}
              onStart={(event) => startDrag("sidebar", event)}
            />
          </Show>
          <box
            width={layout().mainWidth}
            height="100%"
            backgroundColor={theme.surface}
            flexDirection="column"
            overflow="hidden"
          >
            <QueryPanel
              height={layout().queryHeight}
              query={query()}
              focused={!tooSmall() && !picker() && focus() === "query"}
              onFocus={() => setFocus("query")}
              onChange={setQuery}
              actionLabel={
                state().connection === "error"
                  ? "Reconectar"
                  : state().query === "running"
                    ? "Ejecutando…"
                    : "Ejecutar"
              }
              actionDisabled={actionDisabled()}
              onExecute={execute}
            />
            <ResizeHandle
              id="results-resizer"
              length={layout().mainWidth}
              active={drag()?.kind === "results"}
              onStart={(event) => startDrag("results", event)}
            />
            <ResultsPanel
              height={layout().resultsHeight}
              width={layout().mainWidth}
              results={state().result}
              message={resultMessage()}
              focused={!tooSmall() && !picker() && focus() === "results"}
              selectedRow={selectedRow()}
              onFocus={() => setFocus("results")}
              onSelectRow={setSelectedRow}
            />
            <ResizeHandle
              id="assistant-resizer"
              length={layout().mainWidth}
              active={drag()?.kind === "assistant"}
              onStart={(event) => startDrag("assistant", event)}
            />
            <AssistantPanel
              height={layout().assistantHeight}
              width={layout().mainWidth}
              message={demoWorkspace.assistantMessage}
              draft={draft()}
              focused={!tooSmall() && !picker() && focus() === "assistant"}
              onFocus={() => setFocus("assistant")}
              onChange={setDraft}
            />
          </box>
        </box>
        <text height={1} flexShrink={0} wrapMode="none" fg={theme.muted} selectable={false}>
          {fit(
            dimensions().width < 80
              ? " Ctrl+K: conexiones · Ctrl+C: salir"
              : " Ctrl+Enter: ejecutar · Ctrl+K: conexiones · Tab: foco · Ctrl+C: salir",
            dimensions().width - 2,
          )}
        </text>
      </box>
      <Show when={picker() && !tooSmall()}>
        <ConnectionPicker
          manager={manager}
          active={activeConnection()}
          width={dimensions().width}
          height={dimensions().height}
          onSelect={selectConnection}
          onClose={() => {
            setPicker(false);
            setFocus("query");
          }}
        />
      </Show>
      <Show when={drag()}>
        <box
          id="resize-capture"
          position="absolute"
          left={0}
          top={0}
          width="100%"
          height="100%"
          zIndex={100}
          shouldFill={false}
          onMouseDrag={moveDrag}
          onMouseDragEnd={(event) => {
            moveDrag(event);
            stopDrag();
          }}
          onMouseUp={(event) => {
            moveDrag(event);
            stopDrag();
          }}
        />
      </Show>
    </box>
  );
}
