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
| Esquina | Resplandor radial del color de la categoría desde la esquina superior izquierda, cubriendo toda la tarjeta y apagándose al 62 % |
| Nombre | En el color de su categoría, en Bungee |
| Recuento | Solo la cifra, en JetBrains Mono, junto al nombre. La palabra «obras» vive en un `sr-only` para el lector de pantalla |
| Personaje | Recortado, **pegado a la esquina inferior derecha**, al 52 % del ancho |
| Fundido | `mask-image` de izquierda a derecha: la imagen se desvanece antes de llegar al texto |

El resplandor de esquina **sustituyó al punto de color** que había antes: con
el título ya escrito en el color de la categoría, el punto repetía la misma
información en el mismo sitio sin añadir nada.

Se construye con `radial-gradient` y `color-mix` en línea, no con utilidades
`from-*`/`to-*`: un degradado lineal en una caja cuadrada deja **bordes duros
visibles** en la esquina, que es justo lo que no se quiere. La función vive en
`features/library/lib/category-art.ts`.

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
| Fondo | `--ground-deep` al 85 %: la pantalla de detrás se lee como apagada, no teñida |
| Cerrar | Clic fuera, `Escape`, o el botón de cancelar |
| Foco | Atrapado dentro mientras está abierto; al cerrar vuelve a lo que lo abrió |
| Desplazamiento | Bloqueado detrás del modal |
| Entrada | 150 ms: fundido del fondo y fundido con escala de 0.98 del panel |

El `Dialog` es controlado desde fuera y no usa `Dialog.Trigger`, así que Radix
no puede saber qué lo abrió: el componente recuerda el elemento activo al
abrirse y le devuelve el foco al cerrarse.

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

`--ink-faint` **no alcanza el mínimo en ningún fondo**, ni siquiera el 3:1 de
texto grande sobre `surface-raised`. Hoy **no se usa como color de texto en
ningún componente**: queda disponible solo para bordes y fondos. Cualquier
texto, por secundario que sea (fechas, contadores, textos de ayuda, marcadores
de posición, glifos visibles como ✕ o →), usa `--ink-muted` como mínimo.

Lo vigila `apps/web/src/app/token-contrast.test.ts`: la suite falla si alguien
vuelve a pintar texto con él. jsdom no aplica la hoja de estilos, así que el
test escanea el código fuente en vez de renderizar.

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
- **2026-09-09** · La rejilla de miembros pasa a
  `repeat(auto-fill, minmax(260px, 1fr))`: dos columnas fijas dejaban la ficha
  a media anchura cuando el grupo es pequeño.
- **2026-09-09** · La ficha propia se distingue con etiqueta "Tú" y un borde en
  `--accent` al 40 %. El color no va solo: la etiqueta de texto lo acompaña.
- **2026-09-09** · La moldura se extrae a componente compartido y pasa a
  separar secciones, no solo a decorar estados vacíos.
