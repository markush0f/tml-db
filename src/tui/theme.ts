export const theme = {
  background: "#000000",
  surface: "#111111",
  selected: "#292929",
  text: "#f5f5f5",
  muted: "#b8b8b8",
  border: "#777777",
  accent: "#ffdf00",
} as const;

export function fit(value: string, width: number): string {
  const chars = Array.from(value);
  return chars.length <= width ? value : `${chars.slice(0, Math.max(0, width - 1)).join("")}…`;
}
