import { expect, test } from "bun:test";
import { RGBA, type BoxRenderable, type TextRenderable } from "@opentui/core";
import { testRender } from "@opentui/solid";
import { createSignal } from "solid-js";
import { WorkspaceButton } from "../../src/tui/components/WorkspaceButton";
import { MenuButton } from "../../src/tui/components/MenuPrimitives";
import { theme } from "../../src/tui/theme";

for (const kind of ["compact", "menu"] as const) {
  for (const primary of [false, true]) {
    test(`botón ${kind} ${primary ? "principal" : "secundario"}: apariencia, hover, foco y bloqueo`, async () => {
      const [disabled, setDisabled] = createSignal(false);
      const [focused, setFocused] = createSignal(false);
      let presses = 0;
      let button!: TextRenderable | BoxRenderable;
      const view = await testRender(
        () => (
          <box width={32} height={8}>
            {kind === "compact" ? (
              <WorkspaceButton
                id="button"
                label="Guardar"
                width={12}
                primary={primary}
                disabled={disabled()}
                focused={focused()}
                onPress={() => presses++}
              />
            ) : (
              <MenuButton
                id="button"
                label="Guardar"
                primary={primary}
                disabled={disabled()}
                focused={focused()}
                onPress={() => presses++}
              />
            )}
          </box>
        ),
        { width: 40, height: 10, useMouse: true },
      );
      const background = () =>
        kind === "compact"
          ? (button as TextRenderable).bg
          : (button as BoxRenderable).backgroundColor;
      const draw = async () => {
        await Bun.sleep(10);
        await view.renderOnce();
      };
      try {
        await draw();
        button = view.renderer.root.getChildren()[0]!.getChildren()[0]! as typeof button;
        expect(background()).toEqual(RGBA.fromHex(primary ? theme.accent : theme.selected));
        if (kind === "compact") expect(view.captureCharFrame()).toContain("[Guardar   ]");
        await view.mockMouse.moveTo(button.x + 1, button.y);
        await draw();
        expect(background()).toEqual(RGBA.fromHex(primary ? theme.accent : theme.border));
        await view.mockMouse.click(button.x + 1, button.y + (kind === "menu" ? 1 : 0));
        expect(presses).toBe(1);
        await view.mockMouse.moveTo(38, 8);
        await draw();
        expect(background()).toEqual(RGBA.fromHex(primary ? theme.accent : theme.selected));
        setFocused(true);
        await draw();
        expect(background()).toEqual(RGBA.fromHex(primary ? theme.accent : theme.border));
        setDisabled(true);
        await view.mockMouse.moveTo(button.x + 1, button.y);
        await draw();
        expect(background()).toEqual(RGBA.fromHex(theme.surface));
        await view.mockMouse.click(button.x + 1, button.y + (kind === "menu" ? 1 : 0));
        expect(presses).toBe(1);
      } finally {
        view.renderer.destroy();
      }
    });
  }
}
