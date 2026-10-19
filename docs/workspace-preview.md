# Workspace preview — contrato de superficie

Modo: Operate, presentado como maqueta estática. Audiencia: usuario de terminal que prepara un espacio SQL; debe distinguir exploración, consulta, resultados y ayuda sin interpretar los datos como reales.

## Direction contract

**THESIS:** el espacio de trabajo del boceto manda: árbol estrecho a la izquierda y tres regiones apiladas a la derecha, no un dashboard de tarjetas.

**OWN-WORLD:** negro y amarillo existentes, celdas de terminal, gris para jerarquía, marco redondeado y separadores únicos. Sin nuevas fuentes, imágenes ni animación.

**STORY:** explorar visualmente ocho tablas, leer una consulta y sus tres registros ilustrativos, reconocer que el modelo no está conectado. No se promete ninguna operación funcional.

**FIRST VIEWPORT:** cabecera y pie de una fila; explorador de 26/22 columnas; consultas sobre resultados y asistente, con mínimos de seis y cuatro filas para los dos últimos. Compacto sin explorador ni email. Estado mínimo bajo 40×20.

**FORM:** composición fijada por la referencia del usuario y plan aprobado; sin sorteo de conceptos ni comp generado. El único comportamiento es salir; el redimensionado automático conserva la jerarquía.

**FINISH:** la entrega requiere revisión de frames reales de terminal en 120×40, 80×24 y 40×24, comprobación de tipos, pruebas y documentación del diseño. No hay imágenes raster distribuidas.

## Límites de integración

Datos en `demoWorkspace`; contratos de solo lectura exportados desde `src/demo-data.ts`. Los cuatro componentes reciben únicamente datos y dimensiones. No añadir callbacks, red, editor, parser SQL, servicios ni estado de negocio hasta una petición posterior.
