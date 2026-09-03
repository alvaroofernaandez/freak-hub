# Pantallas y navegación

Listado cerrado de pantallas de la aplicación y de la estructura de
navegación que las conecta. Decisión tomada en [ADR-0009](decisions/0009-arquitectura-de-informacion.md);
la paleta y la tipografía con las que se construirán están en [design.md](design.md).

Wireframes de baja fidelidad de las diez pantallas principales (núcleo de
biblioteca más perfil propio y de un amigo, con sus secciones de actividad,
top y recomendaciones): [wireframes/low-fidelity-wireframes.html](wireframes/low-fidelity-wireframes.html).
Escala de grises a propósito: solo estructura, la estética final es la de
[design.md](design.md) y todavía no se ha aplicado.

## Listado de pantallas

| Pantalla | Ruta | Qué resuelve |
| :--- | :--- | :--- |
| Landing | `/` | Ya existe. Explica qué es Freak Hub y encamina a entrar o registrarse |
| Entrar | `/entrar` | Ya existe |
| Registro | `/registro` | Ya existe. Alta con ticket de invitación |
| Invitar | `/invitar` | Ya existe; falta ampliarla con la lista de invitaciones ya enviadas y su estado |
| Inicio | `/inicio` | Panel personal: lo que tienes en curso, recomendaciones recibidas pendientes, resumen breve de actividad reciente |
| Lobby de biblioteca | `/biblioteca` | Pantalla propia, distinta de inicio: las seis categorías como puerta de entrada |
| Biblioteca por categoría | `/biblioteca/[categoria]` | Listado filtrable por estado (la wishlist es el filtro `estado=wishlist`, no ruta propia), favorito y propiedad; campos propios de cada categoría |
| Ficha de obra | `/obras/[id]` | La obra, tu entrada y lo que ha hecho el grupo con ella. Secciones condicionales: expansiones si es un juego de mesa base (ADR-0006), mazos propios si es TCG (ADR-0007) |
| Añadir — categoría | `/anadir` | Primer paso del alta: elegir categoría |
| Añadir — buscar | `/anadir/[categoria]` | Busca en el catálogo externo de la categoría (AniList, IGDB, TMDB, BGG, Scryfall) |
| Añadir — manual | `/anadir/[categoria]/manual` | Alta manual, para lo que no aparece en el catálogo |
| Recomendaciones | `/recomendaciones` | Recibidas pendientes y enviadas, con su motivo |
| Actividad | `/actividad` | Feed cronológico completo del grupo, sin algoritmo. Separado de inicio a propósito |
| Grupo | `/miembros` | Listado de quién está dentro |
| Perfil de miembro | `/miembros/[username]` | Su biblioteca pública, favoritos y actividad reciente |
| Ajustes | `/ajustes` | Cuenta (widget de Clerk), tema claro/oscuro, exportar y borrar tus datos, atribución de catálogos externos |

## Lo que deliberadamente no es una pantalla

| Candidato | Por qué no |
| :--- | :--- |
| `/wishlist` | Es `status='wishlist'` dentro de la biblioteca, no una tabla ni una ruta aparte |
| Catálogo de expansiones | Se añaden desde la ficha del juego base (ADR-0006), no desde un catálogo independiente |
| Detalle de un mazo | El modelo mazo↔carta está sin decidir (ADR-0007); la ficha solo lista nombres |
| Explorar / descubrir | El producto descarta explícitamente el descubrimiento público (product.md) |
| Editar entrada | Es un panel dentro de la ficha de obra, no tiene sentido sin el contexto de la obra |
| Ranking o estadísticas del grupo | Métrica de vanidad descartada por producto |

## Navegación

**Navbar (sesión iniciada, todas las pantallas salvo landing/entrar/registro):**

Wordmark (Bungee, enlaza a `/inicio`) · Inicio · Biblioteca · Actividad ·
Grupo · botón `+ Añadir` (acento) · badge de recomendaciones pendientes ·
menú de usuario (perfil propio, invitar, ajustes, tema, salir).

Solo cuatro enlaces de primer nivel: **Biblioteca** es el único punto de
entrada a las seis categorías, no seis enlaces sueltos — se llega a una
categoría en un clic desde el lobby, y una vez dentro la moldura de seis
colores hace de migas de pan hacia las otras cinco.

Debajo de la navbar, en todas las pantallas de sesión, la moldura de seis
colores del roster (ver [design.md](design.md#motivo-recurrente-la-moldura)); el segmento de la categoría activa se
ensancha cuando estás dentro de `/biblioteca/[categoria]` o de una ficha.

**Barra inferior (móvil):** Inicio · Biblioteca · Añadir (centro) ·
Actividad · Recomendaciones. Grupo y perfil propio pasan al header.

**El único badge de notificación de toda la app** es el contador de
recomendaciones recibidas pendientes. Ningún otro contador es comparativo
ni de vanidad — los contadores de categoría en el lobby son cuántas obras
tuyas hay, no un ranking frente al grupo.
