import { createSignal } from "solid-js";
import { fit, theme } from "../theme";

/** Compact terminal action with an explicit hit area and visible hover/disabled state. */
export function WorkspaceButton(props: {
  id: string;
  label: string;
  icon?: string;
  width: number;
  primary?: boolean;
  disabled?: boolean;
  focused?: boolean;
  onPress: () => void;
}) {
  const [hovered, setHovered] = createSignal(false);
  return (
    <text
      id={props.id}
      height={1}
      width={props.width}
      flexShrink={0}
      wrapMode="none"
      selectable={false}
      bg={
        props.disabled
          ? theme.surface
          : props.primary
            ? theme.accent
            : hovered() || props.focused
              ? theme.border
              : theme.selected
      }
      fg={
        props.disabled
          ? theme.muted
          : props.primary || hovered() || props.focused
            ? theme.background
            : theme.text
      }
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
      onMouseDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.button === 0 && !props.disabled) props.onPress();
      }}
    >
      <b>
        {`[${fit(`${props.icon ? `${props.icon} ` : ""}${props.label}`, Math.max(0, props.width - 2)).padEnd(Math.max(0, props.width - 2))}]`}
      </b>
    </text>
  );
}
