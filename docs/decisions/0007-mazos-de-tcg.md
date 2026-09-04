# ADR-0007 · Un TCG se agrupa por juego; el modelo de mazo se aplaza

**Estado**: Aceptada · 2026-09-01

## Contexto

[domain.md](../domain.md) señalaba esto como la decisión de modelado más
espinosa que quedaba: si un mazo de TCG (un mazo de Magic, por ejemplo) es un
`Work` —una carta concreta— o una entidad aparte que agrupa cartas.

## Decisión

El `Work` de la categoría `tcg` es **el juego** (Magic, Pokémon, Yu-Gi-Oh!…), no
una carta ni un mazo. Los mazos son una creación **personal de cada miembro**,
construida dentro de un juego concreto: cada uno añade los suyos.

El modelo físico del mazo —su relación con las cartas, si cada carta es su
propio `Work` o un registro aparte, cómo entra Scryfall— **se deja sin decidir a
propósito** y se resuelve cuando se construya esta categoría, con más contexto
del que hay hoy.

## Consecuencias

**A favor**

- Cierra la pregunta que sí bloqueaba el resto del modelo: la categoría `tcg`
  ya encaja en `Work` + `LibraryEntry` como las demás (un miembro registra
  "Magic: The Gathering" con su estado, igual que registraría un juego de
  mesa).
- No se inventa un modelo de mazo a ciegas, antes de tener un caso de uso real
  delante.

**En contra**

- Hasta que se diseñe el modelo de mazo, la categoría TCG solo puede registrar
  "juego el juego", no mazos ni cartas concretas: es un producto incompleto
  para esa categoría, a propósito.

**Descartado**

- *Decidir el modelo de mazo ahora*: se consideró, pero el propio dominio lo
  señalaba como la parte más incierta; forzar una decisión sin construir la
  funcionalidad es el mismo error que "una tabla genérica con treinta columnas
  nulas" que este documento ya advierte evitar en otros sitios.
