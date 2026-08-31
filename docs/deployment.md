# Despliegue

## Dónde vive

Un **VPS propio** con Docker Compose: Postgres, MinIO, la API en Go y la web de
Next.js. Coste fijo bajo y control total, a cambio de encargarnos nosotros de
copias de seguridad, TLS y actualizaciones.

```mermaid
flowchart TB
    NET(["Internet"])
    PX["Proxy inverso · Caddy o Traefik<br/>TLS automático"]

    subgraph vps["VPS · docker compose"]
        direction TB
        W["web<br/>freakhub.es"]
        A["api<br/>api.freakhub.es"]
        P[("postgres")]
        S[("minio")]
    end

    NET --> PX
    PX --> W
    PX --> A
    W --> A
    A --> P
    A --> S

    classDef web   fill:#e8a33d,stroke:#8a5c12,stroke-width:2px,color:#1a1410
    classDef api   fill:#4fb8e8,stroke:#14566f,stroke-width:2px,color:#0b1720
    classDef store fill:#5fd18a,stroke:#166b3d,stroke-width:2px,color:#0d1a12
    classDef edge  fill:#c9c9d4,stroke:#4a4a58,stroke-width:2px,color:#16161d
    classDef group fill:none,stroke:#6b6b7d,stroke-dasharray:4 4,color:#8b8b9d

    class W web
    class A api
    class P,S store
    class NET,PX edge
    class vps group
```

El proxy inverso **no está en el compose todavía**: es lo primero que hay que
añadir al montar el servidor real. Sin él, la web y la API quedarían expuestas
por puerto y sin TLS.

## Puesta en marcha en el servidor

```sh
git clone git@github.com:alvaroofernaandez/freak-hub.git
cd freak-hub

cp .env.example .env
# Rellena, como mínimo:
#   POSTGRES_PASSWORD, MINIO_ROOT_PASSWORD      → contraseñas largas y aleatorias
#   API_ENV=production
#   API_ALLOWED_ORIGINS=https://freakhub.es     → obligatorio en producción
#   CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET
#   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_APP_URL

docker compose --profile apps build
docker compose --profile apps run --rm migrate
docker compose --profile apps up -d
```

`API_ALLOWED_ORIGINS` es obligatorio con `API_ENV=production`: la configuración
se niega a arrancar con el valor por defecto de localhost, para que no se cuele
un despliegue que acepte cualquier origen sin querer.

## Antes de abrirlo al mundo

- [ ] Proxy inverso con TLS delante de web y API.
- [ ] Aplicaciones OAuth **propias** de Google y Discord en Clerk. En desarrollo
      Clerk presta las suyas; en producción no.
- [ ] Instancia de **producción** de Clerk (`clerk deploy`), con su dominio y sus
      claves `pk_live` / `sk_live`.
- [ ] Webhook apuntando a `https://api.freakhub.es/webhooks/clerk`.
- [ ] Copias de seguridad de Postgres programadas **y una restauración probada**.
      Una copia que nunca se ha restaurado no es una copia.
- [ ] Postgres y MinIO **sin puertos publicados** al exterior; solo la red interna
      del compose.
- [ ] Rotar todas las contraseñas del `.env.example`.

## Actualizar

```sh
git pull
docker compose --profile apps build
docker compose --profile apps run --rm migrate
docker compose --profile apps up -d
```

Las migraciones se aplican **antes** de arrancar la versión nueva, así que deben
ser compatibles hacia atrás durante el instante en que conviven las dos.

## Despliegue desde GitHub Actions

El workflow de despliegue es **manual** (`workflow_dispatch`), a propósito: un
grupo de amigos no necesita despliegue continuo, y un merge accidental no debería
tumbar el servicio. Cuando quieras automatizarlo, el sitio es
`.github/workflows/deploy.yml`.

## Copias de seguridad

```sh
# Volcado
docker compose exec -T postgres pg_dump -U freakhub freakhub | gzip > backup-$(date +%F).sql.gz

# Restauración
gunzip -c backup-2026-08-31.sql.gz | docker compose exec -T postgres psql -U freakhub freakhub
```

MinIO se copia sincronizando su volumen con `mc mirror` a otro destino.

## Observabilidad

Hoy: logs estructurados en JSON (`slog`) a stdout, que recoge Docker.

Cuando duela, en este orden: métricas de Postgres (conexiones y consultas
lentas), tiempos de respuesta de la API y alerta sobre `/healthz`. No antes: la
observabilidad prematura es infraestructura que mantener sin nadie que la mire.
