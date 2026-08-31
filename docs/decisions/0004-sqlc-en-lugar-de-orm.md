# ADR-0004 · sqlc en lugar de un ORM

**Estado**: Aceptada · 2026-08-31

## Contexto

Para hablar con Postgres desde Go: un ORM (GORM, ent), una capa fina (sqlx) o un
generador a partir de SQL (sqlc).

## Decisión

**sqlc** sobre **pgx**, con las migraciones en **goose**. El SQL se escribe a mano
en `db/queries/` y sqlc genera funciones Go tipadas.

## Consecuencias

**A favor**

- Todas las consultas están escritas y son legibles. No hay SQL que nadie haya
  visto, ni N+1 invisibles.
- Los tipos se generan del esquema real: si una columna cambia y una consulta deja
  de encajar, **falla al compilar**, no en producción.
- Funcionalidades de Postgres sin peleas: índices únicos parciales, `ON CONFLICT`,
  enums, JSONB.
- Sin reflexión en tiempo de ejecución.

**En contra**

- Hay que ejecutar `make sqlc` tras cada cambio de esquema o consulta.
- El código generado se versiona, así que aparece en los diffs.
- No hay relaciones automáticas: los `JOIN` se escriben.

**Descartado**

- *GORM*: la opción más rápida de arrancar y la que más esconde. Automigraciones y
  SQL implícito son exactamente lo que no queremos en la capa de datos.
- *sqlx*: punto medio razonable, pero los escaneos de filas se mantienen a mano y
  nada garantiza que sigan cuadrando con el esquema.
