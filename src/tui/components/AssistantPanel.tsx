import type { TextareaRenderable } from "@opentui/core";
import { fit, theme } from "../theme";
import { icons } from "../icons";
import { PanelHeading } from "./PanelHeading";

interface Props {
  readonly height: number;
  readonly width: number;
  readonly message: string;
  readonly draft: string;
  readonly focused: boolean;
  readonly onFocus: () => void;
  readonly onChange: (value: string) => void;
}

export function AssistantPanel(props: Props) {
  let editor!: TextareaRenderable;
  return (
    <box
      id="assistant-panel"
      height={props.height}
      flexShrink={0}
      flexDirection="column"
      backgroundColor={theme.background}
      paddingLeft={1}
      paddingRight={1}
      overflow="hidden"
      onMouseDown={(event) => {
        if (event.button === 0) props.onFocus();
      }}
    >
      <PanelHeading
        label="Asistente LLM"
        icon={icons.assistant}
        focused={props.focused}
        width={props.width}
      >
        <text height={1} fg={theme.muted} selectable={false} wrapMode="none">
          {` ${icons.edit} BORRADOR`}
        </text>
      </PanelHeading>
      <text height={1} flexShrink={0} wrapMode="none" fg={theme.muted} selectable={false}>
        {fit(`${icons.warning} Modelo no conectado`, props.width - 2)}
      </text>
      <textarea
        id="assistant-editor"
        ref={editor}
        initialValue={props.draft}
        placeholder={props.message}
        focused={props.focused}
        flexGrow={1}
        minHeight={1}
        width="100%"
        textColor={theme.text}
        placeholderColor={theme.muted}
        backgroundColor={theme.background}
        focusedBackgroundColor={theme.background}
        focusedTextColor={theme.text}
        selectionBg={theme.selected}
        selectionFg={theme.accent}
        cursorColor={theme.accent}
        wrapMode="word"
        keyBindings={[
          { name: "z", ctrl: true, action: "undo" },
          { name: "y", ctrl: true, action: "redo" },
          { name: "z", ctrl: true, shift: true, action: "redo" },
        ]}
        onMouseDown={(event) => {
          if (event.button === 0) props.onFocus();
        }}
        onContentChange={() => props.onChange(editor.plainText)}
      />
    </box>
  );
}
