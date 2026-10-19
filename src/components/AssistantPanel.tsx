import { fit, theme } from "../theme";

interface Props {
  readonly height: number;
  readonly width: number;
  readonly message: string;
}

export function AssistantPanel(props: Props) {
  const label = (text: string) => fit(text, props.width - 2);
  return (
    <box height={props.height} flexShrink={0} border={["top"]} borderColor={theme.border} flexDirection="column" paddingLeft={1} paddingRight={1} overflow="hidden">
      <text height={1} fg={theme.text}><b>Asistente LLM</b></text>
      <text height={1} wrapMode="none" fg={theme.muted}>{label("Vista previa · Modelo no conectado")}</text>
      <text height={1} wrapMode="none" fg={theme.muted}>{label(`> ${props.message}`)}</text>
    </box>
  );
}
