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
| `signed-out` | Los cuatro tests de `e2e/auth.spec.ts` | Nada |
| `signed-in` | `e2e/*.signed-in.spec.ts`, partiendo del estado guardado | `setup` + (para invitar) la API en Go |

`signed-out` no depende de `setup`. Es deliberado: una incidencia de Clerk, una
clave que falta o una PR desde un *fork* no pueden impedir que se compruebe el
perímetro.

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

2. **Por qué `+clerk_test` y no una contraseña.** En esta instancia la
   contraseña está activada como credencial pero **no como primer factor**: el
   inicio de sesión es por código de correo. Con la estrategia `password`,
   `@clerk/testing` crea un *sign-in* que nunca llega a `complete`, llama a
   `setActive({ session: null })` y deja el navegador **sin sesión y sin
   error** — el fallo aparece tres aserciones más tarde y señala al sitio
   equivocado. Las direcciones `+clerk_test` son las de prueba de Clerk: nunca
   se entregan de verdad y siempre aceptan el código `424242`, así que la
   estrategia `email_code` funciona sin buzón y sin contraseña.

   Si algún día la instancia acepta contraseña como primer factor, define
   `E2E_CLERK_USER_PASSWORD` y `e2e/support/sign-in.ts` usará esa vía.

3. Para que los recorridos de invitación funcionen, ese usuario tiene que ser
   miembro en la base de datos local. El webhook `user.created` lo crea solo si
   la API está escuchando cuando lo das de alta; si no, repítelo con
   `clerk webhooks --forward-to http://localhost:8080/webhooks/clerk` en
   marcha (ver docs/development.md).

4. Guarda el identificador en `apps/web/.env.local` (ignorado por git):

   ```sh
   E2E_CLERK_USER_IDENTIFIER=freak-hub-e2e+clerk_test@example.com
   ```

   Ese fichero ya lleva `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`
   de `clerk env pull`. Playwright lee los tres de ahí.

Las variables están documentadas —sin valores— en `.env.example`. **Nunca** se
escribe una credencial real en el repositorio, y el fichero de sesión que
Playwright guarda está en `.gitignore` por la misma razón.

### Ejecutarlos en local

```sh
pnpm infra:up        # Postgres, para que la API tenga dónde escribir
pnpm api:dev         # la API en Go, en :8080
pnpm test:e2e        # Playwright levanta la web y corre los tres proyectos
```

Sin la API, los dos recorridos que la atraviesan se omiten con un mensaje que
dice exactamente qué falta. Sin credenciales, se omiten todos los que llevan
sesión. **Ninguno pasa en silencio**: un test que se salta sin decirlo es peor
que no tenerlo.

El correo al que se invita se genera con el sufijo `+clerk_test`, la convención
de Clerk para una dirección que nunca se entrega de verdad, y lleva una marca de
tiempo para no chocar con la invitación pendiente que dejó la pasada anterior.
Si quieres comprobarlo en un buzón real, pon `E2E_INVITEE_EMAIL`.

### En CI

El trabajo `e2e` de `.github/workflows/ci.yml` no depende de `web`, `api` ni
`contracts` ni ellos de él: no bloquea a nadie. Dentro, el perímetro es un paso
normal —falla y el trabajo se pone rojo— y los recorridos con sesión van en un
paso marcado `continue-on-error`, porque atan la suite a una instancia real de
Clerk y una incidencia suya no es una regresión nuestra.

Los recorridos que cruzan a la API no corren en CI: harían falta Postgres, la
API en Go y una fila de miembro para el usuario de prueba. Se omiten solos con
su mensaje, y se ejecutan en local con los tres comandos de arriba.
