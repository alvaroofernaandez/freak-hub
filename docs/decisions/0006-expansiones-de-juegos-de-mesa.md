# ADR-0006 · Las expansiones de juegos de mesa son un Work enlazado al juego base

**Estado**: Aceptada · 2026-09-01

## Contexto

[domain.md](../domain.md) dejaba abierto si una expansión de un juego de mesa
era un `Work` propio o solo metadata del juego base. Ninguna de las dos opciones
sola sirve: si es solo metadata, no se puede llevar una `LibraryEntry`
(probada, jugada, valorada) por expansión; si es un `Work` suelto, aparece en el
catálogo como un juego independiente, que no es lo que es.

## Decisión

Una expansión **es un `Work` propio**, de la misma categoría `boardgame`, con un
campo `expansion_of` que apunta al `Work` del juego base. No vive suelta en el
catálogo: al añadir un juego de mesa, el miembro puede seleccionar o dar de alta
sus expansiones desde ahí, y cada una abre su propia `LibraryEntry` para marcar
que la ha probado o jugado.

## Consecuencias

**A favor**

- Reutiliza el modelo entero: ni tabla nueva ni caso especial en
  `LibraryEntry`. Una expansión se registra, se puntúa y se marca como
  favorita exactamente igual que cualquier otro `Work`.
- El juego base y sus expansiones quedan como fichas independientes y
  comparables entre miembros, que es justo lo que se pierde si la expansión es
  solo JSON dentro del juego base.
- La búsqueda y el alta desde BGG encajan sin fricción: BGG ya modela las
  expansiones como entidades propias, relacionadas con el juego base.

**En contra**

- La UI y la búsqueda tienen que tratar `expansion_of` como caso especial para
  no listar expansiones como si fueran juegos de primera clase (por ejemplo, en
  los resultados de búsqueda general).
- Un `Work` sin `expansion_of` no puede asumirse "es un juego completo" sin
  comprobarlo: hay que consultarlo explícitamente.

**Descartado**

- *Expansión como metadata JSONB del juego base*: más simple de guardar, pero
  impide que alguien tenga una `LibraryEntry` —y por tanto un progreso, una
  nota o una valoración— por expansión, que es precisamente lo que se pidió.
- *Expansión como juego independiente sin relación con el base*: pierde la
  jerarquía y obliga a averiguar de nuevo, a mano, qué expansiones pertenecen
  a qué juego.
