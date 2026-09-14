# Pantallas y navegación

Listado cerrado de pantallas de la aplicación y de la estructura de
navegación que las conecta. Decisión tomada en [ADR-0009](decisions/0009-arquitectura-de-informacion.md);
la paleta y la tipografía con las que se construyen están en [design.md](design.md).

Wireframes de baja fidelidad de las diez pantallas principales (núcleo de
biblioteca más perfil propio y de un amigo, con sus secciones de actividad,
top y recomendaciones): [wireframes/low-fidelity-wireframes.html](wireframes/low-fidelity-wireframes.html).
Escala de grises a propósito: esos wireframes son solo estructura y no llevan
la estética de [design.md](design.md), que en la aplicación ya está aplicada.

Alta fidelidad de las mismas diez pantallas, con la paleta y tipografía de
[design.md](design.md) ya aplicadas: [design/high-fidelity-desktop.html](design/high-fidelity-desktop.html).
El fichero cubre las tres anchuras (1440, 1024 y 390 px), incluida la barra
inferior de móvil. Solo dibuja el **tema oscuro**: el claro se decidió y se
construyó después (issue #37), así que existe en la aplicación y en
[design.md](design.md#el-tema-se-elige-y-se-recuerda) pero no tiene maqueta que
copiar.

Cinco pantallas del listado de más abajo (Actividad, Grupo, Invitar,
Recomendaciones y Ajustes) no tienen ninguna maqueta, en ninguna anchura: el
criterio para extenderlas está en
[design.md#criterio-de-extensión-para-pantallas-sin-maqueta](design.md#criterio-de-extensión-para-pantallas-sin-maqueta)
(épica #18).

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
| Ficha de obra | `/obras/[id]` | La obra, tu entrada y lo que ha hecho el grupo con ella. Secciones condicionales: expansiones si es un juego de mesa base (ADR-0006), mazos propios si es TCG (ADR-0007). **La ruta existe pero todavía responde 404 a cualquier id**: sin endpoint de biblioteca no hay forma de saber si un id es real, y fingir una ficha vacía mentiría más que un 404 |
| Añadir — categoría | Sin ruta propia: modal | Primer paso del alta: elegir categoría. Es un modal sobre la pantalla en la que estés, no una página (`shared/ui/add-category-modal.tsx`, issue #26). Lo abre `useAddCategoryModal()` desde el botón «+ Añadir» de la navbar, el botón central de la barra inferior y el estado vacío de la biblioteca del perfil; se dibuja como `Dialog` a partir de `sm` (640 px) y como `Drawer` por debajo. Elegir categoría navega a `/anadir/[categoria]`. La maqueta ya lo llamaba modal en su §5 |
| Añadir — buscar | `/anadir/[categoria]` | Busca en el catálogo externo de la categoría (AniList, IGDB, TMDB, BGG, Scryfall). Solo anime está conectado: el término viaja en `?q=` y la búsqueda corre en el servidor. Las otras cinco esperan a que el backend las integre |
| Añadir — manual | `/anadir/[categoria]/manual` | Alta manual, para lo que no aparece en el catálogo |
| Recomendaciones | `/recomendaciones` | Recibidas pendientes y enviadas, con su motivo |
| Actividad | `/actividad` | Feed cronológico completo del grupo, sin algoritmo. Separado de inicio a propósito |
| Grupo | `/miembros` | Listado de quién está dentro |
| Perfil de miembro | `/miembros/[username]` | Cuatro secciones alternables (ADR-0010): Biblioteca (pública, favoritos), Actividad (gráficas y estadísticas personales, nunca comparativas), Top (mejor valoradas, filtrable por categoría) y Recomendaciones (enviadas/recibidas entre el visitante y el dueño del perfil). En tu propio perfil puedes elegir qué secciones se muestran y cuál se abre por defecto — solo afecta a tu vista, no a la de quien te visita |
| Ajustes | `/ajustes` | Cuenta (widget de Clerk), tema claro/oscuro, exportar y borrar tus datos, atribución de catálogos externos |

### Las 16, contadas con cuidado

La prueba de fuego de la épica #18 dice «las 16 pantallas de `docs/screens.md`
existen como **ruta protegida**». Tomada al pie de la letra no se puede cumplir
nunca, y no por falta de trabajo:

- **Tres son públicas a propósito.** Portada, Entrar y Registro son las únicas
  tres entradas de `apps/web/src/shared/lib/routes.ts`, que es el único sitio
  que abre una ruta al público (regla 5 de `AGENTS.md`). Llamarlas «protegidas»
  sería tan falso como decir que falta el tema claro.
- **Una no es una ruta.** «Añadir — categoría» es el modal de arriba desde la
  issue #26. Exigirle una ruta propia sería pedir que se deshaga esa decisión.

El recuento honesto: 16 pantallas alcanzables, **12 como ruta protegida** —una
de ellas, la ficha de obra, todavía respondiendo 404 a la espera del endpoint
de biblioteca—, **3 como ruta pública deliberada** y **1 como modal**. Es ese
recuento, y no la frase literal, el que la épica puede dar por cumplido.

## Lo que deliberadamente no es una pantalla

| Candidato | Por qué no |
| :--- | :--- |
| `/wishlist` | Es `status='wishlist'` dentro de la biblioteca, no una tabla ni una ruta aparte |
| Catálogo de expansiones | Se añaden desde la ficha del juego base (ADR-0006), no desde un catálogo independiente |
| Detalle de un mazo | El modelo mazo↔carta está sin decidir (ADR-0007); la ficha solo lista nombres |
| Explorar / descubrir | El producto descarta explícitamente el descubrimiento público (product.md) |
| Editar entrada | Es un panel dentro de la ficha de obra, no tiene sentido sin el contexto de la obra |
| Ranking o estadísticas comparativas entre miembros | Métrica de vanidad descartada por producto — las estadísticas y el "top" del perfil (ADR-0010) son siempre personales, nunca una comparación entre miembros |

## Navegación

**Navbar (sesión iniciada, todas las pantallas salvo landing/entrar/registro):**

Wordmark (Bungee, enlaza a `/inicio`) · Inicio · Biblioteca · Actividad ·
Grupo · botón `+ Añadir` (acento) · badge de recomendaciones pendientes ·
menú de usuario (perfil propio, invitar, ajustes, tema, salir).

Solo cuatro enlaces de primer nivel: **Biblioteca** es el único punto de
entrada a las seis categorías, no seis enlaces sueltos — se llega a una
categoría en un clic desde el lobby, y se vuelve al lobby para cambiar de
categoría.

La moldura que va debajo **no navega**: es `aria-hidden` y no contiene ningún
enlace ni botón (`shared/ui/category-stripe.tsx`). Dice en qué categoría estás,
no cómo salir de ella. Convertirla en seis enlaces sería reintroducir por la
puerta de atrás los seis destinos de primer nivel que
[ADR-0009](decisions/0009-arquitectura-de-informacion.md) descartó.

Debajo de la navbar, en todas las pantallas de sesión, la moldura de seis
colores del roster (ver
[design.md](design.md#la-moldura-bajo-la-navbar-solo-color)). El segmento de la
categoría activa se ensancha dentro de `/biblioteca/[categoria]`, que es hoy la
única pantalla que declara categoría (`SetActiveCategory`); la ficha de obra lo
hará cuando deje de ser un 404 y sepa de qué categoría es la obra.

**Barra inferior (móvil):** Inicio · Biblioteca · Añadir (centro) ·
Actividad · Recomendaciones.

La cabecera **no desaparece en el móvil**: se queda con el wordmark, el badge
de pendientes y el menú de usuario, que es lo que dibuja el artboard `(móvil)`
de la maqueta. Lo que baja a la barra inferior son los destinos, no la
identidad. Desde ese menú se llega al perfil propio, a invitar, a ajustes, al
tema y a cerrar sesión —que no tiene ninguna otra vía en toda la interfaz—, y
por debajo de 768 px también a Grupo, que es la entrada que la barra inferior
cedió a Recomendaciones.

**El único badge de notificación de toda la app** es el contador de
recomendaciones recibidas pendientes. Ningún otro contador es comparativo
ni de vanidad — los contadores de categoría en el lobby son cuántas obras
tuyas hay, no un ranking frente al grupo.
