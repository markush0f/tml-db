# Interfaz de terminal

Panel de demostración mínimo, orientado al teclado. Tipografía y tamaño de celda heredados de la terminal del usuario.

## Composición

Cabecera con nombre y aviso «Demo local», menú horizontal, contenido desplazable y atajos siempre visibles. Sección activa entre corchetes para no depender únicamente del color. El pie reduce su texto bajo 60 columnas.

## Colores

Paleta principalmente negra y amarilla, elegida por el usuario. Fondo negro `#000000`, superficie casi negra `#111111`, texto claro `#f5f5f5`, secundario gris `#b8b8b8` y amarillo `#ffdf00` para título, sección activa y contador. Sin animaciones ni efectos decorativos.

## Comportamiento

Inicio, Actividad y Ayuda comparten estado temporal. Registro limitado a cinco acciones. Tab y flechas cambian de sección; Espacio incrementa, R reinicia y Q sale. Verificación automatizada en 80×24 y 40×24 con el renderer de pruebas de OpenTUI.
