# Product

<!-- impeccable:product-schema 1 -->

## Platform

Terminal (TUI), no navegador ni aplicación móvil. La plataforma TUI no está contemplada por el clasificador web/native de la herramienta de diseño.

## Product Purpose

Preparar un espacio de trabajo SQL con explorador de tablas, editor de consultas, resultados y asistente LLM, usando OpenTUI y SolidJS.

## Capabilities and Constraints

Editor SQL multilínea con cursor, selección, pegado y deshacer. Ratón para enfocar campos, ejecutar consultas, seleccionar filas, desplazar contenido y arrastrar separadores. Borrador local en el asistente, sin envío.

Conexión automática a DBHub local, sin ejecutar SQL al abrir. Catálogo de conexiones nombradas en `config/connections.toml` con una conexión activa; credenciales referenciadas por variable de entorno o `.env`, nunca guardadas en TOML. Cambio de base editando `active` y reiniciando, sin selector en la interfaz. Ctrl+Enter o Ejecutar envía el buffer completo, con solo lectura y hasta 200 filas por conjunto. Resultados reales con columnas dinámicas, múltiples conjuntos, duración y aviso de truncamiento. Reconexión explícita tras timeout o pérdida de transporte; errores seguros sin credenciales. El explorador real está pendiente y no muestra tablas ficticias. No hay modelo LLM ni persistencia. Estado temporal conservado al redimensionar, descartado al salir; cerrar termina el proceso DBHub.

Adaptación automática: explorador desde 80 columnas, vista compacta desde 40 y aviso por debajo de 40×20. Español en la interfaz e identificadores SQL en inglés. Salida con Ctrl+C o clic en Salir; Q es texto. Tab/Shift+Tab recorre editor, resultados y asistente. Enter añade líneas. Ejecución deshabilitada bajo 40×20, mientras conecta/ejecuta o con SQL vacío.

## Brand Commitments

Paleta principalmente negra y amarilla indicada por el usuario. Composición basada en su boceto: explorador lateral y tres paneles apilados, sin caligrafía ni efectos decorativos.

## Stack

TypeScript estricto, Bun, OpenTUI y SolidJS. Ratón, editores, selección y scroll nativos de OpenTUI. Sin dependencias nuevas.
