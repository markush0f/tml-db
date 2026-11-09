import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { App } from "./app";
import { configureIcons, parseIconMode } from "./icons";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(
    "Uso: bun run start [--icons nerd-font|unicode|ascii]\nIconos predeterminados: unicode, sin fuentes especiales. nerd-font requiere una Nerd Font seleccionada en la terminal.",
  );
  process.exit(0);
}
try {
  configureIcons(parseIconMode(args));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Argumentos inválidos");
  process.exit(1);
}

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  useMouse: true,
  enableMouseMovement: true,
});
try {
  await render(() => <App />, renderer);
} catch (error) {
  renderer.destroy();
  throw error;
}
