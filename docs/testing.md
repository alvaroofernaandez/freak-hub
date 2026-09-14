# Tests

## La regla

**TDD estricto: rojo → verde → refactor.** Primero el test que falla, después el
mínimo código que lo pone en verde, después la limpieza. Escribir el código y
"cubrirlo con tests" luego no es TDD: es test de regresión de código en el que ya
confías, y te has saltado justo la parte que aporta diseño.

## Qué se testea y con qué

| Capa | Herramienta | Qué cubre |
| :--- | :--- | :--- |
| Dominio Go | `go test` + dobles en memoria | Reglas de negocio, sin base de datos |
| HTTP Go | `go test` + `httptest` | Rutas, estados, sobre de errores, CORS |
| Web unitaria | Vitest + Testing Library | Utilidades, componentes, server actions |
| Web E2E | Playwright | El perímetro de autenticación y los recorridos con sesión |

## Por qué el dominio se testea sin Postgres

Porque los puertos lo permiten. `internal/users` depende de la interfaz
`Repository`, no de pgx, así que `usersmem.Repository` lo sustituye entero.
Resultado: la suite completa del backend corre en **menos de un segundo**, sin
Docker, sin red y sin un JWT real.

Eso no es un truco para ir rápido: es la prueba de que la arquitectura hexagonal
está bien puesta. El día que no puedas testear una regla sin levantar Postgres,
esa regla está en el sitio equivocado.

## Cobertura actual

```
apps/api   → config, auth, httpx, users, invitations, library, webhooks, api (router)
apps/web   → routes, api-client, cn, invitation-form
e2e        → perímetro de autenticación · sesión, menú de usuario, invitar, cerrar sesión
```

Lo más interesante que ya está blindado:

- Una ruta protegida **nunca** se vuelve pública por accidente
  (`routes.test.ts`).
- El middleware rechaza sin cabecera, con esquema equivocado, con token vacío y
  con token rechazado, y **no filtra el motivo real** al cliente.
- Un webhook sin firma válida **no llega al dominio**.
- Un webhook repetido no crea dos miembros.
- Una invitación rechazada **nunca** llega a Clerk.
- Si Clerk falla al enviar, **no queda fila local**.
- Puntuar algo que no has terminado **no llega a la base de datos**, y la
  máquina de estados se comprueba sobre **los 36 pares de estados posibles**,
  no sobre una lista escrita a mano: acepta los 7 saltos que dibuja
  `domain.md` más los 6 de quedarse donde estás, y rechaza los otros 23.
- El dominio de la biblioteca **no conoce a sus adaptadores**, y eso se
  comprueba en cada pasada: `go list -deps` sobre `internal/library/...` no
  puede alcanzar pgx, chi, Clerk ni `sqlcgen`.
- Una entrada ajena y una inexistente responden **el mismo error, carácter por
  carácter**, para que el mensaje no enumere lo que el código de estado calla.

## Comandos

```sh
pnpm test                        # Vitest, una pasada
pnpm --filter @freak-hub/web test:watch
pnpm test:e2e                    # Playwright (levanta la web solo)
pnpm --filter @freak-hub/web exec playwright test --project=signed-out
pnpm --filter @freak-hub/web exec playwright test --project=signed-in

make -C apps/api test            # go test -race
make -C apps/api test-cover      # informe de cobertura en el navegador
```

## Convenciones

**Go**

- Tests en `package foo_test`, para consumir el paquete como lo hará el resto del
  código y no acabar probando detalles privados.
- `t.Parallel()` en todos: obliga a que no compartan estado.
- Nombre del test = la afirmación: `TestInviteRefusesToInviteAnExistingMember`.
- Los dobles viven en su subpaquete (`usersmem`, `invitationsmem`) y son
  reutilizables.

**Web**

- Consultas por rol y por etiqueta accesible, nunca por clase CSS. Si un test no
  encuentra el elemento por su rol, probablemente el componente tenga un problema
  de accesibilidad real.
- Los server actions se sustituyen con `vi.mock` en los tests de componente.

## E2E con sesión

El perímetro sin sesión cubre la regresión más grave —que una ruta protegida
deje de estarlo— y no necesita nada. Los recorridos **con** sesión sí: hace
falta un usuario real en la instancia de desarrollo de Clerk, porque probar una
integración con un doble no prueba la integración.

### Los tres proyectos de Playwright

| Proyecto | Qué corre | Qué necesita |
| :--- | :--- | :--- |
| `setup` | Inicia sesión una vez y guarda el estado en `apps/web/playwright/.clerk/user.json` | `E2E_CLERK_USER_IDENTIFIER` y `CLERK_SECRET_KEY` |
| `signed-out` | Todo lo que **no** sea `*.signed-in.spec.ts` | Nada |
| `signed-in` | `e2e/*.signed-in.spec.ts`, partiendo del estado guardado | `setup` + (para invitar) la API en Go |

`signed-out` se define por lo que excluye, nunca por una lista de ficheros. Un
proyecto que solo casara con `auth.spec.ts` dejaría fuera, en silencio, todo
spec de perímetro escrito después: un `biblioteca.spec.ts` nuevo no pertenecería
a ningún proyecto, no lo recogería nadie y la pasada seguiría en verde. Con ocho
rutas autenticadas llegando en la épica #10, eso no es hipotético.

`signed-out` tampoco depende de `setup`, y el *global setup* **no lanza nunca**.
Si `clerkSetup()` no consigue su *testing token* —un 401 por clave rotada no
entra en los reintentos de `@clerk/testing`, que solo cubren 408, 429 y 5xx—,
avisa y sigue. Sin esa guardia la excepción se llevaría por delante la pasada
entera, perímetro incluido, antes de la primera aserción.

Dicho lo cual, conviene ser preciso sobre hasta dónde llega la protección. Con
una clave **rotada** la guardia hace su trabajo (los recorridos con sesión se
omiten, la pasada continúa), pero la propia aplicación tampoco funciona con esa
clave, así que el perímetro falla igual — en sus aserciones, con un informe que
dice cuáles, en vez de en el arranque. Comprobado: `clerkSetup()` devuelve
`Unauthorized`, se avisa, seis tests se omiten y los cuatro del perímetro caen
porque `next dev` no puede renderizar. De lo que sí protege por completo es de
un fallo **transitorio** al pedir el token con una clave válida: ahí la web
sigue sirviendo páginas y el perímetro pasa.

El fichero de sesión está en `.gitignore`. Contiene una sesión real: subirlo
equivale a dejar la cuenta abierta en público.

### Los seis recorridos

| Recorrido | Fichero | Qué demuestra |
| :--- | :--- | :--- |
| Iniciar sesión y aterrizar en `/inicio` | `auth.setup.ts` | El flujo de Clerk funciona de verdad |
| `/inicio` muestra el `@usuario` y su menú de sesión | `session.signed-in.spec.ts` | `currentUser()` resuelve en el servidor |
| Invitar a un correo nuevo ⇒ confirmación | `invitations.signed-in.spec.ts` | La cadena entera: `getToken()` → `Authorization` → JWKS → Go |
| Invitar al mismo correo ⇒ «ya hay una pendiente» | `invitations.signed-in.spec.ts` | El `code` del error viaja intacto de Go a la interfaz |
| Un correo sin dominio válido ⇒ error de Zod | `invitations.signed-in.spec.ts` | La validación corta antes de salir a la red |
| Cerrar sesión ⇒ `/inicio` vuelve a redirigir | `sign-out.signed-in.spec.ts` | La sesión se destruye de verdad |

### Crear el usuario de prueba

1. Créalo en la instancia de **desarrollo** de Clerk con una dirección que lleve
   el subcomplemento `+clerk_test`. Con el CLI:

   ```sh
   clerk users create --instance dev \
     --email "freak-hub-e2e+clerk_test@example.com" \
     --username "e2e_playwright" --first-name "E2E" --last-name "Playwright" --yes
   ```

   El nombre de usuario importa: `/inicio` lo muestra y uno de los recorridos lo
   comprueba.

2. **Por qué una dirección `+clerk_test` y no una contraseña.** No es que la
   contraseña esté desactivada. Medido contra la instancia,
   `signIn.create({ identifier })` ofrece `password`, `email_code` y
   `reset_password_email_code`, y la contraseña se verifica de verdad: una
   equivocada responde 422 `form_password_incorrect`. Pero con la **correcta**
   el resultado es:

   ```
   status: "needs_client_trust"
   createdSessionId: null
   supportedSecondFactors: ["email_code"]
   ```

   La instancia quiere verificar el dispositivo, y cada contexto de Playwright
   es un dispositivo recién estrenado. Empezar por `email_code` se salta ese
   paso, porque el código **es** la verificación. Y las direcciones
   `+clerk_test` son las de prueba de Clerk: nunca se entregan y siempre aceptan
   el código `424242`.

   Lo que convierte esto en una trampa en vez de en un error es
   `@clerk/testing@2.2.31`: su rama `password` llama a `create` y luego a
   `setActive` **sin mirar el estado en ningún momento** —las ramas `ticket` y
   `email_code` sí comprueban `complete`—, así que ejecuta
   `setActive({ session: null })` y deja el navegador sin sesión y sin ruido.
   Encima hay una segunda salida silenciosa, un `if (!Clerk.client) return`. Por
   eso `e2e/support/sign-in.ts` espera a `window.Clerk.user` con un tiempo
   límite propio: convierte las dos en un fallo señalando la línea culpable.

   `password` sigue cableada para un identificador que **no** sea una dirección
   `+clerk_test`, que es el único caso en que `email_code` no sirve.

3. Para que los recorridos de invitación funcionen, ese usuario tiene que ser
   miembro en la base de datos local. El webhook `user.created` lo crea solo si
   la API está escuchando cuando lo das de alta; si no, repítelo con
   `clerk webhooks --forward-to http://localhost:8080/webhooks/clerk` en
   marcha (ver docs/development.md).

4. Guarda el identificador en `apps/web/.env.local` (ignorado por git):

   ```sh
   E2E_CLERK_USER_IDENTIFIER=freak-hub-e2e+clerk_test@example.com
   ```

   Playwright carga ese fichero con el directorio de trabajo en `apps/web`, así
   que las variables se documentan en `apps/web/.env.example`, no en el de la
   raíz. Ahí ya están `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`
   de `clerk env pull`.

**Nunca** se escribe una credencial real en el repositorio, y el fichero de
sesión que Playwright guarda está en `.gitignore` por la misma razón.

### Ejecutarlos en local

```sh
pnpm infra:up        # Postgres, para que la API tenga dónde escribir
pnpm api:dev         # la API en Go, en :8080
pnpm test:e2e        # Playwright levanta la web y corre los tres proyectos
```

Sin la API, los dos recorridos que la atraviesan se omiten con un mensaje que
dice exactamente qué falta. Sin credenciales —o si `clerkSetup()` no consiguió
su *testing token*—, se omiten todos los que llevan sesión. **Ninguno pasa en
silencio**: un test que se salta sin decirlo es peor que no tenerlo.

Esa comprobación vive en un `beforeEach`, no en el ámbito del módulo, y el
motivo es medible: Playwright **recoge** los ficheros de test antes de ejecutar
el *global setup*, así que un `test.skip(...)` de módulo se decide cuando
`CLERK_TESTING_TOKEN` todavía no existe. Se vio en una pasada donde la condición
valía `true` dentro del test y aun así los seis salían marcados como omitidos.

El correo al que se invita se genera con el sufijo `+clerk_test`, la convención
de Clerk para una dirección que nunca se entrega de verdad, y lleva una marca de
tiempo para no chocar con la invitación pendiente que dejó la pasada anterior.
Si quieres comprobarlo en un buzón real, pon `E2E_INVITEE_EMAIL`.

### En CI

El trabajo `e2e` de `.github/workflows/ci.yml` no depende de `web`, `api` ni
`contracts` ni ellos de él: no bloquea a nadie. Levanta Postgres como servicio,
aplica las migraciones, siembra la fila de miembro del usuario de prueba
—resolviendo su `clerk_user_id` contra la Backend API, para no guardar un
secreto más—, arranca la API en Go y corre los dos proyectos. Al terminar revoca
las invitaciones que la pasada haya dejado pendientes.

El paso del perímetro es bloqueante: si falla, es que una ruta protegida dejó de
redirigir. El de los recorridos con sesión va marcado `continue-on-error`,
porque atan la suite a una instancia real de Clerk y una incidencia suya no es
una regresión nuestra. El informe HTML se sube como artefacto —no `test-results/`:
el proyecto `setup` conserva los dos reintentos de CI y una traza de reintento
llevaría el intercambio de inicio de sesión y la cookie de sesión.

Todo el trabajo está condicionado a que existan los secretos de la instancia, y
eso viene forzado: `clerkMiddleware` se niega a arrancar sin clave secreta, así
que con una fabricada `next dev` responde 500 y ni el perímetro tiene página
sobre la que afirmar nada. Una PR desde un *fork* ve el trabajo omitido, no roto.

Secretos de repositorio que necesita:

| Secreto | Para qué |
| :--- | :--- |
| `E2E_CLERK_PUBLISHABLE_KEY` | La web arranca con la instancia de desarrollo |
| `E2E_CLERK_SECRET_KEY` | `clerkSetup()`, resolver el usuario y revocar invitaciones |
| `E2E_CLERK_USER_IDENTIFIER` | A quién iniciar sesión |
| `E2E_CLERK_USER_PASSWORD` | Opcional: solo si el identificador no es `+clerk_test` |
