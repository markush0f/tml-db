import { For, Match, Switch } from "solid-js";
import { createStore } from "solid-js/store";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";

const colors = {
  background: "#000000",
  surface: "#111111",
  text: "#f5f5f5",
  muted: "#b8b8b8",
  accent: "#ffdf00",
};
const sections = ["Inicio", "Actividad", "Ayuda"];

export function App() {
  const renderer = useRenderer();
  const dimensions = useTerminalDimensions();
  const [state, setState] = createStore({
    section: 0,
    count: 0,
    actions: [] as string[],
  });

  function record(message: string) {
    setState("actions", (actions) => [message, ...actions].slice(0, 5));
  }

  useKeyboard((key) => {
    if ((key.ctrl && key.name === "c") || key.name === "q") {
      renderer.destroy();
      return;
    }
    if (key.name === "tab" || key.name === "right" || key.name === "left") {
      const step = key.shift || key.name === "left" ? -1 : 1;
      setState("section", (section) => (section + step + sections.length) % sections.length);
    }
    if (key.name === "space" || key.name === " " || key.name === "+" || key.name === "=") {
      setState("count", (count) => count + 1);
      record(`Contador incrementado a ${state.count}`);
    }
    if (key.name === "r") {
      setState("count", 0);
      record("Contador reiniciado");
    }
  });

  return (
    <box width="100%" height="100%" backgroundColor={colors.background} padding={1} flexDirection="column" gap={1}>
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <text fg={colors.accent}><b>tml-db</b></text>
        <text fg={colors.muted}>Demo local</text>
      </box>
      <box flexDirection="row" gap={2} flexShrink={0}>
        <For each={sections}>{(section, index) => (
          <text fg={state.section === index() ? colors.accent : colors.muted}>
            {state.section === index() ? `[${section}]` : ` ${section} `}
          </text>
        )}</For>
      </box>
      <scrollbox flexGrow={1} backgroundColor={colors.surface} padding={1}>
        <Switch>
          <Match when={state.section === 0}>
            <box flexDirection="column" gap={1}>
              <text fg={colors.text}><b>Tu primera interfaz de terminal</b></text>
              <text fg={colors.muted}>OpenTUI + SolidJS. Sin servicios externos.</text>
              <text fg={colors.accent}>{`Contador: ${state.count}`}</text>
              <text fg={colors.text}>Pulsa Espacio para incrementar o R para reiniciar.</text>
              <text fg={colors.muted}>Abre Actividad para ver tus últimas acciones.</text>
            </box>
          </Match>
          <Match when={state.section === 1}>
            <box flexDirection="column" gap={1}>
              <text fg={colors.text}><b>Últimas acciones</b></text>
              <For each={state.actions} fallback={<text fg={colors.muted}>Todavía no hay acciones. Pulsa Espacio para empezar.</text>}>
                {(action) => <text fg={colors.text}>{action}</text>}
              </For>
            </box>
          </Match>
          <Match when={state.section === 2}>
            <box flexDirection="column" gap={1}>
              <text fg={colors.text}><b>Atajos de teclado</b></text>
              <text fg={colors.text}>{"Tab / flechas   Cambiar sección\nEspacio / +     Incrementar contador\nR               Reiniciar contador\nQ / Ctrl+C      Salir"}</text>
              <text fg={colors.muted}>Estado temporal: se pierde al cerrar la aplicación.</text>
            </box>
          </Match>
        </Switch>
      </scrollbox>
      <text fg={colors.muted} flexShrink={0}>
        {dimensions().width < 60 ? "Tab: menú | Espacio: +1 | Q: salir" : "Tab / flechas: menú   Espacio: +1   R: reiniciar   Q: salir"}
      </text>
    </box>
  );
}
