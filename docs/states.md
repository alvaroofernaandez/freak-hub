# Estados y errores en la web

Cómo la web consume el contrato de errores de [ADR-0014](decisions/0014-sistema-de-estados-y-errores.md)
y [api.md](api.md#el-sobre-de-error). Léelo antes de tocar cualquier
estado de carga, vacío o error: nada de lo que hay aquí se inventa por
pantalla, todo pasa por `normalizeError`.

## La regla de una línea

**Ninguna página vuelve a leer `status` ni a comparar texto del backend.**
`normalizeError(error, context)` es la única entrada que interpreta un
fallo; todo lo demás lee `.kind`.

## Taxonomía por alcance (ADR-0014 §3)

| Alcance | Qué cubre | Dónde vive |
| :--- | :--- | :--- |
| Global | Ruta inexistente, fallo fatal, sin conexión | `app/not-found.tsx`, `app/global-error.tsx`, `OfflineNotice` en el shell |
| Módulo | Fallo que deja inservible el área, conservando la navegación | `app/(app)/error.tsx` |
| Página | Recurso inexistente, sesión caducada, cuenta sin preparar, fallo del recurso principal | `not-found.tsx` por segmento, estados de página |
| Sección | Una parte falla o está vacía y el resto sigue | `ErrorState size="section"`, `invitationsError` de `MembersDirectory` |
| Operación | Envío pendiente, correcto, fallido | `RetryButton`, `PendingLabel`, `InlineMessage` del propio formulario |
| Campo | Error de un campo concreto | Mensaje asociado con `aria-describedby` (pendiente de migrar, ver «Qué falta») |

Prioridad cuando coinciden varios: sesión → cuenta sin preparar → permisos →
existencia del recurso → carga inicial → error del recurso principal → datos
parciales → vacío → sin resultados.

## El flujo, de la petición a la pantalla

```
loadResource(path, { token, resource, route, scope })
  → apiFetch()
  → ApiProblemError | ApiNetworkError | ApiTimeoutError | ApiAbortError
  → normalizeError(error, context)
  → NormalizedAppError { kind, severity, scope, retryable, copy, recovery, correlationId… }
  → un componente de shared/ui/state/*
```

`shared/lib/load-resource.ts` es la puerta de entrada de toda lectura de
servidor: hace la petición, captura, normaliza y registra, y devuelve un
`LoadResult<T>` (`ready` | `error`). Ninguna pantalla vuelve a escribir ese
`try/catch` a mano — que es como acaba colándose un `catch { return null }`
que convierte un fallo en una lista vacía, el primer anti-patrón de la lista
de abajo. No tiene rama `empty`: una colección vacía es un `ready` con cero
elementos, y quién dice qué significa ese vacío es el componente que lo
pinta, con la copia concreta de su motivo.

1. **`shared/errors/problem.ts`** — `parseProblem(body, status, headers)` lee
   el sobre Problem Details (o el `{code, message}` heredado) y produce un
   `ApiProblem`. Un `code` que el contrato no declara se convierte en
   `"unknown"`; nunca revienta. `ProblemCode` sale de
   `ApiErrorBody["code"]` (tipo generado del contrato), nunca escrito a mano.
2. **`shared/lib/api-client.ts`** — `apiFetch` añade un plazo por defecto
   (`AbortSignal.timeout`, 10 s, combinado con el `signal` de quien llama vía
   `AbortSignal.any`) y lanza una de cuatro clases según lo que falló:
   `ApiProblemError` (la API respondió con un error), `ApiNetworkError`
   (`fetch` nunca obtuvo respuesta), `ApiTimeoutError` (se agotó el plazo) o
   `ApiAbortError` (la propia llamada canceló la petición — nunca es un
   fallo que contar).
3. **`shared/errors/normalize-error.ts`** — `normalizeError(error, context)`
   clasifica cualquiera de esas cuatro clases (o un `ApiError` a secas, o una
   excepción cualquiera) en un `NormalizedAppError`. `context` lleva
   `resource` (la palabra que usaría una persona: «el grupo», «tu perfil»,
   «la invitación»…), `operation` (`load` | `submit`), `scope` y, si hace
   falta, `idempotent`/`hasData`.
4. **`shared/errors/messages.ts`** — el texto que ve la persona, por `code`,
   como `Record<ProblemCode, (context) => {title, description}>`: un código
   nuevo en el contrato sin entrada aquí no compila. Los códigos sin `code`
   propio (red, sin conexión, límite de peticiones) tienen su copia en
   `KIND_COPY`, por `kind`.
5. **`shared/errors/report-error.ts`** — `reportError(normalized, meta)`
   registra en consola, solo en desarrollo, solo lo inesperado (nunca
   `validation`, `not_found`, `account_pending`, `access_denied` ni una
   cancelación), y solo campos seguros: `kind`, `code`, `status`, `scope`,
   `route`, `correlationId`. Nunca `copy` ni el `ApiProblem` entero.

## `NormalizedAppError.kind`

`session_expired · account_pending · access_denied · not_found · validation ·
conflict · payload_too_large · unsupported_media · rate_limited · timeout ·
service_unavailable · network · offline · unknown`

`unknown_identity` (404) es siempre `account_pending`, nunca `not_found`: la
sesión es real, solo falta que el webhook `user.created` termine de crear la
fila en `members`. `retryable` exige dos cosas a la vez: que el fallo sea
transitorio (`timeout`, `service_unavailable`, `network`, `rate_limited`) **y**
que `context` diga que la operación es segura de repetir — por defecto sí para
`operation: "load"`, no para `operation: "submit"` salvo que se marque
`idempotent: true` explícitamente. Enviar una invitación nunca es retryable.

## Componentes (`shared/ui/state/`)

Una familia pequeña sobre una base interna, no un componente universal (ADR-
0014 descarta esa opción explícitamente): decenas de props condicionales
serían peor que varios componentes con una responsabilidad cada uno.

| Componente | Cuándo |
| :--- | :--- |
| `StateSurface` | Base interna. No se usa directamente desde una página — la usan los demás |
| `ErrorState` | Un `NormalizedAppError` retryable o no; `size="page"` o `"section"` |
| `ResourceUnavailableState` | Un recurso concreto no existe (`not-found.tsx` por segmento): título + un enlace de vuelta |
| `SessionExpiredState` | 401: enlaza a `/entrar?redirect_url=<path>` |
| `AccountPendingState` | 404 `unknown_identity`: explica y ofrece Reintentar |
| `InlineMessage` | Mensaje corto con tono (`error`/`warning`/`success`/`info`); `role="alert"` solo cuando el error aparece tras una acción del usuario; `className` opcional para una superficie compacta (el popover de invitar usa `text-xs`) |
| `SupportReference` | Id de correlación o `digest` de Next, con copiar y aviso anunciado |
| `RetryButton` | `router.refresh()` (o un `onRetry` propio) dentro de una transición, con etiqueta pendiente de ancho estable; `retryAfterSeconds` (de `NormalizedAppError.retryAfter`) lo deja deshabilitado y lo explica una vez hasta que el plazo pasa |

`shared/ui/empty-state.tsx` sigue siendo el componente para «esto está vacío
de verdad» (nunca para un fallo de carga: esa confusión es justo lo que ADR-
0014 corrige). Desde la fase 2 admite `size`: `"section"` (por defecto, con
la moldura) o `"inline"` (sin moldura, para un resultado dentro de una
sección que ya tiene su propia cabecera — ver «Estados vacíos, por motivo»
más abajo). `shared/lib/view-state.ts` da el tipo `ViewState<T>`
(`ready`/`empty`/`error`) para que un loader de página no vuelva a mezclar
banderas booleanas que pueden contradecirse.

Dos primitivas compartidas más, fuera de `shared/ui/state/` porque no son
estados de fallo/vacío sino piezas de formulario y de marca de estado:

| Componente | Cuándo |
| :--- | :--- |
| `shared/ui/form-field.tsx` (`FormField`) | Envoltorio de campo (etiqueta, campo vía render-prop, ayuda opcional, error opcional con `aria-invalid`/`aria-describedby`). Lo usan `invitation-form.tsx`, `invite-popover.tsx` y `edit-profile-dialog.tsx` |
| `shared/ui/status-mark.tsx` (`StatusMark`) | Marca (icono oculto a lectores de pantalla) + palabra. Lo usan `StatusBadge` (entradas de biblioteca) e `InvitationStatusBadge` (invitaciones), cada uno con su propio catálogo de iconos y etiquetas |

## Canales de aviso (ADR-0014 §5)

| Canal | Para qué | Componente |
| :--- | :--- | :--- |
| Pantalla completa | Solo lo global | `app/not-found.tsx`, `app/global-error.tsx` |
| Estado de página o sección | Recurso, sesión, fallo recuperable | `ErrorState`, `SessionExpiredState`, `AccountPendingState`, `ResourceUnavailableState` |
| Aviso persistente | Sin conexión | `OfflineNotice` (en `app/layout.tsx`, todo el shell) |
| En línea | Campo y operación | `InlineMessage`, el propio `<output>` del formulario |
| Modal | Solo decisiones | `Dialog` |
| **Sin toasts** | — | No hay canal de toast. Toda operación tiene un sitio natural para su resultado |

## Reglas de la copia

- **Español neutro, tuteo.** Verbos concretos: «Reintentar», «Iniciar
  sesión», «Volver al grupo». Nunca un código HTTP como título, nunca texto
  crudo del backend (`title`/`detail` de `ApiProblem` son para registrar, no
  para mostrar).
- Un nuevo `code` en el contrato exige una entrada en `messages.ts` — si no,
  `pnpm typecheck` falla.
- El identificador de correlación (`correlationId`, o el `digest` de un
  `error.tsx`/`global-error.tsx`) es siempre opaco: nunca una traza, nunca
  una consulta SQL.

## Ejemplo: una página que carga un recurso

```tsx
const result = await loadResource<MemberPage>("/v1/members?limit=100", {
  token,
  resource: "el grupo",
  route: "/miembros",
});

if (result.status === "error") {
  if (result.error.kind === "session_expired") {
    return <SessionExpiredState size="page" redirectPath="/miembros" />;
  }
  return <ErrorState error={result.error} size="page" />;
}
```

`app/(app)/miembros/page.tsx` y `app/(app)/miembros/[username]/page.tsx` son
los ejemplos reales en el repositorio — mira ahí antes de reinventar el
patrón en una página nueva.

## Anti-patrones (no los repitas)

- `catch { return null }` y tratar cualquier fallo como «vacío». Un fallo de
  carga y una colección vacía son estados distintos con acciones distintas.
- Leer `error.status` o `error.code` fuera de `normalizeError`.
- Mostrar `error.message`, `problem.title` o `problem.detail` tal cual en
  una pantalla.
- Un `role="alert"` en un mensaje que ya estaba ahí al montar el componente
  (interrumpe sin motivo). Usa `role="status"` — `InlineMessage` ya decide
  esto por ti con `afterUserAction`.
- Truncar una lista paginada en silencio cuando `next_cursor` sigue sin ser
  `null`: pide el máximo del contrato (100) y dilo (`membersHasMore` /
  `invitationsHasMore` en `MembersDirectory`, `category-has-more` en
  `/biblioteca/[categoria]`, `inProgressHasMore` en `home-dashboard.tsx`). El
  carril de inicio es el caso que más lo necesita y el que más fácil se olvida:
  al desplazarse en horizontal **no tiene borde inferior**, así que lo truncado
  no se ve truncado, se ve completo. Donde lo truncado es **una cifra** y no una
  lista, el aviso no basta y hay que tocar la cifra: en `/biblioteca` el aviso
  reencuadra los seis recuentos, y en `/biblioteca/[categoria]` la cifra junto
  al `<h1>` pasa a decir «más de N obras». Una cifra a medias no se lee como
  incompleta, se lee como falsa, y un aviso al pie no alcanza a un encabezado.
- Dibujar una barra de progreso con un `progress` del contrato. `progress` es
  un recuento absoluto en la unidad de la categoría (episodios, capítulos,
  horas, partidas), no un porcentaje: `ProgressBar` solo aparece cuando hay un
  total con el que dividirlo (`progressPercentage` en
  `features/library/lib/library-item.ts`). Sin total, la cifra en JetBrains
  Mono es toda la respuesta honesta.
- Un `<form action={formAction}>` con campos que hay que conservar tras un
  fallo. React reinicia los campos no controlados en cuanto la acción
  termina, éxito o no — un formulario con más de un campo controla sus
  valores, o llama a `formAction` a mano desde `onSubmit` con el `FormData`
  real del formulario (ver «Formularios» arriba).
- Un `EmptyState` genérico («No hay nada») para dos motivos distintos
  (colección vacía y búsqueda sin resultados, por ejemplo). Cada motivo
  real del producto tiene su propia copia y su propia acción — ver «Estados
  vacíos, por motivo».
- Un mapa de copia de error propio dentro de un componente o una acción. El
  texto de un `field_errors` se resuelve con los mismos resolutores de
  `messages.ts` que un error de formulario, nunca con un `switch` local.

## Cómo añadir un código de error nuevo sin duplicar lógica

1. Añádelo al `enum` de `Error.code` en `packages/contracts/openapi.yaml` y
   regenera (`pnpm contracts:generate`).
2. `shared/errors/problem.ts`: añade la clave a `KNOWN_CODES` (el `satisfies
   Record<…, true>` te obliga a no olvidarlo).
3. `shared/errors/messages.ts`: añade su entrada a `MESSAGES` (el
   `Record<ProblemCode, …>` falla en compilación si no lo haces).
4. Si el código necesita un `kind` que no exista todavía en
   `shared/errors/types.ts`, añádelo ahí y a los tres `Record<ErrorKind, …>`
   de `normalize-error.ts` (`SEVERITY`, `RECOVERY`) y a `classify()`.
5. No toques páginas ni componentes: si ya usan `normalizeError` y la familia
   de `shared/ui/state`, el código nuevo funciona en cuanto los tres pasos de
   arriba compilan.

## Formularios

Cuatro formularios comparten `shared/ui/form-field.tsx`:
`features/invitations/ui/invitation-form.tsx` (`/invitar`),
`features/invitations/ui/invite-popover.tsx` (el mismo campo de correo, en
popover), `features/profile/ui/edit-profile-dialog.tsx` (nombre, apellidos,
usuario, foto) y `features/library/ui/manual-add-form.tsx` (el alta manual:
título, año, sinopsis y estado). `features/library/ui/entry-editor.tsx` es el
quinto que escribe, pero no es un `<form>`: ver «Escrituras de biblioteca».

- **Foco en el primer campo inválido.** Cada formulario guarda una `ref` por
  campo y, en un `useEffect` sobre el estado de la acción, mueve el foco al
  primero con error tras un envío fallido. En `edit-profile-dialog.tsx` el
  orden es foto → usuario (el orden visual del formulario); no hay más
  campos con error posible.
- **El error de campo viene de `field_errors`.** La acción del servidor
  (`InvitationFormState`/`ProfileFormState`) añade `fieldErrors?: {field,
  message}[]`, construido con `normalizeError(cause, context).fieldErrors` y
  resuelto a texto con las mismas funciones de `messages.ts` — nunca un
  segundo mapa de copia. Un error sin campo (`no_profile_changes`,
  `name_too_long`, un fallo de red) se queda en un `InlineMessage` de
  formulario, no en un campo.
- **Ni `edit-profile-dialog.tsx` ni `manual-add-form.tsx` usan `<form action={formAction}>`.** React
  reinicia los campos no controlados de un formulario en cuanto la acción
  ligada a `action` termina, éxito o no — eso borraba lo escrito y la foto
  elegida justo después de un fallo recuperable. El formulario usa
  `onSubmit` con `event.preventDefault()` y llama a `formAction` a mano con
  el `FormData` del propio `<form>` (la función que devuelve
  `useActionState` sigue siendo válida invocada así); el estado de envío
  para el botón sale del tercer valor de `useActionState`, no de
  `useFormStatus` (que solo sabe de una `<form action>`, no de este
  camino manual). `invitation-form.tsx` e `invite-popover.tsx` sí controlan
  su único campo (`value`/`onChange`) por la misma razón, con menos coste.
- **El alta manual no elige un estado por ti.** `CreateLibraryEntryRequest.status`
  es obligatorio y **no tiene valor por defecto**, y el motivo que da el
  contrato es que no hay nada sensato que adivinar: querer algo, tenerlo ya y
  haberlo terminado hace años son formas igual de normales de empezar. El
  grupo de fichas arranca sin nada marcado y el fallo de validación se ata al
  campo, como cualquier otro. Se ofrecen los seis, porque crear es la entrada
  al ciclo de vida y no una transición.
- **La foto se valida en el cliente antes de subir nada,** con los mismos
  límites que el backend (`AVATAR_MAX_BYTES` = 5 MiB,
  `AVATAR_ACCEPTED_TYPES` = `image/jpeg`, `image/png`, `image/webp`,
  `image/gif` — `shared/errors/messages.ts`, espejo de
  `apps/api/internal/users.MaxAvatarBytes`/`AllowedAvatarContentTypes`). Un
  archivo rechazado limpia el `<input type=file>` (`value = ""`) y no llega
  a `apiFetch`; el mensaje es el mismo que devolvería el backend. El
  `accept="image/*"` del campo ya filtra la mayoría de los casos en el
  selector del sistema operativo — el chequeo en JS cubre a quien lo rodea
  eligiendo «todos los archivos».
- **Sin doble envío.** El botón de guardar/enviar se deshabilita mientras la
  acción está en curso (`isPending`/`pending`), con `PendingLabel` para que
  no cambie de ancho.
- **Éxito en `InlineMessage` tono `success`**, nunca `text-accent` (ese color
  es el de la acción primaria, no el de un resultado). Antes
  `edit-profile-dialog.tsx` usaba `text-accent` para el mensaje de éxito.
- **Cambios sin guardar.** Cerrar `EditProfileDialog` con algún campo tocado
  (`onChange` de un campo de texto, o una foto válida elegida) pide
  confirmación con el `Dialog` existente («¿Descartar los cambios?» /
  «Descartar», destructivo-secundario, vs. «Seguir editando», primario). Un
  diálogo limpio (nada tocado) cierra directo. El estado `dirty` se limpia al
  cerrar y tras un envío correcto.
- **Timeout de mutación.** `shared/lib/api-client.ts` exporta
  `MUTATION_TIMEOUT_MS` (35 000 ms), por encima del límite de 30 s del
  middleware `Timeout` de la API. Toda escritura (`POST`/`PATCH`, subida de
  foto incluida) lo pasa como `timeoutMs`; una lectura se queda en el
  `DEFAULT_TIMEOUT_MS` de 10 s. Antes, la subida de avatar heredaba el plazo
  de lectura y una foto de 5 MB en una conexión lenta podía agotarlo aunque
  el servidor siguiera dispuesto a aceptarla.

## Escrituras de biblioteca

Las cuatro escrituras de la #73 (`POST /v1/works`, `POST /v1/library`,
`PATCH /v1/library/{id}`, `DELETE /v1/library/{id}`) siguen el mismo carril
que `create-invitation.ts` —zod primero, `ErrorContext` fijo de módulo,
`MUTATION_TIMEOUT_MS`, `normalizeError` como único intérprete— con cuatro
particularidades que no tenía ninguna escritura anterior.

- **El `PATCH` envía un diferencial, nunca la entrada entera.** El contrato
  distingue ausente (no lo toques), `null` (bórralo) y valor (escríbelo), así
  que `buildPatch` compara el borrador contra lo guardado y solo viaja lo que
  se movió. De ahí salen gratis dos reglas que de otra forma habría que
  recordar: reenviar el estado actual es un no-op que **no llega a enviarse**,
  y **una valoración guardada sobrevive a un cambio de estado**, porque un
  cambio de estado a secas produce `{status}` y la valoración no está en el
  cuerpo. Borrarla es un `null` explícito y siempre algo que se pide.
- **El estado del `PATCH` es una transición.** `features/library/lib/transitions.ts`
  repite la máquina de `docs/domain.md` para no ofrecer movimientos que el
  dominio va a rechazar con `422 invalid_transition`. Ver
  [ADR-0016](decisions/0016-maquina-de-estados-en-la-interfaz.md).
- **Valorar solo se ofrece donde se acepta**, en `completed` y `dropped`
  (`rating_not_allowed`). Fuera de ahí el control está deshabilitado y el
  texto de ayuda dice, además, que la valoración que ya haya se conserva: la
  regla afecta a un **cambio** de valoración, no a la que está guardada.
- **`DELETE` no es idempotente.** El segundo es un 404, así que su
  `ErrorContext` lleva `idempotent: false` —un plazo agotado no invita a
  repetir— y, al completarse, la interfaz **se va** a
  `/biblioteca/[categoria]` con `router.replace` en vez de quedarse sobre un
  id que ya no resuelve. No hay deshacer: por eso hay confirmación antes.

El progreso es un **recuento absoluto** en la unidad de la categoría, nunca un
porcentaje, y solo lleva tope cuando el catálogo declaró un total
(`metadata.episodes` de un anime). Un anime en emisión no trae número de
episodios, y negarle el episodio 13 sería inventarnos un dato que nadie dio
(regla 5 del dominio).

## El catálogo externo no es la API

`features/library/lib/anilist.ts` no lanza: devuelve una unión de estados
(`ok · empty · rate_limited · unavailable`). No pasa por `normalizeError`
porque ese camino interpreta el sobre Problem Details de `/v1`, y su copia
habla de «el servidor»: un catálogo de terceros caído es otra situación, con
otra salida —el alta manual— y otro texto.

`features/library/lib/catalog-search.ts` es el único sitio que traduce esa
unión, y lo hace **a la forma de siempre**: construye un `NormalizedAppError`
(`kind: "rate_limited"` o `"service_unavailable"`, `scope: "section"`,
`recovery: "retry"`) para que `ErrorState` y `RetryButton` lo pinten como
cualquier otro fallo y nada aguas abajo sepa que este llegó por otro camino.
El reintento es `router.refresh()`, que vuelve a lanzar la misma búsqueda
porque el término vive en la URL.

Un componente que ramificara sobre `CatalogSearchOutcome` por su cuenta sería
el «mapa de copia propio» que prohíbe la lista de anti-patrones, y habría uno
por pantalla el día que lleguen las otras cinco categorías. La copia no nombra
nunca al proveedor ni su modo de fallo: ni «AniList», ni «GraphQL», ni un
código HTTP.

El fichero se borra entero, con `anilist.ts`, cuando `/v1/works` tenga su
propia integración (épica #10): a partir de ahí los fallos del catálogo son
problemas de la API y vuelven a `normalizeError`.

## Estados vacíos, por motivo

`EmptyState` nunca es genérico: cada sitio dice, con sus propias palabras,
por qué no hay nada y qué se puede hacer al respecto (si hay algo que
hacer). La tabla cubre los motivos reales del producto:

| Motivo | Dónde | Copia (resumen) | Acción |
| :--- | :--- | :--- | :--- |
| Primer uso / colección vacía | `category-works-browser.tsx` (sin obras en la categoría) | «Aún no has añadido ninguna obra a esta categoría» | Enlace a `/anadir/<categoría>` |
| Búsqueda sin resultados | `category-works-browser.tsx` (con `filters.search`) | «No hay resultados para "‹término›"» — el término se ve tal cual se escribió | «Limpiar búsqueda» (solo el campo) |
| Filtros sin resultados | `category-works-browser.tsx` (sin búsqueda, con estado/favorito/en propiedad activos) | «No hay obras con estos filtros» | «Quitar filtros» — los chips se ven pulsados hasta que se pulsa esto |
| Ambos a la vez | `category-works-browser.tsx` | Gana la búsqueda (más específica) | «Limpiar búsqueda» |
| Categoría sin catálogo integrado | `app/(app)/anadir/[categoria]/page.tsx`, las cinco que no son anime | «La búsqueda en el catálogo externo todavía no está disponible» | Ninguna — no es un «no hay resultados», es una función que no existe todavía; el enlace a alta manual ya está fuera del `EmptyState` |
| Antes de buscar | `app/(app)/anadir/anime` sin `?q=` | «Busca un anime por su título» | Ninguna — la acción es el propio campo, que está justo encima |
| Búsqueda de catálogo sin resultados | `app/(app)/anadir/anime` con `?q=` | «No hay resultados para "‹término›"» (`size="inline"`) | Ninguna aparte del enlace a alta manual, que ya vive al pie de la pantalla |
| Nada en curso | `home-dashboard.tsx` | «Nada en curso todavía» | Enlace a `/biblioteca` |
| El carril de «en curso» falló | `home-dashboard.tsx` con `inProgressError` | La copia de `normalizeError` | `ErrorState size="section"` — nunca el vacío de arriba: «no tienes nada empezado» y «no hemos podido preguntarlo» son cosas distintas |
| Sin recomendaciones / sin actividad | `home-dashboard.tsx`, `activity-section.tsx`/`recommendations-section.tsx` de perfil | «Sin recomendaciones pendientes», «Sin actividad reciente» | Ninguna — nadie puede generar una recomendación o actividad ajena desde aquí |
| Biblioteca del perfil vacía, perfil propio | `library-section.tsx` con `canAdd` | «Sin favoritos todavía» | «Añadir una obra» — abre el selector de categoría (`useAddCategoryModal`) |
| Biblioteca del perfil vacía, perfil ajeno | `library-section.tsx` sin `canAdd` (`FriendProfileView` nunca lo pasa) | «Sin favoritos todavía» | Ninguna — un perfil ajeno es de solo lectura, nunca ofrece una acción de escritura |
| Nadie en el grupo | `members-directory.tsx` | «Todavía no hay nadie» | Ninguna — solo se entra por invitación, ya visible en la cabecera |
| Sin invitaciones pendientes | `members-directory.tsx` | «No hay invitaciones pendientes» (`size="inline"`, ya no el recuadro de contorno discontinuo) | Ninguna — invitar ya está en la cabecera de la página |
| Sin actividad del grupo | `activity-feed.tsx` | «Sin actividad todavía» | Ninguna |
| Nada recomendado por otros | `recommendations-view.tsx`, bloque «Recibidas pendientes» | «Nada pendiente» | Ninguna — nadie puede recomendarse algo a sí mismo desde aquí |
| Nada recomendado por ti | `recommendations-view.tsx`, bloque «Enviadas» | «Todavía no has recomendado nada» | Ninguna — se recomienda desde la ficha de la obra, no desde esta pantalla |

El recuento de resultados se anuncia por voz (`role="status"` vía
`<output aria-live="polite">`) 400 ms después de que se asiente — no en cada
tecla de una búsqueda, para no convertir el tecleo en una ráfaga de avisos.

En la búsqueda de catálogo el retardo no hace falta: la petición ya va
retrasada 300 ms y solo se envía una por término, así que el recuento se
anuncia en cuanto llega. La región viva vive en `CatalogSearchField` y no se
desmonta entre búsquedas: **solo cambia su texto**. La razón está escrita en
`shared/ui/pending-label.tsx` y vale aquí igual — una región viva que entra en
el DOM con su mensaje ya puesto se la pierde el observador del navegador,
porque solo vigila nodos que ya estaban. Por eso el esqueleto de carga no
lleva región propia (es `aria-hidden` entero): mientras la búsqueda está en
vuelo, la región de siempre dice «Buscando…», lo que además impide que el
recuento anterior se quede como lo último dicho.
Un fallo también se anuncia ahí, solo el título: `ErrorState` es un
encabezado y un párrafo, no una región viva, así que en una navegación de
cliente aparecería en silencio.

## No aplica hoy

Igual que ADR-0014, ninguna de estas funciones existe en el producto, así
que no se les diseña un estado propio. Se incorporan a esta misma taxonomía
el día que existan.

| Función | Evidencia |
| :--- | :--- |
| Acciones masivas | Ninguna pantalla selecciona más de un elemento a la vez |
| Autoguardado | Todo formulario tiene un botón de envío explícito (`edit-profile-dialog.tsx`, `invitation-form.tsx`) |
| Actualizaciones optimistas | Cada mutación espera la respuesta antes de refrescar (`router.refresh()` tras éxito) |
| Conflictos de versión | Ningún recurso lleva ETag/versión; `PATCH /v1/me` no la comprueba (`apps/api/internal/users`) |
| Planes o funciones restringidas | No hay tabla de planes ni *feature flags* en `packages/contracts/openapi.yaml` |
| Suspensión de cuentas | `apps/api/internal/users` no tiene un estado «suspendida»; solo existe/no existe |
| Cola de sincronización sin conexión | `OfflineNotice` solo avisa; ninguna acción se encola para reintentar sola al volver la conexión |

## Envíos con resultado incierto

Un plazo agotado en un envío que no es seguro repetir (`idempotent: false`)
no significa que haya fallado: puede haberse completado justo antes del
corte. Por eso `request_timeout` (el 504 del servidor) y el `timeout` del
cliente no dicen «inténtalo de nuevo» en ese caso, sino «No sabemos si se ha
podido enviar la invitación. Compruébalo antes de volver a intentarlo.».

Cada acción de envío nombra su operación con `action` en su `ErrorContext`
(«enviar la invitación»), y el catálogo la usa para decir exactamente qué
falló. Sin `action`, el texto sigue siendo el del perfil, «No se han podido
guardar los cambios». Las acciones nunca escriben su propio texto de error:
`create-invitation.ts` devuelve siempre `normalized.copy.description`, así una
sesión caducada o una caída del servicio se explican por su causa real.

## Pendiente

- **Objetivo táctil de 44 px.** Cumplimos el mínimo de WCAG 2.2 AA
  (criterio 2.5.8: 24 × 24 px); los 44 px son del nivel AAA y de la guía de
  la plataforma. Los botones nuevos de esta fase
  (`Cancelar`/`Guardar cambios` de `edit-profile-dialog.tsx`,
  `Descartar`/`Seguir editando` del diálogo de confirmación, «Limpiar
  búsqueda»/«Quitar filtros» de `category-works-browser.tsx`, «Ir a tu
  biblioteca» de `home-dashboard.tsx`, «Añadir una obra» de
  `library-section.tsx`, y ahora «Guardar cambios» / «Quitar de mi
  biblioteca» / «Quitar la valoración» de `entry-editor.tsx`, sus dos pasos
  de progreso —`h-10 w-10`, 40 px— y las fichas de estado de
  `radio-chips.tsx`) siguen el `px-*`/`py-2.5` que ya usa el resto de
  botones secundarios de la aplicación (`SaveButton` original,
  `RetryButton`, el botón de enviar de `invitation-form.tsx`), que no llega
  a los 44 px de alto declarados y no está auditado ni documentado en
  `docs/design.md` como una medida deliberada. Revisarlo es un cambio de
  sistema de botones, no de esta fase — tocar solo los botones nuevos
  habría dejado una aplicación con dos alturas de botón secundario
  conviviendo sin motivo.
