import { createSignal, For } from "solid-js";
import type { MouseEvent } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { theme } from "../theme";

interface Props {
  readonly id: string;
  readonly vertical?: boolean;
  readonly length: number;
  readonly active: boolean;
  readonly onStart: (event: MouseEvent) => void;
}

export function ResizeHandle(props: Props) {
  const renderer = useRenderer();
  const [hovered, setHovered] = createSignal(false);
  return (
    <box id={props.id} width={props.vertical ? 1 : "100%"} height={props.vertical ? "100%" : 1} flexShrink={0} flexDirection="column"
      onMouseDown={(event) => { if (event.button === 0) { event.preventDefault(); event.stopPropagation(); props.onStart(event); } }}
      onMouseOver={() => { setHovered(true); renderer.setMousePointer(props.vertical ? "col-resize" : "row-resize"); }}
      onMouseOut={() => { setHovered(false); if (!props.active) renderer.setMousePointer("default"); }}>
      <For each={Array.from({ length: props.vertical ? props.length : 1 })}>{() => (
        <text height={1} wrapMode="none" selectable={false} fg={props.active || hovered() ? theme.accent : theme.border}>
          {props.vertical ? "│" : "─".repeat(Math.max(0, props.length))}
        </text>
      )}</For>
    </box>
  );
}
