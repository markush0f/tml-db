# Product

<!-- impeccable:product-schema 1 -->

## Platform

Terminal (TUI), no navegador ni aplicación móvil. La plataforma TUI no está contemplada por el clasificador web/native de la herramienta de diseño.

## Product Purpose

Preparar el diseño de un espacio de trabajo SQL con explorador de tablas, consultas, resultados y asistente LLM, usando OpenTUI y SolidJS.

## Capabilities and Constraints

Maqueta estática con datos ficticios: ocho tablas en `public`, una consulta de muestra y tres registros. Solo Q/Ctrl+C tiene comportamiento; no hay navegación, edición, filtros, scroll, conexión de base de datos, ejecución SQL, modelo LLM ni persistencia. Componentes con props de solo lectura preparados para integración posterior, que queda fuera del alcance actual.

Adaptación automática: explorador desde 80 columnas, vista compacta desde 40 y aviso por debajo de 40×20. Español en la interfaz e identificadores SQL en inglés.

## Brand Commitments

Paleta principalmente negra y amarilla indicada por el usuario. Composición basada en su boceto: explorador lateral y tres paneles apilados, sin caligrafía ni efectos decorativos.

## Stack

TypeScript estricto, Bun, OpenTUI y SolidJS. Sin nuevas dependencias para la maqueta.
