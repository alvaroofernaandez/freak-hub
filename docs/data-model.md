# Modelo de datos

Postgres 18. Las migraciones se escriben con **goose** y el acceso se genera con
**sqlc**: SQL a mano, Go tipado.

## Por qué sqlc y no un ORM

Un ORM esconde las consultas justo cuando más falta hace verlas. Con sqlc el SQL
está escrito por nosotros en `db/queries/`, el generador produce funciones Go
tipadas, y no hay ninguna consulta que nadie haya leído. El coste es regenerar
tras cada cambio; la ventaja es que no hay sorpresas de rendimiento ni N+1
invisibles.

## Estado actual del esquema

Solo existe lo que sostiene la autenticación. Las tablas de dominio se irán
añadiendo con sus funcionalidades.

### `members`

La proyección local de un usuario de Clerk. Todo lo demás apuntará aquí.

| Columna | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | `uuid` PK | Clave interna. **Nunca** se expone el ID de Clerk como clave de dominio |
| `clerk_user_id` | `text` único | La clave del upsert idempotente del webhook |
| `username` | `text` único | Handle público dentro del grupo |
| `display_name` | `text` | |
| `avatar_url` | `text` | Viene de Clerk |
| `email` | `text` | Con índice único sobre `lower(email)`, parcial |
| `invited_by` | `uuid` → `members(id)` | `NULL` en los fundadores. `ON DELETE SET NULL` |
| `created_at` / `updated_at` | `timestamptz` | |

`invited_by` con `ON DELETE SET NULL` a propósito: si alguien se va, quien entró
por su invitación **no** desaparece con él.

### `invitations`

| Columna | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | `uuid` PK | |
| `clerk_invitation_id` | `text` único | Ata la fila a la invitación real de Clerk |
| `email` | `text` | |
| `inviter_id` | `uuid` → `members(id)` | `ON DELETE CASCADE` |
| `status` | `invitation_status` | `pending` · `accepted` · `revoked` |
| `created_at` / `accepted_at` | `timestamptz` | |

El índice que hace el trabajo de verdad:

```sql
CREATE UNIQUE INDEX invitations_pending_email_idx
    ON invitations (lower(email))
    WHERE status = 'pending';
```

Un índice **único parcial**: puede haber muchas invitaciones históricas al mismo
correo, pero solo una pendiente. Es lo que impide que dos miembros invitando a la
vez generen dos tickets, sin necesidad de bloqueos.

## Convenciones

- **`uuid` como clave primaria**, generada por `gen_random_uuid()`. Los IDs
  aparecen en URLs; un entero secuencial filtra cuánta gente hay dentro.
- **`timestamptz` siempre**, nunca `timestamp`. Guardar en UTC y convertir al
  presentar.
- **Nombres en plural** para las tablas, `snake_case` para las columnas.
- **Las claves ajenas declaran su `ON DELETE`.** Un borrado nunca debe sorprender.
- **Los enums de dominio son tipos de Postgres**, no `text` con un `CHECK`.
- **Los índices se crean con la migración que los necesita**, no después.

## Migraciones

```sh
make -C apps/api migrate-new NAME=create_works
make -C apps/api migrate-up
make -C apps/api migrate-status
make -C apps/api migrate-down     # una sola, y con cuidado
```

Van **embebidas en el binario** (`db/migrations.go` con `embed.FS`), así que el
contenedor de despliegue no necesita llevar los `.sql` sueltos. En producción se
aplican con el servicio `migrate` del compose, antes de arrancar la API.

Reglas:

1. Una migración **nunca** se edita después de haberse aplicado en producción.
   Se escribe otra.
2. Toda migración tiene su `Down` de verdad. Un `Down` vacío es una migración sin
   probar.
3. Los cambios destructivos van en su propia migración, separados de los aditivos.

## Lo que viene

`works`, `library_entries`, `recommendations` (ver [domain.md](domain.md)). La
decisión de modelado importante ya está tomada: **una obra compartida, una
relación por persona**, y lo específico de cada categoría en `metadata` JSONB en
lugar de columnas dispersas.
