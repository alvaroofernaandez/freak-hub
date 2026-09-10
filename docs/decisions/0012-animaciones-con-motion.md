# ADR-0012 · Animaciones con Motion; la pulsación sigue en CSS

**Estado**: Aceptada · 2026-09-10

## Contexto

Hasta ahora la plataforma solo animaba con CSS escrito a mano: la pulsación
global, la entrada de los modales, el `status-pop` de los estados y el hover de
las tarjetas. Eso deja fuera todo lo que depende de que React monte o desmonte
algo:

- **Las salidas.** Cuando Radix desmonta un modal, el menú de sesión o un
  desplegable, el elemento desaparece de golpe. Con CSS no hay forma limpia de
  retrasar el desmontaje hasta que termine la animación.
- **La aparición de listas y rejillas**, que llegan de una vez, sin ritmo.
- **Las transiciones de estado con maquetación**, como el indicador de la
  pestaña activa, que salta en lugar de deslizarse.

La personalidad del movimiento ya está decidida: **pulido y rápido**. Entre 150
y 250 ms, desplazamientos cortos, sin rebotes ni coreografías de carga
([design.md](../design.md)).

## Decisión

**Motion** (`motion`, el antiguo Framer Motion) para todo movimiento que
dependa del ciclo de vida de React: salidas, contenido que aparece y
desaparece, y animaciones de maquetación.

- **Las entradas al montar se hacen con CSS.** Motion renderiza en el servidor
  el estado inicial de una animación (opacidad 0), así que una lista que
  entrara con Motion quedaría invisible hasta la hidratación, o para siempre si
  falla el JavaScript. Un `@keyframes` con `animation-fill-mode: backwards`
  corre desde el primer pintado y no esconde nada.

- **Carga diferida.** `LazyMotion` con el componente `m` en modo `strict`. Las
  funciones (`domMax`, que incluye maquetación) se cargan de forma asíncrona
  después de la hidratación. El arranque paga unos 4,6 kB en lugar de 34 kB.
- **Movimiento reducido en un solo sitio.** `MotionConfig reducedMotion="user"`
  en la raíz: si el sistema pide menos movimiento, Motion anula
  desplazamientos, escalas y maquetación, y conserva los fundidos.
- **Un solo vocabulario.** Duraciones, curvas y variantes viven en
  `shared/motion/tokens.ts`. Ningún componente escribe sus propios valores.
- **CSS para lo que no depende del montaje.** La pulsación (100 ms, global en
  `globals.css`), el hover y los cambios de color no pasan a JavaScript: son lo
  más frecuente de la aplicación y CSS lo resuelve sin coste.
- **Las páginas siguen siendo de servidor.** El movimiento vive en componentes
  cliente pequeños que envuelven contenido renderizado en el servidor.

## Consecuencias

**A favor**

- Salidas animadas en las primitivas de Radix con `forceMount` y
  `AnimatePresence`, una integración que Motion documenta.
- Animaciones interrumpibles: si abres y cierras un menú deprisa, la animación
  cambia de rumbo en lugar de encolarse.
- Una única política de movimiento reducido, en vez de un `motion-reduce:` por
  componente que alguien puede olvidar.
- Animaciones de maquetación (`layout`, `layoutId`) sin medir el DOM a mano.

**En contra**

- Una dependencia nueva, unos 30 kB cuando termina la carga diferida.
- Más componentes cliente, aunque pequeños y en las hojas del árbol.
- Las salidas dejan de ser síncronas. Los tests esperan a que el elemento
  desaparezca en lugar de comprobarlo en el mismo instante, y la suite salta
  las animaciones con la configuración global de Motion en `vitest.setup.ts`.

**Descartado**

- *GSAP*: imperativa y pensada para *timelines* y *scroll*. No tiene un modelo
  de montaje y desmontaje de React, así que las salidas habría que orquestarlas
  a mano.
- *React Spring*: buena física, pero sin un equivalente maduro a
  `AnimatePresence` ni a las animaciones de maquetación.
- *AutoAnimate*: mínima y sin configuración, a cambio de no controlar curvas ni
  duraciones y de no poder animar portales de Radix.
- *Solo CSS*: posible para las entradas, frágil para las salidas. Obligaría a
  retrasar el desmontaje a mano en cada componente que las necesite.
