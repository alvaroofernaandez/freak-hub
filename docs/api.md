# La API HTTP

El contrato completo está en
[`packages/contracts/openapi.yaml`](../packages/contracts/openapi.yaml). Este
documento explica las decisiones que hay detrás.

## Principios

1. **El contrato va primero.** Se cambia `openapi.yaml`, se regeneran los tipos
   y después se implementa. Al revés se desincroniza siempre.
2. **Un solo sobre de error.** Todo error, sin excepción, se sirve como
   `application/problem+json` con la forma de
   [Problem Details (RFC 9457)](https://www.rfc-editor.org/rfc/rfc9457). Los
   clientes ramifican por `code`; `title` y `detail` son prosa en español y se
   reescriben cuando haga falta. Ver [«El sobre de error»](#el-sobre-de-error)
   más abajo y [ADR-0014](decisions/0014-sistema-de-estados-y-errores.md).
3. **Versión en la ruta.** Todo el dominio cuelga de `/v1`. `/healthz` y
   `/webhooks` no la llevan porque no son API de producto.
4. **Sin campos desconocidos.** El decodificador rechaza propiedades que no
   existen: una errata en un cliente falla ruidosamente en vez de ignorarse.

## Endpoints

| Método | Ruta | Sesión | Qué hace |
| :--- | :--- | :--- | :--- |
| GET | `/healthz` | no | Sonda de vida |
| GET | `/v1/me` | sí | El miembro de la sesión actual |
| PATCH | `/v1/me` | sí | Editar el nombre, los apellidos o el nombre de usuario propios |
| POST | `/v1/me/avatar` | sí | Subir la foto de perfil propia (multipart, hasta 5 MB) |
| GET | `/v1/members` | sí | Los miembros del grupo, paginados por cursor |
| GET | `/v1/invitations` | sí | Invitaciones que ha enviado quien llama, paginadas por cursor |
| POST | `/v1/invitations` | sí | Invitar a alguien |
| GET | `/v1/invitations/group` | sí | Invitaciones pendientes de todo el grupo, paginadas por cursor |
| GET | `/v1/works` | sí | Busca en el catálogo compartido. Filtros `?category=` y `?q=`, paginado por cursor |
| POST | `/v1/works` | sí | Da de alta a mano una obra que ningún catálogo externo lista |
| GET | `/v1/works/{id}` | sí | La ficha de una obra |
| GET | `/v1/library` | sí | La biblioteca de quien llama. Filtros `?status=` y `?category=`, paginado por cursor |
| POST | `/v1/library` | sí | Añade una obra a la biblioteca propia |
| GET | `/v1/library/{id}` | sí | Una entrada concreta de la biblioteca propia |
| PATCH | `/v1/library/{id}` | sí | Actualiza estado, progreso, valoración, favorito, posesión o nota |
| DELETE | `/v1/library/{id}` | sí | Saca la obra de la biblioteca. **No** borra la obra |
| POST | `/webhooks/clerk` | firma Svix | Eventos de Clerk |

Toda la tabla está **implementada**. Hasta este cambio las ocho rutas de
`/v1/works` y `/v1/library` existían solo en el contrato: el esquema, el
dominio y el adaptador estaban listos, pero nadie podía llegar a ellos desde
fuera.

## Biblioteca y catálogo

Cuatro decisiones del borde HTTP que no se leen en el YAML y conviene tener a
mano.

### El miembro siempre sale de la sesión

Ni el cuerpo ni la cadena de consulta llevan `member_id`, y no es que se
ignore: `POST /v1/library` no declara esa propiedad, así que el decodificador
estricto la rechaza con `400 invalid_payload`. Aceptarla sería aceptar una
escritura en la biblioteca de otra persona.

El listado tiene además un segundo cerrojo: `library.Service.ListLibrary`
sobrescribe el propietario del filtro con el de la sesión, de modo que un
manejador que algún día olvide fijarlo tampoco puede recorrer una estantería
ajena.

### Una entrada ajena responde 404, nunca 403

`GET`, `PATCH` y `DELETE` sobre `/v1/library/{id}` responden
`404 library_entry_not_found` tanto si la entrada no existe como si existe y
es de otro miembro. Un 403 confirmaría que ese identificador es real, y de
quién es cada biblioteca no es asunto de nadie más.

La indistinguibilidad es literal: mismo estado, mismo `code` y mismo `detail`
en las dos ramas. Una prosa distinta según el caso sería exactamente la
confirmación que el 404 existe para no dar. Un identificador mal formado
—algo que no es un UUID— responde igual, por la misma razón.

La comprobación vive en el servicio de dominio, no en el manejador. El puerto
`EntryRepository.ByID` no recibe el miembro, así que un manejador que lo
llamara directamente entregaría cualquier entrada a cualquiera; por eso las
tres rutas pasan por `GetEntry`, `UpdateEntry` y `RemoveFromLibrary`.

### `PATCH`: ausente, nulo y valor son tres cosas distintas

Una propiedad ausente deja el valor guardado como está. Una propiedad con
`null` lo borra a propósito, y es la única manera de quitar una valoración,
una nota o una fecha. Las cuatro propiedades que el contrato declara sin
`null` —`status`, `progress`, `is_favourite` y `owned`— rechazan un nulo con
`400 invalid_payload` en lugar de leerlo como su valor cero, que dejaría de
marcar un favorito que nadie pidió cambiar.

Dos reglas más, ambas sobre *cambios* y no sobre presencia:

- Reenviar el estado que la entrada ya tiene no es una transición ilegal: es
  no pedir nada, y responder 422 a nada es una trampa.
- Reenviar la misma valoración guardada tampoco pide nada y pasa en cualquier
  estado. Solo una valoración **distinta** sobre un estado que no sea
  `completed` ni `dropped` da `422 rating_not_allowed`. Esa cláusula no se
  aplica al alta: en un `POST` no hay nada guardado con lo que coincidir.

Una valoración guardada **sobrevive** a un cambio de estado. Volver a ver algo
no borra la nota que le pusiste.

### Un cursor solo vale para los filtros que lo produjeron

El cursor lleva una posición —`(created_at, id)`— y no los filtros con los que
se calculó, así que reutilizar uno de otra combinación **no se rechaza**: el
orden es el mismo para todos los filtros, de modo que la página que vuelve es
una página correcta del filtro nuevo, solo que empezada por la mitad. Lo que
no es, es un recorrido completo. Por eso el contrato pide reenviar los mismos
filtros en cada página y empezar sin cursor cada vez que uno cambie.

Un valor de filtro fuera del enum sí se rechaza, con `400 invalid_filter`: a
quien pidió una porción, devolverle la lista entera se le parece demasiado a
que haya funcionado.

## El sobre de error

Toda respuesta de error, sin excepción, lleva `Content-Type:
application/problem+json` y este cuerpo (ADR-0014):

```json
{
  "type": "urn:freak-hub:problem:invitation_already_sent",
  "title": "Invitación ya enviada",
  "status": 409,
  "detail": "Ya hay una invitación pendiente para ese correo.",
  "instance": "/v1/invitations",
  "code": "invitation_already_sent",
  "message": "Ya hay una invitación pendiente para ese correo.",
  "correlation_id": "4f0c2e9a7b1d3c5e8f6a0b2c4d6e8f10",
  "retryable": false,
  "field_errors": [{ "field": "email", "code": "invitation_already_sent" }]
}
```

| Campo | Para qué sirve |
| :--- | :--- |
| `code` | El identificador estable. Es lo único por lo que un cliente debe ramificar. |
| `title` / `detail` | Prosa en español para personas. Pueden reescribirse en cualquier momento; nunca forman parte del contrato. |
| `type` | `urn:freak-hub:problem:<code>`, por si algún día hace falta un enlace a documentación por tipo de error. |
| `instance` | La ruta de la petición (nunca la cadena de consulta). |
| `message` | **Obsoleto.** El mismo texto que `detail`, para no romper un cliente anterior a este ADR. |
| `correlation_id` | Identificador opaco de la petición. También sale en la cabecera `X-Request-ID` de **toda** respuesta, de éxito o de error: es lo que hay que pedir al reportar un fallo, porque es la clave con la que se busca la línea de log correspondiente. |
| `retryable` | Si repetir la misma petición tal cual tiene una probabilidad razonable de funcionar (condiciones tipo 429, 503, 504). |
| `retry_after` | Segundos sugeridos antes de reintentar. Solo aparece cuando `retryable` es `true` y el plazo se conoce. |
| `field_errors` | Solo cuando el error señala uno o más campos sin ambigüedad. La validación sigue devolviendo el primer error, como siempre. |

`invalid_cursor` e `invalid_limit` los devuelven los endpoints paginados, que
desde el ADR-0011 son todos los que listan: `GET /v1/members`,
`GET /v1/invitations`, `GET /v1/invitations/group`, `GET /v1/works` y
`GET /v1/library`. Ver [ADR-0011](decisions/0011-paginacion-por-cursor.md).

`invalid_filter` es de la misma familia y lo devuelven los dos listados que
filtran —`GET /v1/works` y `GET /v1/library`— cuando `?status=` o `?category=`
traen un valor fuera del enum. Es un código propio y no `invalid_payload` por la
misma razón que lo son `invalid_limit` e `invalid_cursor`: `invalid_payload`
significa «el **cuerpo** de la petición no es válido», y una cadena de consulta
no es un cuerpo.

## Catálogo de códigos

| `code` | Estado | Reintentable | Cuándo |
| :--- | :--- | :--- | :--- |
| `missing_token` | 401 | no | No hay cabecera `Authorization`, o no es `Bearer` |
| `invalid_token` | 401 | no | El token no verifica o ha caducado |
| `unauthorized` | 401 | no | La firma Svix de un webhook no es válida |
| `unknown_identity` | 404 | no | Sesión válida sin fila en `members` (el webhook `user.created` aún no ha llegado) |
| `invalid_payload` | 400 | no | El cuerpo no es JSON válido, trae campos de más, o el multipart está mal formado |
| `not_found` | 404 | no | Ruta inexistente |
| `internal_error` | 500 | no | Fallo nuestro. El detalle va al log, nunca al cliente |
| `invalid_cursor` | 400 | no | El cursor de paginación no decodifica. Ver [ADR-0011](decisions/0011-paginacion-por-cursor.md) |
| `invalid_filter` | 400 | no | Un filtro de consulta (`?status=`, `?category=`) trae un valor que no está en el enum. No se ignora en silencio |
| `invalid_limit` | 400 | no | El `limit` de paginación está fuera de rango. Ver [ADR-0011](decisions/0011-paginacion-por-cursor.md) |
| `no_profile_changes` | 422 | no | `PATCH /v1/me` sin ningún campo |
| `name_too_long` | 422 | no | Nombre o apellidos por encima de 100 caracteres |
| `username_invalid_length` | 422 | no | El nombre de usuario no mide entre 3 y 24 caracteres |
| `username_numeric_only` | 422 | no | El nombre de usuario es solo números |
| `username_taken` | 409 | no | Ese nombre de usuario ya está en uso |
| `avatar_too_large` | 413 | no | La imagen supera los 5 MB |
| `avatar_unsupported_type` | 415 | no | La imagen no es JPEG, PNG, WEBP ni GIF |
| `invalid_email` | 422 | no | El correo de la invitación no es válido |
| `invitation_already_sent` | 409 | no | Ya hay una invitación pendiente para ese correo |
| `already_member` | 409 | no | Ese correo ya pertenece a un miembro |
| `already_in_library` | 409 | no | Quien llama ya tiene esa obra en su biblioteca. Un miembro tiene como máximo una entrada por obra (regla 1 del dominio) |
| `work_not_found` | 404 | no | El `work_id` referenciado no existe en el catálogo compartido |
| `rating_not_allowed` | 422 | no | Llega una valoración con un estado que no es `completed` ni `dropped` (regla 2 del dominio) |
| `invalid_progress` | 422 | no | El progreso no encaja con la categoría de la obra. La unidad la valida el dominio, no la base de datos (regla 5) |
| `library_entry_not_found` | 404 | no | No hay una entrada con ese identificador en la biblioteca de quien llama. El mismo código cubre «no existe» y «es de otra persona»: un 403 confirmaría que existe |
| `invalid_transition` | 422 | no | El cambio de estado que pide un `PATCH` no lo permite la máquina de estados de [domain.md](domain.md). Crear una entrada no es una transición y no pasa por aquí |
| `method_not_allowed` | 405 | no | La ruta existe, pero no para ese verbo |
| `payload_too_large` | 413 | no | El cuerpo de la petición supera el límite del endpoint (1 MB en JSON) |
| `request_timeout` | 504 | sí | La petición no terminó dentro del plazo del servidor |
| `upstream_unavailable` | 503 | sí | Clerk está limitando peticiones o no responde |

`internal/platform/httpx` es la fuente de verdad de este catálogo en Go
(`ErrorCode` y `codeRegistry`); `packages/contracts/openapi.yaml` lo repite
como el `enum` de `code`, y un test de Go falla si alguno de los dos cambia
sin el otro.

Añadir un código toca **tres** sitios, no dos, y los tres avisan solos:

| Dónde | Qué lo comprueba |
| :--- | :--- |
| `apps/api/internal/platform/httpx/codes.go` | `TestContractCodesMatchTheRegistry`, en `internal/api`. Es simétrico: falla en las dos direcciones |
| `apps/web/src/shared/errors/problem.ts` | `KNOWN_CODES`, exhaustivo con `satisfies Record<…, true>`. Rompe `pnpm typecheck` |
| `apps/web/src/shared/errors/messages.ts` | `MESSAGES`, un `Record<ProblemCode, CopyResolver>`: sin copy no compila |

Que el test de Go sea simétrico tiene una consecuencia práctica: un código
nuevo **no se puede repartir en dos PR**. O el contrato y el registro entran
juntos, o `main` se queda en rojo entre los dos.

## Reclasificaciones de transporte (ADR-0014)

Estos cambios de status o código son deliberados y forman parte de este mismo
ADR. Nada más cambió:

| Situación | Antes | Después |
| :--- | :--- | :--- |
| Pánico no controlado | 500 sin cuerpo | 500 `internal_error`, con cuerpo Problem y log con `request_id` |
| Método no permitido | 405 `bad_request` | 405 `method_not_allowed` |
| Plazo agotado | 500 `internal_error` | 504 `request_timeout`, reintentable |
| Clerk no disponible o limitando, en una operación | 500 `internal_error` | 503 `upstream_unavailable`, reintentable |
| Clerk no disponible al verificar el token | 401 `invalid_token` | 503 `upstream_unavailable`, reintentable |
| Multipart mal formado (no por tamaño) | 413 `avatar_too_large` | 400 `invalid_payload` |
| Cuerpo JSON por encima del límite | 400 `invalid_payload` | 413 `payload_too_large` |
| Cuerpo de webhook ilegible | 400 `bad_request` | 400 `invalid_payload` |

Una caída de Clerk ya no se presenta como una sesión no válida: un token que
de verdad no verifica sigue siendo 401 `invalid_token`. `bad_request` se
retira del catálogo porque duplicaba a `invalid_payload`.

Una cancelación del cliente (`context.Canceled`) no se registra como error ni
genera una respuesta con cuerpo.

## Correlación e identificador de petición

Toda respuesta, de éxito o de error, lleva la cabecera `X-Request-ID`: un
identificador opaco de 128 bits en hexadecimal, generado con `crypto/rand`.
Nunca contiene el nombre de la máquina. Si la petición ya trae un
`X-Request-ID` con forma válida (`^[A-Za-z0-9-]{8,64}$`), se reutiliza; si no,
se genera uno nuevo. El mismo identificador aparece en `correlation_id` de un
cuerpo de error y en cada línea de log de esa petición (`request_id`).

## Cómo evolucionar el contrato sin romper nada

- **Añadir** un campo opcional o un endpoint: seguro, adelante.
- **Quitar o renombrar** un campo, cambiar un tipo, endurecer una validación:
  eso es un cambio incompatible. Como los clientes son nuestros y desplegamos a
  la vez, se puede hacer en el mismo cambio, pero tiene que ser **deliberado** y
  quedar registrado como ADR.
- `generated/api.ts` está versionado a propósito: si alguien cambia el YAML y no
  regenera, el CI lo detecta.

## Paginación

El criterio está decidido en
[ADR-0011](decisions/0011-paginacion-por-cursor.md): **cursor (keyset)**, y se
aplica a todo endpoint que liste.

Todo listado devuelve un objeto, nunca un array desnudo:

```json
{ "items": [ … ], "next_cursor": "eyJ0IjoiMjAyNi0wOS0wNVQxMDoyMzowMFoiLCJpIjoiOTRhZiJ9" }
```

| Aspecto | Criterio |
| :--- | :--- |
| Parámetros | `?limit=` (defecto 25, mínimo 1, máximo 100) y `?cursor=` |
| Fin de la lista | `next_cursor` a `null` |
| Orden | `(created_at DESC, id DESC)`. `created_at` sola no es única y haría el recorrido no determinista |
| Cursor | Opaco. Base64 de `created_at` e `id`; para el cliente es una cadena sin estructura |
| Total | No se devuelve. Contar exige recorrer la tabla y ninguna pantalla lo necesita |
| `limit` fuera de rango | `400 invalid_limit`. No se recorta en silencio |
| Cursor corrupto | `400 invalid_cursor` |

## Lo que aún no está resuelto

- **Rate limiting.** Hoy no hay. `POST /v1/invitations` es el candidato obvio: sin
  cupo por miembro, un límite por ventana temporal es la única defensa contra un
  bucle accidental.
- **Idempotencia en escrituras.** Si aparecen reintentos de cliente, hará falta
  `Idempotency-Key`.
- **Cuatro cotas del contrato que nadie comprueba todavía.** `year` (1800-2200)
  y `synopsis` (5000) en `CreateWorkRequest`, `note` (1000) en los dos cuerpos
  de biblioteca y `q` (200) en `GET /v1/works`. El dominio valida el título, la
  categoría, el estado, la valoración y el progreso, pero no estas cuatro, y el
  borde HTTP no las inventa por su cuenta: una regla de negocio escrita en un
  manejador es una regla que el dominio no puede hacer cumplir cuando el mismo
  caso de uso llegue por otra puerta. Tampoco hay un `code` para ninguna de
  ellas. Cuando se cierren, se cierran en `internal/library` y con su código en
  el contrato.
