import { createSignal, For, Show, createEffect } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { ScrollBoxRenderable } from "@opentui/core";
import { nextSheetName, type SqlSheetsController } from "../sql-sheets";
import { theme, fit } from "../theme";
import { icons } from "../icons";
import { MenuFrame, MenuButton, MenuOption } from "./MenuPrimitives";
import { WorkspaceButton } from "./WorkspaceButton";

export function SqlSheetPicker(props: {
  sheets: SqlSheetsController; width: number; height: number; visible: boolean;
  runningId?: string; exitPrompt: boolean; onClose: () => void; onExit: (discard: boolean) => void;
}) {
  const [selected, setSelected] = createSignal(props.sheets.document().activeSheetId);
  const [mode, setMode] = createSignal<"list" | "new" | "rename" | "delete">("list");
  const [name, setName] = createSignal("");
  const [error, setError] = createSignal("");
  const [button, setButton] = createSignal(-1);
  const [busy, setBusy] = createSignal(false);
  let list: ScrollBoxRenderable | undefined;
  const rows = () => props.sheets.document().sheets;
  const sheet = () => rows().find(s => s.id === selected()) ?? rows()[0]!;
  const width = () => Math.min(props.width - 2, 80);
  const height = () => Math.min(props.height - 2, 28);
  const canDelete = () => sheet().id !== props.runningId;
  createEffect(() => {
    const index = rows().findIndex(s => s.id === selected());
    list?.scrollTo(Math.max(0, index - Math.max(1, height() - 15) + 1));
  });
  function form(next: "new" | "rename") {
    if (busy()) return;
    setName(next === "new" ? nextSheetName(rows()) : sheet().name);
    setError(""); setMode(next); setButton(-1);
  }
  function confirmDelete() { if (canDelete()) { setMode("delete"); setButton(0); } }
  function save() {
    try {
      if (mode() === "new") { props.sheets.create(name()); props.onClose(); }
      else { props.sheets.rename(sheet().id, name()); setMode("list"); setButton(-1); }
    } catch (e) { setError((e as Error).message); }
  }
  function cancel() {
    if (busy()) return;
    if (mode() === "list") props.onClose(); else { setMode("list"); setButton(-1); setError(""); }
  }
  async function recover(reset = false) {
    setBusy(true);
    try { if (reset) await props.sheets.reset(); else await props.sheets.retry(); }
    finally { setBusy(false); }
  }
  function open() { props.sheets.select(sheet().id); props.onClose(); }
  function action(index: number) {
    if (busy()) return;
    if (props.exitPrompt) {
      if (index === 0) props.onExit(false);
      else if (index === 1) props.onClose();
      else props.onExit(true);
    } else if (mode() === "delete") {
      if (index === 0) cancel();
      else if (canDelete()) { props.sheets.remove(sheet().id); setSelected(props.sheets.document().activeSheetId); setMode("list"); setButton(-1); }
    } else if (mode() !== "list") { if (index === 0) cancel(); else save(); }
    else if (index === 0) form("new"); else if (index === 1) form("rename"); else if (index === 2) confirmDelete();
    else void recover(index === 4);
  }
  useKeyboard(key => {
    if (!props.visible || busy() || (key.ctrl && key.name === "c")) return;
    if (key.ctrl && ["n", "e", "d"].includes(key.name) && mode() === "list" && !props.exitPrompt) {
      key.preventDefault(); key.stopPropagation();
      if (key.name === "n") form("new"); else if (key.name === "e") form("rename"); else confirmDelete();
    } else if (key.name === "escape") { key.preventDefault(); cancel(); }
    else if (key.name === "tab") {
      key.preventDefault();
      const count = props.exitPrompt ? 3 : mode() === "list" ? 3 + (props.sheets.message() ? 1 : 0) + (props.sheets.blocked() ? 1 : 0) : 2;
      setButton((button() + (key.shift ? -1 : 1) + count + 2) % (count + 1) - 1);
    } else if ((key.name === "up" || key.name === "down") && mode() === "list" && !props.exitPrompt) {
      key.preventDefault(); setButton(-1);
      const index = rows().findIndex(s => s.id === sheet().id);
      setSelected(rows()[Math.max(0, Math.min(rows().length - 1, index + (key.name === "down" ? 1 : -1)))]!.id);
    } else if ((key.name === "left" || key.name === "right") && (mode() === "delete" || props.exitPrompt)) {
      key.preventDefault(); const count = props.exitPrompt ? 3 : 2;
      setButton((Math.max(0, button()) + (key.name === "right" ? 1 : -1) + count) % count);
    } else if (key.name === "return" || key.name === "enter") {
      key.preventDefault();
      if (button() >= 0) action(button());
      else if (props.exitPrompt) action(0);
      else if (mode() === "list") open();
      else if (mode() !== "delete") save();
    }
  });
  return (
    <box position="absolute" left={0} top={0} width="100%" height="100%" zIndex={50}
      visible={props.visible} alignItems="center" justifyContent="center" backgroundColor={theme.background}>
      <MenuFrame id="sql-sheet-picker" width={width()} height={height()}
        title={props.exitPrompt ? "Hojas sin guardar" : mode() === "new" ? "Nueva hoja SQL" : mode() === "rename" ? "Renombrar hoja" : mode() === "delete" ? "Eliminar hoja" : "Hojas SQL"}
        icon={icons.query}
        description={props.exitPrompt ? "No se pudo guardar. ¿Cómo quieres salir?" : mode() === "list" ? "Compartidas entre conexiones · guardado local automático" : "El SQL se guarda en este equipo, no en la base de datos."}
        onClose={cancel}
        hint={mode() === "list" && !props.exitPrompt ? (width() < 64 ? "↑/↓ · Enter abrir · Ctrl+N/E/D" : "↑/↓ elegir · Enter abrir · Ctrl+N/E/D · Esc volver") : (width() < 64 ? "Tab acción · Enter confirmar" : "Tab cambiar acción · Enter confirmar · Esc cancelar")}
        footer={props.exitPrompt ? <Show when={width() >= 64} fallback={<box flexDirection="column" width="100%" height={3}>
          <WorkspaceButton id="sheets-exit-retry" label="Reintentar" width={width() - 4} focused={button() === 0} onPress={() => action(0)} />
          <WorkspaceButton id="sheets-exit-back" label="Volver" width={width() - 4} focused={button() === 1} onPress={() => action(1)} />
          <WorkspaceButton id="sheets-exit-discard" label="Salir sin guardar" width={width() - 4} focused={button() === 2} onPress={() => action(2)} />
        </box>}>
          <MenuButton id="sheets-exit-retry" label="Reintentar" focused={button() === 0} onPress={() => action(0)} />
          <MenuButton id="sheets-exit-back" label="Volver" focused={button() === 1} onPress={() => action(1)} />
          <MenuButton id="sheets-exit-discard" label="Salir sin guardar" focused={button() === 2} onPress={() => action(2)} />
        </Show> : mode() === "list" ? <>
          <MenuButton id="sheet-new" label="Nueva" icon={width() >= 64 ? icons.add : undefined} focused={button() === 0} onPress={() => form("new")} />
          <MenuButton id="sheet-rename" label="Renombrar" icon={width() >= 64 ? icons.edit : undefined} focused={button() === 1} onPress={() => form("rename")} />
          <MenuButton id="sheet-delete" label="Eliminar" icon={width() >= 64 ? icons.delete : undefined} focused={button() === 2} disabled={!canDelete()} onPress={confirmDelete} />
        </> : <>
          <MenuButton id="sheet-cancel" label="Cancelar" focused={button() === 0} onPress={cancel} />
          <MenuButton id="sheet-save" label={mode() === "delete" ? "Eliminar" : "Guardar"} primary={mode() !== "delete"} focused={button() === 1} disabled={mode() === "delete" && !canDelete()} onPress={() => action(1)} />
        </>}>
        <Show when={props.exitPrompt} fallback={<Show when={mode() === "list"} fallback={
          <box flexDirection="column">
            <Show when={mode() === "delete"} fallback={<>
              <text fg={theme.muted}>Nombre de la hoja</text>
              <box height={3} flexShrink={0} border borderColor={button() === -1 ? theme.accent : theme.border} backgroundColor={theme.background}>
                <input id="sheet-name" value={name()} onInput={setName} focused={props.visible && button() === -1}
                  onMouseDown={() => setButton(-1)} backgroundColor={theme.background}
                  textColor={theme.text} focusedBackgroundColor={theme.selected} cursorColor={theme.accent} />
              </box>
              <text fg={theme.accent} wrapMode="word">{error()}</text>
            </>}>
              <text fg={theme.accent} wrapMode="none">{fit(sheet().name, width() - 6)}</text>
              <text fg={theme.text} wrapMode="word">Se eliminará esta hoja y su SQL guardado. No se borran datos de la base.</text>
            </Show>
          </box>
        }>
          <text height={1} flexShrink={0} fg={theme.muted}>{`${rows().length} hojas · ${props.sheets.status() === "saved" ? "Guardado" : props.sheets.status() === "saving" ? "Guardando…" : "Sin guardar"}`}</text>
          <Show when={props.sheets.message()}>
            <text fg={theme.accent} wrapMode="word" flexShrink={0}>{props.sheets.message()}</text>
            <box height={1} flexShrink={0} gap={1} flexDirection="row">
              <WorkspaceButton id="sheets-retry" label="Reintentar" width={12} focused={button() === 3} disabled={busy()} onPress={() => void recover()} />
              <Show when={props.sheets.blocked()}><WorkspaceButton id="sheets-reset" label="Restablecer guardado" width={21} focused={button() === 4} disabled={busy()} onPress={() => void recover(true)} /></Show>
            </box>
          </Show>
          <scrollbox ref={list} flexGrow={1} minHeight={1} scrollY scrollX={false}>
            <For each={rows()}>{s => <MenuOption id={`sheet-row-${s.id}`} title={`${s.name}${s.id === props.sheets.document().activeSheetId ? " · En uso" : ""}`} shortcut="" compact width={width() - 6}
              focused={s.id === sheet().id && button() === -1} onPress={() => { setSelected(s.id); props.sheets.select(s.id); props.onClose(); }} />}</For>
          </scrollbox>
          <Show when={!canDelete()}><text height={1} fg={theme.muted}>No se puede eliminar: consulta en curso.</text></Show>
        </Show>}>
          <text fg={theme.accent} wrapMode="word">{props.sheets.message() || "Hay cambios pendientes. Reintenta o vuelve para conservar el trabajo en memoria."}</text>
        </Show>
      </MenuFrame>
    </box>
  );
}
