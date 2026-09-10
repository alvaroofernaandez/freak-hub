# Dirección visual

La estética estuvo deliberadamente sin decidir mientras se construían los
cimientos (ver [roadmap.md](roadmap.md)). Esta es la decisión, cerrada con
[ADR-0008](decisions/0008-direccion-visual.md).

## El concepto: character select

Freak Hub ya tenía una identidad asomando en el banner del README: oscura,
con aire de "pantalla de selección de personaje" arcade, construida sobre el
arte de Fullmetal Alchemist y Hunter × Hunter. La dirección visual de la
aplicación **extiende esa identidad** en lugar de inventar una segunda: mismo
neutro violeta, mismos colores de partida (Ed, Gon, Killua), llevados de un
banner de marketing a un sistema de interfaz completo.

Oscuro por defecto, con tema claro disponible.

## Paleta

### Neutros

Un solo hue violeta (272°) recorre toda la paleta, oscuro y claro. Es el
mismo que ya usa `globals.css` y el banner: no se sustituye, se completa.

| Token | Oscuro | Claro |
| :--- | :--- | :--- |
| `--ground` | `oklch(0.130 0.020 272)` | `oklch(0.975 0.006 272)` |
| `--surface` | `oklch(0.185 0.024 272)` | `oklch(0.995 0.003 272)` |
| `--surface-raised` | `oklch(0.240 0.028 272)` | `oklch(0.955 0.012 272)` |
| `--border` | `oklch(0.340 0.032 272)` | `oklch(0.840 0.018 272)` |
| `--ink` | `oklch(0.960 0.008 272)` | `oklch(0.220 0.020 272)` |
| `--ink-muted` | `oklch(0.700 0.020 272)` | `oklch(0.460 0.020 272)` |

### El roster — un color por categoría

Seis categorías, seis tonos. Tres ya existían en el banner (Ed, Gon, Killua);
las otras tres se completan con la misma fórmula de luminosidad y croma, así
que el conjunto se lee como una sola familia y no como parches sueltos.

| Categoría | Token | Hue | Notas |
| :--- | :--- | :--- | :--- |
| Anime | `--accent` / `--cat-anime` | 78° | Ámbar de "Ed". Hace doble función: es también el acento de marca — la categoría por la que arranca el roadmap es la que presta su color a toda la app |
| Manga | `--cat-manga` | 32° | |
| Videojuegos | `--cat-games` | 150° | Verde de "Gon" |
| Películas | `--cat-films` | 196° | |
| Juegos de mesa | `--cat-board` | 226° | Cian de "Killua" |
| TCG | `--cat-tcg` | 300° | Recupera el morado que era el acento provisional de `globals.css` |

**Regla:** el color de categoría nunca es el único identificador — siempre va
acompañado de una etiqueta de texto. Nunca se usa solo, ni para transmitir
significado por sí mismo.

### Semántica (éxito / error / aviso)

Reutiliza tonos del roster en vez de abrir una tercera familia de color:
`--success` = verde de Videojuegos, `--danger` = un rojo propio ("Coat",
22°, el mismo que ya marca "SOLO POR INVITACIÓN" en el banner),
`--warning` = el ámbar de marca. Conviven sin ambigüedad porque aparecen en
contextos distintos: un toast de error nunca comparte pantalla con una
etiqueta de categoría.

## El estado de una entrada no usa color

Los seis estados de una `LibraryEntry` (`wishlist`, `pending`,
`in_progress`, `completed`, `dropped`, `on_hold`, ver
[domain.md](domain.md)) se comunican con **icono + etiqueta, nunca con
color**. El color ya está gastado en identificar la categoría; usarlo otra
vez para el estado obligaría a leer dos codificaciones de color a la vez en
la misma tarjeta.

| Estado | Icono (`reicon-react`) | Por qué |
| :--- | :--- | :--- |
| `wishlist` | `Star` | Algo deseado, todavía no tuyo |
| `pending` | `Clock` | Esperando su turno |
| `in_progress` | `Play` | En marcha |
| `completed` | `Check` | Terminado |
| `dropped` | `X` | Abandonado |
| `on_hold` | `Pause` | Parado a propósito, no abandonado |

## Tipografía

Tres familias, cada una con un trabajo y solo uno.

| Familia | Papel | Por qué |
| :--- | :--- | :--- |
| **Bungee** | Solo el wordmark y momentos de titular muy puntuales | Una sola pesada, de una sola voz: perfecta para "FREAK HUB", ilegible en un párrafo. No entra en componentes de uso diario |
| **Sora** | Interfaz: encabezados y cuerpo | Sustituye a Inter. Ya viste la etiqueta del banner, así que el wordmark y el texto de producto comparten familia tipográfica en vez de dos sans-serif sin relación |
| **JetBrains Mono** | Etiquetas, cifras, marcas de tiempo, handles | Ya es el uso que le da la app hoy (`inicio/page.tsx`: `font-mono uppercase tracking-widest`). Se mantiene tal cual |

## Motivo recurrente: la moldura

El banner usa una franja de tres colores al pie del cabinet arcade (uno por
personaje). En la interfaz se extiende a los seis colores del roster y se usa
como separador entre secciones importantes: además de decorar, funciona como
índice visual de las seis categorías, coherente con las etiquetas que ya se
ven en las tarjetas.

## Estado de una invitación

Mismo criterio que los estados de una entrada: **marca + palabra, nunca color
solo**. Reutiliza el vocabulario que ya usa `StatusBadge`, para que un círculo
signifique lo mismo en toda la aplicación.

| Estado | Icono | Etiqueta |
| :--- | :--- | :--- |
| `pending` | `Clock` | Pendiente |
| `accepted` | `Check` | Aceptada |
| `revoked` | `Forbidden` | Revocada |

Una invitación pendiente se dibuja con **contorno discontinuo**, no con un
color propio: comunica "todavía no está dentro" sin gastar color y sin
depender de la vista cromática. Ver `PendingInvitationRow`.

## La moldura como separador

Además de decorar los estados vacíos, la franja de seis colores separa las
secciones importantes de una misma pantalla (por ejemplo, miembros de
invitaciones en `/miembros`). Vive en `shared/ui/moulding.tsx`; no se duplica
por pantalla.

## Todo lo pulsable responde

Tailwind 4 elimina `cursor: pointer` de los botones en su preflight, así que
la aplicación lo declara en `@layer base` (`globals.css`) junto al resto de
afordancias. Se hace en la base y no componente a componente para que un botón
nuevo no pueda olvidarlo.

| Señal | Valor |
| :--- | :--- |
| Cursor | `pointer` en botones, enlaces con `href`, `[role=button]`, `summary` y `label[for]` |
| Cursor deshabilitado | `not-allowed` |
| Pulsación | `scale(0.97)`, transición de 100 ms `ease-out` |
| Foco | Contorno de 2 px en `--color-accent`, con 2 px de separación |

La pulsación es la interacción más frecuente de la aplicación, así que el
movimiento es el mínimo que se percibe: solo `transform`, nunca propiedades de
maquetación, y anulado bajo `prefers-reduced-motion`.

El hover sí es responsabilidad de cada componente, porque su señal depende de
lo que se pulsa: el borde se enciende en el color de la categoría en las
tarjetas de obra, en `--color-accent` en las filas de miembro, y el texto pasa
a `--color-accent` en los enlaces de navegación.

## Carga: esqueleto, nunca ruleta

Cuando ya se conoce la forma de la respuesta, se reserva su espacio con un
esqueleto del mismo tamaño (`MemberRowSkeleton`) en lugar de un indicador
giratorio. Evita el salto de maquetación cuando llegan los datos.

## La cabecera dice dónde estás

El enlace de la sección activa lleva `aria-current="page"` y se distingue por
peso y color (`--ink` sobre el `--ink-muted` de los demás). La marca no
depende solo del color: el peso tipográfico y el atributo ARIA la acompañan.

Una sección sigue activa mientras estés dentro de ella: `/miembros/alvaro`
mantiene "Grupo" marcado. Aplica igual a la barra inferior del móvil.

## La cabecera, en detalle

| Pieza | Decisión |
| :--- | :--- |
| Wordmark | Bungee, enlaza a `/inicio` |
| Navegación | Icono + palabra. El icono de la sección activa usa `weight="Filled"`; el resto, `Outline` |
| Acción primaria | "Añadir" con `Plus`, en `--accent`: es la única acción primaria de la cabecera |
| Identidad | `UserMenu` con avatar, handle y chevron que gira al desplegarse |
| Salto al contenido | Primer elemento enfocable del documento, visible solo al recibir foco |

El peso del icono es la segunda señal de la sección activa, junto al color y al
peso tipográfico. Tres señales para el mismo estado no es exceso: significa que
funciona en escala de grises, con daltonismo y a tamaño pequeño.

### La barra inferior del móvil

Cuatro destinos más el botón de añadir en el centro: cinco objetivos, el máximo
que un pulgar alcanza con comodidad en el borde inferior. Por eso la barra
cambia "Grupo" por "Recomendaciones"; el grupo queda a un toque desde el menú
de perfil.

Cada destino es icono sobre etiqueta, con altura mínima de 44 px, y respeta
`env(safe-area-inset-bottom)` para no quedar bajo la barra de gestos.

## El menú de sesión es nuestro, no de Clerk

`<UserButton>` de Clerk quedaba fuera del sistema de diseño: sus propios
colores, su propia tipografía, su propio vocabulario. Se sustituye por
`UserMenu`, construido con los tokens del proyecto. Clerk permanece debajo,
reducido a la llamada `signOut()`.

Sigue el patrón *menu button* de WAI-ARIA, y eso no es opcional:

| Requisito | Cómo |
| :--- | :--- |
| Estado anunciado | `aria-haspopup="menu"` y `aria-expanded` en el disparador |
| Apertura por teclado | La flecha abajo abre y enfoca el primer elemento |
| Cierre | `Escape` cierra y **devuelve el foco** al disparador |
| Cierre por puntero | Un clic fuera lo cierra |
| Capas | `z-40`: por encima del contenido, por debajo del modal (`z-50`) |

No enlaza a rutas que no existen. `/ajustes` y `/recomendaciones` están
pendientes (issues #37 y #36); hasta que existan, el menú no las ofrece.

## Las tarjetas de categoría llevan personaje

El lobby de biblioteca pasa de tres columnas a **dos**, con tarjetas altas
(190–230 px). Cada categoría se presenta como el personaje que la representa:

| Pieza | Decisión |
| :--- | :--- |
| Escenario | Charco de luz radial del color de la categoría en el suelo, bajo el personaje (anclado al borde inferior, al 82 % del ancho), que se apaga antes de llegar al nombre |
| Nombre | En el color de su categoría, en Bungee |
| Recuento | Solo la cifra, en JetBrains Mono, en una ficha arriba a la izquierda. La palabra «obras» vive en un `sr-only`, que se lee después del nombre |
| Personaje | Recortado, **pegado a la esquina inferior derecha**, al 52 % del ancho |
| Fundido | `mask-image` de izquierda a derecha: la imagen se desvanece antes de llegar al texto |
| Al señalarla | El personaje crece un 4 % desde su esquina (nunca se despega del borde), el escenario pasa del 70 % al 100 % y el borde toma el color de la categoría. 220 ms con `--ease-out-quint`; sin escala bajo `prefers-reduced-motion` |

El escenario **sustituyó al resplandor de esquina**, que a su vez había
sustituido a un punto de color. En la esquina superior izquierda la luz no
tocaba ni al personaje ni al nombre: sobre la superficie oscura se leía como
una mancha en un rincón vacío. Bajo el personaje, la luz lo separa del fondo,
como en una pantalla de selección.

Se construye con `radial-gradient` y `color-mix` en línea, no con utilidades
`from-*`/`to-*`: un degradado lineal en una caja cuadrada deja **bordes duros
visibles**, que es justo lo que no se quiere. La función vive en
`shared/ui/category-art.ts`.

**Una sola tarjeta, dos pantallas.** `CategoryCard`
(`shared/ui/category-card.tsx`) es la del lobby (un enlace, tamaño `roster`)
y la del selector de «Añadir» (un botón, tamaño `compact`, sin recuento y con
`Plus` en lugar de la flecha). Elegir qué añadir es elegir un personaje del
mismo roster, no rellenar un campo. En el selector, la elegida se marca con un
anillo del color de su categoría durante los 180 ms previos a navegar.

**Los personajes se anclan a la esquina inferior derecha.** Si una figura no
cabe, el recorte cae sobre el borde de la tarjeta, donde se lee como que la
figura sale de ella. Un recorte a media figura, flotando dentro de la tarjeta,
parece un error de montaje: por eso ninguna ilustración lleva recortes propios
que partan al personaje.

Los seis personajes: Edward Elric (anime), Asta (manga), Arthur Morgan
(videojuegos), Darth Vader (películas), un caballo de ajedrez (juegos de mesa)
y Pikachu (TCG). Todos recortados a **700 px de alto** para que se lean a un
tamaño parecido cuando la tarjeta los escala.

El personaje es decoración: va con `aria-hidden` y sin texto alternativo,
porque el nombre de la categoría ya está escrito al lado. Las categorías sin
ilustración no muestran hueco: la tarjeta está diseñada para sostenerse sola.

**El nombre del fichero nombra al personaje** (`char-tcg-booster.webp`, no
`char-tcg.webp`). `next/image` cachea por URL: si cambias el personaje pero
conservas el nombre, se sigue sirviendo la imagen antigua desde la caché del
navegador y de `.next/cache/images`, y borrar la caché del servidor no basta.
Renombrar el fichero es lo único que lo sustituye de verdad.

**Los sujetos muy verticales llevan aire transparente arriba** dentro de su
propio lienzo. Sin él llenan toda la altura de la tarjeta y aplastan al resto:
una caja de sobres no puede pesar el triple que Edward Elric.

**Formato de los recortes**: WebP con canal alfa. Los mismos recortes en PNG
pesaban 835 KB en total; en WebP son 240 KB, con transparencia idéntica. Se
sirven con `next/image`, que reserva su espacio y evita el salto de maquetación.

Para recortar un fondo blanco sin vaciar los blancos interiores del dibujo
(la cara, la ropa), se rellena desde las **cuatro esquinas**, no se hace
`-transparent white`:

```sh
magick entrada.webp -alpha set -fuzz 12% -fill none \
  -draw "alpha 0,0 floodfill" -draw "alpha W,0 floodfill" \
  -draw "alpha 0,H floodfill" -draw "alpha W,H floodfill" \
  -trim +repage salida.png
```

## Componentes: Radix con nuestros tokens

Los controles interactivos se construyen sobre **primitivas de Radix UI**,
estilizadas con los tokens de este documento. No se usa el CLI de shadcn/ui:
genera componentes que asumen su propio sistema de variables
(`--background`, `--foreground`, `--primary`), y este proyecto ya tiene el
suyo. Radix es lo que shadcn usa por debajo, así que el resultado es el mismo
sin un segundo sistema de color compitiendo con el de aquí.

| Componente | Primitiva | Vive en |
| :--- | :--- | :--- |
| Modal | `@radix-ui/react-dialog` | `shared/ui/dialog.tsx` |
| Casilla | `@radix-ui/react-checkbox` | `shared/ui/checkbox.tsx` |
| Desplegable de opciones | `@radix-ui/react-select` | `shared/ui/select.tsx` |
| Menú de sesión | `@radix-ui/react-dropdown-menu` | `features/members/ui/user-menu.tsx` |
| Reordenar arrastrando | `@dnd-kit/*` | `features/profile/ui/edit-sections-panel.tsx` |

**Nada de controles nativos.** `<select>`, `type="checkbox"` y `type="radio"`
pintan su lista y su caja con los colores del sistema operativo, que sobre una
superficie oscura llegan como un panel blanco y azul ajeno a todo lo demás. Lo
vigila `apps/web/src/app/native-controls.test.ts`.

### Los modales

Todos pasan por el mismo `Dialog`, así que todos se comportan igual:

| Comportamiento | Detalle |
| :--- | :--- |
| Fondo | `--ground-deep` al 55 % con un desenfoque de 6 px: la pantalla de detrás se aparta sin apagarse, y lo que hay detrás (a menudo las mismas tarjetas) queda desenfocado en vez de competir |
| Cerrar | Clic fuera, `Escape`, o el botón de cancelar |
| Foco | Atrapado dentro mientras está abierto; al cerrar vuelve a lo que lo abrió |
| Desplazamiento | Bloqueado detrás del modal |
| Entrada | 150 ms con `--ease-out-quint`: fundido del fondo y fundido con escala de 0.98 del panel |
| Salida | 75 % de la entrada (~110 ms), con Motion: el panel ya no desaparece de golpe al cerrarse. Ver [Movimiento](#movimiento) |

Solo el fondo del `Dialog` oscurece. El selector de «Añadir» bajaba además la
opacidad de la aplicación al 32 %, y las dos capas juntas dejaban la pantalla
en negro.

El `Dialog` es controlado desde fuera y no usa `Dialog.Trigger`, así que Radix
no puede saber qué lo abrió: el componente recuerda el elemento activo al
abrirse y le devuelve el foco al cerrarse.

### Componentes de Cult UI, adaptados a mano

Cuatro interacciones se adoptan de [Cult UI](https://github.com/nolly-studio/cult-ui)
(MIT), copiadas y adaptadas a mano en vez de instaladas con su CLI
([ADR-0013](decisions/0013-componentes-de-cult-ui.md), que documenta el
porqué y lo descartado). Cada fichero adaptado lleva un comentario con su
ruta de origen en el repositorio de Cult UI.

| Componente | Qué | Dónde | Qué cambia del original |
| :--- | :--- | :--- | :--- |
| `AnimatedNumber` (`shared/ui/animated-number.tsx`) | Una cifra que rueda hasta su nuevo valor en vez de saltar | Ficha de recuento de `CategoryCard`, estadísticas de `ActivitySection` (perfil) | Muelle críticamente amortiguado (`bounce: 0`) en vez del original, subamortiguado y con rebote visible; arranca ya en el valor real (sin contar desde 0 al montar); movimiento reducido lo deja instantáneo; la cifra visible es `aria-hidden`, con el valor real aparte para lectores de pantalla; formato en `es-ES` |
| `Drawer` (`shared/ui/drawer.tsx`), usado por `AddCategoryModalHost` | Hoja inferior para «Añadir» en móvil | Bajo el punto de corte `sm` (640 px); a partir de ahí, el mismo contenido en el `Dialog` de siempre | Construido sobre `vaul` (que a su vez usa `@radix-ui/react-dialog`, igual que `Dialog`): foco atrapado, `Escape` y superposición iguales a los del modal. `react-use-measure`, que el original de `family-drawer` traía para animar `height`, no se instala: no hay ninguna altura que medir |
| `InvitePopover` (`features/invitations/ui/invite-popover.tsx`) | El botón «Invitar» se transforma en un panel con el campo de email, en vez de abrir un modal centrado | Cabecera de `/miembros` (sustituye a `InviteMemberDialog`) | Construido sobre `@radix-ui/react-popover` (`modal`): el original no gestionaba `Escape` ni el foco. El disparador no lleva `aria-hidden`/`tabIndex` manuales: `Popover.Root modal` ya oculta el resto de la página para lectores de pantalla, y marcar como oculto el propio disparador mientras aún conserva el foco (justo al abrirse) es una violación de ARIA. El panel se queda abierto tras un envío correcto — igual que hacía `InviteMemberDialog` — con el campo de email vacío y una confirmación junto al formulario, lista para la siguiente invitación; no se cierra solo |
| Contenido de pestaña con dirección (`SectionTabs`, `features/profile/ui/section-tabs.tsx`) | El contenido de la pestaña activa entra desde el lado hacia el que se navegó | Pestañas del perfil (`library`/`activity`/`top`/`recommendations`) | Desplazamiento de 300 px a ±24 px de entrada / ±12 px de salida; sin `filter: blur`; muelle con rebote sustituido por la curva `--ease-out-quint` sin rebote; ya no bloquea el clic mientras anima (`isAnimating` del original desaparece); no anima `height` |

**La regla del punto de corte «Añadir».** Por debajo de `sm` (640 px) el
selector de categoría es una hoja inferior; a partir de ahí, un modal
centrado. La decisión se toma en el cliente
(`shared/lib/use-media-query.ts`, `useMediaQuery`), porque `matchMedia` no
existe en el servidor. El componente que la consulta
(`AddCategoryModalHost`) ya está siempre montado en el shell de la
aplicación, así que el valor por defecto (`true`, hoja ancha → `Dialog`) es
lo que se ve hasta que el efecto resuelve la consulta real; como el
contenido del selector solo es visible una vez abierto, ese instante por
defecto nunca llega a pintarse.

## Iconografía: un solo set

Los iconos vienen de **[Reicon](https://reicon.dev)** (`reicon-react`, MIT,
sin dependencias, con tipos incluidos y *tree-shaking*). Un único set, para que
todos compartan rejilla, trazo y peso óptico.

Antes se usaban glifos tipográficos prestados de la fuente de cuerpo (`✕`, `★`,
`○`, `◐`, `‹`, `→`). No se alineaban entre sí ni con nada: cada uno traía las
métricas de su fuente de origen. Lo vigila
`apps/web/src/app/icon-set.test.ts`, que falla si alguno vuelve al código.

| Uso | Tamaño |
| :--- | :--- |
| En línea con texto (estados, chips, elementos de menú) | 14–16 px |
| Acciones de la cabecera y marcadores de tarjeta | 16–18 px |
| Botón flotante de la barra móvil | 24 px |

Los iconos que solo acompañan a una etiqueta ya legible van con
`aria-hidden="true"`: el texto de al lado ya lo dice todo, y anunciarlos dos
veces molesta más que ayuda. `weight="Filled"` se reserva para lo que está
activo (un favorito marcado); el resto usa el `Outline` por defecto.

## Contraste: `--ink-faint` no es para texto

Medido sobre los fondos reales del tema oscuro (WCAG 2.1, mínimo AA de 4.5:1
para texto normal):

| Token | Sobre `ground` | Sobre `surface` | Sobre `surface-raised` |
| :--- | ---: | ---: | ---: |
| `--ink` | 17.91 | 16.61 | 14.67 |
| `--ink-muted` | 7.52 | 6.98 | 6.16 |
| `--ink-faint` | 3.07 | 2.85 | **2.52** |
| `--accent` | 9.88 | 9.16 | 8.09 |
| `--danger` | 5.91 | 5.48 | 4.84 |
| `--success` | 11.48 | 10.64 | 9.40 |
| `--warning` | 9.88 | 9.16 | 8.09 |

`--ink-faint` **no alcanza el mínimo en ningún fondo**, ni siquiera el 3:1 de
texto grande sobre `surface-raised`. Hoy **no se usa como color de texto en
ningún componente**: queda disponible solo para bordes y fondos. Cualquier
texto, por secundario que sea (fechas, contadores, textos de ayuda, marcadores
de posición, glifos visibles como ✕ o →), usa `--ink-muted` como mínimo.

`--success` y `--warning` (docs/states.md, `InlineMessage` y la familia de
`shared/ui/state`) superan el mínimo AA de 4.5:1 en los tres fondos —
`--warning` es literalmente `var(--color-accent)`, ya medido en la fila de
arriba. Ninguno necesita una entrada propia en
`apps/web/src/app/token-contrast.test.ts`: ese test guarda un token que
**falla** el mínimo (`--ink-faint`), y ni `--success` ni `--warning` están en
ese caso.

Lo vigila `apps/web/src/app/token-contrast.test.ts`: la suite falla si alguien
vuelve a pintar texto con él. jsdom no aplica la hoja de estilos, así que el
test escanea el código fuente en vez de renderizar.

## Movimiento

Extiende [ADR-0012](decisions/0012-animaciones-con-motion.md), que decide la
herramienta (Motion) y el motivo. Esto es el vocabulario: los valores exactos
y en qué casos se usa cada uno.

### Quién anima qué

| Herramienta | Casos |
| :--- | :--- |
| CSS | Pulsación, hover, cambios de color, entradas al montar (una lista, una tarjeta, una ruta nueva) |
| Motion | Salidas, presencia (algo que aparece o desaparece tras una interacción), maquetación (`layout`, `layoutId`) |

La razón no es de gusto: Motion pinta en el servidor el estado inicial de una
animación, así que una entrada montada con Motion se vería invisible hasta la
hidratación, o para siempre si falla el JavaScript. Un `@keyframes` con
`animation-fill-mode: backwards` corre desde el primer pintado y no esconde
nada. Las salidas no tienen ese problema porque solo ocurren tras la
hidratación, cuando React ya controla el desmontaje.

### Tokens

Viven en `shared/motion/tokens.ts`. Ningún componente escribe sus propios
valores.

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `EASE_OUT_QUINT` | `cubic-bezier(0.22, 1, 0.36, 1)`, igual que `--ease-out-quint` en `globals.css` | La curva de toda llegada |
| `DURATION.fast` | 150 ms | Popovers, diálogos |
| `DURATION.base` | 220 ms | Contenido general |
| `DURATION.layout` | 350 ms | Animaciones de maquetación |
| `EXIT_RATIO` | 0.75 | Toda salida dura el 75 % de su entrada: `duraciónEntrada * EXIT_RATIO` |
| `LAYOUT_SPRING` | muelle, `duration: 0.35`, `bounce: 0` | Maquetación sin rebote (indicador de pestaña, reflujo de la rejilla) |
| `staggerIndex(i)` / `--i` | tope en 7 (8 elementos) × 40 ms | Cascada de una lista al montar, vía la clase `.stagger-in` |

Las entradas al montar usan `--animate-rise` (opacidad + 6 px de
desplazamiento, 220 ms) y, para rutas completas, `--animate-route-in`
(180 ms) en `app/(app)/template.tsx`, que Next.js remonta en cada navegación
del lado del cliente.

### La frecuencia importa

Lo que se usa docenas de veces por sesión, o se dispara con el teclado, dura
120 ms o menos, o no anima. Por eso la casilla de verificación entra en 120 ms
y sale en 90 ms en vez de usar `DURATION.fast`: es el control más repetido del
panel de preferencias. Nada de animaciones en bucle salvo el esqueleto de
carga (`animate-pulse`), y nada de rebote ni elástico en ningún caso.

### Movimiento reducido

`MotionConfig reducedMotion="user"` en la raíz (`shared/motion/motion-provider.tsx`)
lee la preferencia del sistema una sola vez: si pide menos movimiento, Motion
anula desplazamientos, escalas y maquetación, y conserva los fundidos. Las
entradas en CSS siguen la misma regla a mano, bajo
`@media (prefers-reduced-motion: reduce)`: pierden el desplazamiento y se
quedan en un fundido simple, nunca en nada instantáneo ni en contenido oculto.
Ese bloque se declara **sin capa** (`@layer`) y después de los
`@keyframes rise` / `route-in` de movimiento completo: en CSS Cascade Layers
una regla sin capa gana siempre a una con capa, sin importar el orden de
aparición, así que si el override viviera dentro de `@layer base` (como
ocurría antes) las versiones sin capa de arriba ganarían y el movimiento
reducido nunca se aplicaría.

## Registro de decisiones

- **2026-09-09** · Estados de invitación con marca + palabra, y contorno
  discontinuo para lo pendiente. Extiende la regla de "el estado no usa color".
- **2026-09-09** · Afordancias de pulsación declaradas en `@layer base`.
  Motivo: Tailwind 4 quita el cursor por defecto y hacerlo por componente se
  desincroniza.
- **2026-09-09** · `--ink-faint` deja de usarse para texto: no llega a 4.5:1
  en ningún fondo. Sustituido por `--ink-muted` en fechas, contadores y
  marcadores de posición.
- **2026-09-10** · El recuento de la tarjeta se queda en la cifra desnuda. La
  columna ya dice qué se cuenta; «obras» seis veces no informaba.
- **2026-09-10** · Los ficheros de personaje incluyen su nombre, para que un
  cambio de personaje cambie la URL e invalide la caché de `next/image`.
- **2026-09-10** · El lobby de biblioteca pasa a dos columnas con tarjetas de
  personaje. Motivo: a tres columnas la tarjeta no daba sitio a nada más que un
  punto de color.
- **2026-09-10** · Controles interactivos sobre primitivas de Radix, con los
  tokens de este documento. Se descarta el CLI de shadcn/ui para no introducir
  un segundo sistema de variables de color.
- **2026-09-10** · Prohibidos los controles nativos de formulario.
- **2026-09-10** · El orden de las secciones del perfil lo decide cada miembro,
  arrastrando o con el teclado. `ProfilePreferences` gana `order`, opcional
  para que las preferencias ya guardadas sigan cargando.
- **2026-09-10** · La cabecera pasa a icono + palabra, con el icono activo en
  `Filled`. Añadido enlace de salto al contenido y `safe-area-inset` en la
  barra inferior.
- **2026-09-10** · Iconografía unificada en `reicon-react` (Reicon, MIT).
  Sustituye los glifos tipográficos, que no compartían rejilla ni trazo. Los
  seis estados pasan a iconos semánticos (`Star`, `Clock`, `Play`, `Check`,
  `X`, `Pause`) en lugar de marcas geométricas abstractas.
- **2026-09-10** · La cabecera marca la sección activa con `aria-current` más
  peso tipográfico, en la navegación de escritorio y en la barra móvil.
- **2026-09-10** · `<UserButton>` de Clerk sustituido por `UserMenu` propio.
  Motivo: era la única superficie de la aplicación fuera del sistema de
  diseño. Clerk queda como `signOut()`, sin interfaz visible.
- **2026-09-10** · El resplandor de la tarjeta de categoría pasa de la esquina
  superior izquierda a un escenario bajo el personaje, que crece un 4 % al
  señalarla. Supera al resplandor de esquina: en un rincón vacío se leía como
  una mancha.
- **2026-09-10** · Una sola `CategoryCard` para el lobby y el selector de
  «Añadir». Sustituye a `CategoryTile` y a las casillas con un cuadrado de
  color del selector.
- **2026-09-10** · El recuento sube a una ficha arriba a la izquierda. Pegado
  al nombre se leía como una nota al pie.
- **2026-09-10** · El fondo de los modales baja de `--ground-deep` al 85 % a
  55 % con desenfoque de 6 px, y el selector deja de atenuar la aplicación por
  su cuenta. Supera a «apagada, no teñida»: con las dos capas la pantalla
  quedaba en negro y se perdía el contexto.
- **2026-09-10** · Curva `--ease-out-quint` para las llegadas (modales y
  tarjetas). El `ease-out` de serie era demasiado débil para notarse.
- **2026-09-10** · La elevación de las tarjetas pulsables transiciona `scale`
  y solo se aplica con `motion-safe:`. En Tailwind 4 `scale-*` escribe la
  propiedad `scale`, no `transform`: la transición no la animaba (saltaba de
  golpe) y `motion-reduce:transform-none` no la anulaba.
- **2026-09-09** · La rejilla de miembros pasa a
  `repeat(auto-fill, minmax(260px, 1fr))`: dos columnas fijas dejaban la ficha
  a media anchura cuando el grupo es pequeño.
- **2026-09-09** · La ficha propia se distingue con etiqueta "Tú" y un borde en
  `--accent` al 40 %. El color no va solo: la etiqueta de texto lo acompaña.
- **2026-09-09** · La moldura se extrae a componente compartido y pasa a
  separar secciones, no solo a decorar estados vacíos.
- **2026-09-10** · Sistema de movimiento con Motion (ADR-0012). Vocabulario
  único en `shared/motion/tokens.ts`: curva, duraciones, salidas al 75 % de la
  entrada, muelle de maquetación sin rebote y cascada de listas con tope de 8
  elementos. Ver [Movimiento](#movimiento).
- **2026-09-10** · El `Dialog` anima también su salida (Motion,
  `AnimatePresence` + `forceMount`), no solo su entrada. El panel y el fondo
  dejan de desaparecer de golpe al cerrarse.
- **2026-09-10** · Los popovers (`UserMenu`, `Select`) entran y salen desde el
  origen de transformación que da Radix (`--radix-*-content-transform-origin`),
  para que visiblemente se despleguen desde el control que los abrió.
- **2026-09-10** · La barra de progreso deja de animar `width`. `width` es una
  propiedad de maquetación: cada fotograma forzaba un reflujo. Pasa a un
  relleno a ancho completo que transiciona `scale` con origen a la izquierda.
  *Superseded* por la entrada siguiente.
- **2026-09-10** · El relleno de la barra de progreso pasa de transicionar
  `scale` a revelarse con `clip-path: inset(...)`. Motivo: `scale` en el eje X
  deforma las esquinas redondeadas del propio relleno (una elipse, no un
  círculo, en porcentajes bajos); `clip-path` recorta una caja a ancho
  completo sin tocar su `border-radius`, así que el relleno es siempre un
  rectángulo redondeado de verdad. Supera a la entrada anterior.
- **2026-09-10** · El indicador de la pestaña activa (`SectionTabs`) pasa de un
  borde estático a un elemento con `layoutId`, que se desliza entre pestañas
  con el muelle de maquetación en vez de saltar.
- **2026-09-10** · Las listas y rejillas que ya tienen datos al montar (lobby
  de biblioteca, miembros, actividad, inicio, obras de una categoría, estado
  vacío) entran con una cascada CSS (`--animate-rise` + `--i`), nunca con
  Motion: son contenido de servidor en el primer pintado.
- **2026-09-10** · La rejilla de obras de una categoría reordena y filtra con
  `layout` de Motion y `AnimatePresence mode="popLayout"`: lo que deja de
  coincidir con el filtro se desvanece en vez de desaparecer de golpe, y el
  resto de la rejilla fluye a su nueva posición.
- **2026-09-10** · El indicador de arrastre de `EditSectionsPanel` pasa de
  `shadow-lg` (demasiado ancha, combinada con borde) a una sombra de ≤ 8 px de
  desenfoque y una elevación de `scale`, que no interfiere con el
  `transform`/`transition` propios de dnd-kit porque son propiedades CSS
  independientes.
- **2026-09-10** · Las etiquetas de los botones de envío («Enviar
  invitación», «Guardar cambios») funden con su versión pendiente
  («Enviando…», «Guardando…») en vez de sustituirla de golpe, mediante
  `shared/ui/pending-label.tsx`. Una copia invisible en flujo normal reserva
  el ancho, así el botón nunca cambia de tamaño al fundir.
- **2026-09-10** · Los overrides de `@keyframes rise` y `route-in` bajo
  `prefers-reduced-motion: reduce` pasan a declararse sin `@layer` (antes
  vivían dentro de `@layer base`). En CSS Cascade Layers una regla sin capa
  gana siempre a una con capa, sin importar el orden: con el override dentro
  de una capa, el movimiento reducido nunca llegaba a aplicarse.
- **2026-09-10** · El control «+1» de la tarjeta de «Sigue donde lo dejaste»
  (`HomeDashboard`) desaparece. Parecía pulsable (borde, relleno) pero no
  tenía `onClick` ni acción de actualizar progreso detrás: una afordancia
  falsa. La tarjeta conserva la barra de progreso, que además pasa a
  `shared/ui/progress-bar.tsx` (el mismo componente accesible del resto de la
  app) en lugar de una `<div>` con `width` sin semántica de `progressbar`.
- **2026-09-10** · `--animate-rise` deja de animar `filter: blur(4px)`.
  Motivo: las seis tarjetas de categoría del lobby y otras entradas en lista
  incluyen `next/image`; desenfocar múltiples imágenes ráster a la vez arriesga
  a saltos de fotogramas (jank) en dispositivos modestos, y la opacidad más el
  desplazamiento de 6 px ya comunican la entrada sin ese coste.
- **2026-09-10** · El `layoutId` del indicador de `SectionTabs` se acota por
  instancia con `LayoutGroup` (`id` de `useId()`). El literal compartido
  `"section-tab-indicator"` hacía que dos `SectionTabs` en la misma página
  (perfil propio y de un amigo, por ejemplo) intentaran fundir sus
  indicadores entre sí en vez de deslizarse cada uno por su cuenta.
- **2026-09-10** · El intercambio de etiqueta pendiente/inactiva de
  `PendingLabel` pasa a anunciarse con un `<output>` accesible, montado solo
  mientras `pending` es verdadero. El cambio era puramente visual: nada le
  decía a un lector de pantalla que el botón había entrado en estado
  pendiente. No se deja montado y vacío en reposo porque varios formularios
  que usan `PendingLabel` ya tienen su propia región de resultado
  (`<output>`, con rol `status` implícito) y un segundo `status` permanente
  colisiona con esa consulta.
- **2026-09-10** · Se adoptan cuatro componentes de Cult UI, copiados y
  adaptados a mano ([ADR-0013](decisions/0013-componentes-de-cult-ui.md)):
  `AnimatedNumber` (cifras que ruedan), `Drawer` (hoja inferior para
  «Añadir» en móvil), `InvitePopover` (el botón «Invitar» se transforma en
  panel) y el contenido de pestaña con dirección de `SectionTabs`. Ver
  [Componentes de Cult UI, adaptados a mano](#componentes-de-cult-ui-adaptados-a-mano).
- **2026-09-10** · `InviteMemberDialog` se retira, sustituido por
  `InvitePopover`. Un solo campo de email no necesitaba un modal centrado
  completo; un panel anclado al botón que lo abre es más directo, y en
  pantallas estrechas sigue cabiendo entero (`collisionPadding` de Radix).
- **2026-09-10** · `InvitePopover` deja de poner `aria-hidden`/`tabIndex`
  manuales en el disparador «Invitar» mientras el panel está abierto.
  *Supersedes* la fila de la tabla de arriba tal y como estaba escrita antes
  de esta fecha: el disparador sigue siendo el elemento con foco durante el
  primer fotograma tras abrir (antes de que el foco automático entre en el
  campo de email), y ocultar de `aria-hidden` el elemento que tiene el foco
  es una violación de ARIA que varios lectores de pantalla no recuperan bien.
  `Popover.Root modal` ya llama a `hideOthers` sobre todo lo que queda fuera
  del panel portado, así que el atributo manual era redundante además de
  inseguro.
- **2026-09-10** · `InvitePopover` deja de cerrarse solo 1.4 s después de un
  envío correcto. *Supersedes* el comportamiento introducido al migrar desde
  `InviteMemberDialog`: ese temporizador reintrodujo justo el problema que la
  migración pretendía evitar (cerrar en éxito encarece la segunda invitación
  a un reabrir completo). El panel ahora se mantiene abierto, limpia el campo
  de email y muestra la confirmación junto al formulario, lista para la
  siguiente invitación.
- **2026-09-10** · `SectionTabs` conecta cada pestaña con su panel
  (`aria-controls`/`id` únicos por instancia, `aria-labelledby` en el panel) y
  gana tabindex progresivo (Flecha izquierda/derecha, Inicio, Fin), siguiendo
  el patrón de pestañas del WAI-ARIA APG. Antes, `role="tab"` y `role="tabpanel"`
  no estaban asociados entre sí y cada pestaña era su propia parada de
  tabulación, en vez de una sola con flechas para moverse entre el resto.
- **2026-09-10** · La región que anuncia `PendingLabel` a lectores de
  pantalla se monta siempre (con `aria-live="polite"`, sin `role="status"`) y
  cambia de texto, en vez de insertarse y desmontarse con `pending`.
  *Supersedes* la entrada anterior sobre este mismo componente: una región
  `aria-live` insertada en el DOM después del primer pintado con frecuencia no
  se anuncia (el navegador necesita verla ya presente para empezar a
  vigilarla), y usar `role="status"` seguía colisionando con la región de
  resultado propia de los formularios que usan `PendingLabel`.
- **2026-09-10** · Tres tokens nuevos, `--danger-soft`, `--success-soft` y
  `--warning-soft`, derivados con `color-mix(in oklch, <color> 15%,
  transparent)` en `globals.css`. Sustituyen al patrón `bg-danger/15` que ya
  se usaba suelto en `InvitePopover`: un token por color en vez de repetir el
  porcentaje de opacidad en cada sitio que lo necesita.
- **2026-09-10** · Familia de componentes de estado en `shared/ui/state/`
  (docs/states.md): `StateSurface` (base interna, no se usa directamente),
  `ErrorState`, `ResourceUnavailableState`, `SessionExpiredState`,
  `AccountPendingState`, `InlineMessage`, `SupportReference`, `RetryButton`.
  Una familia pequeña, no un componente universal — la misma razón que ya
  llevó a preferir varios componentes de estado en vez de uno con decenas de
  props condicionales (ADR-0014 §4 lo descarta explícitamente). Reutilizan
  los tokens de tipografía, espaciado y color existentes: ningún token nuevo
  aparte de los `-soft` de arriba.
- **2026-09-10** · `OfflineNotice` (`shared/ui/offline-notice.tsx`, montado
  en `app/layout.tsx` sobre todo el shell): aviso persistente y no
  bloqueante de conexión, con `useOnlineStatus` (`useSyncExternalStore`
  sobre los eventos `online`/`offline`). Entra y sale con un desplazamiento
  de 6 px y una opacidad de 180 ms (`AnimatePresence`); nunca lleva `initial`
  en el primer pintado del servidor porque solo se monta por un cambio de
  estado del cliente, no en la carga inicial. No hay canal de toast (ADR-
  0014 §5): esto es lo que hay, no un tercero nuevo.
- **2026-09-10** · Límites y mensajes propios del contrato de errores
  (`shared/errors/`) fuera de `globals.css`: `problem.ts` (`ApiProblem`,
  `ProblemCode`, derivado del tipo generado del contrato, nunca escrito a
  mano), `normalize-error.ts` (`normalizeError`, la única entrada que
  interpreta un fallo), `messages.ts` (copia por `code`, exhaustiva por
  tipo) y `report-error.ts`. Documentado en detalle en
  [docs/states.md](states.md), no aquí: este archivo es de diseño visual, no
  del contrato de errores.
- **2026-09-10** · `OfflineNotice` y la cabecera dejan de disputarse el mismo
  `top: 0`. `useOfflineNoticeVisible` (`shared/lib/`) centraliza la lógica de
  «¿el aviso está en pantalla ahora?» que antes solo conocía `OfflineNotice`;
  `Navbar` la lee y cambia su propio `top-0` por `top-9` mientras el aviso
  está visible, en vez de que ambos se claven en `y=0` y el aviso (`z-50`)
  tape la cabecera (`z-30`). El aviso pasa a una altura fija de 36 px
  (`h-9`, `truncate`) para que ese desplazamiento sea siempre exacto, sin
  medir el DOM.
- **2026-09-10** · `RetryButton` gana `retryAfterSeconds`: con un
  `Retry-After` real del backend (429/503), el botón nace deshabilitado y lo
  explica una vez («Podrás reintentarlo en unos segundos», región
  `aria-live="polite"` con texto fijo, no un contador que se re-anuncia cada
  segundo) hasta que el plazo pasa. Antes `retryAfter` se calculaba y se
  tiraba: el backend pedía esperar y la web dejaba reintentar al instante.
- **2026-09-10** · Timeout distinto para lectura y escritura en `apiFetch`:
  `MUTATION_TIMEOUT_MS` (35 s) para cualquier `POST`/`PATCH`/subida, por
  encima del propio límite de 30 s del middleware `Timeout` de la API, sin
  tocar el `DEFAULT_TIMEOUT_MS` (10 s) de una lectura. Antes una foto de 5 MB
  en una conexión lenta podía agotar el plazo de 10 s aunque el servidor
  siguiera dispuesto a aceptarla.
- **2026-09-10** · `shared/ui/form-field.tsx`: el envoltorio de campo que
  comparten `invitation-form.tsx`, `invite-popover.tsx` y
  `edit-profile-dialog.tsx` — etiqueta, campo (render-prop, para no adivinar
  props de un `<input type=file>` frente a uno de texto), ayuda opcional y
  error opcional, con `aria-invalid`/`aria-describedby` calculados una sola
  vez. El error de campo usa `role="alert"`: aparece siempre como resultado
  directo de un envío.
- **2026-09-10** · `shared/ui/status-mark.tsx`: la pareja icono + palabra que
  `StatusBadge` (entradas de biblioteca) e `InvitationStatusBadge`
  (invitaciones) duplicaban por separado. Cada dominio conserva su propio
  catálogo de iconos, etiquetas y tamaño; solo la forma compartida (marca
  oculta a lectores de pantalla más palabra visible) vive en un solo sitio.
- **2026-09-10** · `EmptyState` gana `size`: `"section"` (por defecto, con
  moldura, para una categoría o página entera sin nada) e `"inline"` (sin
  moldura ni el `py-14`, para un resultado — una búsqueda o un filtro sin
  coincidencias — que vive dentro de una sección que ya tiene su propia
  cabecera). No se fusiona con `StateSurface`: ADR-0014 §4 descarta
  explícitamente un componente universal para esto.
- **2026-09-10** · El aviso de «no hay invitaciones pendientes»
  (`MembersDirectory`) deja el contorno discontinuo y pasa al `EmptyState`
  del sistema. Ese contorno no está asignado a este caso en ningún sitio de
  este documento — sí lo está, deliberadamente, a una fila de invitación
  pendiente (`pending-invitation-row.tsx`, «lo pendiente se lee como
  provisional») — así que aplicarlo también a un estado vacío habría sido
  una coincidencia visual, no una decisión.
- **2026-09-10** · Botón destructivo-secundario para la única decisión
  irreversible que introduce esta fase (descartar cambios sin guardar en
  `EditProfileDialog`): borde `border-danger/40`, texto `text-danger`,
  `hover:bg-danger-soft`. Mismo tratamiento de borde que el resto de botones
  secundarios de la aplicación, con el color cambiado al token de peligro en
  vez de inventar un tercer estilo de botón.
- **2026-09-10** · Ayuda de la foto de perfil corregida a «JPEG, PNG, WEBP o
  GIF, hasta 5 MB» — el texto anterior («JPG, PNG o WebP») omitía GIF, que
  `apps/api/internal/users.AllowedAvatarContentTypes` sí admite.
