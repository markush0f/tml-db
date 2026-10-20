export interface LayoutPreferences {
  readonly sidebar?: number;
  readonly results?: number;
  readonly assistant?: number;
}

export const MIN_QUERY_HEIGHT = 4;
export const MIN_RESULTS_HEIGHT = 5;
export const MIN_ASSISTANT_HEIGHT = 3;
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(Math.round(value), max));

export function workspaceLayout(
  width: number,
  height: number,
  preferences: LayoutPreferences = {},
) {
  const compact = width < 80;
  // Keep hidden panels valid even when the terminal is too small to display them.
  const availableWidth = Math.max(40, width) - 2;
  const bodyHeight = Math.max(20, height) - 4;
  const sidebarWidth = compact
    ? 0
    : clamp(preferences.sidebar ?? (width >= 100 ? 26 : 22), 18, availableWidth - 36);
  const assistantHeight = clamp(
    preferences.assistant ?? Math.floor(bodyHeight * 0.15) - 1,
    MIN_ASSISTANT_HEIGHT,
    bodyHeight - 2 - MIN_QUERY_HEIGHT - MIN_RESULTS_HEIGHT,
  );
  const resultsHeight = clamp(
    preferences.results ?? Math.floor(bodyHeight * 0.25) - 1,
    MIN_RESULTS_HEIGHT,
    bodyHeight - 2 - MIN_QUERY_HEIGHT - assistantHeight,
  );
  return {
    compact,
    bodyHeight,
    sidebarWidth,
    mainWidth: availableWidth - sidebarWidth,
    resultsHeight,
    assistantHeight,
    queryHeight: bodyHeight - resultsHeight - assistantHeight - 2,
  };
}
