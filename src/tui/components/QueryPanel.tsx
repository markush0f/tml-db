import { onCleanup, onMount, For, Show, createMemo, createRenderEffect, on } from "solid-js";
import { SyntaxStyle, type TextareaRenderable } from "@opentui/core";
import { useRenderer } from "@opentui/solid";
import { theme } from "../theme";
import { icons } from "../icons";
import type { SqlSheet } from "../sql-sheets";
import { WorkspaceButton } from "./WorkspaceButton";

interface Props {
  readonly height: number;
  readonly width: number;
  readonly sheets: SqlSheet[];
  readonly activeId: string;
  readonly loading: boolean;
  readonly focused: boolean;
  readonly onFocus: () => void;
  readonly onChange: (id: string, query: string) => void;
  readonly onOpenSheets: () => void;
  readonly actionLabel: string;
  readonly actionDisabled: boolean;
  readonly onExecute: () => void;
}

function SheetEditor(props: { id: string; initialSql: string; active: boolean; focused: boolean; onFocus: () => void; onChange: (sql: string) => void }) {
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
  let savedView: { x: number; y: number; selection: ReturnType<TextareaRenderable["getSelection"]> } | undefined;
  let restorePending = false;
  // Native display:none resizes the view to zero and resets its scroll offset.
  // Capture before hiding, then restore after its next nonzero layout.
  createRenderEffect(on(() => props.active, active => {
    if (!editor) return;
    if (!active) {
      const viewport = editor.editorView.getViewport();
      savedView = { x: viewport.offsetX, y: viewport.offsetY, selection: editor.getSelection() };
    } else if (savedView) {
      editor.editorView.setViewport(savedView.x, savedView.y, Math.max(1, editor.width), Math.max(1, editor.height), false);
      if (savedView.selection) editor.setSelection(savedView.selection.start, savedView.selection.end);
      restorePending = true;
    }
  }));
  function restoreView() {
    if (!restorePending || !savedView || !props.active || editor.width < 1 || editor.height < 1) return;
    const viewport = editor.editorView.getViewport();
    console.error("RESIZEVIEW", viewport, savedView, editor.width, editor.height);
    if (viewport.offsetX === savedView.x && viewport.offsetY === savedView.y) restorePending = false;
    else editor.editorView.setViewport(savedView.x, savedView.y, editor.width, editor.height, false);
    if (savedView.selection) editor.setSelection(savedView.selection.start, savedView.selection.end);
  }
  onMount(highlight);
  onCleanup(() => syntax.destroy());
  return <box visible={props.active} flexGrow={props.active ? 1 : 0} height={props.active ? undefined : 0} minHeight={0} flexDirection="column" overflow="hidden">
    <line_number flexGrow={1} minHeight={0} width="100%" fg={theme.muted} bg={theme.background} minWidth={3} paddingRight={1}>
      <textarea id={props.active ? "query-editor" : `query-editor-${props.id}`} ref={editor}
        initialValue={props.initialSql} focused={props.active && props.focused} flexGrow={1} width="100%" height="100%" wrapMode="none"
        textColor={theme.text} backgroundColor={theme.background} focusedBackgroundColor={theme.background} focusedTextColor={theme.text}
        selectionBg={theme.selected} selectionFg={theme.accent} cursorColor={theme.accent} syntaxStyle={syntax}
        keyBindings={[{ name: "z", ctrl: true, action: "undo" }, { name: "y", ctrl: true, action: "redo" }, { name: "z", ctrl: true, shift: true, action: "redo" }]}
        onMouseDown={(event) => { if (event.button === 0) props.onFocus(); }}
        onSizeChange={restoreView}
        onContentChange={() => { props.onChange(editor.plainText); highlight(); }} />
    </line_number>
  </box>;
}

export function QueryPanel(props: Props) {
  const ready = createMemo((wasReady: boolean) => wasReady || !props.loading, false);
  const selectorWidth = () => Math.max(3, Math.min(32, props.width - (props.actionLabel.length + 15 + icons.execute.length) - (icons.query.length + 5) - 3));
  return <box id="query-panel" height={props.height} flexShrink={0} flexDirection="column" overflow="hidden" backgroundColor={theme.background}
    onMouseDown={(event) => { if (event.button === 0) props.onFocus(); }}>
    <box height={1} flexShrink={0} flexDirection="row" gap={1}>
      <text height={1} flexShrink={0} fg={props.focused ? theme.accent : theme.muted} selectable={false}><b>{` ${icons.query} SQL`}</b></text>
      <WorkspaceButton id="sql-sheets-button" label={props.sheets.find(s => s.id === props.activeId)?.name ?? "Hojas"} width={selectorWidth()} disabled={props.loading} onPress={props.onOpenSheets} />
      <box flexGrow={1} />
      <WorkspaceButton id="execute-button" label={`${props.actionLabel}  Ctrl+Enter`} icon={props.actionLabel === "Reconectar" ? icons.refresh : icons.execute}
        width={props.actionLabel.length + 15 + icons.execute.length} primary disabled={props.actionDisabled} onPress={props.onExecute} />
    </box>
    <box flexGrow={1} minHeight={0} flexDirection="column" border borderStyle="rounded" borderColor={props.focused ? theme.accent : theme.border} paddingLeft={1} paddingRight={1}>
      <Show when={ready()} fallback={<text fg={theme.muted}>Cargando hojas…</text>}>
        <For each={props.sheets.map(s => s.id)}>{id => <SheetEditor id={id} initialSql={props.sheets.find(s => s.id === id)!.sql}
          active={props.activeId === id} focused={props.focused} onFocus={props.onFocus} onChange={sql => props.onChange(id, sql)} />}</For>
      </Show>
    </box>
  </box>;
}
