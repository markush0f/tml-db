import { expect, test } from "bun:test";
import { testRender } from "@opentui/solid";
import type { Renderable, TextareaRenderable } from "@opentui/core";
import { App } from "../../src/tui/app";
import type { ConnectionManager, ConnectionSummary } from "../../src/db/connection-manager";

type View = Awaited<ReturnType<typeof testRender>>;
async function draw(view: View) {
  await Bun.sleep(15);
  await view.renderOnce();
  await Bun.sleep(5);
  await view.renderOnce();
  return view.captureCharFrame();
}
function find(view: View, id: string): Renderable {
  function visit(node: Renderable): Renderable | undefined {
    if (node.id === id) return node;
    for (const child of node.getChildren()) {
      const found = visit(child as Renderable);
      if (found) return found;
    }
  }
  const node = visit(view.renderer.root);
  if (!node) throw new Error(`Missing ${id}`);
  return node;
}
async function click(view: View, id: string) {
  if (["connection-edit", "connection-write", "connection-delete"].includes(id)) {
    await click(view, "connection-more");
  }
  const node = find(view, id);
  await view.mockMouse.click(node.x, node.y);
  return draw(view);
}
async function newUrlForm(view: View, name: string) {
  await click(view, "connection-new");
  await click(view, "connection-import");
  view.mockInput.pressTab();
  await draw(view);
  await view.mockInput.typeText(name);
  view.mockInput.pressTab({ shift: true });
  await draw(view);
}
function setup() {
  let entries: ConnectionSummary[] = [
    { name: "dev", kind: "llavero" },
    { name: "demo", kind: "demo" },
  ];
  const saved: string[][] = [];
  const removed: string[] = [];
  const connected: (string | undefined)[] = [];
  let closes = 0;
  const manager: ConnectionManager = {
    list: async () => ({ active: "dev", connections: entries }),
    save: async (name, dsn, replace) => {
      saved.push([name, dsn, String(replace)]);
      if (!replace) entries = [...entries, { name, kind: "llavero" }];
    },
    setWriteEnabled: async (name, enabled) => {
      entries = entries.map((entry) =>
        entry.name === name ? { ...entry, writeEnabled: enabled } : entry,
      );
    },
    remove: async (name) => {
      removed.push(name);
      entries = entries.filter((e) => e.name !== name);
    },
  };
  const connect = async (name?: string) => {
    connected.push(name);
    return {
      writeEnabled: entries.find((entry) => entry.name === (name ?? "dev"))?.writeEnabled === true,
      close: async () => {
        closes++;
      },
      execute: async () => ({ statements: [], durationMs: 1 }),
    };
  };
  return { manager, connect, saved, removed, connected, closes: () => closes };
}
for (const width of [120, 40]) {
  test(`selector ${width}: buscar, cambiar, conservar SQL y restaurar foco`, async () => {
    const fixture = setup();
    const view = await testRender(
      () => <App connect={fixture.connect} connections={fixture.manager} />,
      { width, height: 24, useMouse: true },
    );
    try {
      await draw(view);
      const editor = find(view, "query-editor") as TextareaRenderable;
      const sql = editor.plainText;
      await click(view, width === 40 ? "connection-header" : "connection-sidebar");
      expect(await draw(view)).toContain("Gestionar conexiones");
      await view.mockInput.typeText("demo");
      await draw(view);
      view.mockInput.pressEnter();
      await draw(view);
      expect(fixture.connected).toEqual([undefined, "demo"]);
      expect(fixture.closes()).toBe(1);
      expect(editor.plainText).toBe(sql);
      view.mockInput.pressKey("k", { ctrl: true });
      await draw(view);
      view.mockInput.pressEscape();
      await draw(view);
      expect(editor.focused).toBe(true);
    } finally {
      view.renderer.destroy();
    }
  });
}
for (const width of [120, 40]) {
  test(`escritura ${width}: confirmar activación, reconectar activa y deshabilitar`, async () => {
    const fixture = setup();
    const view = await testRender(
      () => <App connect={fixture.connect} connections={fixture.manager} />,
      { width, height: 24, useMouse: true },
    );
    try {
      await draw(view);
      view.mockInput.pressKey("k", { ctrl: true });
      await draw(view);
      view.mockInput.pressKey("w", { ctrl: true });
      expect(await draw(view)).toContain("Habilitar escritura");
      expect((await fixture.manager.list()).connections[0]!.writeEnabled).toBeUndefined();
      view.mockInput.pressEscape();
      await draw(view);
      expect(fixture.connected).toEqual([undefined]);
      await click(view, "connection-write");
      await click(view, "connection-confirm-write");
      expect(await draw(view)).toContain(
        width === 40 ? "DBHub local · Escritura" : "Conectado · Escritura",
      );
      expect(fixture.connected).toEqual([undefined, "dev"]);
      expect(fixture.closes()).toBe(1);
      view.mockInput.pressKey("k", { ctrl: true });
      await draw(view);
      await click(view, "connection-write");
      expect(await draw(view)).toContain(
        width === 40 ? "DBHub local · Solo lectura" : "Conectado · Solo lectura",
      );
      expect(fixture.closes()).toBe(2);
    } finally {
      view.renderer.destroy();
    }
  });
}

for (const width of [120, 40]) {
  test(`modo directo ${width}: conexión activa, cancelación, SQL intacto y sin ejecución automática`, async () => {
    const fixture = setup();
    let executions = 0;
    const connect = async (name?: string) => ({
      ...(await fixture.connect(name)),
      execute: async () => {
        executions++;
        return { statements: [], durationMs: 1 };
      },
    });
    const view = await testRender(() => <App connect={connect} connections={fixture.manager} />, {
      width,
      height: 24,
      useMouse: true,
    });
    try {
      await draw(view);
      // Change to the second entry so the direct action must locate the active connection.
      view.mockInput.pressKey("k", { ctrl: true });
      await draw(view);
      await view.mockInput.typeText("demo");
      await draw(view);
      view.mockInput.pressEnter();
      await draw(view);
      const editor = find(view, "query-editor") as TextareaRenderable;
      const sql = editor.plainText;
      await click(view, "write-mode-toggle");
      const confirmation = await draw(view);
      expect(confirmation).toContain("Habilitar escritura");
      expect(confirmation).toContain("demo");
      expect(confirmation).toContain("Sin más");
      view.mockInput.pressEscape();
      expect(await draw(view)).not.toContain("Gestionar conexiones");
      expect(editor.focused).toBe(true);
      expect(fixture.connected).toEqual([undefined, "demo"]);
      view.mockInput.pressKey("w", { ctrl: true });
      await draw(view);
      await click(view, "connection-confirm-write");
      expect(await draw(view)).toContain("Escritura");
      expect(
        (await fixture.manager.list()).connections.find((e) => e.name === "demo")!.writeEnabled,
      ).toBe(true);
      expect(
        (await fixture.manager.list()).connections.find((e) => e.name === "dev")!.writeEnabled,
      ).toBeUndefined();
      expect(fixture.connected).toEqual([undefined, "demo", "demo"]);
      expect(editor.plainText).toBe(sql);
      await click(view, "write-mode-toggle");
      expect(await draw(view)).toContain("Solo lectura");
      expect(fixture.connected).toEqual([undefined, "demo", "demo", "demo"]);
      expect(editor.plainText).toBe(sql);
      expect(executions).toBe(0);
    } finally {
      view.renderer.destroy();
    }
  });
}

test("cambio directo bloqueado durante conexión y ejecución", async () => {
  const fixture = setup();
  let resolveConnect!: () => void;
  let resolveQuery!: () => void;
  const connecting = new Promise<void>((resolve) => {
    resolveConnect = resolve;
  });
  const querying = new Promise<void>((resolve) => {
    resolveQuery = resolve;
  });
  const view = await testRender(
    () => (
      <App
        connections={fixture.manager}
        connect={async () => {
          await connecting;
          return {
            ...(await fixture.connect()),
            execute: async () => {
              await querying;
              return { statements: [], durationMs: 1 };
            },
          };
        }}
      />
    ),
    { width: 80, height: 24, useMouse: true },
  );
  try {
    await draw(view);
    view.mockInput.pressKey("w", { ctrl: true });
    await click(view, "write-mode-toggle");
    expect(await draw(view)).not.toContain("Habilitar escritura");
    resolveConnect();
    await draw(view);
    await click(view, "execute-button");
    expect(await draw(view)).toContain("Ejecutando");
    view.mockInput.pressKey("w", { ctrl: true });
    await click(view, "write-mode-toggle");
    expect(await draw(view)).not.toContain("Habilitar escritura");
    expect((await fixture.manager.list()).connections[0]!.writeEnabled).toBeUndefined();
  } finally {
    resolveConnect();
    resolveQuery();
    view.renderer.destroy();
  }
});

test("registro oculto, sustitución, cancelación y eliminación con confirmación", async () => {
  const fixture = setup();
  const view = await testRender(
    () => <App connect={fixture.connect} connections={fixture.manager} />,
    { width: 80, height: 24, useMouse: true },
  );
  try {
    await draw(view);
    view.mockInput.pressKey("k", { ctrl: true });
    await draw(view);
    await newUrlForm(view, "prod");
    const dsn = "postgres://alice:super-secret@localhost/db";
    await view.mockInput.pasteBracketedText(dsn);
    const frame = await draw(view);
    expect(frame).toContain("***");
    expect(frame).not.toContain("super-secret");
    expect(frame).not.toContain("alice");
    view.mockInput.pressEnter();
    await draw(view);
    expect(fixture.saved).toEqual([["prod", dsn, "false"]]);
    await view.mockInput.typeText("prod");
    await draw(view);
    await click(view, "connection-edit");
    expect(await draw(view)).not.toContain("super-secret");
    await view.mockInput.pasteBracketedText("postgres://new-secret@localhost/db");
    await click(view, "connection-save");
    expect(fixture.saved[1]).toEqual(["prod", "postgres://new-secret@localhost/db", "true"]);
    await view.mockInput.typeText("prod");
    await draw(view);
    await click(view, "connection-delete");
    expect(fixture.removed).toEqual([]);
    view.mockInput.pressEscape();
    await draw(view);
    await click(view, "connection-delete");
    await click(view, "connection-confirm-delete");
    expect(fixture.removed).toEqual(["prod"]);
    await newUrlForm(view, "cancelled");
    await view.mockInput.pasteBracketedText(dsn);
    view.mockInput.pressEscape();
    await draw(view);
    await click(view, "connection-new");
    expect(await draw(view)).not.toContain("***");
    expect(fixture.saved.length).toBe(2);
  } finally {
    view.renderer.destroy();
  }
});
for (const [width, height] of [
  [120, 30],
  [80, 24],
  [40, 20],
] as const) {
  test(`formulario ${width}×${height}: jerarquía, límites, foco y URL oculta`, async () => {
    const fixture = setup();
    const view = await testRender(
      () => <App connect={fixture.connect} connections={fixture.manager} />,
      { width, height, useMouse: true },
    );
    try {
      await draw(view);
      view.mockInput.pressKey("k", { ctrl: true });
      await draw(view);
      await newUrlForm(view, "production");
      const picker = find(view, "connection-picker");
      expect(picker.width).toBe(Math.min(104, width - 4));
      expect(picker.height).toBe(height - 2);
      expect(find(view, "connection-name").height).toBe(3);
      expect(find(view, "connection-secret").height).toBe(3);
      expect(find(view, "connection-save").height).toBe(3);
      const dsn = "postgres://alice:secret@localhost/production";
      await view.mockInput.pasteBracketedText(dsn);
      const frame = await draw(view);
      expect(frame).toContain("URL de conexión · oculta");
      expect(frame).toContain("Cancelar");
      expect(frame).toContain("***");
      expect(frame).not.toContain("alice");
      expect(frame).not.toContain("secret");
      expect(find(view, "connection-cancel").y + 3).toBeLessThanOrEqual(height - 1);
      view.mockInput.pressTab();
      await draw(view);
      expect(await draw(view)).toContain("Nombre de la conexión");
      view.mockInput.pressTab();
      view.mockInput.pressTab();
      view.mockInput.pressTab({ shift: true });
      view.mockInput.pressEnter();
      await draw(view);
      expect(fixture.saved).toEqual([["production", dsn, "false"]]);
    } finally {
      view.renderer.destroy();
    }
  });
}

test("formulario: conserva datos al reducir terminal y muestra errores sin revelar URL", async () => {
  const fixture = setup();
  fixture.manager.save = async () => {
    throw new Error("No se pudo guardar en el llavero.");
  };
  const view = await testRender(
    () => <App connect={fixture.connect} connections={fixture.manager} />,
    { width: 120, height: 30, useMouse: true },
  );
  try {
    await draw(view);
    view.mockInput.pressKey("k", { ctrl: true });
    await draw(view);
    await newUrlForm(view, "prod");
    await view.mockInput.pasteBracketedText("postgres://private@localhost/db");
    view.resize(40, 20);
    let frame = await draw(view);
    expect(frame).toContain("***");
    await click(view, "connection-save");
    frame = await draw(view);
    expect(frame).toContain("No se pudo guardar");
    expect(frame).toContain("llavero.");
    expect(frame).toContain("Cancelar");
    expect(frame).not.toContain("private");
    expect(frame).not.toContain("***");
    expect(find(view, "connection-picker").height).toBeLessThanOrEqual(18);
    await click(view, "connection-cancel");
    expect(await draw(view)).toContain("Gestionar conexiones");
  } finally {
    view.renderer.destroy();
  }
});

for (const [width, height] of [
  [120, 42],
  [80, 24],
  [40, 20],
] as const) {
  test(`campos ${width}×${height}: motor, navegación, contraseña oculta y guardado real`, async () => {
    const fixture = setup();
    const view = await testRender(
      () => <App connect={fixture.connect} connections={fixture.manager} />,
      { width, height, useMouse: true },
    );
    try {
      await draw(view);
      view.mockInput.pressKey("k", { ctrl: true });
      await draw(view);
      await click(view, "connection-new");
      const initial = await draw(view);
      expect(initial).toContain("Tipo de conexión");
      expect(initial).not.toContain("SSL");
      expect(initial).not.toContain("SSH");
      expect(initial).toContain("Guardar");
      view.mockInput.pressArrow("right");
      view.mockInput.pressTab();
      await draw(view);
      view.mockInput.pressKey("u", { ctrl: true });
      await view.mockInput.typeText("db.local");
      view.mockInput.pressTab();
      await draw(view);
      expect(await draw(view)).toContain("3306");
      view.mockInput.pressTab();
      await draw(view);
      await view.mockInput.typeText("alice");
      view.mockInput.pressTab();
      await draw(view);
      await view.mockInput.pasteBracketedText("p@ssword");
      let frame = await draw(view);
      expect(frame).toContain("********");
      expect(frame).not.toContain("p@ssword");
      view.mockInput.pressTab();
      await draw(view);
      await view.mockInput.typeText("app");
      view.mockInput.pressTab();
      await draw(view);
      await view.mockInput.typeText("mysql-prod");
      frame = await draw(view);
      expect(frame).toContain("Nombre de la conexión");
      expect(frame).toContain("mysql-prod");
      expect(frame).toContain("Cancelar");
      view.mockInput.pressTab();
      view.mockInput.pressEnter();
      await draw(view);
      expect(fixture.saved).toEqual([
        ["mysql-prod", "mysql://alice:p%40ssword@db.local:3306/app", "false"],
      ]);
      expect(fixture.connected).toEqual([undefined]);
    } finally {
      view.renderer.destroy();
    }
  });
}

test("selector de motor con ratón, SQLite sin campos de red y cancelación limpia", async () => {
  const fixture = setup();
  const view = await testRender(
    () => <App connect={fixture.connect} connections={fixture.manager} />,
    { width: 120, height: 42, useMouse: true },
  );
  try {
    await draw(view);
    view.mockInput.pressKey("k", { ctrl: true });
    await draw(view);
    await click(view, "connection-new");
    await click(view, "connection-engine");
    await click(view, "connection-engine-sqlite");
    let frame = await draw(view);
    expect(frame).toContain("Archivo SQLite");
    expect(frame).not.toContain("Contraseña");
    expect(frame).not.toContain("Puerto");
    view.mockInput.pressTab();
    await draw(view);
    await view.mockInput.typeText("/tmp/app.sqlite");
    view.mockInput.pressTab();
    await draw(view);
    await view.mockInput.typeText("sqlite-dev");
    await click(view, "connection-save");
    expect(fixture.saved).toEqual([["sqlite-dev", "sqlite:///tmp/app.sqlite", "false"]]);
    await newUrlForm(view, "cancelled");
    await view.mockInput.pasteBracketedText("mysql://private@localhost/db");
    await click(view, "connection-cancel");
    await click(view, "connection-new");
    await click(view, "connection-import");
    frame = await draw(view);
    expect(frame).not.toContain("***");
    expect(frame).not.toContain("private");
  } finally {
    view.renderer.destroy();
  }
});

test("no permite eliminar la conexión activa y aísla Ctrl+Enter del editor", async () => {
  const fixture = setup();
  const view = await testRender(
    () => <App connect={fixture.connect} connections={fixture.manager} />,
    { width: 40, height: 20, useMouse: true },
  );
  try {
    await draw(view);
    view.mockInput.pressKey("k", { ctrl: true });
    await draw(view);
    await click(view, "connection-delete");
    expect(await draw(view)).toContain("Cambia a otra conexión");
    await click(view, "connection-new");
    await view.mockInput.pressKeys(["\x1b[13;5u"]);
    await draw(view);
    expect(fixture.connected.length).toBe(1);
    expect(fixture.removed.length).toBe(0);
    const frame = await draw(view);
    expect(frame.split("\n").length).toBeLessThanOrEqual(21);
    for (const line of frame.split("\n")) expect(Array.from(line).length).toBeLessThanOrEqual(40);
  } finally {
    view.renderer.destroy();
  }
});
