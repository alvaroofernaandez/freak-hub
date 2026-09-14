# Catálogos externos

## La estrategia: híbrido

Las fichas vienen de catálogos públicos **y** se pueden crear a mano. Ninguna de
las dos opciones sola funciona:

- Solo APIs: un mazo casero o un juego oscuro no se pueden registrar.
- Solo manual: dar de alta algo se vuelve tedioso, los datos quedan inconsistentes
  y no hay forma de saber que dos personas hablan de lo mismo.

Con el híbrido, un `Work` tiene `source` y `source_id`. Cuando `source` es
`manual`, `source_id` es nulo y la ficha la mantiene quien la creó.

## Los proveedores

| Categoría | Proveedor | Auth | Límite | Notas |
| :--- | :--- | :--- | :--- | :--- |
| Anime y manga | [AniList](https://anilist.co) | ninguna | ~90 req/min | GraphQL. El mejor catálogo del lote |
| Películas | [TMDB](https://themoviedb.org) | API key | generoso | Exige atribución visible |
| Videojuegos | [IGDB](https://igdb.com) | OAuth de Twitch | 4 req/s | El token caduca: hay que refrescarlo |
| Juegos de mesa | [BoardGameGeek](https://boardgamegeek.com) | ninguna | estricto, no documentado | **XML**, lento, a veces responde 202 "vuelve luego" |
| TCG | [Scryfall](https://scryfall.com) | ninguna | 10 req/s | Excelente. Solo Magic |

## Reglas de integración

1. **Un adaptador por proveedor**, detrás de un puerto del dominio. El dominio
   pide "busca anime", no "haz esta query de GraphQL". Cambiar de proveedor no
   debería tocar nada fuera de su carpeta.
2. **Cachear la ficha en nuestra base de datos** al importarla. Un proveedor caído
   no puede dejar la biblioteca de nadie en blanco.
3. **Un fallo externo nunca rompe una pantalla.** Si la búsqueda falla, se ofrece
   el alta manual.
4. **Respetar los límites**, con reintento y *backoff*. BGG especialmente:
   responde 202 cuando aún está preparando la respuesta, y hay que reintentar.
5. **Las claves viven en la API**, nunca en el navegador. TMDB e IGDB tienen
   secretos y no pueden salir del backend.
6. **Atribución donde el proveedor la exige.** TMDB lo pide explícitamente; es
   condición de uso, no cortesía.

## Cómo conseguir las credenciales

- **TMDB**: cuenta → Settings → API → clave gratuita para uso no comercial.
- **IGDB**: aplicación en la [consola de Twitch](https://dev.twitch.tv/console/apps)
  → `Client ID` y `Client Secret` → se intercambian por un token OAuth que caduca
  y hay que refrescar.
- **AniList, BGG y Scryfall**: nada, son abiertas.

Todas se declaran en `.env.example`.

## La excepción temporal de AniList

Mientras la API en Go no exponga `/v1/works` con su propia integración
(épica #10), la web consulta AniList directamente desde
`apps/web/src/features/library/lib/anilist.ts`. Es una excepción consciente y
con fecha de caducidad, acordada en la épica #20: AniList es un catálogo
externo de solo lectura, así que la regla 2 de `AGENTS.md` no se rompe, pero
la regla 1 de aquí —un adaptador por proveedor detrás de un puerto del
dominio— sí queda pendiente hasta que ese adaptador viva en el backend.

`app/(app)/anadir/anime` ya lo usa: el paso de búsqueda lee el término del
parámetro `q` de la URL y llama al cliente **desde el componente de servidor**,
no desde el navegador. Es lo que exige la regla 5 de esta lista para las otras
cinco integraciones (que sí tienen secretos), y aquí además evita el
preflight de CORS y hace que el presupuesto de peticiones —que AniList cuenta
por IP— lo pague el servidor una vez en lugar de cada visitante por separado.
De paso resuelve la carrera entre búsquedas sin código: lo que hay en pantalla
es función de la URL, y la URL solo guarda el último término, así que una
búsqueda lenta no puede pintar encima de otra más nueva. Las otras cinco
categorías siguen con el campo desactivado.

Ese módulo respeta lo que sí aplica ya: está pensado para ejecutarse en el
servidor, no persiste nada, no filtra los tipos de AniList fuera de sí mismo y
trata el límite de peticiones y los fallos de red como estados, no como
excepciones. Cuando el backend tenga su integración, el fichero se borra entero
y la web pasa a consumir la API propia.

Que se ejecute en el servidor no está impuesto por nada: `ANILIST_API_URL` no
lleva el prefijo `NEXT_PUBLIC_`, así que en el navegador queda `undefined` y la
búsqueda degrada a «no disponible», pero nadie impide el import ni hay un error
de compilación que lo avise. Hacerlo obligatorio pediría el paquete
`server-only`, una dependencia nueva para un módulo escrito para borrarse.

La variable se declara en `apps/web/.env.example` **y** en el de la raíz, y se
reenvía al servicio `web` de `docker-compose.yml`. No es duplicación: Next carga
los ficheros de entorno desde el directorio de la aplicación y no sube al raíz
del monorepo, y el contenedor solo ve lo que compose le pasa. Declararla en un
solo sitio deja la búsqueda apagada en silencio, que es justo lo que el contrato
de estados de este cliente hace invisible.

## Casos que no cubre ninguna API

TCG más allá de Magic (Pokémon, Yu-Gi-Oh!, One Piece), cómic europeo, ediciones
raras, mazos propios y coleccionables varios. Para todo eso está el alta manual,
que **no es un plan B**: es parte del diseño desde el principio.
