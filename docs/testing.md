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
| Web E2E | Playwright | El perímetro de autenticación |

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
apps/api   → config, auth, httpx, users, invitations, webhooks, api (router)
apps/web   → routes, api-client, cn, invitation-form
e2e        → perímetro de autenticación
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

## Comandos

```sh
pnpm test                        # Vitest, una pasada
pnpm --filter @freak-hub/web test:watch
pnpm test:e2e                    # Playwright (levanta la web solo)

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

Los recorridos autenticados necesitan `@clerk/testing` (ya instalado) y un
usuario de prueba. Todavía no están escritos: el perímetro sin sesión cubre la
regresión más grave, que es que una ruta protegida deje de estarlo.

Cuando toque, la vía es `clerkSetup()` en el *global setup* de Playwright y
`setupClerkTestingToken()` en los tests, con un usuario dedicado en la instancia
de desarrollo.
