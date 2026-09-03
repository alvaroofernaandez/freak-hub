# ADR-0009 · Pantallas y navegación: lobby propio, inicio como panel personal

**Estado**: Aceptada · 2026-09-03

## Contexto

Con la dirección visual cerrada ([ADR-0008](0008-direccion-visual.md)) hacía
falta fijar qué pantallas construir y cómo se navega entre ellas, antes de
poder empezar los wireframes. Surgieron dos propuestas para la misma
pregunta.

La primera, con las seis categorías (anime, manga, videojuegos, películas,
juegos de mesa, TCG) accesibles cada una directamente desde la navbar, y una
pantalla de "lobby" distinta de inicio que las presenta como puerta de
entrada — extendiendo el concepto de "character select" a la navegación, no
solo a la paleta.

La segunda, elaborada de forma independiente por otro agente leyendo la
misma documentación del repositorio, fusionaba el selector de categorías
dentro de `/inicio` (como sección "elige categoría") y dejaba la navbar con
solo cuatro enlaces (Inicio, Biblioteca, Actividad, Grupo), sin un enlace
por categoría. Esa propuesta acertaba en otras dos cosas que la primera no
había separado: `/actividad` como feed completo del grupo, distinto del
panel personal de `/inicio`, y una pantalla `/ajustes` para cuenta, tema y
exportación de datos.

## Decisión

**El lobby es una pantalla propia, distinta de inicio** — `/biblioteca`,
con las seis categorías del roster como puerta de entrada. `/inicio` queda
con un solo trabajo: panel personal (en curso, recomendaciones pendientes,
resumen de actividad reciente).

**La navbar no lleva las seis categorías sueltas.** Lleva un único enlace
"Biblioteca" que abre el lobby; desde ahí, un clic más lleva a cada
categoría. Dentro de una categoría o de una ficha, la moldura de seis
colores hace de migas de pan hacia las otras cinco, así que el roster no se
duplica como navegación de primer nivel.

Se adopta también la separación `/inicio` / `/actividad` y la pantalla
`/ajustes` de la segunda propuesta.

El listado completo de pantallas y el detalle de la navegación (navbar,
barra inferior en móvil, badge único de recomendaciones) están en
[screens.md](../screens.md).

## Consecuencias

**A favor**

- `/inicio` tiene un solo trabajo (panel personal) en vez de dos (panel +
  selector de categoría), lo que evita que crezca hacia un totum revolutum.
- La navbar se queda corta en las seis pantallas de sesión que más se
  visitan, y cabe entera en la barra inferior de móvil sin recortar nada.
- El conjunto de seis categorías sigue siendo cerrado y explícito
  (domain.md), y aparece una sola vez como navegación real — en el lobby —
  en vez de repetirse en navbar y en inicio a la vez.

**En contra**

- Llegar a una categoría desde la navbar cuesta un clic más que si estuviera
  enlazada directamente.
- Dos pantallas con vocación de "punto de partida" (`/inicio` y
  `/biblioteca`) exigen que la interfaz deje muy clara la diferencia entre
  una y otra, o generan confusión.

**Descartado**

- *Seis enlaces de categoría directos en la navbar*: es la propuesta
  inicial. Se descarta por saturar la navbar — sobre todo en móvil, donde no
  cabían junto al resto de enlaces — a cambio de ahorrar un clic sobre un
  conjunto de pantallas que ya queda a un clic de distancia.
- *Roster fusionado dentro de `/inicio`, sin lobby propio*: es la propuesta
  del segundo agente. Se descarta porque mezcla panel personal y navegación
  en una sola pantalla, justo la clase de mezcla que luego complica el
  layout según crece cada sección por separado.
