# ADR-0005 · Las notas de una entrada son públicas

**Estado**: Aceptada · 2026-09-01

## Contexto

`LibraryEntry.note` guarda el comentario corto que alguien escribe sobre una
obra. [domain.md](../domain.md) dejaba abierto si la leía solo quien la escribe
o todo el grupo, y la marcaba como privada por defecto mientras se decidía.

## Decisión

**La nota es pública**: la ve cualquier miembro del grupo, sin ajuste de
privacidad por entrada.

## Consecuencias

**A favor**

- Encaja con lo que es Freak Hub: una biblioteca *compartida*, no un diario
  personal. Una nota es contexto para el resto del grupo, no una confesión.
- Alimenta el feed de actividad y las recomendaciones sin trabajo extra: "X
  terminó Y" ya puede llevar el porqué.
- Sin un `visibility` por fila ni una pantalla de ajustes que mantener.

**En contra**

- No hay forma de dejar una nota solo para uno mismo. Quien quiera apuntes
  privados necesita otro sitio.
- Hay que decirlo con claridad en la UI antes de escribir, para que nadie
  descubra tarde que lo que escribió lo lee todo el grupo.

**Descartado**

- *Privada por defecto, con un botón para hacerla pública*: es la opción más
  flexible, pero añade un estado y una decisión a cada entrada para un
  problema que, a la escala de un grupo cerrado de amigos, no existe todavía.
  Si la necesidad real aparece, es un ADR nuevo.
