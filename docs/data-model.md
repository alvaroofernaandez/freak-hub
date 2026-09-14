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

> [!NOTE]
> **`works.updated_at` no puede cambiar todavía.** No hay ningún `UPDATE works`
> en `db/queries/` ni disparador que lo mueva, así que hoy vale siempre lo mismo
> que `created_at`. El contrato lo describe como la señal de que una copia
> embebida de un `Work` se ha quedado rancia, y esa promesa está sin cumplir
> hasta que exista una ruta de actualización —la importación desde catálogos
> externos, que es donde un `Work` cambiará de verdad—. Es correcto para el
> alcance de hoy, en el que una obra no se modifica después de crearse.
>
> Y la trampa concreta que hay que recordar cuando llegue esa ruta: **no hay
> disparador**, así que la consulta que actualice una obra tendrá que escribir
> `updated_at = now()` **a mano**, exactamente como ya hace
> `UpdateLibraryEntry`. Es lo primero que se olvida, y se olvida en silencio:
> la fila se actualiza igual y la columna se queda mintiendo.

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

Y dos que viven en `works`, con nombre propio porque son las que sostienen el
catálogo compartido:

```sql
CONSTRAINT works_source_id_matches_source
    CHECK (
        (source = 'manual') = (source_id IS NULL)
        AND (source_id IS NULL OR (source_id ~ '\S' AND source_id !~ '^\s|\s$'))
    )
CONSTRAINT works_expansion_of_is_another_work
    CHECK (expansion_of IS NULL OR expansion_of <> id)
```

La primera es la importante, y tiene **tres** puertas, de las que solo la
primera es evidente:

- **`source_id` nulo en una obra importada**: es **invisible** para
  `works_source_idx`, que es parcial sobre `WHERE source_id IS NOT NULL`. Basta
  un puntero a nil en un importador para que la deduplicación deje de funcionar
  sin dar ningún error, y que la siguiente persona que importe el mismo anime
  cree una **segunda** obra. Dos personas «viendo lo mismo» apuntando a filas
  distintas es justo la premisa que rompe las coincidencias.
- **`source_id` vacío**: la imagen especular, y peor, porque **sí se indexa**.
  Dos anime distintos importados con el id externo en blanco chocan en
  `('anilist', '')`: un importador que consulte antes de insertar encuentra el
  primero y da el segundo por importado, entregando a alguien una entrada de
  biblioteca que apunta a **otro anime**, sin 409 ni 500 ni nada. Y si inserta
  primero, se lleva una violación de unicidad por un anime que de verdad no
  está. Una cadena vacía en una clave de deduplicación es un valor que significa
  «no se sabe» disfrazado de uno que significa «este anime concreto».
- **`source_id` con espacios alrededor**: vuelve el primer fallo por una tercera
  puerta, porque `' 5114'` y `'5114'` son cadenas distintas, entran las dos y no
  colisionan nunca.

Las expresiones regulares están en lugar de `btrim` porque `btrim` por defecto
recorta espacios y nada más: un `source_id` de un solo tabulador pasaría por
encima de `btrim(source_id) <> ''` siendo exactamente el id en blanco que esto
viene a impedir.

Que solo los juegos de mesa tengan expansión **no** está en el esquema: esa
categoría todavía no existe, [ADR-0006](decisions/0006-expansiones-de-juegos-de-mesa.md)
describe cómo será, y un `CHECK` escrito antes del primer juego de mesa es una
suposición.

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
    ON library_entries (member_id, status, created_at DESC, id DESC);

-- Recorrer el catálogo compartido por categoría, con el mismo orden.
CREATE INDEX works_category_created_idx
    ON works (category, created_at DESC, id DESC);

-- Buscar por título sin que importen mayúsculas ni acentos (ADR-0015).
CREATE INDEX works_title_search_idx
    ON works USING gin (immutable_unaccent(lower(title)) gin_trgm_ops);
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
- `library_entries_member_status_idx` **también** lleva las columnas del keyset,
  y no por simetría. Como `(member_id, status)` a secas, el planificador no lo
  eligió ni una sola vez sobre 100.000 entradas —ni con un estado que cubría el
  0,1 % de las filas— porque no sabía entregar el `ORDER BY` y
  `member_created_idx` sí: el estado quedaba como filtro encima de aquel. Con
  las cuatro columnas se elige siempre para la consulta filtrada, y el predicado
  del keyset entra en el `Index Cond` en lugar de en un `Sort`. Un índice que
  nadie elige no es un índice lento, es un comentario que además encarece cada
  escritura.

#### La búsqueda por título

`GET /v1/works?q=` busca de forma insensible a mayúsculas **y a acentos**: quien
escriba «pokemon» encuentra *Pokémon*, y quien escriba «shogun» encuentra
*Shōgun*. Eso obliga al esquema a depender de dos extensiones contrib, que es la
decisión que recoge [ADR-0015](decisions/0015-busqueda-sin-acentos.md) y que hay
que verificar **antes de elegir dónde se despliega Postgres**:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;   -- pliega los acentos
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- hace buscable la subcadena

-- unaccent() es STABLE, no IMMUTABLE, y Postgres se niega a indexar una función
-- así. Este envoltorio fija el diccionario y promete IMMUTABLE: sin él, el
-- índice de abajo no se puede crear.
CREATE FUNCTION immutable_unaccent(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, input) $$;

CREATE INDEX works_title_search_idx
    ON works USING gin (immutable_unaccent(lower(title)) gin_trgm_ops);
```

GIN de trigramas y no B-tree porque la búsqueda es **por subcadena**: un B-tree
sabe responder «empieza por», nunca «contiene». `ListWorks` escribe la expresión
exactamente igual que el índice —si no, el planificador no lo reconoce— y escapa
el término antes de meterlo en el patrón, para que un `%` escrito por alguien sea
un signo de porcentaje y no un comodín.

Si algún día se edita el fichero de reglas de `unaccent`, hay que hacer `REINDEX`
de `works_title_search_idx`: la promesa de `IMMUTABLE` es nuestra, y Postgres
seguirá confiando en lo que calculó con las reglas viejas.

> [!IMPORTANT]
> **El escapado envuelve al plegado, nunca al revés**, y de ese orden depende
> que la búsqueda sea segura. `unaccent` **emite comodines**: seis puntos de
> código se pliegan sobre los metacaracteres de `LIKE` —U+2216, U+FE68 y U+FF3C
> se convierten en `\`; U+FE6A y U+FF05 (el `％` de ancho completo) en `%`;
> U+FF3F en `_`—. Si se escapara primero y se plegara después, el plegado
> fabricaría un comodín vivo a partir de un término que no tenía ninguno: una
> inyección de comodines que ningún test en ASCII detectaría. En `ListWorks`
> `immutable_unaccent` va por dentro y los `replace` por fuera, y hay un test
> con `％` que lo fija.

## Lo que traduce el adaptador, y lo que no

`internal/platform/postgres` es la frontera: por encima de ella nadie sabe que
Postgres existe. Eso significa que ningún `pgtype.*` la cruza y que ningún error
de driver llega a un handler. La traducción de errores **discrimina por nombre
de restricción**, no solo por SQLSTATE, porque dos violaciones de la misma clase
significan cosas distintas para quien espera la respuesta:

| En Postgres | Error de dominio | Respuesta |
| :--- | :--- | :--- |
| `23505` en `library_entries_member_work_idx` | `ErrAlreadyInLibrary` | 409 `already_in_library` |
| `23505` en `works_source_idx` | `ErrWorkAlreadyImported` | pendiente de código en el contrato |
| `23503` en `library_entries_work_id_fkey` | `ErrWorkNotFound` | 404 `work_not_found` |
| `pgx.ErrNoRows` | el «no encontrado» de la entidad consultada | 404 |
| `23514` en cualquiera de los dos `CHECK` | **ninguno**, a propósito | 500 con la restricción en el log |

La última fila es la que hay que justificar. `works_source_id_matches_source` y
`works_expansion_of_is_another_work` saltan cuando alguien compone una obra que
el propio dominio declara imposible —una obra importada sin id externo, o una
que se expande a sí misma—. Nadie las teclea: no hay campo en el contrato que
las provoque. Convertirlas en un 4xx le pediría a un miembro que arregle algo
que nunca escribió y escondería el fallo real del importador detrás de un
mensaje de validación. Viajan envueltas, responden 500 y dejan en el log el
nombre de la restricción, que es donde está la pista.

> [!IMPORTANT]
> **`COALESCE($n::jsonb, '{}')` no basta para `metadata`.** Atrapa el `NULL` de
> SQL —el parámetro ausente— y solo eso. El escalar jsonb `null` es un valor
> válido, satisface el `NOT NULL` y llega en cuanto algo serializa un mapa de Go
> a nil. La fila resultante parece correcta hasta que alguien lee
> `metadata->>'episodes'` y recibe `NULL` en vez de «esa clave no está», que
> para `Work.Total()` es la diferencia entre «sigue emitiéndose» y «no tiene
> episodios». Dentro de SQL ya no hay forma de distinguirlos, así que **la
> puerta la cierra el adaptador**: un `Metadata` ausente o vacío se envía como
> `NULL` de SQL y cae en el `DEFAULT '{}'` de la columna, nunca como los cuatro
> bytes `null`. El handler de `POST /v1/works` no tiene que defenderse de un
> `"metadata": null` del cuerpo: cuando el valor llega aquí ya es un mapa nil.

El listado de la biblioteca resuelve la entrada y su obra en **una sola
consulta** con `sqlc.embed`, y el `JOIN` es `INNER`. `work_id` es `NOT NULL`
detrás de una clave ajena `ON DELETE RESTRICT`, así que una entrada sin obra no
puede existir y las dos variantes devuelven hoy lo mismo. La diferencia está en
qué pasaría si eso dejara de ser cierto: un `LEFT JOIN` respondería con una obra
a cero —una tarjeta sin título ni portada, que parece un fallo de pintado y tapa
una referencia rota— mientras que el `INNER` deja caer la fila, que se nota como
una entrada que falta. Ninguno miente en silencio, y el ruidoso es el que falla
del lado seguro.

El cursor opaco **no se codifica aquí**. `internal/platform/httpx`
(`PageCursor`, `EncodeCursor`, `DecodeCursor`) ya es dueño de ese formato para
`/v1/members` y `/v1/invitations/group`, y los puertos del dominio reciben la
posición `(created_at, id)` ya decodificada. Un segundo códec del mismo formato
en el adaptador sería un segundo sitio donde el formato puede divergir.

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
   está por delante de ese reloj, así que el número nuevo puede quedar **por
   debajo** de una migración ya aplicada. Renombra el fichero a un número mayor
   que el último antes de escribir una sola línea de SQL.

   Lo que pasa si no lo haces depende de contra qué base se aplique, y la
   diferencia importa porque el síntoma grave no se parece en nada a la causa
   (comprobado con goose v3.27.3):

   - **Contra una base que ya pasó de esa versión** —producción, la de tus
     compañeros, el camino incremental del CI— goose **se niega en voz alta y
     aborta el `up` entero**, incluidas las migraciones posteriores que sí están
     en orden:

     ```
     ERROR: found 1 missing migrations before current version 20260914130000
     ```

     Quien se tope con eso no está ante una base corrupta: está ante un fichero
     mal numerado. Se arregla renombrándolo por encima de la última versión.

   - **Contra una base limpia** sí es silencioso: goose aplica todo por orden de
     nombre y no se queja. La mitad callada de esa mitad es que un
     `migrate-down` revierte entonces la migración **más alta**, no la que
     acabas de escribir.

> [!WARNING]
> El `Down` de `20260914130000_create_library.sql` hace `DROP EXTENSION` de
> `unaccent` y `pg_trgm`. Sin `CASCADE` a propósito: si algo ajeno a esa
> migración llegara a depender de ellas, la vuelta atrás **falla en voz alta** en
> lugar de llevarse por delante ese algo. La asimetría que hay que conocer es la
> contraria: el `Up` usa `CREATE EXTENSION IF NOT EXISTS`, así que en una base
> donde alguien ya las hubiera instalado a mano, el `Down` retira algo que esa
> migración nunca creó.

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
