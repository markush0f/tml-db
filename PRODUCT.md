# Product

<!-- impeccable:product-schema 1 -->

## Platform

Terminal (TUI), no navegador ni aplicación móvil. La plataforma TUI no está contemplada por el clasificador web/native de la herramienta de diseño.

## Product Purpose

Preparar un espacio de trabajo SQL con explorador de tablas, editor de consultas, resultados y asistente LLM, usando OpenTUI y SolidJS.

## Capabilities and Constraints

Editor SQL local multilínea con cursor, selección, pegado y deshacer. Ratón para enfocar campos, filtrar tablas, abrir/cerrar esquemas, seleccionar tablas/filas, desplazar contenido y arrastrar separadores. Borrador local en el asistente, sin envío.

Datos ficticios: ocho tablas en `public` y tres registros de ejemplo. No hay conexión de base de datos, ejecución SQL, modelo LLM ni persistencia. Editar consultas o seleccionar otra tabla no altera los resultados. Estado temporal conservado al redimensionar, descartado al salir.

Adaptación automática: explorador desde 80 columnas, vista compacta desde 40 y aviso por debajo de 40×20. Español en la interfaz e identificadores SQL en inglés. Salida con Ctrl+C o clic en Salir; Q es texto. Tab/Shift+Tab cambia el foco.

## Brand Commitments

Paleta principalmente negra y amarilla indicada por el usuario. Composición basada en su boceto: explorador lateral y tres paneles apilados, sin caligrafía ni efectos decorativos.

## Stack

TypeScript estricto, Bun, OpenTUI y SolidJS. Ratón, editores, selección y scroll nativos de OpenTUI. Sin dependencias nuevas.
