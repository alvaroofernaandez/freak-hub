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

## Casos que no cubre ninguna API

TCG más allá de Magic (Pokémon, Yu-Gi-Oh!, One Piece), cómic europeo, ediciones
raras, mazos propios y coleccionables varios. Para todo eso está el alta manual,
que **no es un plan B**: es parte del diseño desde el principio.
