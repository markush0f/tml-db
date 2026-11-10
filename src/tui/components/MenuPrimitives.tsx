import { createSignal, Show, type JSX } from "solid-js";
import { WorkspaceButton } from "./WorkspaceButton";
import { fit, theme } from "../theme";

/** Shared chrome: title, breathing room, scroll-safe body and a fixed action footer. */
export function MenuFrame(props: {
  id?: string;
  width: number;
  height: number;
  title: string;
  icon?: string;
  description: string;
  children: JSX.Element;
  footer: JSX.Element;
  hint: string;
  closeFocused?: boolean;
  onClose: () => void;
}) {
  const padding = () => (props.width >= 64 ? 2 : 1);
  const textWidth = () => props.width - 2 - padding() * 2;
  return (
    <box
      id={props.id ?? "connection-picker"}
      width={props.width}
      height={props.height}
      border
      borderColor={theme.border}
      backgroundColor={theme.surface}
      paddingLeft={padding()}
      paddingRight={padding()}
      flexDirection="column"
      overflow="hidden"
    >
      <box id="menu-heading" height={3} flexShrink={0} paddingTop={1} flexDirection="column">
        <box height={1} flexShrink={0} flexDirection="row" gap={1}>
          <text height={1} flexGrow={1} wrapMode="none" fg={theme.accent}>
            <b>{fit(`${props.icon ? `${props.icon} ` : ""}${props.title}`, textWidth() - 6)}</b>
          </text>
          <WorkspaceButton
            id={props.id ? `${props.id}-close` : "connection-close"}
            label="Esc"
            width={5}
            focused={props.closeFocused}
            onPress={props.onClose}
          />
        </box>
        <text height={1} flexShrink={0} wrapMode="none" fg={theme.muted}>
          {fit(props.description, textWidth())}
        </text>
      </box>
      <box
        id="menu-body"
        flexGrow={1}
        minHeight={0}
        marginTop={1}
        flexDirection="column"
        overflow="hidden"
      >
        {props.children}
      </box>
      <box
        id="menu-footer"
        height={5}
        flexShrink={0}
        border={["top"]}
        borderColor={theme.border}
        paddingTop={1}
        flexDirection="row"
        gap={1}
      >
        {props.footer}
      </box>
      <text height={1} flexShrink={0} fg={theme.muted} wrapMode="none">
        {fit(props.hint, textWidth())}
      </text>
    </box>
  );
}

export function MenuButton(props: {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  primary?: boolean;
  focused?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = createSignal(false);
  const active = () => !props.disabled && (props.focused || hovered());
  return (
    <box
      id={props.id}
      height={3}
      flexShrink={1}
      flexGrow={1}
      flexBasis={
        props.label.length +
        (props.icon ? props.icon.length + 1 : 0) +
        (props.shortcut ? props.shortcut.length + 3 : 0) +
        2
      }
      border
      borderColor={
        props.disabled ? theme.selected : active() || props.primary ? theme.accent : theme.border
      }
      backgroundColor={
        props.primary && !props.disabled
          ? theme.accent
          : active()
            ? theme.border
            : props.disabled
              ? theme.surface
              : theme.selected
      }
      alignItems="center"
      justifyContent="center"
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 0 && !props.disabled) props.onPress();
      }}
    >
      <text
        height={1}
        wrapMode="none"
        selectable={false}
        fg={
          props.disabled
            ? theme.muted
            : props.primary
              ? theme.background
              : active()
                ? theme.background
                : theme.text
        }
      >
        <b>{props.icon ? `${props.icon} ${props.label}` : props.label}</b>
        <Show when={props.shortcut}>{` · ${props.shortcut}`}</Show>
      </text>
    </box>
  );
}

export function MenuOption(props: {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  compact?: boolean;
  shortcut: string;
  width: number;
  focused: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = createSignal(false);
  const active = () => !props.disabled && (props.focused || hovered());
  return (
    <box
      id={props.id}
      height={props.compact ? 1 : props.description ? 3 : 2}
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={props.description ? 1 : 0}
      backgroundColor={active() ? theme.selected : theme.background}
      flexDirection="column"
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 0 && !props.disabled) props.onPress();
      }}
    >
      <box flexDirection="row" height={1} flexShrink={0}>
        <text
          height={1}
          flexGrow={1}
          wrapMode="none"
          fg={props.disabled ? theme.muted : active() ? theme.accent : theme.text}
        >
          <b>
            {fit(
              `${props.focused ? "> " : "  "}${props.icon ? `${props.icon} ` : ""}${props.title}`,
              props.width - 8,
            )}
          </b>
        </text>
        <text height={1} width={6} selectable={false} fg={theme.muted}>
          {props.shortcut}
        </text>
      </box>
      <Show when={props.description}>
        <text height={1} fg={theme.muted} wrapMode="none">
          {fit(`  ${props.description}`, props.width - 2)}
        </text>
      </Show>
    </box>
  );
}
