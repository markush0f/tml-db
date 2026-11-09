import type { JSX } from "solid-js";
import { theme } from "../theme";

/** Compact workspace tab with a rule that follows the available terminal width. */
export function PanelHeading(props: {
  label: string;
  icon?: string;
  focused: boolean;
  width: number;
  children?: JSX.Element;
}) {
  return (
    <box height={1} flexShrink={0} flexDirection="row" overflow="hidden">
      <text
        height={1}
        flexShrink={0}
        fg={props.focused ? theme.accent : theme.text}
        bg={theme.selected}
        selectable={false}
        wrapMode="none"
      >
        <b>{` ${props.icon ? `${props.icon} ` : ""}${props.label} `}</b>
      </text>
      {props.children}
      <text
        width={0}
        minWidth={0}
        flexGrow={1}
        wrapMode="none"
        fg={theme.border}
        selectable={false}
      >
        {` ${"─".repeat(Math.max(0, props.width))}`}
      </text>
    </box>
  );
}
