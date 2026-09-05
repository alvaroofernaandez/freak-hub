# AGENTS.md — Freak Hub

Contexto para cualquier agente de IA que trabaje en este repositorio. Léelo entero
antes de tocar nada.

## Qué es esto

Plataforma cerrada entre amigos para registrar y seguir anime, manga,
videojuegos, películas, juegos de mesa y TCG, con wishlist, valoraciones,
favoritos y recomendaciones dirigidas. Ver [docs/product.md](docs/product.md).

## Reglas que no se negocian

### 1. TDD estricto

Rojo → verde → refactor. **Primero el test que falla**, y que falle por una
aserción, no por un error de importación. Escribir el código y añadir tests
después no es TDD y no se acepta.

### 2. Next.js nunca habla con Postgres

Toda lectura y escritura de dominio pasa por la API en Go. Si te ves añadiendo un
cliente de base de datos en `apps/web`, estás resolviendo el problema equivocado.

### 3. El dominio no conoce a sus adaptadores

`internal/users`, `internal/invitations` y `internal/auth` **no importan** Clerk,
pgx ni chi. Definen puertos (interfaces); los adaptadores viven en
`internal/platform` y se cablean en `cmd/api/main.go`.

### 4. El contrato va primero

Un endpoint nuevo se describe en `packages/contracts/openapi.yaml`, se ejecuta
`pnpm contracts:generate` y **después** se implementa. Los tipos de la web salen
de ahí, nunca se escriben a mano.

### 5. Todo está protegido por defecto

`apps/web/src/shared/lib/routes.ts` es el **único** sitio que abre una ruta al
público, y tiene tests. En la API, todo lo que cuelga de `/v1` pasa por
`auth.Middleware`.

### 6. Idioma

- **Español neutro** (tuteo) en la interfaz, la documentación y los mensajes al
  usuario. Nada de voseo ni de jerga rioplatense.
- **Inglés** en el código: identificadores, comentarios, nombres de fichero,
  mensajes de commit, descripción y topics del repositorio en GitHub.

### 7. Commits convencionales

`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`. **Sin** líneas de
`Co-Authored-By` ni atribución a IA.

## Diseño

**La dirección visual ya está decidida**: "character select", oscura por defecto
con tema claro disponible, extendiendo la identidad del banner del README. Los
valores están escritos —paleta oklch sobre un solo hue (272), un color por cada
una de las seis categorías, Bungee para el wordmark, Sora para la interfaz y
JetBrains Mono para datos— en [docs/design.md](docs/design.md) y
[ADR-0008](docs/decisions/0008-direccion-visual.md).

**Lo que falta es aplicarla.** `globals.css` sigue con los tokens provisionales y
`app/layout.tsx` sigue con Inter en lugar de Sora. Esos dos cambios van antes de
construir pantallas de verdad.

No inventes tokens ni amplíes la paleta por tu cuenta: los valores ya están en
`design.md`. Y recuerda la regla que más fácil se rompe: el color identifica la
**categoría**; el estado de una entrada se comunica con icono y etiqueta, nunca
con color. Si hace falta una decisión visual que `design.md` no cubra, se
documenta antes de escribir componentes.

## Comandos

```sh
pnpm dev · build · test · test:e2e · typecheck · lint · lint:fix
pnpm contracts:generate
pnpm infra:up · infra:down · infra:reset
pnpm api:dev · api:test · api:lint
pnpm diagrams:check          # cada diagrama Mermaid de la documentación parsea
pnpm assets:render           # regenera el banner y la imagen social del README

make -C apps/api help        # todos los targets del backend
```

## Antes de dar algo por terminado

- [ ] `pnpm lint && pnpm typecheck && pnpm test`
- [ ] `make -C apps/api lint && make -C apps/api test`
- [ ] Si cambió el contrato: `pnpm contracts:generate` y el diff committeado
- [ ] Si cambió el esquema: migración **con su `Down`** y `make -C apps/api sqlc`
- [ ] Si cambió un diagrama de la documentación: `pnpm diagrams:check`
- [ ] Si cambió una decisión: ADR nuevo en `docs/decisions/`
- [ ] La documentación afectada, actualizada en el mismo cambio

## Trampas conocidas

| Trampa | Realidad |
| :--- | :--- |
| `middleware.ts` | Next.js 16 lo llama **`proxy.ts`** |
| `<SignedIn>` / `<SignedOut>` | Clerk Core 3 los eliminó: usa `<Show when="signed-in">` |
| `<ClerkProvider>` envolviendo `<html>` | Va **dentro** de `<body>` |
| `auth()` sin `await` | Siempre se espera |
| Editar `sqlcgen/` | Es generado. Cambia `db/queries/` y regenera |
| Editar una migración ya aplicada | Nunca. Se escribe otra |
| Tocar `.env.local` | Contiene claves reales. Documenta en `.env.example` |

## Mapa rápido

```
apps/web/src/
  app/                  enrutado (App Router). Sin lógica de negocio
  features/<dominio>/    actions/ y ui/ de cada funcionalidad
  shared/api/           tipos derivados del contrato
  shared/lib/           api-client · routes · cn
  proxy.ts              middleware de Clerk

apps/api/
  cmd/api/              composition root
  cmd/migrate/          migraciones embebidas
  internal/<dominio>/   entidad · puerto · servicio · doble en memoria
  internal/api/         router y handlers HTTP
  internal/platform/    adaptadores: clerkadapter · svix · postgres · httpx
  db/migrations · db/queries
```
