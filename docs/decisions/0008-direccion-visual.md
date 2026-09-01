# ADR-0008 · Dirección visual: "character select", oscuro por defecto

**Estado**: Aceptada · 2026-09-01

## Contexto

`globals.css` llevaba tokens explícitamente provisionales desde el principio
del proyecto, y el roadmap marcaba la dirección visual como la primera
decisión pendiente antes de construir pantallas de verdad. Al mismo tiempo,
el banner del README (`tools/assets/banner.html`) ya tenía una identidad
propia y pública: oscura, con estética de pantalla de selección de personaje
arcade, sobre arte de Fullmetal Alchemist y Hunter × Hunter, con su propia
paleta oklch (hue 272) y su propio wordmark en Bungee.

La pregunta no era "qué estética elegimos" desde cero, sino si la aplicación
debía vivir en la misma línea que ese banner o abrir una identidad distinta
para las pantallas de uso diario.

## Decisión

**La aplicación extiende la identidad del banner en vez de sustituirla.**
Oscuro por defecto, con tema claro disponible. La paleta neutra (hue 272) se
completa, no se reemplaza. Los tres colores de personaje del banner (Ed,
Gon, Killua) se convierten en tres de los seis colores de categoría del
producto, completados con tres tonos más siguiendo la misma fórmula. El
estado de una entrada se comunica con icono y etiqueta, nunca con color, para
no competir con el color de categoría. Tipografía: Bungee solo para el
wordmark, Sora para la interfaz (sustituye a Inter), JetBrains Mono para
datos y etiquetas, como ya se usa hoy.

Detalle completo, con los valores de cada token, en [design.md](../design.md).

## Consecuencias

**A favor**

- Una sola identidad visual en todo el repositorio: quien ve el README y
  luego abre la app reconoce el mismo sitio, no dos marcas distintas.
- No hay que decidir una paleta desde cero: la mitad del trabajo ya estaba
  hecho y validado en el banner.
- El color de categoría y el estado de una entrada nunca compiten por la
  misma señal visual, porque se resolvió explícitamente cuál usa color y
  cuál usa icono.

**En contra**

- La estética "arcade/otaku" es una apuesta de carácter fuerte: no es un
  fondo neutro que envejezca sin opinión. Si el grupo cambia de gusto, tocará
  rehacer la paleta entera, no solo un acento.
- Cambiar de Inter a Sora en `app/layout.tsx` es un cambio de código real,
  no solo de documentación, y queda pendiente de aplicar.

**Descartado**

- *Dirección neutra tipo herramienta de producto* (Linear, Notion): más
  segura y más fácil de mantener con el tiempo, pero desaprovecha la
  identidad que el banner ya había validado en público.
- *Dirección editorial tipo catálogo* (Letterboxd, AniList): encaja bien con
  seis categorías de contenido, pero rompe con el tono "gamer/otaku" que el
  grupo ya reconoce en el README.
