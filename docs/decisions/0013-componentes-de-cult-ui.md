# ADR-0013 · Componentes de Cult UI, copiados y adaptados a mano

**Estado**: Aceptada · 2026-09-10

## Contexto

[Cult UI](https://github.com/nolly-studio/cult-ui) (MIT) es una colección de
componentes con movimiento construidos sobre Motion y Tailwind. Varios resuelven
interacciones que la plataforma necesita y que costaría diseñar desde cero.

Dos restricciones condicionan cómo se adoptan:

- [design.md](../design.md) **prohíbe el CLI de shadcn/ui**. Cult UI se
  distribuye con él, y sus componentes asumen las variables de color de shadcn
  (`bg-background`, `text-foreground`, `bg-muted`…), que compiten con los
  tokens del proyecto.
- Los componentes más llamativos del catálogo apuntan a funciones que todavía
  no tienen interfaz: cambiar estado, valorar, marcar favorito, recomendar y
  escribir notas. La ficha de obra devuelve 404 hasta que exista el endpoint de
  biblioteca.

## Decisión

Se adoptan **cuatro** componentes, cada uno atado a una función que ya existe:

| Componente | Dónde |
| :--- | :--- |
| `animated-number` | Recuentos del lobby, estadísticas del perfil y panel de inicio |
| `family-drawer` | «Añadir» en móvil, como hoja inferior; en escritorio sigue el modal |
| `popover-form` | «Invitar»: el botón se transforma en el campo de email |
| `direction-aware-tabs` | Pestañas del perfil: el contenido entra desde el lado hacia el que navegas |

**Se copian y se adaptan a mano**, nunca con el CLI. La adaptación es parte de
la adopción, no un paso opcional:

- Tokens del proyecto en lugar de las variables de shadcn.
- Iconos de `reicon-react` en lugar de `lucide-react`.
- `m.*` en lugar de `motion.*`, porque la raíz usa `LazyMotion` en modo
  estricto ([ADR-0012](0012-animaciones-con-motion.md)).
- Muelles sin rebote y las duraciones de `shared/motion/tokens.ts`.
- Movimiento reducido. Ninguno de los originales lo contempla.
- Lo que falte de accesibilidad, añadido: `popover-form` no gestiona `Escape`
  ni el foco, así que se monta sobre `@radix-ui/react-popover`.
- Un número renderizado en el servidor muestra su valor real desde el primer
  pintado; solo se animan los cambios posteriores.

Cada componente adaptado conserva un comentario con su origen (ruta en el
repositorio de Cult UI) para poder comparar con nuevas versiones.

Dependencias nuevas: `vaul` (hoja inferior, de Emil Kowalski) y
`@radix-ui/react-popover`. `react-use-measure`, que el original de
`family-drawer` usa para animar `height`, no se instala: ese `height` es
justo la propiedad de maquetación que `direction-aware-tabs` (misma familia
de componentes) también descarta, así que no hay nada que medir.

## Consecuencias

**A favor**

- Interacciones probadas en producción por otros, sin diseñarlas desde cero.
- El código queda en el repositorio y bajo nuestras reglas: tokens, iconos,
  movimiento y accesibilidad iguales que en el resto de la aplicación.
- La acción principal del producto, añadir una obra, gana una hoja inferior en
  móvil, donde el pulgar llega sin estirarse.

**En contra**

- Dos dependencias más.
- Las mejoras de Cult UI no llegan solas: actualizar un componente es volver a
  comparar y adaptar a mano.
- La adaptación cuesta más que copiar y pegar, y es donde se concentra el
  trabajo.

**Descartado por ahora**

- *`popover-form` para notas, `floating-panel`, `onboarding`, `side-panel`*:
  encajan con valorar, anotar, la ficha de obra o la primera entrada de un
  miembro, que todavía no existen. Se reconsideran cuando exista la función.
- *`shift-card` en la tarjeta de obra*: escondería el estado tras el hover, y
  en móvil se perdería.
- *`expandable`*: su muelle rebota (`bounce: 0.2`), contra la regla de
  movimiento del proyecto.
- *`morph-surface`, `toolbar-expandable`, `family-button`, `dock`*: no hay
  ninguna superficie de la aplicación que los necesite. `morph-surface`,
  además, registra tres listeners globales en `document`.
- *Instalar con el CLI de shadcn*: prohibido por [design.md](../design.md).
