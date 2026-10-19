import { onCleanup, onMount } from "solid-js";
import { SyntaxStyle, type TextareaRenderable } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { theme } from "../theme";

interface Props {
  readonly height: number;
  readonly query: string;
  readonly focused: boolean;
  readonly onFocus: () => void;
  readonly onChange: (query: string) => void;
}

export function QueryPanel(props: Props) {
  const renderer = useRenderer();
  let editor!: TextareaRenderable;
  const syntax = SyntaxStyle.fromStyles({ keyword: { fg: theme.accent } }, renderer.nativeScene);
  const keywordStyle = syntax.getStyleId("keyword")!;
  function highlight() {
    editor.clearAllHighlights();
    editor.plainText.split("\n").forEach((line, row) => {
      for (const match of line.matchAll(/\b(SELECT|FROM|WHERE|LIMIT|ORDER|BY|GROUP|JOIN|LEFT|RIGHT|INNER|ON|AS|AND|OR|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|NULL|IS|NOT|ASC|DESC|DISTINCT)\b/gi)) {
        const start = Buffer.byteLength(line.slice(0, match.index));
        editor.addHighlight(row, { start, end: start + match[0].length, styleId: keywordStyle });
      }
    });
  }
  onMount(highlight);
  onCleanup(() => syntax.destroy());
  return (
    <box id="query-panel" height={props.height} flexShrink={0} flexDirection="column" overflow="hidden" paddingLeft={1} paddingRight={1}
      onMouseDown={(event) => { if (event.button === 0) props.onFocus(); }}>
      <text height={1} flexShrink={0} fg={props.focused ? theme.accent : theme.text} selectable={false}><b>Consultas</b></text>
      <line_number flexGrow={1} minHeight={0} width="100%" fg={theme.muted} bg={theme.surface} minWidth={3} paddingRight={1}>
        <textarea id="query-editor" ref={editor} initialValue={props.query} focused={props.focused} flexGrow={1} width="100%" height="100%" wrapMode="none"
          textColor={theme.text} backgroundColor={theme.surface} focusedBackgroundColor={theme.surface} focusedTextColor={theme.text}
          selectionBg={theme.selected} selectionFg={theme.accent} cursorColor={theme.accent} syntaxStyle={syntax}
          keyBindings={[{ name: "z", ctrl: true, action: "undo" }, { name: "y", ctrl: true, action: "redo" }, { name: "z", ctrl: true, shift: true, action: "redo" }]}
          onMouseDown={(event) => { if (event.button === 0) props.onFocus(); }}
          onContentChange={() => { props.onChange(editor.plainText); highlight(); }} />
      </line_number>
    </box>
  );
}
