import { Show } from "solid-js";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { DatabaseSidebar } from "./components/DatabaseSidebar";
import { QueryPanel } from "./components/QueryPanel";
import { ResultsPanel } from "./components/ResultsPanel";
import { AssistantPanel } from "./components/AssistantPanel";
import { demoWorkspace } from "./demo-data";
import { fit, theme } from "./theme";

export function App() {
  const renderer = useRenderer();
  const dimensions = useTerminalDimensions();
  const compact = () => dimensions().width < 80;
  const tooSmall = () => dimensions().width < 40 || dimensions().height < 20;
  const sidebarWidth = () => compact() ? 0 : dimensions().width >= 100 ? 26 : 22;
  const mainWidth = () => dimensions().width - 2 - sidebarWidth();
  const bodyHeight = () => dimensions().height - 4;
  const resultsHeight = () => Math.max(6, Math.floor(bodyHeight() * 0.25));
  const assistantHeight = () => Math.max(4, Math.floor(bodyHeight() * 0.15));
  const queryHeight = () => bodyHeight() - resultsHeight() - assistantHeight();

  useKeyboard((key) => {
    if (key.name === "q" || (key.ctrl && key.name === "c")) renderer.destroy();
  });

  return (
    <box width="100%" height="100%" backgroundColor={theme.background} flexDirection="column" overflow="hidden">
      <Show when={!tooSmall()} fallback={
        <box flexDirection="column" padding={1} overflow="hidden">
          <text wrapMode="none" fg={theme.accent}>Terminal pequeña</text>
          <text wrapMode="none" fg={theme.text}>Mínimo: 40×20</text>
          <text wrapMode="none" fg={theme.muted}>Q / Ctrl+C: salir</text>
        </box>
      }>
        <box width="100%" height="100%" border borderStyle="rounded" borderColor={theme.border} flexDirection="column" overflow="hidden">
          <text height={1} flexShrink={0} wrapMode="none" fg={theme.accent}>{` ${compact() ? demoWorkspace.connectionName : "tml-db"} · DEMO`}</text>
          <box height={bodyHeight()} flexShrink={0} flexDirection="row" overflow="hidden">
            <Show when={!compact()}>
              <DatabaseSidebar width={sidebarWidth()} connectionName={demoWorkspace.connectionName} schemas={demoWorkspace.schemas} selectedTable="users" />
            </Show>
            <box width={mainWidth()} height="100%" backgroundColor={theme.surface} flexDirection="column" overflow="hidden">
              <QueryPanel height={queryHeight()} query={demoWorkspace.query} />
              <ResultsPanel height={resultsHeight()} width={mainWidth()} compact={compact()} results={demoWorkspace.results} />
              <AssistantPanel height={assistantHeight()} width={mainWidth()} message={demoWorkspace.assistantMessage} />
            </box>
          </box>
          <text height={1} flexShrink={0} wrapMode="none" fg={theme.muted}>{fit(compact() ? " Datos ficticios·Sin conexión·Q: salir" : " Datos ficticios · Sin conexión · Q: salir", dimensions().width - 2)}</text>
        </box>
      </Show>
    </box>
  );
}
