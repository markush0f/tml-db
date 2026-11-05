import { Show, type JSX } from "solid-js";
import { fit, theme } from "../theme";

/** Shared chrome: title, breathing room, scroll-safe body and a fixed action footer. */
export function MenuFrame(props: {
  width: number;
  height: number;
  title: string;
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
      id="connection-picker"
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
            <b>{fit(props.title, textWidth() - 5)}</b>
          </text>
          <text
            id="connection-close"
            height={1}
            width={3}
            selectable={false}
            fg={props.closeFocused ? theme.accent : theme.muted}
            bg={props.closeFocused ? theme.selected : theme.surface}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (event.button === 0) props.onClose();
            }}
          >
            Esc
          </text>
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
  shortcut?: string;
  primary?: boolean;
  focused?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <box
      id={props.id}
      height={3}
      flexShrink={0}
      flexGrow={1}
      flexBasis={0}
      border
      borderColor={
        props.focused || (props.primary && !props.disabled) ? theme.accent : theme.border
      }
      backgroundColor={
        props.primary && !props.disabled
          ? theme.accent
          : props.focused
            ? theme.selected
            : theme.surface
      }
      alignItems="center"
      justifyContent="center"
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
              : props.focused
                ? theme.accent
                : theme.text
        }
      >
        <b>{props.label}</b>
        <Show when={props.shortcut}>{` · ${props.shortcut}`}</Show>
      </text>
    </box>
  );
}

export function MenuOption(props: {
  id: string;
  title: string;
  description?: string;
  compact?: boolean;
  shortcut: string;
  width: number;
  focused: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <box
      id={props.id}
      height={props.compact ? 1 : props.description ? 3 : 2}
      flexShrink={0}
      paddingLeft={1}
      paddingRight={1}
      paddingTop={props.description ? 1 : 0}
      backgroundColor={props.focused ? theme.selected : theme.background}
      flexDirection="column"
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
          fg={props.disabled ? theme.muted : props.focused ? theme.accent : theme.text}
        >
          <b>{fit(`${props.focused ? "> " : "  "}${props.title}`, props.width - 10)}</b>
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
