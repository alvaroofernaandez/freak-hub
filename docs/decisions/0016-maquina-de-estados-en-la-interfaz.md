# ADR-0016 · La interfaz repite la máquina de estados en vez de descubrirla por el 422

**Estado**: Aceptada · 2026-09-14

## Contexto

`PATCH /v1/library/{id}` trata el `status` como una **transición** y la valida
contra la máquina de estados de [domain.md](../domain.md). Lo que no está en
el diagrama se responde `422 invalid_transition`. Las seis flechas viven en
`apps/api/internal/library/entry.go`, transcritas una a una.

La ficha de obra tiene que ofrecer un control de estado. Hay dos formas de
llegar a saber qué se puede pulsar:

1. Ofrecer los seis estados siempre y dejar que el servidor rechace. La
   persona pulsa «Terminado» sobre algo que está en la wishlist, espera el
   viaje de ida y vuelta y recibe un error que explica una regla que nadie le
   había enseñado.
2. Repetir el diagrama en la web y ofrecer solo lo que el dominio va a
   aceptar.

La opción 1 es la que no cuesta nada escribir y la que convierte una regla de
producto en un castigo. El error de `invalid_transition` ya existe y está bien
redactado, pero llega **después** de que la interfaz haya prometido algo que
no podía cumplir.

La opción 2 duplica conocimiento de dominio al otro lado del cable, que es
exactamente lo que la regla 3 de `AGENTS.md` («el dominio no conoce a sus
adaptadores») existe para vigilar en la dirección contraria.

## Decisión

**La web repite la máquina de estados, en `apps/web/src/features/library/lib/transitions.ts`,
y la usa solo para decidir qué se ofrece.**

La duplicación tiene un trabajo estrecho y declarado:

- **El dominio sigue siendo la autoridad.** Un `PATCH` con una transición
  ilegal se responde `422` diga lo que diga la web. La copia no relaja ninguna
  comprobación del servidor y no se consulta antes de enviar: solo decide qué
  opciones se pintan pulsables.
- **Los seis estados se pintan siempre.** Los que no se pueden alcanzar salen
  deshabilitados, no ocultos, y debajo hay una frase que dice desde dónde se
  puede ir a dónde. La forma del ciclo de vida es información; una lista que
  encoge sola no enseña nada.
- **`dropped` no ofrece ningún cambio**, porque el diagrama no dibuja ninguna
  flecha de salida, y la frase lo dice en vez de dejar seis fichas apagadas y
  mudas.
- **Quedarse donde está sigue siendo válido.** `canTransition(x, x)` es
  `true`, igual que en Go: reenviar el estado actual es un no-op, no un
  movimiento ilegal. Aun así el estado actual nunca se envía, porque solo
  viaja lo que cambia.

La misma decisión **no** aplica a la creación: `POST /v1/library` acepta los
seis estados porque crear es la entrada al ciclo de vida y no una transición,
así que el alta manual ofrece los seis sin restricción.

A la valoración aplica de otra forma, y esto hubo que corregirlo: la primera
versión de este ADR decía que ahí bastaba «el reflejo más simple», habilitar el
control solo en `completed` y `dropped` y dejar que el diferencial hiciera el
resto. **No basta, y el review de la PR #75 lo demostró con un caso concreto.**

La API valida la valoración entrante contra el estado **resultante**, y lo hace
en la misma petición atómica que la transición. Una entrada `completed` sin
valorar en la que alguien escribe un 8 y después pulsa «En curso» —el único
movimiento legítimo desde ahí, que la interfaz ofrece bien— produce
`{status: "in_progress", rating: 8}`, porque el 8 **sí** se movió respecto de lo
guardado. Eso es un `422 rating_not_allowed` que **se lleva por delante también
el cambio de estado**, y deja a la persona encerrada detrás de un campo
deshabilitado.

Así que hacen falta las dos mitades:

1. **Visible**: al pasar a un estado que no admite valoración, el campo vuelve
   a la valoración guardada, para que una casilla en gris no enseñe un número
   que el guardado va a descartar. Un borrado explícito sí se respeta, porque
   `null` se acepta en cualquier estado.
2. **Estructural**: `buildPatch` no incluye una valoración distinta cuando el
   estado resultante no la admite. Es la garantía, no la presentación.

La lección general: **el diferencial es necesario pero no suficiente.** Hace
que dos de las tres cláusulas sutiles del `PATCH` se cumplan solas; la tercera
necesita conocer la regla.

## Consecuencias

- El diagrama de `domain.md` está escrito tres veces: en el diagrama, en Go y
  en TypeScript. Un cambio en la máquina de estados obliga a tocar las tres, y
  los tests de `transitions.test.ts` están escritos contra el diagrama
  precisamente para que la tercera copia no se quede atrás en silencio.
- Una ficha con datos viejos (dos pestañas abiertas, una vuelta atrás del
  navegador) puede ofrecer una transición que ya no es legítima. No es un
  problema nuevo ni uno que la copia empeore: el `422` sigue ahí y su mensaje
  ya está en `messages.ts`.
- Nada de esto viaja en el contrato. Se valoró que `LibraryEntry` expusiera sus
  transiciones posibles y se descartó: engorda cada elemento de cada página de
  biblioteca con datos que solo usa una pantalla, y el diagrama cambia mucho
  menos que las pantallas que lo leen.
