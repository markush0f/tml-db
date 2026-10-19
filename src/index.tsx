import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { App } from "./app";

const renderer = await createCliRenderer({ exitOnCtrlC: true });
try {
  await render(() => <App />, renderer);
} catch (error) {
  renderer.destroy();
  throw error;
}
