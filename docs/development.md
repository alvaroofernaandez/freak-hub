# Desarrollo

## Requisitos

| Herramienta | Versión | Para qué |
| :--- | :--- | :--- |
| Node.js | ≥ 22 | Ejecutar Next.js |
| pnpm | 10.32 | Gestor de paquetes del workspace |
| Go | 1.26 | Compilar la API |
| Docker | ≥ 28 | Postgres y MinIO en local |
| Clerk CLI | ≥ 3.1 | Claves y configuración de la instancia |

Las herramientas de Go se instalan solas:

```sh
make -C apps/api tools   # sqlc y golangci-lint
```

## Arranque desde cero

```sh
# 1. Variables de entorno
cp .env.example .env                  # rellena POSTGRES_PASSWORD y MINIO_ROOT_PASSWORD
cp apps/web/.env.example apps/web/.env.local

# 2. Claves de Clerk (sobrescribe apps/web/.env.local con las reales)
clerk env pull --file apps/web/.env.local

# 3. Dependencias
pnpm install

# 4. Infraestructura
pnpm infra:up                         # Postgres + MinIO + bucket

# 5. Esquema
make -C apps/api migrate-up

# 6. Las dos aplicaciones, en dos terminales
pnpm dev                              # web  → http://localhost:3000
pnpm api:dev                          # api  → http://localhost:8080
```

Comprobación rápida de que todo está vivo:

```sh
curl -s localhost:8080/healthz        # {"status":"ok"}
```

Y en el navegador, `http://localhost:3000/inicio` debe redirigirte a `/entrar`.

## El primer miembro (el problema del huevo y la gallina)

El registro está cerrado, así que **nadie puede entrar todavía**. Para crear al
primer miembro, invítate desde el CLI:

```sh
clerk api POST /invitations \
  --json '{"email_address":"tu@correo.com","redirect_url":"http://localhost:3000/registro"}'
```

Llega un correo, completas el registro y el webhook crea tu fila en `members`. A
partir de ahí ya puedes invitar desde `/invitar`.

Recuerda tener el reenvío de webhooks activo mientras te registras:

```sh
clerk webhooks --forward-to http://localhost:8080/webhooks/clerk
```

Si te registras sin él, la sesión será válida pero `/v1/me` responderá
`404 unknown_identity`. Se arregla reenviando el evento desde el panel de Clerk.

## Comandos del día a día

### Desde la raíz

```sh
pnpm dev                  # web en modo desarrollo
pnpm build                # build de producción de la web
pnpm test                 # tests unitarios de la web
pnpm test:e2e             # Playwright
pnpm typecheck            # tsc --noEmit
pnpm lint                 # Biome sobre todo el repo
pnpm lint:fix             # Biome con autofix
pnpm contracts:generate   # regenera los tipos desde openapi.yaml

pnpm api:dev · api:test · api:lint
pnpm infra:up · infra:down · infra:reset
```

### En la API

```sh
make -C apps/api help     # lista todos los targets
make -C apps/api test     # go test -race
make -C apps/api lint     # go vet + golangci-lint
make -C apps/api sqlc     # regenera el acceso a datos
make -C apps/api migrate-new NAME=add_works
```

## Añadir un endpoint

El orden importa, y no es negociable:

1. **Contrato primero.** Describe el endpoint en
   `packages/contracts/openapi.yaml` y corre `pnpm contracts:generate`.
2. **Test primero.** Escribe el test en `internal/api/router_test.go` (o el del
   servicio de dominio) y **compruébalo en rojo**.
3. **Dominio.** Si hay una regla de negocio nueva, va en su paquete de
   `internal/<dominio>`, con su propio test y sus dobles en memoria.
4. **Handler.** Parsear, llamar, traducir errores. Nada más.
5. **Web.** Consume el tipo generado desde `@freak-hub/contracts`. Nunca lo
   escribas a mano.

## Añadir una tabla

```sh
make -C apps/api migrate-new NAME=create_works
# escribe el SQL en db/migrations/<timestamp>_create_works.sql
# escribe las consultas en db/queries/works.sql
make -C apps/api sqlc
make -C apps/api migrate-up
```

El código generado en `internal/platform/postgres/sqlcgen/` **se versiona** y no
se edita a mano.

## Problemas frecuentes

| Síntoma | Causa y arreglo |
| :--- | :--- |
| `/v1/me` responde 404 | El webhook no llegó. Arranca `clerk webhooks --forward-to …` y reenvía el evento |
| `401 invalid_token` en todo | `CLERK_SECRET_KEY` no corresponde a la misma instancia que la clave publicable |
| CORS bloquea la web | Falta el origen en `API_ALLOWED_ORIGINS` |
| `docker compose` se queja de variables | Falta `.env`, o falta una contraseña dentro |
| `sqlc: command not found` | `make -C apps/api tools` |
| El build de la web pide `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Es de tiempo de compilación: pásala como `--build-arg` |
