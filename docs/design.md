# Dirección visual

La estética estuvo deliberadamente sin decidir mientras se construían los
cimientos (ver [roadmap.md](roadmap.md)). Esta es la decisión, cerrada con
[ADR-0008](decisions/0008-direccion-visual.md).

## El concepto: character select

Freak Hub ya tenía una identidad asomando en el banner del README: oscura,
con aire de "pantalla de selección de personaje" arcade, construida sobre el
arte de Fullmetal Alchemist y Hunter × Hunter. La dirección visual de la
aplicación **extiende esa identidad** en lugar de inventar una segunda: mismo
neutro violeta, mismos colores de partida (Ed, Gon, Killua), llevados de un
banner de marketing a un sistema de interfaz completo.

Oscuro por defecto, con tema claro disponible.

## Paleta

### Neutros

Un solo hue violeta (272°) recorre toda la paleta, oscuro y claro. Es el
mismo que ya usa `globals.css` y el banner: no se sustituye, se completa.

| Token | Oscuro | Claro |
| :--- | :--- | :--- |
| `--ground` | `oklch(0.130 0.020 272)` | `oklch(0.975 0.006 272)` |
| `--surface` | `oklch(0.185 0.024 272)` | `oklch(0.995 0.003 272)` |
| `--surface-raised` | `oklch(0.240 0.028 272)` | `oklch(0.955 0.012 272)` |
| `--border` | `oklch(0.340 0.032 272)` | `oklch(0.840 0.018 272)` |
| `--ink` | `oklch(0.960 0.008 272)` | `oklch(0.220 0.020 272)` |
| `--ink-muted` | `oklch(0.700 0.020 272)` | `oklch(0.460 0.020 272)` |

### El roster — un color por categoría

Seis categorías, seis tonos. Tres ya existían en el banner (Ed, Gon, Killua);
las otras tres se completan con la misma fórmula de luminosidad y croma, así
que el conjunto se lee como una sola familia y no como parches sueltos.

| Categoría | Token | Hue | Notas |
| :--- | :--- | :--- | :--- |
| Anime | `--accent` / `--cat-anime` | 78° | Ámbar de "Ed". Hace doble función: es también el acento de marca — la categoría por la que arranca el roadmap es la que presta su color a toda la app |
| Manga | `--cat-manga` | 32° | |
| Videojuegos | `--cat-games` | 150° | Verde de "Gon" |
| Películas | `--cat-films` | 196° | |
| Juegos de mesa | `--cat-board` | 226° | Cian de "Killua" |
| TCG | `--cat-tcg` | 300° | Recupera el morado que era el acento provisional de `globals.css` |

**Regla:** el color de categoría nunca es el único identificador — siempre va
acompañado de una etiqueta de texto. Nunca se usa solo, ni para transmitir
significado por sí mismo.

### Semántica (éxito / error / aviso)

Reutiliza tonos del roster en vez de abrir una tercera familia de color:
`--success` = verde de Videojuegos, `--danger` = un rojo propio ("Coat",
22°, el mismo que ya marca "SOLO POR INVITACIÓN" en el banner),
`--warning` = el ámbar de marca. Conviven sin ambigüedad porque aparecen en
contextos distintos: un toast de error nunca comparte pantalla con una
etiqueta de categoría.

## El estado de una entrada no usa color

Los seis estados de una `LibraryEntry` (`wishlist`, `pending`,
`in_progress`, `completed`, `dropped`, `on_hold`, ver
[domain.md](domain.md)) se comunican con **icono + etiqueta, nunca con
color**. El color ya está gastado en identificar la categoría; usarlo otra
vez para el estado obligaría a leer dos codificaciones de color a la vez en
la misma tarjeta.

| Estado | Marca |
| :--- | :--- |
| `wishlist` | ☆ |
| `pending` | ○ |
| `in_progress` | ◐ |
| `completed` | ● |
| `dropped` | ✕ |
| `on_hold` | ❚❚ |

## Tipografía

Tres familias, cada una con un trabajo y solo uno.

| Familia | Papel | Por qué |
| :--- | :--- | :--- |
| **Bungee** | Solo el wordmark y momentos de titular muy puntuales | Una sola pesada, de una sola voz: perfecta para "FREAK HUB", ilegible en un párrafo. No entra en componentes de uso diario |
| **Sora** | Interfaz: encabezados y cuerpo | Sustituye a Inter. Ya viste la etiqueta del banner, así que el wordmark y el texto de producto comparten familia tipográfica en vez de dos sans-serif sin relación |
| **JetBrains Mono** | Etiquetas, cifras, marcas de tiempo, handles | Ya es el uso que le da la app hoy (`inicio/page.tsx`: `font-mono uppercase tracking-widest`). Se mantiene tal cual |

## Motivo recurrente: la moldura

El banner usa una franja de tres colores al pie del cabinet arcade (uno por
personaje). En la interfaz se extiende a los seis colores del roster y se usa
como separador entre secciones importantes: además de decorar, funciona como
índice visual de las seis categorías, coherente con las etiquetas que ya se
ven en las tarjetas.

## Qué implica para el código (pendiente)

Esta decisión fija la dirección; la implementación en `globals.css` (sustituir
los tokens provisionales) y en `app/layout.tsx` (cambiar la fuente de cuerpo
de Inter a Sora, cargar Bungee) queda para cuando se retome este trabajo. No
se construye ningún componente sobre la paleta hasta entonces.
