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

Cuatro tablas: `members` e `invitations` sostienen la autenticación, y `works`
y `library_entries` son el núcleo del producto. El resto de tablas de dominio
—`recommendations`— se irán añadiendo con sus funcionalidades.

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

### `works`

La ficha objetiva de algo, **compartida por todo el grupo**. Si tú y yo vemos el
mismo anime, apuntamos a la misma fila: esa coincidencia es lo que hace que las
recomendaciones y los cruces entre miembros signifiquen algo.

| Columna | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `title` | `text` | Obligatorio |
| `category` | `work_category` | `anime` · `manga` · `game` · `film` · `boardgame` · `tcg` |
| `source` | `work_source` | `anilist` · `tmdb` · `igdb` · `bgg` · `scryfall` · `manual` |
| `source_id` | `text` | El id de la obra dentro de su catálogo. `NULL` exactamente cuando `source = 'manual'` |
| `cover_url` | `text` | Anulable |
| `synopsis` | `text` | Anulable |
| `year` | `int` | Anulable |
| `metadata` | `jsonb` | `NOT NULL DEFAULT '{}'`. Lo específico de cada categoría |
| `expansion_of` | `uuid` → `works(id)` | Solo juegos de mesa. `ON DELETE RESTRICT` |
| `created_at` / `updated_at` | `timestamptz` | |

`metadata` no es un cajón de sastre: la regla de [domain.md](domain.md) es que un
dato compartido por todas las categorías es columna, y uno que solo aplica a una
vive aquí. Episodios, plataforma, número de jugadores o código de set van en
`metadata`; título, año y portada son columnas.

`expansion_of` implementa [ADR-0006](decisions/0006-expansiones-de-juegos-de-mesa.md):
una expansión es un `Work` propio —con su ficha, su `source_id` en BGG y su
propia entrada de biblioteca— enlazado al juego base en lugar de flotar suelto
en el catálogo. `ON DELETE RESTRICT` porque una expansión apuntando a nada es
peor que ninguna expansión.

### `library_entries`

La relación de **una** persona con **una** obra: lo que convierte un catálogo
compartido en *tu* biblioteca.

| Columna | Tipo | Notas |
| :--- | :--- | :--- |
| `id` | `uuid` PK | |
| `member_id` | `uuid` → `members(id)` | `ON DELETE CASCADE`. Regla 4 del dominio |
| `work_id` | `uuid` → `works(id)` | `ON DELETE RESTRICT`. Regla 3 del dominio |
| `status` | `library_status` | `wishlist` · `pending` · `in_progress` · `completed` · `dropped` · `on_hold` |
| `progress` | `int` | `NOT NULL DEFAULT 0`, `CHECK (progress >= 0)` |
| `rating` | `int` | `CHECK (rating BETWEEN 1 AND 10)`, anulable |
| `is_favourite` | `boolean` | `NOT NULL DEFAULT false`. Afecto, no nota |
| `owned` | `boolean` | `NOT NULL DEFAULT false` |
| `note` | `text` | Anulable. **Pública** para todo el grupo ([ADR-0005](decisions/0005-notas-publicas.md)) |
| `started_at` / `finished_at` | `timestamptz` | Anulables |
| `created_at` / `updated_at` | `timestamptz` | |

**La lista de deseos no es una tabla aparte**: es `status = 'wishlist'`. Una
entrada recorre todo el ciclo de vida sin cambiar de tabla ni perder su
historia.

#### Qué valida el esquema y qué no

La base de datos se queda con las invariantes **estructurales**, las que son
ciertas para cualquier categoría y en cualquier versión del producto:

- `progress >= 0`: el progreso no corre hacia atrás, midas episodios o partidas.
  Cuánto vale «mucho» depende de la categoría, así que **la magnitud la valida el
  dominio** (regla 5).
- `rating BETWEEN 1 AND 10`: la escala es estructural.

Lo que **no** está en el esquema, y no por olvido:

- **Que una valoración solo tenga sentido con `status` en `completed` o
  `dropped`** (regla 2). Es una regla de producto sobre la valoración que *llega
  en una petición*, no sobre la que ya está guardada: una valoración almacenada
  sobrevive a un cambio de estado, porque revisitar algo no borra tu nota.
  Congelar cualquiera de las dos mitades en un `CHECK` ataría el esquema a una
  regla que puede moverse, y obligaría a una migración para cambiar de opinión.
- **La máquina de estados.** Los seis estados son válidos **al crear** una
  entrada: registrar algo que terminaste hace años es normal. Lo que la máquina
  de [domain.md](domain.md) restringe son las **transiciones**, y eso lo enforce
  el servicio.

#### Los índices que hacen el trabajo de verdad

```sql
-- Regla 1 del dominio: como máximo una entrada por obra y persona.
CREATE UNIQUE INDEX library_entries_member_work_idx
    ON library_entries (member_id, work_id);

-- Una obra importada es única. El alta manual no compite: su source_id es NULL
-- y el índice parcial la deja fuera.
CREATE UNIQUE INDEX works_source_idx
    ON works (source, source_id)
    WHERE source_id IS NOT NULL;

-- El keyset del ADR-0011: tu biblioteca, lo más reciente primero.
CREATE INDEX library_entries_member_created_idx
    ON library_entries (member_id, created_at DESC, id DESC);

-- Filtrar tu biblioteca por estado, que es también como se lee la wishlist.
CREATE INDEX library_entries_member_status_idx
    ON library_entries (member_id, status);

-- Recorrer el catálogo compartido por categoría, con el mismo orden.
CREATE INDEX works_category_created_idx
    ON works (category, created_at DESC, id DESC);
```

Tres de ellos merecen explicación:

- `library_entries_member_work_idx` **tiene** que ser un índice y no una
  comprobación en Go. Dos peticiones simultáneas leerían las dos «no está» y las
  dos insertarían. El índice convierte esa carrera en un `409`.
- `works_source_idx` es **parcial a propósito**. Las obras importadas se
  deduplican por `(source, source_id)`; las manuales no, porque su `source_id`
  es nulo y dos personas pueden dar de alta legítimamente cosas distintas con el
  mismo título. Lo que evita el duplicado accidental es buscar antes
  (`GET /v1/works?q=`), no una restricción que rechazaría altas honestas.
- `library_entries_member_created_idx` lleva el desempate por `id` porque
  [ADR-0011](decisions/0011-paginacion-por-cursor.md) lo exige: `created_at` no
  es única, y una frontera de página entre dos filas con la misma marca de
  tiempo saltaría una o repetiría otra.

> [!NOTE]
> El contrato promete que la búsqueda por título de `GET /v1/works?q=` es
> insensible a mayúsculas **y a acentos**. Esta migración solo habilita lo
> primero: `ListWorks` usa `strpos(lower(title), lower(...))`. La
> insensibilidad a acentos necesita una decisión de esquema que esta migración
> no toma —extensión `unaccent` o columna normalizada con su índice— y queda
> pendiente antes de que la búsqueda se dé por terminada.

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
4. **Comprueba el número que te da `migrate-new`.** Lo genera con la hora UTC
   real, y alguna migración del repositorio lleva una marca puesta a mano que
   está por delante de ese reloj. Si el número nuevo queda por debajo de una
   migración ya aplicada, goose la considera fuera de orden: `down` no la
   revierte y `up` no la vuelve a aplicar, sin decir nada. Renombra el fichero a
   un número mayor que el último antes de escribir una sola línea de SQL.

> [!WARNING]
> El `Down` de `20260914120000_backfill_members_invited_by.sql` **borra datos en
> una base viva**. No puede distinguir un `invited_by` que escribió el relleno
> de uno idéntico que el webhook escribió después, así que vacía los dos. Si
> lanzas `deploy.yml` con `run_migrations` y necesitas revertir, vuelve a
> aplicar el `Up`: recupera los valores de `invitations`, que es la misma
> fuente que leyó la primera vez.

## Lo que viene

`recommendations` (ver [domain.md](domain.md)): de una persona a otra, sobre una
obra y con un motivo. El feed de actividad se resuelve leyendo los cambios de
`library_entries`, sin tabla de eventos, hasta que el volumen demuestre lo
contrario.
