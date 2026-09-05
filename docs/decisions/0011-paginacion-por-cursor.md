# ADR-0011 · Paginación por cursor, con un sobre de página común

**Estado**: Aceptada · 2026-09-05

## Contexto

Ningún endpoint pagina. `GET /v1/invitations` devuelve la colección entera, y es
sostenible porque las invitaciones de un miembro son unas pocas decenas.

Una biblioteca personal no se parece a eso. Un miembro activo acumula cientos de
`library_entries` entre seis categorías, y el feed de actividad del grupo crece
sin techo. [api.md](../api.md) y [roadmap.md](../roadmap.md) aplazaron la
decisión a propósito, ambos con la misma condición: fijarla **antes del primer
endpoint que liste obras**. Ese endpoint es el siguiente que se escribe.

Las opciones eran dos —cursor (keyset) u offset— y con la elegida venían cuatro
preguntas que no se pueden dejar abiertas sin volver a discutirlas en cada
endpoint: qué forma tiene la respuesta, qué parámetros se aceptan, con qué orden
se recorre y qué pasa con el listado que ya existe.

## Decisión

**Paginación por cursor (keyset)** en todos los endpoints que listan, incluido
`GET /v1/invitations`, que se migra en lugar de quedar como excepción.

**Sobre de página.** Todo listado devuelve un objeto, nunca un array desnudo:

```json
{ "items": [ … ], "next_cursor": "eyJ0IjoiMjAyNi0wOS0wNVQxMDoyMzowMFoiLCJpIjoiOTRhZiJ9" }
```

`next_cursor` es `null` cuando no queda nada por leer. No hay `total`: contar
exige una segunda consulta sobre toda la tabla y ninguna pantalla del producto lo
necesita.

**Parámetros.** `?limit=` (por defecto **25**, mínimo 1, máximo **100**) y
`?cursor=`. Un `limit` fuera de rango es `400 invalid_payload`; no se recorta en
silencio, porque fallar ruidosamente es la regla del proyecto.

**Orden estable.** `(created_at DESC, id DESC)`. `created_at` por sí sola no es
única: dos filas con la misma marca de tiempo harían el keyset no determinista y
la paginación repetiría o saltaría elementos. El `id` desempata.

**El cursor es opaco.** Base64 de `created_at` e `id`, tratado como una cadena
sin estructura por quien lo recibe. Un cursor opaco es un detalle de
implementación que se puede cambiar; uno expuesto es contrato para siempre. Un
cursor que no decodifica es `400 invalid_cursor`, código nuevo en la tabla de
[api.md](../api.md).

**Se pide una fila de más.** Con `limit=25` se consultan 26: la vigésimo sexta no
se devuelve, solo delata que hay página siguiente. Evita el `COUNT(*)`.

**`GET /v1/invitations` se migra.** Pasa a devolver el mismo sobre. Es un cambio
incompatible de contrato y se hace de forma deliberada, que es justo lo que
[api.md](../api.md) exige para uno: los clientes son nuestros, se despliega todo
a la vez y hoy hay un único consumidor. El coste está en su mínimo histórico y
solo puede crecer.

## Consecuencias

**A favor**

- El coste de leer la página N es **constante**: `WHERE (created_at, id) < (…)`
  usa el índice y no escanea nada que vaya a descartar. Con `OFFSET`, leer la
  página 40 obliga a Postgres a atravesar 1.000 filas para tirarlas.
- **No repite ni salta filas** cuando alguien escribe mientras otro pagina, que
  en un feed de grupo pasa constantemente. Un `OFFSET` desplaza la ventana entera
  con cada inserción.
- Una sola forma de listar en toda la API. La web escribe un componente de
  paginación, no dos.
- El índice que hace falta —`(member_id, created_at DESC, id DESC)`— es el mismo
  que ya pide la consulta natural «mi biblioteca, lo más reciente primero».
- El sobre deja sitio para crecer sin romper nada: añadir un campo opcional junto
  a `items` es compatible; convertir un array desnudo en objeto no lo es.

**En contra**

- **No se puede saltar a una página arbitraria.** No hay «página 7». Se asume: el
  producto es un feed cronológico y listas que se recorren en scroll, y nadie
  navega su biblioteca por número de página.
- **No hay total de resultados**, así que no hay «1-25 de 340». Si alguna pantalla
  lo necesitara de verdad, será un campo opcional y una consulta aparte, no un
  rediseño.
- Migrar `GET /v1/invitations` **rompe el contrato**: arrastra `openapi.yaml`, los
  tipos generados, el handler, sus tests y la página `/invitar`. Es trabajo real
  que no existiría dejándola como estaba.
- El cursor opaco es incómodo de depurar a mano: hay que decodificarlo para saber
  por dónde va. Se acepta a cambio de poder cambiar su contenido sin avisar.

**Mitigación**

El keyset solo es correcto si el orden es estable y el índice existe. Ambas cosas
son condición de aceptación de la migración que crea `library_entries`
([data-model.md](../data-model.md)): el índice se crea **con** la tabla, no
después.

**Descartado**

- *Offset / limit*: la opción más conocida y la única que permite saltar a una
  página concreta. Se descarta por sus dos defectos, que aquí sí duelen: coste
  creciente con la profundidad y ventana inestable ante escrituras concurrentes.
  Para un feed cronológico son exactamente los dos peores.
- *Dejar `GET /v1/invitations` sin paginar*: ahorra el cambio incompatible hoy y
  deja dos formas de listar en la misma API. Esa clase de inconsistencia no se
  corrige nunca sola: se normaliza, se copia al siguiente endpoint y acaba siendo
  el estado permanente.
- *Incluir `total` en el sobre*: útil para una interfaz que muestre «de 340», y
  caro en cada petición. Se deja fuera hasta que una pantalla concreta lo pida.
- *Cursor legible* (por ejemplo, el `created_at` en claro): más fácil de depurar,
  pero congela la forma interna del cursor como contrato público. Cambiar el
  criterio de orden más adelante pasaría a ser un cambio incompatible.
