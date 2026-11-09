import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { useKeyboard, usePaste } from "@opentui/solid";
import type { ScrollBoxRenderable } from "@opentui/core";
import type { ConnectionManager } from "../../db/connection-manager";
import { connectionDsn, connectionEngines } from "../connection-form";
import { databaseIcon, icons } from "../icons";
import { fit, theme } from "../theme";
import { MenuButton, MenuFrame, MenuOption } from "./MenuPrimitives";

interface Props {
  manager: ConnectionManager;
  name: string;
  edit: boolean;
  width: number;
  height: number;
  onCancel: () => void;
  onSaved: () => void;
}
type Field =
  | "engine"
  | "host"
  | "port"
  | "user"
  | "password"
  | "database"
  | "name"
  | "secret"
  | "save"
  | "cancel"
  | "import";

export function ConnectionForm(props: Props) {
  const [name, setName] = createSignal(props.name);
  const [secret, setSecret] = createSignal("");
  const [engine, setEngine] = createSignal(0);
  const [host, setHost] = createSignal("localhost");
  const [port, setPort] = createSignal("5432");
  const [user, setUser] = createSignal("");
  const [password, setPassword] = createSignal("");
  const [database, setDatabase] = createSignal("");
  const [urlMode, setUrlMode] = createSignal(props.edit);
  const [focus, setFocus] = createSignal<Field>(props.edit ? "secret" : "engine");
  const [choosing, setChoosing] = createSignal(false);
  const [chooseConfirm, setChooseConfirm] = createSignal(true);
  const [pendingEngine, setPendingEngine] = createSignal(0);
  const [busy, setBusy] = createSignal(false);
  const [message, setMessage] = createSignal("");
  let scroll: ScrollBoxRenderable | undefined;
  let alive = true;
  const width = () => Math.min(104, props.width - 4);
  const columns = () => width() >= 64;
  const padding = () => (columns() ? 2 : 1);
  const contentWidth = () => width() - padding() * 2 - 4;
  const inputWidth = (field: Field) =>
    !columns()
      ? undefined
      : field === "port"
        ? 16
        : field === "user" || field === "password"
          ? Math.floor((contentWidth() - 2) / 2)
          : undefined;
  const sqlite = () => connectionEngines[engine()]!.scheme === "sqlite";
  const fields = (): Field[] => [
    ...(urlMode()
      ? ["secret" as const]
      : sqlite()
        ? (["engine", "database"] as const)
        : (["engine", "host", "port", "user", "password", "database"] as const)),
    ...(!props.edit ? ["name" as const] : []),
    "save",
    "cancel",
    "import",
  ];
  const values = { host, port, user, password, database, name, secret };
  const setters = {
    host: setHost,
    port: setPort,
    user: setUser,
    password: setPassword,
    database: setDatabase,
    name: setName,
    secret: setSecret,
  };
  const canSave = () =>
    !busy() &&
    !!name().trim() &&
    (urlMode()
      ? !!secret()
      : sqlite()
        ? !!database().trim()
        : !!host().trim() && !!port() && !!user().trim());
  function clearSecrets() {
    setSecret("");
    setPassword("");
  }
  onCleanup(() => {
    alive = false;
    clearSecrets();
  });
  function cancel() {
    if (!busy()) {
      clearSecrets();
      props.onCancel();
    }
  }
  function toggleImport() {
    if (busy()) return;
    setUrlMode(!urlMode());
    setChoosing(false);
    setMessage("");
    setFocus(urlMode() ? "secret" : "engine");
  }
  function openEngines() {
    setPendingEngine(engine());
    setChooseConfirm(true);
    setChoosing(true);
  }
  function choose(index: number) {
    setEngine(index);
    setPort(connectionEngines[index]!.port);
    setChoosing(false);
    setFocus("engine");
  }
  createEffect(() => {
    const field = focus();
    props.width;
    props.height;
    urlMode();
    choosing();
    engine();
    const group =
      columns() && (field === "port" || field === "password")
        ? field === "port"
          ? "host"
          : "user"
        : field;
    const timer = setTimeout(() => {
      if (!alive || !scroll || choosing() || ["save", "cancel", "import"].includes(group)) return;
      const target =
        choosing() && field === "engine"
          ? `connection-engine-${connectionEngines[engine()]!.scheme}`
          : `connection-group-${group}`;
      const child = scroll.content.findDescendantById(target);
      if (!child) return;
      // OpenTUI's nearest-scroll leaves equal-height fields unmoved; align them explicitly.
      if (
        child.y < scroll.viewport.y ||
        child.y + Math.min(child.height, scroll.viewport.height) >
          scroll.viewport.y + scroll.viewport.height
      )
        scroll.scrollTo(scroll.scrollTop + child.y - scroll.viewport.y);
    }, 0);
    onCleanup(() => clearTimeout(timer));
  });
  async function save() {
    if (!canSave()) return;
    let dsn: string;
    try {
      dsn = urlMode()
        ? secret()
        : connectionDsn({
            engine: engine(),
            host: host(),
            port: port(),
            user: user(),
            password: password(),
            database: database(),
          });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revisa los campos de conexión.");
      return;
    }
    setBusy(true);
    setMessage("");
    clearSecrets();
    try {
      await props.manager.save(name(), dsn, props.edit);
      if (alive) props.onSaved();
    } catch (error) {
      if (alive)
        setMessage(error instanceof Error ? error.message : "No se pudo guardar la conexión.");
    } finally {
      if (alive) setBusy(false);
    }
  }
  function append(text: string) {
    const current = focus();
    if (!(current in setters)) return;
    const key = current as keyof typeof setters;
    const clean = text.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
    setters[key]((value) =>
      (value + clean).slice(0, key === "secret" ? 2000 : key === "name" ? 64 : 512),
    );
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
      if (choosing()) setChoosing(false);
      else cancel();
      return;
    }
    if (choosing()) {
      if (["up", "down"].includes(key.name)) {
        const next =
          (pendingEngine() + (key.name === "up" ? -1 : 1) + connectionEngines.length) %
          connectionEngines.length;
        setPendingEngine(next);
      } else if (["tab", "left", "right"].includes(key.name)) setChooseConfirm((value) => !value);
      else if (key.name === "return" || key.name === "enter") {
        if (chooseConfirm()) choose(pendingEngine());
        else setChoosing(false);
      } else if (/^[1-5]$/.test(key.sequence)) choose(Number(key.sequence) - 1);
      return;
    }
    if (key.ctrl && key.name === "i") {
      toggleImport();
      return;
    }
    if (key.name === "tab") {
      setChoosing(false);
      const order = fields();
      setFocus(
        order[(order.indexOf(focus()) + (key.shift ? -1 : 1) + order.length) % order.length]!,
      );
      return;
    }
    if (focus() === "engine" && ["left", "right", "up", "down"].includes(key.name)) {
      const direction = key.name === "left" || key.name === "up" ? -1 : 1;
      const next = (engine() + direction + connectionEngines.length) % connectionEngines.length;
      setEngine(next);
      setPort(connectionEngines[next]!.port);
      return;
    }
    if (key.name === "pageup" || key.name === "pagedown") {
      scroll?.scrollBy(key.name === "pageup" ? -1 : 1, "viewport");
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      if (focus() === "engine") openEngines();
      else if (focus() === "cancel") cancel();
      else if (focus() === "import") toggleImport();
      else if (focus() === "save" || key.ctrl || focus() === "secret") void save();
      else {
        const order = fields();
        setFocus(order[(order.indexOf(focus()) + 1) % order.length]!);
      }
      return;
    }
    if (focus() in setters) {
      const setter = setters[focus() as keyof typeof setters];
      if (key.ctrl && key.name === "u") {
        setter("");
        return;
      }
      if (key.name === "backspace") {
        setter((value) => Array.from(value).slice(0, -1).join(""));
        return;
      }
    }
    if (!key.ctrl && !key.meta && !key.option && key.sequence && !key.sequence.startsWith("\x1b"))
      append(key.sequence);
  });
  const input = (field: keyof typeof values, label: string, placeholder: string) => (
    <box
      id={`connection-group-${field}`}
      flexDirection="column"
      flexGrow={field === "host" && columns() ? 1 : 0}
      width={inputWidth(field)}
      flexShrink={0}
      height={4}
    >
      <text height={1} fg={focus() === field ? theme.accent : theme.text}>
        <b>{`${{ host: icons.server, port: icons.link, user: icons.user, password: icons.lock, database: sqlite() ? icons.file : icons.database, name: icons.database, secret: icons.link }[field]} ${label}`}</b>
      </text>
      <box
        id={`connection-${field}`}
        height={3}
        flexShrink={0}
        border
        borderColor={focus() === field ? theme.accent : theme.border}
        backgroundColor={focus() === field ? theme.selected : theme.background}
        paddingLeft={1}
        paddingRight={1}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (event.button === 0 && !busy()) setFocus(field);
        }}
      >
        <text
          height={1}
          wrapMode="none"
          selectable={false}
          fg={values[field]() ? theme.text : theme.muted}
        >
          {(() => {
            const available =
              (inputWidth(field) ??
                (field === "host" && columns() ? contentWidth() - 18 : contentWidth())) - 4;
            const value =
              field === "password" || field === "secret"
                ? "*".repeat(Math.min(values[field]().length, available))
                : values[field]();
            return value
              ? Array.from(value).slice(-available).join("")
              : fit(placeholder, available);
          })()}
        </text>
      </box>
    </box>
  );
  return (
    <MenuFrame
      width={width()}
      height={Math.min(choosing() ? 25 : 44, props.height - 2)}
      title={
        choosing()
          ? "Motor de base de datos"
          : props.edit
            ? "Sustituir credenciales"
            : "Nueva conexión"
      }
      icon={icons.database}
      description={
        choosing()
          ? "Elige el tipo de conexión."
          : props.edit
            ? `${icons.database} Conexión: ${name()}`
            : "Datos de acceso a la base."
      }
      onClose={() => (choosing() ? setChoosing(false) : cancel())}
      hint={
        choosing()
          ? "↑↓ elegir · Enter usar · Esc"
          : columns()
            ? "Tab: campo · Ctrl+I: campos/URL · Ctrl+Enter: guardar · Esc: cancelar"
            : "Tab: campo · Ctrl+Enter: guardar"
      }
      footer={
        choosing() ? (
          <>
            <MenuButton
              id="connection-engine-back"
              label="Volver"
              icon={icons.back}
              focused={!chooseConfirm()}
              onPress={() => setChoosing(false)}
            />
            <MenuButton
              id="connection-engine-apply"
              label="Usar motor"
              icon={icons.database}
              primary
              focused={chooseConfirm()}
              onPress={() => choose(pendingEngine())}
            />
          </>
        ) : (
          <>
            <MenuButton
              id="connection-cancel"
              label="Cancelar"
              icon={icons.close}
              shortcut={columns() ? "Esc" : undefined}
              focused={focus() === "cancel"}
              disabled={busy()}
              onPress={cancel}
            />
            <MenuButton
              id="connection-save"
              label={busy() ? "Guardando…" : columns() ? "Guardar conexión" : "Guardar"}
              icon={icons.save}
              primary
              focused={focus() === "save"}
              disabled={!canSave()}
              onPress={() => void save()}
            />
          </>
        )
      }
    >
      <Show
        when={!choosing()}
        fallback={
          <box id="connection-engine-options" flexDirection="column" flexGrow={1} minHeight={0}>
            <For each={connectionEngines}>
              {(entry, i) => (
                <MenuOption
                  id={`connection-engine-${entry.scheme}`}
                  title={`${databaseIcon(entry.scheme)} ${entry.label}`}
                  shortcut={String(i() + 1)}
                  compact={props.height < 24}
                  width={width() - 2 - padding() * 2}
                  focused={pendingEngine() === i()}
                  onPress={() => choose(i())}
                />
              )}
            </For>
          </box>
        }
      >
        <box
          height={2}
          flexShrink={0}
          flexDirection="row"
          marginBottom={props.height >= 24 ? 1 : 0}
        >
          <box
            id={urlMode() ? "connection-import" : "connection-method-active"}
            flexGrow={1}
            flexBasis={0}
            height={2}
            border={["bottom"]}
            borderColor={!urlMode() || focus() === "import" ? theme.accent : theme.border}
            backgroundColor={!urlMode() ? theme.selected : theme.surface}
            alignItems="center"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.button === 0 && urlMode()) toggleImport();
            }}
          >
            <text height={1} selectable={false} fg={!urlMode() ? theme.accent : theme.muted}>
              <b>{`${icons.column} Por campos`}</b>
            </text>
          </box>
          <box
            id={!urlMode() ? "connection-import" : "connection-method-active"}
            flexGrow={1}
            flexBasis={0}
            height={2}
            border={["bottom"]}
            borderColor={urlMode() || focus() === "import" ? theme.accent : theme.border}
            backgroundColor={urlMode() ? theme.selected : theme.surface}
            alignItems="center"
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.button === 0 && !urlMode()) toggleImport();
            }}
          >
            <text height={1} selectable={false} fg={urlMode() ? theme.accent : theme.muted}>
              <b>{`${icons.link} Por URL`}</b>
            </text>
          </box>
        </box>
        <scrollbox
          id="connection-form-scroll"
          ref={scroll}
          flexGrow={1}
          minHeight={0}
          scrollX={false}
          contentOptions={{ flexDirection: "column", gap: columns() ? 0 : 1, paddingRight: 1 }}
          scrollbarOptions={{
            trackOptions: { foregroundColor: theme.border, backgroundColor: theme.surface },
          }}
        >
          <Show
            when={!urlMode()}
            fallback={input("secret", "URL de conexión · oculta", "Pega o escribe la URL")}
          >
            <box id="connection-group-engine" flexDirection="column" flexShrink={0}>
              <text height={1} fg={focus() === "engine" ? theme.accent : theme.text}>
                <b>{`${icons.database} Tipo de conexión`}</b>
              </text>
              <box
                id="connection-engine"
                height={3}
                flexShrink={0}
                border
                borderColor={focus() === "engine" ? theme.accent : theme.border}
                backgroundColor={focus() === "engine" ? theme.selected : theme.background}
                paddingLeft={1}
                paddingRight={1}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (event.button === 0 && !busy()) {
                    setFocus("engine");
                    openEngines();
                  }
                }}
              >
                <text
                  height={1}
                  selectable={false}
                  fg={theme.text}
                >{`${databaseIcon(connectionEngines[engine()]!.scheme)} ${connectionEngines[engine()]!.label}  ${choosing() ? "−" : "▾"}`}</text>
              </box>
            </box>
            <Show when={!sqlite()}>
              <box
                flexDirection={columns() ? "row" : "column"}
                gap={columns() ? 2 : 1}
                flexShrink={0}
              >
                {input("host", "Host", "localhost")}
                {input("port", "Puerto", connectionEngines[engine()]!.port)}
              </box>
              <box
                flexDirection={columns() ? "row" : "column"}
                gap={columns() ? 2 : 1}
                flexShrink={0}
              >
                {input("user", "Usuario", "Usuario de la base de datos")}
                {input("password", "Contraseña · oculta", "Opcional")}
              </box>
            </Show>
            {input(
              "database",
              sqlite() ? "Archivo SQLite" : "Base de datos",
              sqlite() ? "/ruta/base-de-datos.sqlite" : "Predeterminada del servidor",
            )}
          </Show>
          <box flexDirection="column" flexShrink={0} marginTop={columns() ? 1 : 0}>
            <Show
              when={!props.edit}
              fallback={
                <text height={1} fg={theme.muted}>
                  {fit(`${icons.database} Nombre: ${name()} · no editable`, contentWidth())}
                </text>
              }
            >
              {input("name", "Nombre de la conexión", "mi-conexion")}
            </Show>
            <text height={1} flexShrink={0} fg={theme.muted} wrapMode="none">
              {fit(
                props.edit
                  ? `${icons.lock} Credenciales en el llavero del sistema.`
                  : `${icons.lock} Llavero del sistema · Solo lectura`,
                contentWidth(),
              )}
            </text>
          </box>
        </scrollbox>
        <Show when={message() || busy()}>
          <text id="connection-form-message" height={2} flexShrink={0} fg={theme.accent}>
            {fit(busy() ? "Guardando en el llavero…" : message(), contentWidth() * 2)}
          </text>
        </Show>
      </Show>
    </MenuFrame>
  );
}
