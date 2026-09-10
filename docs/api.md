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
| GET | `/v1/invitations` | sí | Invitaciones que ha enviado quien llama |
| POST | `/v1/invitations` | sí | Invitar a alguien |
| GET | `/v1/invitations/group` | sí | Invitaciones pendientes de todo el grupo, paginadas por cursor |
| POST | `/webhooks/clerk` | firma Svix | Eventos de Clerk |

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

`invalid_cursor` e `invalid_limit` los devuelven los endpoints paginados
(`GET /v1/members` y `GET /v1/invitations/group`). Ver
[ADR-0011](decisions/0011-paginacion-por-cursor.md).

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
| `method_not_allowed` | 405 | no | La ruta existe, pero no para ese verbo |
| `payload_too_large` | 413 | no | El cuerpo de la petición supera el límite del endpoint (1 MB en JSON) |
| `request_timeout` | 504 | sí | La petición no terminó dentro del plazo del servidor |
| `upstream_unavailable` | 503 | sí | Clerk está limitando peticiones o no responde |

`internal/platform/httpx` es la fuente de verdad de este catálogo en Go
(`ErrorCode` y `codeRegistry`); `packages/contracts/openapi.yaml` lo repite
como el `enum` de `code`, y un test de Go falla si alguno de los dos cambia
sin el otro.

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

> **Estado.** El criterio está fijado; la implementación llega con el primer
> endpoint que lista obras. `GET /v1/invitations` todavía devuelve la colección
> entera como array: su migración al sobre de página es un cambio incompatible
> **deliberado**, decidido en el ADR-0011 y pendiente de aplicar.

## Lo que aún no está resuelto

- **Rate limiting.** Hoy no hay. `POST /v1/invitations` es el candidato obvio: sin
  cupo por miembro, un límite por ventana temporal es la única defensa contra un
  bucle accidental.
- **Idempotencia en escrituras.** Si aparecen reintentos de cliente, hará falta
  `Idempotency-Key`.
