import { expect, test } from "bun:test";
import { measureEditText } from "@opentui/core";
import {
  configureIcons,
  databaseIcon,
  icons,
  iconSets,
  parseIconMode,
  type IconMode,
} from "../../src/tui/icons";

for (const mode of ["nerd-font", "unicode", "ascii"] as const) {
  test(`catálogo ${mode}: objetos distintos y anchura estable`, () => {
    const values = Object.values(iconSets[mode]);
    expect(new Set(values).size).toBe(values.length);
    for (const icon of values) {
      expect(measureEditText(icon, { widthMethod: "wcwidth" })).toBe(mode === "ascii" ? 2 : 1);
      if (mode === "nerd-font") expect(icon).toMatch(/^[\uE000-\uF8FF]$/u);
      else expect(icon).not.toMatch(/[\uE000-\uF8FF\u{F0000}-\u{10FFFF}]/u);
      if (mode === "ascii") expect(icon).toMatch(/^[A-Z]{2}$/);
    }
  });
}

test("Nerd Fonts usa los puntos de código del catálogo oficial", () => {
  expect(iconSets["nerd-font"]).toEqual({
    database: "\uF1C0",
    schema: "\uEA8B",
    table: "\uF0CE",
    column: "\uEB5F",
    row: "\uEB85",
    query: "\uF120",
    assistant: "\uF075",
    search: "\uF002",
    add: "\uF067",
    edit: "\uF040",
    delete: "\uF1F8",
    execute: "\uF04B",
    refresh: "\uF021",
    save: "\uF0C7",
    back: "\uF060",
    close: "\uF00D",
    settings: "\uF085",
    lock: "\uF023",
    write: "\uF09C",
    user: "\uF007",
    server: "\uF233",
    link: "\uF0C1",
    file: "\uF15B",
    warning: "\uF071",
  });
});

test("configura el catálogo compartido sin cambiar su referencia", () => {
  const reference = icons;
  try {
    for (const mode of ["nerd-font", "unicode", "ascii"] as IconMode[]) {
      configureIcons(mode);
      expect(icons).toBe(reference);
      expect(icons).toEqual(iconSets[mode]);
      for (const engine of ["postgres", "mysql", "mariadb", "sqlserver", "sqlite", undefined]) {
        expect(databaseIcon(engine)).toBe(iconSets[mode].database);
      }
    }
  } finally {
    configureIcons("unicode");
  }
});

test("CLI: Unicode por defecto y selección explícita de los tres modos", () => {
  expect(parseIconMode([])).toBe("unicode");
  for (const mode of ["nerd-font", "unicode", "ascii"] as const) {
    expect(parseIconMode(["--icons", mode])).toBe(mode);
    expect(parseIconMode([`--icons=${mode}`])).toBe(mode);
  }
  expect(parseIconMode(["--icons", "ascii", "--icons=unicode"])).toBe("unicode");
});

test("CLI rechaza opciones desconocidas, valores inválidos o ausentes", () => {
  for (const args of [["--icons"], ["--icons="], ["--icons", "auto"], ["--unknown"], ["ascii"]]) {
    expect(() => parseIconMode(args)).toThrow();
  }
});
