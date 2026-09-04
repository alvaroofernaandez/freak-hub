# ADR-0010 · Estadísticas personales y secciones configurables en el perfil

**Estado**: Aceptada · 2026-09-03

## Contexto

[ADR-0009](0009-arquitectura-de-informacion.md) dejó la pantalla de perfil
como "su biblioteca pública, favoritos y actividad reciente", y
[screens.md](../screens.md) marcaba explícitamente "ranking o estadísticas
del grupo" como algo que la aplicación **no** construye, por ser una
métrica de vanidad.

Al hacer los wireframes de baja fidelidad surgió un hueco real: con
valoraciones, favoritos y recomendaciones dirigidas ya en el dominio, un
perfil que solo lista obras se queda corto. Hacía falta un sitio para verlo
agregado — pero sin convertirlo en la clase de ranking que el producto ya
había descartado.

## Decisión

El perfil de un miembro (el tuyo o el de otra persona) gana tres secciones
más, alternables con el mismo selector, junto a la ya existente
**Biblioteca**:

- **Actividad** — gráficas y estadísticas personales (obras terminadas,
  valoración media…), filtrables por categoría.
- **Top** — las obras mejor valoradas de esa persona, filtrables por
  categoría.
- **Recomendaciones** — las recomendaciones enviadas y recibidas entre
  quien mira el perfil y su dueño, con el motivo de cada una.

**Estas estadísticas son siempre personales, nunca comparativas.** No hay
posición, ni ranking del grupo, ni nadie "por encima" de otro miembro — solo
los datos de una persona sobre sí misma.

Cada miembro puede elegir qué secciones se muestran y cuál se abre por
defecto **al entrar en su propio perfil**. Es una preferencia solo suya: no
cambia lo que ve un amigo cuando visita ese perfil, que siempre ve las
cuatro secciones disponibles.

## Consecuencias

**A favor**

- Da sentido a datos que ya se registran (progreso, valoración, favoritos)
  sin inventar una tabla nueva.
- Al ser siempre personales, no choca con "nada de presión social"
  (product.md): nadie compite con nadie, cada quien ve solo lo suyo.
- Cierra un hueco real del perfil sin reabrir la pregunta de si debería
  haber un ranking del grupo — esa pregunta sigue cerrada en contra.

**En contra**

- Amplía `screens.md` justo después de cerrarlo: hay que aceptar que la
  lista de pantallas no queda fija para siempre, cambia cuando el wireframe
  descubre un hueco real.
- La preferencia de sección predeterminada añade un estado propio por
  miembro que persistir; el modelo concreto (¿campo en `members`? ¿tabla
  aparte?) queda para cuando se construya la pantalla, no es parte de esta
  decisión.

**Descartado**

- *Que el top o las estadísticas comparen entre miembros* (un ranking real
  del grupo): es exactamente la métrica de vanidad que `product.md`
  descarta.
- *Que la sección predeterminada también decida lo que ve un visitante*: se
  descarta porque mezclaría una preferencia personal con la presentación
  pública del perfil, y hoy el perfil se presenta igual a cualquiera que lo
  visite.
