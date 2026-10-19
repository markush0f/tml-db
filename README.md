# tml-db

Maqueta estática de un espacio de trabajo SQL en terminal con OpenTUI y SolidJS. Inspirada en un explorador de bases de datos: árbol lateral y paneles de consultas, resultados y asistente LLM.

## Vista previa

- **Explorador:** conexión ficticia `demo_local`, esquema `public` con ocho tablas y `users` resaltada.
- **Consultas:** SQL de muestra con números de línea y palabras clave acentuadas.
- **Resultados:** tres registros ficticios; correos bajo `example.com`.
- **Asistente LLM:** mensaje y prompt visual, sin modelo conectado.

Todo el contenido es de ejemplo. No hay edición, navegación, filtros, scroll, ejecución SQL, conexiones, llamadas LLM ni persistencia. **Q / Ctrl+C** cierra la aplicación; las demás teclas no modifican la vista.

Desde 80 columnas se muestra el explorador. Entre 40 y 79 se oculta y los resultados muestran solo `id` y `name`. Por debajo de 40 columnas o 20 filas se muestra un aviso de tamaño mínimo. El diseño se adapta automáticamente al redimensionar la terminal.

## Requisitos y comandos

Bun >= 1.3.14 (en Windows ARM64, >= 1.4.0).

```sh
bun install
bun run dev         # Modo watch
bun run start       # Ejecutar en una terminal interactiva
bun run typecheck   # Comprobar tipos
bun test            # Renderizado, adaptación, inmovilidad y salida
```

## Organización

- `src/index.tsx`: inicio y limpieza del renderer.
- `src/app.tsx`: composición adaptable y salida.
- `src/components/`: `DatabaseSidebar`, `QueryPanel`, `ResultsPanel`, `AssistantPanel`; componentes de presentación con props de solo lectura.
- `src/demo-data.ts`: datos ficticios y contratos `WorkspacePreview`, `SchemaPreview`, `ResultPreview` para una integración posterior.
- `src/theme.ts`: paleta y truncado de etiquetas.
- `docs/workspace-preview.md`: contrato visual de desarrollo.

TypeScript estricto, Bun, OpenTUI y SolidJS. `bunfig.toml` carga el plugin de SolidJS y `tsconfig.json` configura JSX para OpenTUI. Se mantienen las dependencias existentes; keymap, Tree-sitter y sql-formatter no se inicializan en esta maqueta.

Documentación de OpenTUI: https://opentui.com/docs
