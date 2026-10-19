# tml-db

Espacio de trabajo SQL en terminal con OpenTUI y SolidJS. Explorador de tablas, editor de consultas, resultados y asistente LLM. La edición y el ratón funcionan localmente; los datos siguen siendo ficticios y no hay servicios conectados.

## Uso

- **Consultas:** editor multilínea con números de línea, acentos de palabras clave, selección, pegado y deshacer. Tiene el foco al iniciar. Haz clic para colocar el cursor, arrastra para seleccionar y usa la rueda para desplazarte.
- **Explorador:** haz clic en un esquema para abrirlo/cerrarlo o en una tabla para resaltarla. El campo superior filtra tablas por nombre. La rueda y la barra de desplazamiento funcionan cuando el árbol excede su espacio.
- **Tamaños:** arrastra la línea vertical para cambiar el ancho del explorador. Arrastra la línea sobre Resultados para ampliar/reducir la tabla, o la línea sobre el asistente para redistribuir su espacio. El separador se vuelve amarillo al apuntarlo. Los mínimos evitan ocultar los paneles.
- **Resultados:** clic para enfocar/seleccionar una fila; rueda o barra para desplazarte. Siguen siendo tres registros de ejemplo, no resultados del SQL editado.
- **Asistente:** clic para escribir un borrador local. No envía mensajes ni se conecta a un modelo.
- **Salir:** clic en `[Salir]` o **Ctrl+C**. `Q` es texto normal y ya no cierra la aplicación.

**Tab / Shift+Tab** cambia de panel/campo. **Escape** termina un arrastre y vuelve a Consultas. **Ctrl+Z** deshace y **Ctrl+Y / Ctrl+Shift+Z** rehace en los editores. Enter añade una línea; Tab cambia el foco (para sangrar, usa espacios).

El texto y los ajustes se conservan al redimensionar la terminal, pero son temporales y se pierden al salir. Desde 80 columnas se muestra el explorador; entre 40 y 79 se oculta. La tabla muestra `id` y `name` si no hay ancho para email. Por debajo de 40 columnas o 20 filas se muestra un aviso, sin perder los buffers del editor.

El ratón se activa explícitamente; se necesita una terminal compatible con eventos de ratón. Sin ratón se puede editar y cambiar el foco con el teclado.

## Requisitos y comandos

Bun >= 1.3.14 (en Windows ARM64, >= 1.4.0).

```sh
bun install
bun run dev         # Modo watch
bun run start       # Ejecutar en una terminal interactiva
bun run typecheck   # Comprobar tipos
bun test            # Edición, ratón, separadores, adaptación y salida
```

## Organización

- `src/index.tsx`: inicio, ratón y limpieza del renderer.
- `src/app.tsx`: estado local, foco, composición y captura de arrastre.
- `src/components/`: explorador, editor SQL, resultados, borrador LLM y separadores reutilizables.
- `src/workspace-layout.ts`: cálculo de tamaños y límites.
- `src/demo-data.ts`: datos ficticios y contratos de datos de solo lectura.
- `src/theme.ts`: paleta y truncado de etiquetas.
- `docs/workspace-preview.md`: contrato de superficie.

Sin conexión de base de datos, ejecución SQL, llamadas LLM ni persistencia. Sin nuevas dependencias: los editores, selección, scroll y eventos usan OpenTUI. El resaltado es local y sencillo, no un parser SQL. No se inicializan Tree-sitter, sql-formatter ni keymap.

Documentación de OpenTUI: https://opentui.com/docs
