# La API HTTP

El contrato completo está en
[`packages/contracts/openapi.yaml`](../packages/contracts/openapi.yaml). Este
documento explica las decisiones que hay detrás.

## Principios

1. **El contrato va primero.** Se cambia `openapi.yaml`, se regeneran los tipos
   y después se implementa. Al revés se desincroniza siempre.
2. **Un solo sobre de error.** Todo error, sin excepción, es
   `{ "code": "...", "message": "..." }`. Los clientes ramifican por `code`;
   `message` es prosa en español, se reescribe cuando haga falta y **no** forma
   parte del contrato.
3. **Versión en la ruta.** Todo el dominio cuelga de `/v1`. `/healthz` y
   `/webhooks` no la llevan porque no son API de producto.
4. **Sin campos desconocidos.** El decodificador rechaza propiedades que no
   existen: una errata en un cliente falla ruidosamente en vez de ignorarse.

## Endpoints

| Método | Ruta | Sesión | Qué hace |
| :--- | :--- | :--- | :--- |
| GET | `/healthz` | no | Sonda de vida |
| GET | `/v1/me` | sí | El miembro de la sesión actual |
| GET | `/v1/invitations` | sí | Invitaciones que ha enviado quien llama |
| POST | `/v1/invitations` | sí | Invitar a alguien |
| POST | `/webhooks/clerk` | firma Svix | Eventos de Clerk |

## Códigos de error

| `code` | Estado | Cuándo |
| :--- | :--- | :--- |
| `missing_token` | 401 | No hay cabecera `Authorization`, o no es `Bearer` |
| `invalid_token` | 401 | El token no verifica o ha caducado |
| `unknown_identity` | 404 | Sesión válida sin fila en `members` |
| `invalid_payload` | 400 | El cuerpo no es JSON válido o trae campos de más |
| `invalid_email` | 422 | El correo de la invitación no es válido |
| `invitation_already_sent` | 409 | Ya hay una invitación pendiente |
| `already_member` | 409 | Ese correo ya está dentro |
| `not_found` | 404 | Ruta inexistente |
| `internal_error` | 500 | Fallo nuestro. El detalle va al log, nunca al cliente |
| `invalid_cursor` | 400 | El cursor de paginación no decodifica. Ver [ADR-0011](decisions/0011-paginacion-por-cursor.md) |

`invalid_cursor` entra en vigor con el primer endpoint paginado: está decidido,
pero todavía no lo devuelve ninguna ruta.

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
| `limit` fuera de rango | `400 invalid_payload`. No se recorta en silencio |
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
