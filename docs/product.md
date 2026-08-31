# Producto

## Qué es

Freak Hub es la **biblioteca compartida de un grupo de amigos**. Sirve para
registrar lo que cada uno ve, lee y juega, apuntar lo que tiene pendiente y
enseñárselo a los demás.

Funciona como una red social muy pequeña y cerrada: no hay descubrimiento
público, no hay algoritmo, no hay desconocidos. Lo que hay es un grupo que ya se
conoce y quiere llevar la cuenta de sus cosas en el mismo sitio.

## Para quién

Para un grupo cerrado de amigos. El tamaño esperado es de **decenas de
personas**, no de miles. Esa es una decisión de producto, no una limitación
técnica, y condiciona todo lo demás: se entra solo por invitación, no hay perfiles
públicos y no se indexa en buscadores.

## Qué se registra

Seis categorías, todas de primera clase:

| Categoría | Ejemplos | Catálogo externo |
| :--- | :--- | :--- |
| Anime | series y películas de animación japonesa | AniList |
| Manga | series, tomos, one-shots | AniList |
| Videojuegos | cualquier plataforma | IGDB |
| Películas | cine de acción real | TMDB |
| Juegos de mesa | incluye expansiones | BoardGameGeek |
| TCG | cartas y mazos de coleccionables | Scryfall |

El modelo está pensado para admitir categorías nuevas sin migraciones dolorosas
(ver [domain.md](domain.md)), pero añadir una es una decisión de producto, no un
detalle de implementación.

## Qué se puede hacer

- **Registrar** una entrada en tu biblioteca con su estado (pendiente, en curso,
  terminado, abandonado) y tu progreso.
- **Guardar en la wishlist** lo que quieres ver, leer, jugar o comprar.
- **Valorar** lo que has terminado y escribir una nota corta si te apetece.
- **Marcar favoritos**, que es distinto de puntuar alto: el favorito es afecto,
  la nota es juicio.
- **Recomendar** algo a una persona concreta del grupo, con un motivo.
- **Ver la actividad** de los demás en un feed cronológico sencillo.
- **Invitar** a alguien nuevo. Cualquier miembro puede hacerlo, sin límite.

## Qué NO es

Decir que no también es diseñar. Freak Hub **no** aspira a:

- Ser un catálogo público ni competir con AniList, Letterboxd o Backloggd.
- Tener recomendaciones automáticas o algorítmicas. Las recomendaciones las hacen
  personas, a personas concretas, con un motivo escrito.
- Ser una tienda, un gestor de préstamos o un inventario con valor económico.
- Tener métricas de vanidad: ni seguidores, ni rachas, ni gamificación.
- Escalar a un público abierto. Si algún día hiciera falta, sería otro producto.

## Principios

1. **Registrar tiene que costar poco.** Si añadir algo lleva más de unos segundos,
   nadie lo usará y el proyecto muere solo.
2. **Los datos son de quien los escribe.** Cualquiera puede exportar y borrar lo
   suyo.
3. **Nada de presión social.** No hay contadores públicos que empujen a competir.
4. **Cerrado por defecto.** Cada superficie nueva se piensa primero como privada.
