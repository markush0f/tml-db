import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useKeyboard, usePaste } from "@opentui/solid";
import type { ConnectionManager, ConnectionSummary } from "../../db/connection-manager";
import { fit, theme } from "../theme";
import { ConnectionForm } from "./ConnectionForm";
import { MenuButton, MenuFrame, MenuOption } from "./MenuPrimitives";

interface Props {
  manager: ConnectionManager;
  active: string;
  toggleActiveWrite?: boolean;
  width: number;
  height: number;
  onSelect: (name: string) => void;
  onClose: () => void;
}
type Mode = "list" | "actions" | "new" | "edit" | "delete" | "write";
type Action = "search" | "select" | "new" | "more" | "close";

export function ConnectionPicker(props: Props) {
  const [entries, setEntries] = createSignal<ConnectionSummary[]>([]);
  const [search, setSearch] = createSignal("");
  const [index, setIndex] = createSignal(0);
  const [mode, setMode] = createSignal<Mode>("list");
  const [name, setName] = createSignal("");
  const [busy, setBusy] = createSignal(true);
  const [message, setMessage] = createSignal("");
  const [focus, setFocus] = createSignal<Action>("search");
  const [option, setOption] = createSignal(0);
  const [confirm, setConfirm] = createSignal(true);
  let alive = true;
  const filtered = () =>
    entries().filter((entry) => entry.name.toLowerCase().includes(search().toLowerCase()));
  const selected = () => filtered()[index()];
  const isForm = () => mode() === "new" || mode() === "edit";
  const width = () => Math.min(mode() === "list" ? 96 : 72, props.width - 4);
  const height = () =>
    Math.min(mode() === "list" ? 32 : mode() === "actions" ? 25 : 23, props.height - 2);
  const contentWidth = () => width() - 2 - (width() >= 64 ? 4 : 2);
  const wide = () => contentWidth() >= 62;
  const short = () => props.height < 24;
  const roomy = () => props.height >= 28;
  const rowHeight = () => (roomy() ? 2 : 1);
  const showCount = () => !(short() && (message() || busy()));
  const listHeight = () =>
    Math.max(
      1,
      height() -
        12 -
        (short() ? 2 : 3) -
        Number(roomy()) -
        1 -
        Number(showCount()) -
        (message() || busy() ? 2 : 0),
    );
  const visibleRows = () => Math.max(1, Math.floor(listHeight() / rowHeight()));
  const start = () => Math.max(0, index() - visibleRows() + 1);
  const source = (entry: ConnectionSummary) =>
    entry.kind === "llavero" ? "Llavero" : entry.kind === "entorno" ? "Variable env." : "Ejemplo";
  const tableLine = (
    name: string,
    access: string,
    credentials: string,
    state: string,
    marker = "  ",
  ) => {
    if (!wide())
      return `${marker}${fit(name, contentWidth() - 12).padEnd(contentWidth() - 12)}  ${fit(state, 8).padEnd(8)}`;
    const nameWidth = contentWidth() - 42;
    return `${marker}${fit(name, nameWidth).padEnd(nameWidth)}  ${access.padEnd(14)}  ${credentials.padEnd(12)}  ${state.padEnd(8)}`;
  };
  async function load() {
    try {
      const list = await props.manager.list();
      if (alive) setEntries(list.connections);
    } catch {
      if (alive) setMessage("No se pudo leer el catálogo. Revisa su formato y permisos.");
    }
  }
  onMount(async () => {
    await load();
    if (!alive) return;
    setBusy(false);
    const activeIndex = entries().findIndex((entry) => entry.name === props.active);
    if (activeIndex >= 0) setIndex(activeIndex);
    if (props.toggleActiveWrite) {
      if (activeIndex >= 0) askWriteMode();
      else setMessage("La conexión activa ya no existe. Revisa el catálogo.");
    }
  });
  onCleanup(() => {
    alive = false;
  });
  function close() {
    if (!busy()) props.onClose();
  }
  function back() {
    if (props.toggleActiveWrite) {
      close();
      return;
    }
    setMode("list");
    setFocus("search");
    setMessage("");
  }
  function form(edit = false) {
    if (busy() || (edit && !selected())) return;
    setName(edit ? selected()!.name : "");
    setMode(edit ? "edit" : "new");
    setMessage("");
  }
  async function saved() {
    setMode("list");
    setFocus("search");
    setSearch("");
    setIndex(0);
    setMessage("Guardada en el llavero. Selecciónala para conectar.");
    setBusy(true);
    await load();
    if (alive) setBusy(false);
  }
  async function remove() {
    if (busy() || !selected()) return;
    setBusy(true);
    setMessage("");
    try {
      await props.manager.remove(selected()!.name);
      if (alive) {
        setMode("list");
        setIndex(0);
        setFocus("search");
        setMessage("Conexión y secreto eliminados.");
      }
    } catch (error) {
      if (alive) {
        setMode("list");
        setMessage(error instanceof Error ? error.message : "No se pudo eliminar la conexión.");
      }
    } finally {
      await load();
      if (alive) setBusy(false);
    }
  }
  async function changeWriteMode(enabled: boolean) {
    const entry = selected();
    if (busy() || !entry || !props.manager.setWriteEnabled) return;
    setBusy(true);
    setMessage("");
    try {
      await props.manager.setWriteEnabled(entry.name, enabled);
      if (alive) {
        setMode("list");
        setFocus("search");
        setMessage(
          enabled
            ? "Escritura habilitada. Selecciónala para conectar."
            : "Solo lectura habilitada.",
        );
        if (entry.name === props.active) props.onSelect(entry.name);
      }
    } catch (error) {
      if (alive) {
        setMode("list");
        setMessage(error instanceof Error ? error.message : "No se pudo cambiar el modo.");
      }
    } finally {
      await load();
      if (alive) setBusy(false);
    }
  }
  function askWriteMode() {
    if (busy() || !selected() || !props.manager.setWriteEnabled) return;
    setMessage("");
    setConfirm(true);
    if (selected()!.writeEnabled) void changeWriteMode(false);
    else setMode("write");
  }
  function askDelete() {
    if (busy() || !selected()) return;
    if (selected()!.name === props.active) {
      setMessage("Cambia a otra conexión antes de eliminar la activa.");
      setMode("list");
      return;
    }
    setConfirm(true);
    setMode("delete");
    setMessage("");
  }
  const options = () => [
    {
      id: "edit",
      title: "Editar URL",
      description: "Sustituir las credenciales guardadas",
      shortcut: "Ctrl+E",
      press: () => form(true),
    },
    ...(props.manager.setWriteEnabled
      ? [
          {
            id: "write",
            title: selected()?.writeEnabled ? "Solo lectura" : "Habilitar escritura",
            description: selected()?.writeEnabled
              ? "Bloquear cambios en datos y tablas"
              : "Permitir cambios en datos y tablas",
            shortcut: "Ctrl+W",
            press: askWriteMode,
          },
        ]
      : []),
    {
      id: "delete",
      title: "Eliminar conexión",
      description: "Quitar del catálogo y borrar su secreto",
      shortcut: "Ctrl+D",
      press: askDelete,
    },
  ];
  function activate(action: Action) {
    if (busy()) return;
    if (action === "select" && selected()) props.onSelect(selected()!.name);
    else if (action === "new") form();
    else if (action === "more" && selected()) {
      setOption(0);
      setMode("actions");
      setMessage("");
    } else if (action === "close") close();
  }
  function append(text: string) {
    if (mode() !== "list") return;
    setFocus("search");
    setSearch((s) => (s + text.replace(/[\x00-\x1f\x7f-\x9f]/g, "")).slice(0, 64));
    setIndex(0);
  }
  usePaste((event) => {
    if (isForm()) return;
    event.preventDefault();
    event.stopPropagation();
    if (!busy()) append(new TextDecoder().decode(event.bytes));
  });
  useKeyboard((key) => {
    if (isForm() || (key.ctrl && key.name === "c")) return;
    key.preventDefault();
    key.stopPropagation();
    if (busy()) return;
    if (key.name === "escape") {
      if (mode() === "list") close();
      else back();
      return;
    }
    if (mode() === "write" || mode() === "delete") {
      if (["tab", "left", "right"].includes(key.name)) setConfirm((value) => !value);
      if (key.name === "return" || key.name === "enter") {
        if (!confirm()) back();
        else if (mode() === "write") void changeWriteMode(true);
        else void remove();
      }
      return;
    }
    if (key.ctrl && key.name === "n") {
      form();
      return;
    }
    if (key.ctrl && key.name === "e") {
      form(true);
      return;
    }
    if (key.ctrl && key.name === "w") {
      askWriteMode();
      return;
    }
    if (key.ctrl && key.name === "d") {
      askDelete();
      return;
    }
    if (mode() === "actions") {
      const order = options();
      if (["up", "down", "tab"].includes(key.name)) {
        const direction = key.name === "up" || (key.name === "tab" && key.shift) ? -1 : 1;
        setOption((i) => (i + direction + order.length + 1) % (order.length + 1));
      }
      if (key.name === "return" || key.name === "enter") {
        if (option() === order.length) back();
        else order[option()]?.press();
      }
      return;
    }
    if (key.name === "tab") {
      const order: Action[] = ["search", "select", "new", "more", "close"];
      setFocus(
        order[(order.indexOf(focus()) + (key.shift ? -1 : 1) + order.length) % order.length]!,
      );
      return;
    }
    if (key.ctrl && key.name === "u") {
      setSearch("");
      setIndex(0);
      setFocus("search");
      return;
    }
    if (key.name === "up" || key.name === "down") {
      setFocus("search");
      setIndex((i) =>
        Math.max(0, Math.min(filtered().length - 1, i + (key.name === "up" ? -1 : 1))),
      );
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      activate(focus() === "search" ? "select" : focus());
      return;
    }
    if (key.name === "backspace") {
      setFocus("search");
      setSearch((s) => Array.from(s).slice(0, -1).join(""));
      setIndex(0);
      return;
    }
    if (!key.ctrl && !key.meta && !key.option && key.sequence && !key.sequence.startsWith("\x1b"))
      append(key.sequence);
  });
  const title = () =>
    mode() === "write"
      ? "Habilitar escritura"
      : mode() === "delete"
        ? "Eliminar conexión"
        : mode() === "actions"
          ? "Acciones de conexión"
          : "Gestionar conexiones";
  return (
    <box
      id="connection-overlay"
      position="absolute"
      left={0}
      top={0}
      width="100%"
      height="100%"
      zIndex={200}
      backgroundColor={theme.background}
      alignItems="center"
      justifyContent="center"
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <Show
        when={!isForm()}
        fallback={
          <ConnectionForm
            manager={props.manager}
            name={name()}
            edit={mode() === "edit"}
            width={props.width}
            height={props.height}
            onCancel={back}
            onSaved={() => void saved()}
          />
        }
      >
        <MenuFrame
          width={width()}
          height={height()}
          title={title()}
          description={
            mode() === "list"
              ? "Elige dónde trabajar."
              : mode() === "actions"
                ? (selected()?.name ?? "")
                : "Confirma el cambio."
          }
          closeFocused={mode() === "list" && focus() === "close"}
          onClose={mode() === "list" ? close : back}
          hint={
            mode() === "list"
              ? "↑↓ elegir · Tab · Enter conectar"
              : mode() === "actions"
                ? "↑↓ elegir · Enter · Esc volver"
                : "Tab: botón · Enter: activar"
          }
          footer={
            mode() === "list" ? (
              <>
                <MenuButton
                  id="connection-new"
                  label={wide() ? "Nueva conexión" : "Nueva"}
                  shortcut={contentWidth() >= 82 ? "Ctrl+N" : undefined}
                  focused={focus() === "new"}
                  disabled={busy()}
                  onPress={() => form()}
                />
                <MenuButton
                  id="connection-more"
                  label="Acciones"
                  focused={focus() === "more"}
                  disabled={busy() || !selected()}
                  onPress={() => activate("more")}
                />
                <MenuButton
                  id="connection-select"
                  label="Conectar"
                  shortcut={wide() ? "Enter" : undefined}
                  primary
                  focused={focus() === "select"}
                  disabled={busy() || !selected()}
                  onPress={() => activate("select")}
                />
              </>
            ) : mode() === "actions" ? (
              <MenuButton
                id="connection-actions-back"
                label="Volver"
                shortcut="Esc"
                focused={option() === options().length}
                disabled={busy()}
                onPress={back}
              />
            ) : (
              <>
                <MenuButton
                  id={`connection-cancel-${mode()}`}
                  label="Cancelar"
                  shortcut={wide() ? "Esc" : undefined}
                  focused={!confirm()}
                  disabled={busy()}
                  onPress={back}
                />
                <MenuButton
                  id={`connection-confirm-${mode()}`}
                  label={
                    busy()
                      ? "Espera…"
                      : mode() === "write"
                        ? wide()
                          ? "Habilitar escritura"
                          : "Habilitar"
                        : "Eliminar"
                  }
                  primary
                  focused={confirm()}
                  disabled={busy()}
                  onPress={() => (mode() === "write" ? void changeWriteMode(true) : void remove())}
                />
              </>
            )
          }
        >
          <Show when={mode() === "list"}>
            <box
              id="connection-search"
              height={short() ? 2 : 3}
              flexShrink={0}
              border={short() ? ["bottom"] : true}
              borderColor={focus() === "search" ? theme.accent : theme.border}
              backgroundColor={theme.background}
              paddingLeft={1}
              paddingRight={1}
              marginBottom={roomy() ? 1 : 0}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (event.button === 0 && !busy()) setFocus("search");
              }}
            >
              <text
                height={1}
                wrapMode="none"
                selectable={false}
                fg={search() ? theme.text : theme.muted}
              >
                {fit(search() ? `Buscar: ${search()}` : "Buscar conexión…", contentWidth() - 4)}
              </text>
            </box>
            <text height={1} flexShrink={0} wrapMode="none" fg={theme.muted}>
              <b>{tableLine("CONEXIÓN", "ACCESO", "CREDENCIALES", "ESTADO")}</b>
            </text>
            <box
              id="connection-list"
              height={listHeight()}
              flexShrink={0}
              backgroundColor={theme.background}
              flexDirection="column"
              onMouseScroll={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!busy() && event.scroll && ["up", "down"].includes(event.scroll.direction)) {
                  setFocus("search");
                  setIndex((i) =>
                    Math.max(
                      0,
                      Math.min(
                        filtered().length - 1,
                        i + (event.scroll!.direction === "up" ? -1 : 1),
                      ),
                    ),
                  );
                }
              }}
            >
              <For each={filtered().slice(start(), start() + visibleRows())}>
                {(entry, offset) => (
                  <box
                    id={`connection-item-${entry.name}`}
                    height={rowHeight()}
                    flexShrink={0}
                    backgroundColor={
                      index() === start() + offset() ? theme.selected : theme.background
                    }
                    onMouseDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (event.button === 0 && !busy()) {
                        setFocus("search");
                        setIndex(start() + offset());
                      }
                    }}
                  >
                    <text
                      height={1}
                      wrapMode="none"
                      selectable={false}
                      fg={index() === start() + offset() ? theme.accent : theme.text}
                    >
                      {tableLine(
                        entry.name,
                        entry.writeEnabled ? "Escritura" : "Solo lectura",
                        source(entry),
                        entry.name === props.active ? "En uso" : "",
                        index() === start() + offset() ? "> " : "  ",
                      )}
                    </text>
                  </box>
                )}
              </For>
              <Show when={!filtered().length}>
                <text height={1} fg={theme.muted}>
                  {busy() ? "Cargando conexiones…" : "Sin coincidencias"}
                </text>
              </Show>
            </box>
            <Show when={showCount()}>
              <text
                id="connection-selection-info"
                height={1}
                flexShrink={0}
                wrapMode="none"
                fg={theme.muted}
              >
                {fit(
                  selected()
                    ? wide()
                      ? `${filtered().length} conexiones · Seleccionada: ${selected()!.name}`
                      : `${index() + 1}/${filtered().length} · ${selected()!.writeEnabled ? "Escritura" : "Solo lectura"} · ${source(selected()!)}`
                    : "Prueba otro nombre o crea una conexión.",
                  contentWidth(),
                )}
              </text>
            </Show>
            <Show when={message() || busy()}>
              <text id="connection-message" height={2} flexShrink={0} fg={theme.accent}>
                {fit(busy() ? "Espera…" : message(), contentWidth() * 2)}
              </text>
            </Show>
          </Show>
          <Show when={mode() === "actions"}>
            <For each={options()}>
              {(action, i) => (
                <MenuOption
                  id={`connection-${action.id}`}
                  title={action.title}
                  description={short() ? undefined : action.description}
                  shortcut={action.shortcut}
                  width={contentWidth()}
                  focused={option() === i()}
                  disabled={busy()}
                  onPress={action.press}
                />
              )}
            </For>
          </Show>
          <Show when={mode() === "write" || mode() === "delete"}>
            <scrollbox
              id="connection-confirm-scroll"
              flexGrow={1}
              minHeight={0}
              scrollX={false}
              contentOptions={{ flexDirection: "column" }}
              scrollbarOptions={{
                trackOptions: { foregroundColor: theme.border, backgroundColor: theme.surface },
              }}
            >
              <box
                id="connection-confirm-target"
                height={short() ? 2 : 4}
                flexShrink={0}
                flexDirection="column"
                paddingLeft={short() ? 0 : 1}
                paddingTop={short() ? 0 : 1}
                backgroundColor={short() ? theme.surface : theme.background}
              >
                <Show when={!short()}>
                  <text height={1} fg={theme.muted}>
                    Conexión
                  </text>
                </Show>
                <text height={1} wrapMode="none" fg={theme.text}>
                  <b>
                    {fit(
                      short() ? `Conexión: ${selected()?.name ?? ""}` : (selected()?.name ?? ""),
                      contentWidth() - (short() ? 0 : 2),
                    )}
                  </b>
                </text>
              </box>
              <text
                id="connection-confirm-risk"
                height={2}
                flexShrink={0}
                fg={theme.text}
                marginTop={short() ? 0 : 1}
              >
                {mode() === "write"
                  ? "El SQL podrá modificar o eliminar datos y tablas."
                  : "Se borrarán la conexión y su secreto del llavero."}
              </text>
              <text id="connection-confirm-policy" height={2} flexShrink={0} fg={theme.muted}>
                {mode() === "write"
                  ? "Permiso persistente. Sin más confirmaciones al ejecutar."
                  : "Esta acción no elimina la base de datos."}
              </text>
            </scrollbox>
          </Show>
        </MenuFrame>
      </Show>
    </box>
  );
}
