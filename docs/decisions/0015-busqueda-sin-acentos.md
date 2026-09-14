# ADR-0015 · La búsqueda de obras depende de `unaccent` y `pg_trgm`

**Estado**: Aceptada · 2026-09-14

## Contexto

El contrato de los endpoints de biblioteca, mergeado con la issue #5, promete
que el filtro `q` de `GET /v1/works` busca en el título de forma insensible **a
mayúsculas y a acentos**. La promesa es suya: [ADR-0011](0011-paginacion-por-cursor.md)
decidió cómo se **pagina** ese listado, no cómo se busca dentro de él. No es un adorno: en un producto en español, quien escriba «pokemon»
sin tilde tiene que encontrar *Pokémon*, y quien escriba «shogun» tiene que
encontrar *Shōgun*. Si no, la búsqueda parece rota justo en los títulos que más
se buscan.

Plegar mayúsculas es `lower()`, que viene de serie. Plegar acentos no: Postgres
no trae nada en el núcleo que lo haga. Y hay un segundo problema encima, que es
el que decide de verdad: la búsqueda es **por subcadena**, no por prefijo. Un
índice B-tree sabe responder «empieza por», nunca «contiene». Con 20.000 obras y
una consulta por pulsación de tecla, leer la tabla entera cada vez no es una
opción que se pueda dejar para después.

Lo que estaba decidido era la promesa; lo que no estaba decidido es **de qué
pasa a depender el esquema para cumplirla**. Eso es lo que se fija aquí.

## Decisión

**El esquema depende de dos extensiones contrib de Postgres**, instaladas por la
migración `20260914130000_create_library.sql`:

- **`unaccent`**, para plegar los acentos.
- **`pg_trgm`**, para que el resultado se pueda buscar por subcadena con un
  índice GIN de trigramas.

Y de un envoltorio propio, que existe por una razón concreta:

```sql
CREATE FUNCTION immutable_unaccent(input text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
    AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, input) $$;
```

`unaccent()` está declarada `STABLE`, no `IMMUTABLE`, porque resuelve su
diccionario a través del `search_path` en tiempo de llamada. Postgres se niega a
indexar una función así. El envoltorio fija el diccionario de forma explícita y
promete `IMMUTABLE`, que es lo que hace creable el índice:

```sql
CREATE INDEX works_title_search_idx
    ON works USING gin (immutable_unaccent(lower(title)) gin_trgm_ops);
```

La consulta usa `LIKE` sobre esa misma expresión, con el término **escapado**
antes de entrar en el patrón: el texto viene de una query string, y sin escapar,
quien buscara `100%` estaría escribiendo un comodín en lugar de un signo de
porcentaje.

El orden de esas dos operaciones no es intercambiable: **el escapado envuelve al
plegado**. `unaccent` emite comodines —el `％` de ancho completo (U+FF05) se
pliega a `%`, U+FF3C a `\` y U+FF3F a `_`—, así que plegar después de escapar
fabricaría un comodín vivo a partir de un término que no tenía ninguno.

## Consecuencias

**A favor**

- La búsqueda cumple el contrato, que es la razón de todo esto.
- Sobre 20.004 obras, `EXPLAIN (ANALYZE)` muestra `Bitmap Index Scan on
  works_title_search_idx` con 16 buffers, en lugar de recorrer la tabla.
- No hay estado duplicado que mantener: el índice se calcula solo, y no existe
  ninguna columna que pueda quedarse desincronizada del título.

**En contra**

- **El Postgres de producción tiene que traer contrib disponible**, y no todo
  servicio gestionado lo permite. La imagen oficial `postgres:18-alpine` que usan
  el compose y el CI lo trae; RDS, Cloud SQL, Neon y Supabase lo permiten
  también, pero cada uno con su lista de extensiones autorizadas. **Comprobarlo
  es parte de elegir dónde se despliega**, no algo que se descubra en el primer
  `migrate up` contra producción.
- `CREATE EXTENSION` exige privilegios que un rol de aplicación estrecho puede no
  tener. Las migraciones ya corren con un rol que crea tablas y tipos, así que no
  cambia el modelo, pero sí sube el listón.
- Si algún día se edita el fichero de reglas de `unaccent`, **hay que hacer
  `REINDEX`** de `works_title_search_idx`: la promesa de `IMMUTABLE` es nuestra,
  y Postgres seguirá confiando en las entradas calculadas con las reglas viejas.
- Un índice GIN de trigramas ocupa bastante más que un B-tree y encarece la
  escritura. A la escala del catálogo de un grupo de amigos es irrelevante.
- Con términos de menos de tres caracteres el índice no ayuda y el planificador
  vuelve al recorrido secuencial. Aceptado: buscar por una o dos letras no es una
  búsqueda.

**Descartado**

- *Columna `title_normalized` mantenida por trigger*: evita depender de
  `unaccent` en tiempo de consulta, pero **no evita depender de ella** para
  calcular el valor, así que no elimina la extensión, solo la mueve. Y añade lo
  peor: estado duplicado que un `UPDATE` mal hecho puede dejar mintiendo, más un
  trigger que mantener. Si un día no hubiera más remedio que quitar `unaccent`,
  esta es la alternativa a retomar, con el plegado hecho en la aplicación al
  escribir.
- *Plegar en la aplicación, al buscar*: no funciona. Se puede normalizar el
  término que llega, pero no los títulos guardados, que es la otra mitad de la
  comparación. Normalizar los títulos al escribir es el caso anterior.
- *Búsqueda de texto completo con `tsvector`*: mejor para buscar palabras en un
  texto largo, y peor para lo que hace falta aquí, que es coincidencia parcial
  sobre títulos cortos —encontrar «terra» dentro de «Terraforming»—. Además
  `to_tsvector` con la configuración en español ya pliega acentos, así que
  tampoco quitaría la dependencia. Si algún día se busca dentro de las sinopsis,
  es un ADR nuevo.
- *`ILIKE '%…%'` sin plegar acentos*: la opción de no hacer nada. `works` no
  existía antes de esta migración, así que no es «lo que había» sino lo que
  habría sido escribir la tabla ignorando la promesa. Es más barata en todo
  —ninguna extensión, ningún índice funcional, ningún envoltorio que explicar—
  y la única pega es que incumple el contrato en los títulos que más se buscan,
  que es pega suficiente.
