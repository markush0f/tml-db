import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { useKeyboard, usePaste } from "@opentui/solid";
import type { ConnectionManager, ConnectionSummary } from "../../db/connection-manager";
import { fit, theme } from "../theme";

interface Props {
  manager: ConnectionManager;
  active: string;
  /** Open the active connection's mode action without navigating the list. */
  toggleActiveWrite?: boolean;
  width: number;
  height: number;
  onSelect: (name: string) => void;
  onClose: () => void;
}
export function ConnectionPicker(props: Props) {
  const [entries, setEntries] = createSignal<ConnectionSummary[]>([]);
  const [search, setSearch] = createSignal("");
  const [index, setIndex] = createSignal(0);
  const [mode, setMode] = createSignal<"list" | "new" | "edit" | "delete" | "write">("list");
  const [name, setName] = createSignal("");
  const [secret, setSecret] = createSignal("");
  const [field, setField] = createSignal(0);
  const [busy, setBusy] = createSignal(true);
  const [message, setMessage] = createSignal("");
  let alive = true;
  const filtered = () =>
    entries().filter((entry) => entry.name.toLowerCase().includes(search().toLowerCase()));
  const selected = () => filtered()[index()];
  const width = () => Math.min(62, props.width - 4);
  const visibleRows = () =>
    Math.max(
      1,
      Math.min(
        8,
        props.height - 13 - Math.ceil(message().length / Math.max(1, width() - 4)) - Number(busy()),
      ),
    );
  const start = () => Math.max(0, index() - visibleRows() + 1);
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
    if (alive) {
      setBusy(false);
      if (props.toggleActiveWrite) {
        const activeIndex = entries().findIndex((entry) => entry.name === props.active);
        if (activeIndex >= 0) {
          setIndex(activeIndex);
          askWriteMode();
        } else setMessage("La conexión activa ya no existe. Revisa el catálogo.");
      }
    }
  });
  onCleanup(() => {
    alive = false;
    setSecret("");
  });
  function close() {
    if (!busy()) {
      setSecret("");
      props.onClose();
    }
  }
  function back() {
    if (props.toggleActiveWrite) {
      close();
      return;
    }
    setSecret("");
    setMode("list");
    setMessage("");
  }
  function form(edit = false) {
    if (busy() || (edit && !selected())) return;
    setName(edit ? selected()!.name : "");
    setSecret("");
    setField(edit ? 1 : 0);
    setMode(edit ? "edit" : "new");
    setMessage("");
  }
  async function save() {
    if (busy() || !name() || !secret()) return;
    setBusy(true);
    setMessage("");
    const value = secret();
    setSecret("");
    try {
      await props.manager.save(name(), value, mode() === "edit");
      if (alive) {
        setMode("list");
        setSearch("");
        setIndex(0);
        setMessage("Guardada en el llavero. Selecciónala para conectar.");
      }
    } catch (error) {
      if (alive)
        setMessage(error instanceof Error ? error.message : "No se pudo guardar la conexión.");
    } finally {
      await load();
      if (alive) setBusy(false);
    }
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
        setMessage(
          enabled
            ? "Escritura habilitada. Selecciónala para conectar."
            : "Solo lectura habilitada.",
        );
        // Replace the live session so its policy cannot disagree with the saved setting.
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
    if (selected()!.writeEnabled) void changeWriteMode(false);
    else setMode("write");
  }
  function askDelete() {
    if (!busy() && selected()) {
      if (selected()!.name === props.active) {
        setMessage("Cambia a otra conexión antes de eliminar la activa.");
        return;
      }
      setMode("delete");
      setMessage("");
    }
  }
  function append(text: string) {
    const clean = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
    if (mode() === "list") {
      setSearch((s) => (s + clean).slice(0, 64));
      setIndex(0);
    } else if (mode() === "new" && field() === 0) setName((s) => (s + clean).slice(0, 64));
    else if ((mode() === "new" || mode() === "edit") && field() === 1)
      setSecret((s) => (s + clean).slice(0, 2000));
  }
  usePaste((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!busy()) append(new TextDecoder().decode(event.bytes));
  });
  useKeyboard((key) => {
    if (key.ctrl && key.name === "c") return;
    key.preventDefault();
    key.stopPropagation();
    if (busy()) return;
    if (key.name === "escape") {
      if (mode() === "list") close();
      else back();
      return;
    }
    if (mode() === "list") {
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
      if (key.name === "up" || key.name === "down") {
        setIndex((i) =>
          Math.max(0, Math.min(filtered().length - 1, i + (key.name === "up" ? -1 : 1))),
        );
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        if (selected()) props.onSelect(selected()!.name);
        return;
      }
      if (key.name === "backspace") {
        setSearch((s) => Array.from(s).slice(0, -1).join(""));
        setIndex(0);
        return;
      }
    } else if (mode() === "write") {
      if (key.name === "return" || key.name === "enter") void changeWriteMode(true);
      return;
    } else if (mode() === "delete") {
      if (key.name === "return" || key.name === "enter") void remove();
      return;
    } else {
      if (key.name === "tab") {
        const first = mode() === "edit" ? 1 : 0;
        setField((f) => first + ((f - first + (key.shift ? -1 : 1) + 4 - first) % (4 - first)));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        if (field() === 3) back();
        else if (field() < 1) setField(1);
        else void save();
        return;
      }
      if (key.name === "backspace") {
        if (field() === 1) setSecret((s) => Array.from(s).slice(0, -1).join(""));
        else if (field() === 0 && mode() === "new")
          setName((s) => Array.from(s).slice(0, -1).join(""));
        return;
      }
      if (key.ctrl && key.name === "u" && field() === 1) {
        setSecret("");
        return;
      }
    }
    if (!key.ctrl && !key.meta && !key.option && key.sequence && !key.sequence.startsWith("\x1b"))
      append(key.sequence);
  });
  const button = (id: string, label: string, action: () => void, active = false) => (
    <text
      id={id}
      height={1}
      fg={active ? theme.accent : theme.text}
      selectable={false}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 0 && !busy()) action();
      }}
    >
      {label}
    </text>
  );
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
      <box
        id="connection-picker"
        width={width()}
        maxHeight={props.height - 2}
        border
        borderColor={theme.accent}
        backgroundColor={theme.surface}
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
        overflow="hidden"
      >
        <text height={1} fg={theme.accent}>
          {mode() === "new"
            ? "Nueva conexión"
            : mode() === "edit"
              ? "Sustituir credenciales"
              : mode() === "write"
                ? "Habilitar escritura"
                : mode() === "delete"
                  ? "Eliminar conexión"
                  : "Gestionar conexiones"}
        </text>
        <Show when={mode() === "list"}>
          <text height={1} fg={theme.muted}>
            {fit(`Buscar: ${search() || "escribe un nombre"}`, width() - 4)}
          </text>
          <For each={filtered().slice(start(), start() + visibleRows())}>
            {(entry, offset) => (
              <text
                id={`connection-item-${entry.name}`}
                height={1}
                wrapMode="none"
                selectable={false}
                bg={index() === start() + offset() ? theme.selected : theme.surface}
                fg={entry.name === props.active ? theme.accent : theme.text}
                onMouseDown={(event) => {
                  if (event.button === 0 && !busy()) setIndex(start() + offset());
                }}
              >
                {fit(
                  `${entry.name === props.active ? "*" : " "} ${entry.name} · ${entry.writeEnabled ? "Escritura" : "Solo lectura"} · ${entry.kind}`,
                  width() - 4,
                )}
              </text>
            )}
          </For>
          <Show when={!filtered().length}>
            <text height={1} fg={theme.muted}>
              {busy() ? "Cargando…" : "Sin coincidencias"}
            </text>
          </Show>
          <text
            height={1}
            fg={theme.muted}
          >{`${filtered().length} conexiones · ↑/↓ seleccionar`}</text>
          {button(
            "connection-select",
            "[Conectar · Enter]",
            () => {
              if (selected()) props.onSelect(selected()!.name);
            },
            true,
          )}
          {button("connection-new", "[+ Nueva conexión · Ctrl+N]", () => form())}
          {button("connection-edit", "[Sustituir URL · Ctrl+E]", () => form(true))}
          <Show when={props.manager.setWriteEnabled}>
            {button(
              "connection-write",
              selected()?.writeEnabled
                ? "[Pasar a solo lectura · Ctrl+W]"
                : "[Habilitar escritura · Ctrl+W]",
              askWriteMode,
            )}
          </Show>
          {button("connection-delete", "[Eliminar · Ctrl+D]", askDelete)}
          {button("connection-close", "[Cerrar · Esc]", close)}
        </Show>
        <Show when={mode() === "new" || mode() === "edit"}>
          <text height={1} fg={theme.muted}>
            Nombre (letras, números, _ y -)
          </text>
          {button(
            "connection-name",
            fit(`${field() === 0 ? ">" : " "} ${name() || "mi-conexion"}`, width() - 4),
            () => {
              if (mode() === "new") setField(0);
            },
            field() === 0,
          )}
          <text height={1} fg={theme.muted}>
            URL completa (oculta, incluye contraseña)
          </text>
          {button(
            "connection-secret",
            `${field() === 1 ? ">" : " "} ${secret() ? "*".repeat(Math.min(secret().length, width() - 8)) : "Pega o escribe la URL"}`,
            () => setField(1),
            field() === 1,
          )}
          <text height={1} fg={theme.muted}>
            Solo se guarda en el llavero del sistema.
          </text>
          <text height={1} fg={theme.muted}>
            Tab: campo · Ctrl+U: vaciar URL
          </text>
          {button("connection-save", "[Guardar]", () => void save(), field() === 2)}
          {button("connection-cancel", "[Cancelar · Esc]", back, field() === 3)}
        </Show>
        <Show when={mode() === "write"}>
          <text fg={theme.text}>{`¿Habilitar escritura en ${selected()?.name ?? ""}?`}</text>
          <text fg={theme.accent}>El SQL podrá modificar o eliminar datos y tablas.</text>
          <text fg={theme.muted}>Se guardará para esta conexión. Sin más confirmaciones.</text>
          {button(
            "connection-confirm-write",
            "[Habilitar escritura · Enter]",
            () => void changeWriteMode(true),
            true,
          )}
          {button("connection-cancel-write", "[Cancelar · Esc]", back)}
        </Show>
        <Show when={mode() === "delete"}>
          <text fg={theme.text}>{`¿Eliminar ${selected()?.name ?? ""} y su secreto?`}</text>
          {button(
            "connection-confirm-delete",
            "[Eliminar definitivamente · Enter]",
            () => void remove(),
            true,
          )}
          {button("connection-cancel-delete", "[Cancelar · Esc]", back)}
        </Show>
        <Show when={busy()}>
          <text fg={theme.accent}>Espera…</text>
        </Show>
        <Show when={message()}>
          <text fg={theme.accent}>{message()}</text>
        </Show>
      </box>
    </box>
  );
}
