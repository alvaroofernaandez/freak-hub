# ADR-0001 · Backend en Go separado del front

**Estado**: Aceptada · 2026-08-31

## Contexto

Next.js 16 puede hablar con Postgres directamente desde server components y
server actions. Para una plataforma de este tamaño sería suficiente y más rápido
de escribir. La alternativa era montar una API aparte en Go.

## Decisión

Backend propio en **Go**, con Postgres detrás. Next.js **nunca** habla con la base
de datos: consume la API por HTTP con un JWT de sesión.

## Consecuencias

**A favor**

- Una regla de negocio vive en un solo sitio. Una app móvil o un bot de Discord
  no obligarían a reimplementar nada.
- Las credenciales de base de datos existen en un único proceso.
- El contrato entre las capas es explícito y verificable ([ADR pendiente sobre
  OpenAPI](../api.md)).
- Go da binarios estáticos de pocos megas: encaja perfecto en un VPS modesto.

**En contra**

- Un salto de red en cada lectura. Irrelevante a esta escala.
- Dos toolchains, dos linters, dos suites de tests.
- Hay que mantener el contrato sincronizado, que es justo lo que resuelve
  `packages/contracts`.

**Descartado**

- *Server actions contra Postgres*: más rápido de arrancar, pero mezcla dominio
  con presentación y encierra la lógica dentro de Next.
- *Un BaaS (Supabase, Convex)*: menos código, pero la lógica acaba repartida entre
  políticas RLS y funciones, y el `vendor lock-in` es difícil de revertir.
