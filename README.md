<div align="center">

<img src="docs/assets/hero.png" alt="Freak Hub — la biblioteca compartida del grupo: anime, manga, videojuegos, películas, juegos de mesa y TCG" width="100%">

<br/>
<br/>

Registra lo que ves, lees y juegas. Apunta lo que tienes pendiente.<br/>
Descubre qué recomiendan los tuyos. **Solo entra quien recibe una invitación.**

<br/>

![Next.js](https://img.shields.io/badge/Next.js%2016-000000?logo=next.js&logoColor=white&style=for-the-badge)
![React](https://img.shields.io/badge/React%2019-087ea4?logo=react&logoColor=white&style=for-the-badge)
![Tailwind](https://img.shields.io/badge/Tailwind%204-38bdf8?logo=tailwindcss&logoColor=white&style=for-the-badge)
![Go](https://img.shields.io/badge/Go%201.26-00add8?logo=go&logoColor=white&style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/Postgres%2018-4169e1?logo=postgresql&logoColor=white&style=for-the-badge)
![Clerk](https://img.shields.io/badge/Clerk-6c47ff?logo=clerk&logoColor=white&style=for-the-badge)

[![CI](https://img.shields.io/github/actions/workflow/status/alvaroofernaandez/freak-hub/ci.yml?branch=main&style=flat-square&label=CI&labelColor=1a1a24)](https://github.com/alvaroofernaandez/freak-hub/actions/workflows/ci.yml)
![acceso](https://img.shields.io/badge/acceso-solo%20por%20invitaci%C3%B3n-e0574f?style=flat-square&labelColor=1a1a24)
![arquitectura](https://img.shields.io/badge/arquitectura-hexagonal-b39ddb?style=flat-square&labelColor=1a1a24)
![enfoque](https://img.shields.io/badge/enfoque-TDD-4fb8e8?style=flat-square&labelColor=1a1a24)
![contrato](https://img.shields.io/badge/contrato-OpenAPI%203.1-5fd18a?style=flat-square&labelColor=1a1a24)

<br/>

```sh
pnpm install && pnpm infra:up && pnpm dev
```

<br/>

**[⚡ Arranque](#-arranque)** ·
**[🧬 Arquitectura](#-arquitectura)** ·
**[🔐 Acceso](#-acceso)** ·
**[🗺️ Mapa](#️-mapa-del-repositorio)** ·
**[🎴 Catálogos](#-catálogos)** ·
**[🧪 Tests](#-tests)** ·
**[📚 Docs](#-documentación)**

</div>

---

## 🎯 En una pantalla

Un grupo de amigos, seis categorías y una sola pregunta que resolver: **¿qué estás
viendo, leyendo o jugando ahora mismo?**

Freak Hub es una red social diminuta y cerrada. No hay algoritmo, ni descubrimiento
público, ni desconocidos: solo la gente que ya se conoce llevando la cuenta de sus
cosas en el mismo sitio.

<table>
<tr>
<td width="50%" valign="top">

**Lo que registras**

| | |
| :-- | :--- |
| 📺 | Anime, con su progreso por episodio |
| 📖 | Manga, por capítulos o tomos |
| 🎮 | Videojuegos, de cualquier plataforma |
| 🎬 | Películas |
| 🎲 | Juegos de mesa y sus expansiones |
| 🃏 | Cartas y mazos de TCG |

</td>
<td width="50%" valign="top">

**Lo que haces con ello**

| | |
| :-- | :--- |
| 🔖 | Wishlist: un estado más, no otra lista |
| ⭐ | Favorito y nota son cosas distintas |
| 🎁 | Recomiendas a alguien concreto, con motivo |
| 👀 | Ves la actividad del grupo, sin algoritmo |
| ✉️ | Invitas a un colega, sin pedir permiso |
| 📦 | Exportas lo tuyo cuando quieras |

</td>
</tr>
</table>

<details>
<summary><b>¿Y qué NO es Freak Hub?</b></summary>

<br/>

**No es un catálogo público.** No compite con AniList, Letterboxd ni Backloggd:
esos ya existen y son mejores en eso.

**No tiene recomendaciones automáticas.** Las recomendaciones las hacen personas,
a personas concretas, explicando por qué. Una recomendación que reciben todos no
la lee nadie.

**No tiene métricas de vanidad.** Ni seguidores, ni rachas, ni insignias. Nada que
convierta ver una serie en una competición.

**No escala a un público abierto.** Es una decisión de producto, no una limitación
técnica. Si algún día hiciera falta, sería otro producto.

Más en [docs/product.md](docs/product.md).

</details>

---

## 🧬 Arquitectura

```mermaid
flowchart LR
    B["Navegador"]

    subgraph app["Freak Hub"]
        direction TB
        W["apps/web<br/>Next.js 16 · React 19"]
        A["apps/api<br/>Go 1.26 · hexagonal"]
    end

    subgraph datos["Estado"]
        direction TB
        P[("PostgreSQL 18")]
        S[("MinIO · S3")]
    end

    C["Clerk<br/>identidad"]

    B --> W
    W -->|"JWT de sesión"| A
    A -->|"pgx"| P
    A --> S
    W -.->|"SDK"| C
    C -.->|"webhooks Svix"| A

    classDef web   fill:#e8a33d,stroke:#8a5c12,stroke-width:2px,color:#1a1410
    classDef api   fill:#4fb8e8,stroke:#14566f,stroke-width:2px,color:#0b1720
    classDef store fill:#5fd18a,stroke:#166b3d,stroke-width:2px,color:#0d1a12
    classDef ident fill:#e0574f,stroke:#7d1c17,stroke-width:2px,color:#1c0c0b
    classDef user  fill:#c9c9d4,stroke:#4a4a58,stroke-width:2px,color:#16161d
    classDef group fill:none,stroke:#6b6b7d,stroke-dasharray:4 4,color:#8b8b9d

    class W web
    class A api
    class P,S store
    class C ident
    class B user
    class app,datos group
```

**La regla que lo explica casi todo: Next.js nunca habla con Postgres.** Todo el
dominio pasa por la API en Go. Cuesta un salto de red y a cambio una regla de
negocio vive en un solo sitio: el día que haya app móvil o bot de Discord, no hay
nada que reimplementar.

<details>
<summary><b>Por qué hexagonal, y cómo se nota</b></summary>

<br/>

```mermaid
flowchart TB
    subgraph adaptin["Adaptadores de entrada"]
        H["internal/api<br/>router · handlers"]
        WH["internal/webhooks<br/>eventos de Clerk"]
    end

    subgraph dominio["Dominio · no importa Clerk, pgx ni chi"]
        direction LR
        U["users"]
        IV["invitations"]
        AU["auth"]
    end

    subgraph puertos["Puertos, que define el propio dominio"]
        direction LR
        PR["Repository"]
        SD["Sender"]
        VF["Verifier"]
    end

    subgraph adaptout["Adaptadores de salida"]
        direction LR
        PG["platform/postgres"]
        CK["platform/clerkadapter"]
        MEM["usersmem · invitationsmem<br/>dobles de test"]
    end

    H --> U
    H --> IV
    WH --> U
    WH --> IV
    AU -.-> VF
    U -.-> PR
    IV -.-> SD
    IV -.-> PR
    PR --> PG
    PR --> MEM
    SD --> CK
    SD --> MEM
    VF --> CK

    classDef in    fill:#e8a33d,stroke:#8a5c12,stroke-width:2px,color:#1a1410
    classDef core  fill:#5fd18a,stroke:#166b3d,stroke-width:2px,color:#0d1a12
    classDef port  fill:#c9c9d4,stroke:#4a4a58,stroke-width:2px,color:#16161d
    classDef out   fill:#4fb8e8,stroke:#14566f,stroke-width:2px,color:#0b1720
    classDef test  fill:#b39ddb,stroke:#4a2f7d,stroke-width:2px,color:#150c22
    classDef group fill:none,stroke:#6b6b7d,stroke-dasharray:4 4,color:#8b8b9d

    class H,WH in
    class U,IV,AU core
    class PR,SD,VF port
    class PG,CK out
    class MEM test
    class adaptin,dominio,puertos,adaptout group
```

Fíjate en la dirección de las flechas de puntos: **el dominio no apunta a nadie
de fuera**. Define sus puertos y son los adaptadores los que encajan en ellos.

La prueba no es teórica. Toda la lógica del backend se testea **sin Postgres, sin
red y sin un JWT real**, en menos de un segundo, cambiando los adaptadores por los
dobles en memoria. El día que no puedas testear una regla sin levantar Docker, esa
regla está en el sitio equivocado.

Detalle completo en [docs/architecture.md](docs/architecture.md) y las decisiones,
con sus alternativas descartadas, en [docs/decisions/](docs/decisions/).

</details>

---

## 🔐 Acceso

**Solo se entra con invitación.** La instancia de Clerk corre en modo `restricted`:
sin un ticket, el registro sencillamente no existe.

```mermaid
sequenceDiagram
    autonumber
    actor M as Miembro
    participant W as Web
    participant A as API en Go
    participant C as Clerk
    actor I as Invitado

    M->>W: escribe un correo
    W->>A: POST /v1/invitations
    A->>A: ¿ese correo ya es miembro?
    A->>A: ¿hay una invitación pendiente?
    Note over A: Todo lo que puede rechazar se comprueba<br/>ANTES de llamar a Clerk
    A->>C: crear invitación
    C-->>I: correo con el ticket
    C-->>A: invitation_id
    A->>A: guarda quién invitó a quién
    A-->>W: 201 Created
    I->>C: pulsa el enlace
    C->>I: /registro con el ticket
    C-)A: webhook user.created
    A->>A: crea el miembro
    A->>A: marca la invitación aceptada
```

| | |
| :--- | :--- |
| **Quién invita** | Cualquier miembro, sin cupo |
| **Se registra** | Quién invitó a quién, siempre |
| **Métodos** | Email + contraseña · Google · Discord |
| **Contraseñas** | Mínimo 12, zxcvbn ≥ 3, contrastadas con HIBP |
| **Protección** | CAPTCHA, bloqueo a los 10 intentos, sin correos desechables |

Cuatro reglas que tiene el código, no el panel:

1. **Nada se envía antes de validar.** Correo inválido, ya miembro o invitación
   pendiente se rechazan antes de llamar a Clerk. Un rechazo nunca deja un correo
   en la bandeja de nadie.
2. **La fila local se escribe después de que Clerk confirme.** Si Clerk falla, no
   queda registro fantasma.
3. **Un índice único parcial** es la última línea contra dos personas invitando a
   la vez al mismo correo.
4. **La API nunca dice por qué rechaza.** Token caducado y firma corrupta responden
   lo mismo. El detalle va al log.

Todo el flujo en [docs/auth.md](docs/auth.md).

---

## ⚡ Arranque

Node ≥ 22 · pnpm 10 · Go 1.26 · Docker · [Clerk CLI](https://clerk.com/docs/cli)

```sh
# 1. Entorno
cp .env.example .env                    # pon contraseñas de verdad
cp apps/web/.env.example apps/web/.env.local
clerk env pull --file apps/web/.env.local

# 2. Dependencias e infraestructura
pnpm install
pnpm infra:up                           # Postgres + MinIO + bucket
make -C apps/api migrate-up

# 3. Las dos aplicaciones, en dos terminales
pnpm dev                                # web → localhost:3000
pnpm api:dev                            # api → localhost:8080

# 4. Comprobación
curl -s localhost:8080/healthz          # {"status":"ok"}
```

<details>
<summary><b>El huevo y la gallina: ¿cómo entra el primero?</b></summary>

<br/>

El registro está cerrado, así que **nadie puede entrar todavía**. Ni siquiera tú.
Es exactamente lo que queríamos, pero hay que romper el círculo una vez.

Deja el reenvío de webhooks corriendo:

```sh
clerk webhooks --forward-to http://localhost:8080/webhooks/clerk
```

Y invítate a ti mismo desde el CLI:

```sh
clerk api POST /invitations \
  --json '{"email_address":"tu@correo.com","redirect_url":"http://localhost:3000/registro"}'
```

Te llega el correo, completas el registro, el webhook crea tu fila en `members` y
a partir de ahí ya puedes invitar desde `/invitar` como todo el mundo.

Si te registras **sin** el reenvío activo, la sesión será válida pero `/v1/me`
responderá `404 unknown_identity`. Se arregla reenviando el evento desde el panel
de Clerk.

</details>

---

## 🗺️ Mapa del repositorio

```
freak-hub/
├── apps/
│   ├── web/              Next.js 16 · React 19 · Tailwind 4 · Clerk
│   │   └── src/
│   │       ├── app/          enrutado. Sin lógica de negocio
│   │       ├── features/     el dominio, una carpeta por funcionalidad
│   │       ├── shared/       api-client · routes · tipos del contrato
│   │       └── proxy.ts      middleware de Clerk (Next 16 lo llama así)
│   │
│   └── api/              Go 1.26 · chi · pgx · sqlc · goose
│       ├── cmd/              composition root y migraciones
│       ├── internal/
│       │   ├── users/            entidad · puerto · servicio · doble
│       │   ├── invitations/      idem
│       │   ├── auth/             Identity y middleware de sesión
│       │   ├── webhooks/         eventos de Clerk → dominio
│       │   ├── api/              router y handlers
│       │   └── platform/         clerk · svix · postgres · httpx
│       └── db/               migrations/ y queries/
│
├── packages/contracts/   openapi.yaml + tipos TypeScript generados
├── tools/assets/         genera el banner y la imagen social del repo
├── docs/                 toda la documentación del proyecto
└── docker-compose.yml    Postgres · MinIO · (perfil apps) web y api
```

---

## 🎴 Catálogos

Las fichas vienen de catálogos públicos **y** se pueden crear a mano. Ninguna de
las dos cosas sola funciona: un mazo casero no está en ninguna API, y dar de alta
todo a mano mata el proyecto en una semana.

| Categoría | Proveedor | Clave |
| :--- | :--- | :--- |
| 🌸 Anime · Manga | AniList (GraphQL) | no hace falta |
| 🎬 Películas | TMDB | sí |
| 🎮 Videojuegos | IGDB | OAuth de Twitch |
| 🎲 Juegos de mesa | BoardGameGeek (XML) | no hace falta |
| 🃏 TCG | Scryfall | no hace falta |

Las claves viven **en la API**, nunca en el navegador. Límites y particularidades
de cada proveedor en [docs/catalogs.md](docs/catalogs.md).

---

## 🧪 Tests

**TDD estricto.** Rojo → verde → refactor, sin atajos. Escribir el código y
"cubrirlo con tests" después no es TDD: es test de regresión de código en el que
ya confías, y te has saltado justo la parte que aporta diseño.

```sh
pnpm test                  # Vitest + Testing Library
pnpm test:e2e              # Playwright
make -C apps/api test      # go test -race
pnpm diagrams:check        # los diagramas de estos docs parsean de verdad
```

Lo que ya está blindado:

- ✅ Una ruta protegida **nunca** se vuelve pública por accidente
- ✅ El middleware rechaza sin cabecera, con esquema erróneo, con token vacío y con
  token inválido, y **no filtra el motivo** al cliente
- ✅ Un webhook sin firma válida **no llega al dominio**
- ✅ Un webhook repetido no crea dos miembros
- ✅ Una invitación rechazada **nunca** llega a Clerk
- ✅ Si Clerk falla al enviar, **no queda fila local**

Más en [docs/testing.md](docs/testing.md).

---

## 📚 Documentación

<table>
<tr>
<td valign="top" width="50%">

| Documento | Responde a… |
| :--- | :--- |
| [product.md](docs/product.md) | Qué es y qué **no** es |
| [domain.md](docs/domain.md) | Obras, entradas, estados |
| [architecture.md](docs/architecture.md) | Cómo encaja todo |
| [auth.md](docs/auth.md) | Clerk, sesiones, invitaciones |
| [api.md](docs/api.md) | El contrato HTTP |
| [data-model.md](docs/data-model.md) | Esquema y migraciones |

</td>
<td valign="top" width="50%">

| Documento | Responde a… |
| :--- | :--- |
| [catalogs.md](docs/catalogs.md) | Las APIs externas |
| [development.md](docs/development.md) | El día a día |
| [testing.md](docs/testing.md) | Estrategia y flujo TDD |
| [deployment.md](docs/deployment.md) | El VPS, paso a paso |
| [roadmap.md](docs/roadmap.md) | Qué está hecho y qué viene |
| [decisions/](docs/decisions/) | Los ADR |

</td>
</tr>
</table>

Para agentes de IA: [AGENTS.md](AGENTS.md).

---

## 🚧 Estado

Los **cimientos están terminados**: monorepo, autenticación funcionando de punta a
punta, invitaciones, contrato, tests, CI y despliegue.

El **dominio está por construir**. Lo siguiente, en orden, es cerrar la dirección
visual y levantar `works` + `library_entries` con una sola categoría antes de
generalizar a las seis.

> [!NOTE]
> **La dirección visual ya está decidida** (["character select"](docs/design.md),
> [ADR-0008](docs/decisions/0008-direccion-visual.md)): extiende la identidad de
> este mismo banner —oscuro, paleta oklch, un color por categoría— a toda la
> aplicación. `globals.css` todavía lleva los tokens provisionales; sustituirlos
> es el siguiente paso, antes de construir pantallas de verdad. El banner y la
> imagen social de este README se regeneran con `pnpm assets:render`.

Detalle completo en [docs/roadmap.md](docs/roadmap.md).

<div align="center">
<br/>
<sub>Arte de <a href="https://fullmetalalchemist.fandom.com/">Fullmetal Alchemist</a> y <a href="https://hunterxhunter.fandom.com/">Hunter × Hunter</a>, propiedad de sus autores. Uso no comercial en un proyecto privado entre amigos.</sub>
</div>
