# Hoja de ruta

## Hecho — cimientos

- [x] Monorepo pnpm con `apps/web`, `apps/api` y `packages/contracts`
- [x] Next.js 16 · React 19 · Tailwind 4 · TypeScript · Biome
- [x] API en Go 1.26 con arquitectura hexagonal (chi · pgx · sqlc · goose)
- [x] Clerk configurado por CLI: registro restringido, email+contraseña, Google,
      Discord, contraseñas fuertes y protección de bots
- [x] Login, registro por invitación y rutas protegidas, funcionando de verdad
- [x] Verificación de sesión en Go contra el JWKS de Clerk
- [x] Webhooks de Clerk con firma Svix e idempotencia
- [x] Invitaciones: cualquier miembro invita, sin cupo, con trazabilidad
- [x] Esquema de `members` e `invitations` con sus índices
- [x] Contrato OpenAPI con tipos de TypeScript generados
- [x] Suite de tests bajo TDD: dominio, HTTP, web y perímetro E2E
- [x] Docker Compose con Postgres y MinIO
- [x] CI en GitHub Actions: lint, tipos, tests, build de imágenes y gitleaks
- [x] Documentación completa del proyecto
- [x] Dirección visual decidida **y aplicada**: "character select", paleta
      oklch sobre un solo hue (272), un color por cada una de las seis
      categorías, Sora · Bungee · JetBrains Mono, y los dos temas — oscuro por
      defecto, claro elegible en `/ajustes` y recordado en el navegador (ver
      [design.md](design.md) y [ADR-0008](decisions/0008-direccion-visual.md))
- [x] Listado cerrado de pantallas y estructura de navegación (ver
      [screens.md](screens.md) y
      [ADR-0009](decisions/0009-arquitectura-de-informacion.md))

Las dos últimas entradas estuvieron mucho tiempo bajo «Siguiente». Suben aquí
porque ya no queda ninguna decisión por tomar en ellas: la paleta, la
tipografía, el movimiento y los **dos** temas están escritos en `design.md` y
aplicados en el código. Lo que sigue abierto es el **acabado pantalla a
pantalla** —clonar la maqueta en las diez pantallas que la tienen (épica #17) y
extender el sistema a las cinco que no (épica #18)—, y eso aplica las
decisiones en vez de replantearlas, así que no bloquea al dominio.

## Siguiente — el dominio

1. **`works` y `library_entries`.** El corazón del producto: registrar algo con su
   estado y su progreso, en **una sola categoría** (anime) hasta que el modelo
   sobreviva al uso real.

   **La mitad de la API está hecha** (épica #10): contrato, esquema con sus
   índices, dominio con su máquina de estados, adaptador de Postgres y las ocho
   rutas bajo `/v1`. Una persona puede dar de alta un anime, avanzar su
   progreso, valorarlo y borrarlo, y hay una prueba de extremo a extremo contra
   Postgres real que lo recorre entero.

   **La web ya lee.** El camino de lectura de la issue #73 está cableado:
   `/biblioteca` cuenta de verdad, `/biblioteca/[categoria]` lista las entradas
   reales —y con ellas aparecen por fin los chips, la búsqueda y el orden que
   entregó la #24—, `/obras/[id]` carga la entrada y devuelve un 404 solo
   cuando la API dice `library_entry_not_found`, y el carril «Sigue donde lo
   dejaste» de `/inicio` sale de `?status=in_progress`. Las recomendaciones y
   la actividad del inicio siguen vacías porque no tienen endpoint.

   **Falta el camino de escritura**: el alta manual (`POST /v1/works` y después
   `POST /v1/library`) y las mutaciones desde la ficha (`PATCH`/`DELETE`). Es
   la segunda mitad de la #73.
2. **Búsqueda e importación desde AniList**, con alta manual como alternativa.
   La web ya busca anime de verdad contra AniList desde `/anadir/anime` (épica
   #20), con un cliente deliberadamente desechable: lo retira el día que la API
   traiga su propia integración.
3. **Las otras cinco categorías**, una a una: manga, videojuegos, películas, juegos
   de mesa, TCG.
4. **Wishlist**, que no es una tabla nueva sino `status = 'wishlist'`.
5. **Valoraciones y favoritos.**
6. **Recomendaciones dirigidas**, de persona a persona y con motivo.
7. **Feed de actividad**, cronológico y sin algoritmo.
8. **Perfil público dentro del grupo**: qué está viendo alguien, qué ha terminado.

## Más adelante

- Subida de imágenes propias a MinIO (fotos de estanterías y mazos)
- Exportar los datos propios
- Estadísticas personales de fin de año
- Notificaciones (probablemente a Discord, que es donde está el grupo)

## Decisiones aplazadas a propósito

| Tema | Por qué espera |
| :--- | :--- |
| Rate limiting | Hace falta cuando las invitaciones se usen de verdad |
| App móvil | La API ya está lista para ello; el producto no |
| Modelo físico de un mazo de TCG | La dirección ya está decidida (ADR-0007: el `Work` es el juego, el mazo es personal); falta el modelo mazo↔carta, que se resuelve al construir la categoría |
