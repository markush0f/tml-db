# tml-db

Ejemplo mínimo de una aplicación de terminal con OpenTUI y SolidJS.

## Panel de ejemplo

Ejecuta `bun run start` desde una terminal interactiva.

- **Inicio:** contador reactivo con Solid Stores.
- **Actividad:** últimas cinco acciones de la sesión.
- **Ayuda:** listado de atajos.

**Tab / flechas:** cambiar sección · **Espacio / +:** incrementar · **R:** reiniciar · **Q / Ctrl+C:** salir.

No conecta bases de datos ni persiste información. El contenido se adapta al ancho de la terminal y permite desplazamiento con la rueda del ratón.

## Stack

| Área | Tecnología |
| --- | --- |
| Lenguaje | TypeScript (modo estricto) |
| Runtime | Bun |
| Interfaz de terminal | `@opentui/core` |
| UI reactiva | SolidJS con `@opentui/solid` |
| Motor de renderizado | Zig, incluido en OpenTUI |
| Estado de interfaz | Solid Stores (`solid-js/store`) |
| Atajos de teclado | `@opentui/keymap` |
| Resaltado de código | Tree-sitter (`web-tree-sitter`, compatible con OpenTUI) |
| Editor SQL | Componente propio sobre OpenTUI, pendiente de implementar |
| Formateo SQL | `sql-formatter` |

SolidJS está fijado a la versión requerida por `@opentui/solid`.
El resaltado y la gramática SQL se configurarán al implementar el editor.

## Requisitos

- Bun >= 1.3.14 (en Windows ARM64, >= 1.4.0).

## Comandos

```sh
bun install          # Instalar dependencias
bun run dev         # Ejecutar en modo watch
bun run start       # Ejecutar el punto de entrada
bun run typecheck   # Comprobar tipos
bun test            # Probar interfaz y atajos en 80 y 40 columnas
```

El punto de entrada es `src/index.tsx` y el panel está en `src/app.tsx`.
`tsconfig.json` configura JSX para OpenTUI y `bunfig.toml` carga el plugin de SolidJS.

Documentación: https://opentui.com/docs
