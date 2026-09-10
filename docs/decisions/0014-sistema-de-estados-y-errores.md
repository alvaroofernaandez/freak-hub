# ADR-0014 · Sistema de estados y contrato de errores de extremo a extremo

**Estado**: Aceptada · 2026-09-10

## Contexto

La auditoría de la API y de la web encontró que los estados de la aplicación
no forman un sistema:

**API**

- El sobre de error es `{code, message}`, pero un pánico responde un 500 **sin
  cuerpo** y un 405 sale con el código `bad_request`.
- Trece códigos existen solo como cadenas sueltas en `handlers.go`. El
  contrato (`openapi.yaml`) no los enumera y ningún test comprueba que Go y el
  contrato coincidan.
- `middleware.RequestID` genera un identificador que **incluye el nombre de la
  máquina** y que no sale ni en la respuesta ni en los logs: un error visible
  no se puede correlacionar con su línea de log, y el formato por defecto no se
  puede exponer tal cual.
- Un timeout, un 429 de Clerk o una caída de Postgres acaban como un 500 opaco,
  indistinguible de un fallo real del servidor. Un multipart mal formado se
  responde como «foto demasiado grande».
- No hay filtraciones: nunca se envía `err.Error()` al cliente.

**Web**

- No existe `not-found.tsx`, `error.tsx` ni `global-error.tsx`: una ruta
  inexistente o una excepción no controlada caen en las pantallas por defecto
  de Next, fuera del sistema de diseño.
- Las páginas atrapan cualquier fallo con `catch { return null }`. Una sesión
  expirada (401), un miembro sin ficha (404 `unknown_identity`) y un 500 se ven
  igual.
- Un fallo de carga se muestra con `EmptyState`, como si la colección estuviera
  vacía, y conviven cuatro tratamientos distintos de «no hay nada».
- Los formularios muestran un único mensaje al pie, sin `aria-invalid` ni
  `aria-describedby`, y sin llevar el foco al error.
- La web descarta `next_cursor`: con más de 25 miembros la lista se cortaría en
  silencio.

## Decisión

### 1. Un contrato de errores, con `openapi.yaml` como fuente canónica

Todas las respuestas de error de la API usan un sobre compatible con
**Problem Details** (RFC 9457), servido como `application/problem+json`:

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

- `code` es el identificador **estable** que consumen las máquinas. El
  contrato lo declara como `enum`, y un test de Go falla si el catálogo de Go y
  el del contrato se separan. La web recibe el tipo generado y no puede
  referirse a un código que no exista.
- `message` se conserva, marcado como obsoleto, con el mismo texto que
  `detail`: la web actual lo lee y no se rompe nada durante la migración.
- `correlation_id` es **opaco**: 128 bits aleatorios en hexadecimal, también en
  la cabecera `X-Request-ID` y en cada línea de log de la petición. Sustituye
  al identificador de chi, que incluye el nombre de la máquina.
- `retryable` indica si la condición es transitoria (429, 502, 503, 504). Si
  reintentar es **seguro** lo decide la web según la operación: una invitación
  no se reintenta a ciegas.
- `field_errors` solo aparece cuando el error pertenece a un campo sin
  ambigüedad. La validación sigue devolviendo el primer error, como hoy.

### 2. Un único mapeo central en la API

`internal/api` mapea cada error de dominio a `(status, code, campo)` en **una
tabla**, que sustituye a los `switch` repartidos por los handlers. Los
paquetes de dominio no cambian: ni sus reglas ni cuándo fallan. Solo cambia
cómo se clasifica y se transporta el fallo.

Se corrigen únicamente clasificaciones de transporte:

| Situación | Antes | Después |
| :--- | :--- | :--- |
| Pánico | 500 sin cuerpo | 500 `internal_error` con Problem, log con `request_id` |
| Método no permitido | 405 `bad_request` | 405 `method_not_allowed` |
| Plazo agotado | 500 `internal_error` | 504 `request_timeout`, reintentable |
| Clerk no disponible o limitando, en una operación | 500 `internal_error` | 503 `upstream_unavailable`, reintentable |
| Clerk no disponible al verificar el token | 401 `invalid_token` | 503 `upstream_unavailable`, reintentable |
| Multipart mal formado | 413 `avatar_too_large` | 400 `invalid_payload` |
| Cuerpo JSON demasiado grande | 400 `invalid_payload` | 413 `payload_too_large` |
| Cuerpo de webhook ilegible | 400 `bad_request` | 400 `invalid_payload` |

La segunda fila es la que más importa al usuario: una caída de Clerk ya no se
presenta como «tu sesión no es válida», que invitaba a volver a iniciar sesión
sin que sirviera de nada. Un token realmente inválido sigue siendo 401. La
última fila no cambia el status; `bad_request` se retira del catálogo porque
duplicaba a `invalid_payload`.

Todas las parejas `(status, code)` que hoy verifican los tests se conservan.
Una cancelación del cliente no se registra como error.

### 3. Taxonomía de estados por alcance

| Alcance | Qué cubre | Dónde vive |
| :--- | :--- | :--- |
| Global | Ruta inexistente, fallo fatal, sin conexión | `app/not-found.tsx`, `app/global-error.tsx`, aviso de conexión en el shell |
| Módulo | Fallo que deja inservible el área, conservando la navegación | `app/(app)/error.tsx` |
| Página | Recurso inexistente, sesión caducada, cuenta sin preparar, fallo del recurso principal, vacío | `not-found.tsx` por segmento, estados de página |
| Sección | Una parte falla o está vacía y el resto sigue | Estado de sección con reintento |
| Operación | Envío pendiente, correcto, fallido | Botón y región de estado del propio formulario |
| Campo | Error de un campo concreto | Mensaje asociado con `aria-describedby` |

La prioridad cuando coinciden varios es: sesión → cuenta sin preparar →
permisos → existencia del recurso → carga inicial → error del recurso
principal → datos parciales → vacío → sin resultados.

### 4. En la web, un normalizador y una familia de componentes pequeña

- `normalizeError(error, contexto)` es la **única** entrada que interpreta un
  fallo: errores de la API (Problem o el formato antiguo), errores de red,
  timeouts y excepciones. Ninguna página vuelve a leer `status` ni compara
  textos del backend.
- El texto que ve el usuario lo decide la web por `code` y contexto, con un
  catálogo tipado por el enum del contrato: un código nuevo sin texto no
  compila.
- Una familia de componentes, cada uno con una sola responsabilidad, en lugar
  de un componente universal: estado vacío por motivo, sin resultados, error
  con reintento, recurso no disponible, sesión caducada, mensaje en línea,
  mensaje de campo y referencia de soporte.
- Las listas paginadas piden el máximo del contrato (100) y, si aun así queda
  `next_cursor`, lo dicen en lugar de cortar la lista en silencio.

### 5. Canales de aviso

- **Pantalla completa**: solo lo global (ruta inexistente, fallo fatal).
- **Estado de página o sección**: recurso, vacío, error recuperable.
- **Aviso persistente**: sin conexión.
- **En línea**: campo y operación.
- **Modal**: solo decisiones (descartar cambios sin guardar).
- **Sin toasts por ahora**: todas las operaciones que existen tienen un sitio
  natural para su resultado. Se reconsidera cuando una operación no lo tenga.

## Consecuencias

**A favor**

- Un fallo visible se puede rastrear hasta su línea de log por
  `correlation_id`, sin exponer nada de la infraestructura.
- Go, el contrato y la web comparten el catálogo de códigos, y un test impide
  que se separen.
- Sesión caducada, cuenta sin preparar, recurso inexistente, vacío, sin
  resultados y fallo ya no se confunden.
- La migración no rompe clientes: `code` y `message` siguen donde estaban.

**En contra**

- Cambia el `Content-Type` de los errores a `application/problem+json`.
  Cualquier cliente que comprobara `application/json` exacto tendría que
  aceptarlo. El único cliente es la web, y no lo comprueba.
- `message` queda duplicado con `detail` hasta que se retire en otro ADR.
- Seis clasificaciones de transporte cambian de status (tabla del punto 2).

**No aplica hoy**

Acciones masivas, autoguardado, actualizaciones optimistas, conflictos de
versión, planes o funciones restringidas y suspensión de cuentas: el producto no
tiene esas funciones, así que no se diseñan estados para ellas. Cuando exista
una, entra en esta misma taxonomía.

**Descartado**

- *Compartir clases de excepción entre Go y la web*: se comparte el contrato,
  no la implementación.
- *Un componente de estado universal*: acabaría con decenas de props
  condicionales. Se prefiere una familia pequeña sobre una base común.
- *Toasts como canal general*: ninguna operación actual los necesita, y un
  toast nunca debe ser la única vía para un error que hay que corregir.
