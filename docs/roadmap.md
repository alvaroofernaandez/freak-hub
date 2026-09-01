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

## Siguiente — el dominio

1. **Dirección visual.** Está deliberadamente sin decidir. Hoy solo hay tokens
   provisionales en `globals.css`, suficientes para que el flujo de auth se lea.
   Es lo primero que hay que cerrar antes de construir pantallas de verdad.
2. **`works` y `library_entries`.** El corazón del producto: registrar algo con su
   estado y su progreso. Empezar por **una sola categoría** (anime, vía AniList) y
   generalizar cuando el modelo haya sobrevivido al uso real.
3. **Búsqueda e importación desde AniList**, con alta manual como alternativa.
4. **Las otras cinco categorías**, una a una: manga, videojuegos, películas, juegos
   de mesa, TCG.
5. **Wishlist**, que no es una tabla nueva sino `status = 'wishlist'`.
6. **Valoraciones y favoritos.**
7. **Recomendaciones dirigidas**, de persona a persona y con motivo.
8. **Feed de actividad**, cronológico y sin algoritmo.
9. **Perfil público dentro del grupo**: qué está viendo alguien, qué ha terminado.

## Más adelante

- Subida de imágenes propias a MinIO (fotos de estanterías y mazos)
- Exportar los datos propios
- Estadísticas personales de fin de año
- Notificaciones (probablemente a Discord, que es donde está el grupo)

## Decisiones aplazadas a propósito

| Tema | Por qué espera |
| :--- | :--- |
| Dirección visual | Se decidirá con el pipeline de diseño completo |
| Paginación | Se fija con el primer endpoint que liste obras |
| Rate limiting | Hace falta cuando las invitaciones se usen de verdad |
| App móvil | La API ya está lista para ello; el producto no |
| Modelo físico de un mazo de TCG | La dirección ya está decidida (ADR-0007: el `Work` es el juego, el mazo es personal); falta el modelo mazo↔carta, que se resuelve al construir la categoría |
