# ADR-0003 · Cualquier miembro puede invitar, sin cupo

**Estado**: Aceptada · 2026-08-31

## Contexto

El registro es cerrado. Quedaba decidir quién abre la puerta: solo un
administrador, cualquier miembro con un cupo, o cualquier miembro sin límite.

## Decisión

**Cualquier miembro invita, sin cupo**, y se registra quién invitó a quién.

## Consecuencias

**A favor**

- El grupo crece como crecen los grupos de amigos: por confianza, sin pedir
  permiso a nadie.
- Nadie es cuello de botella.
- Sin cupos que administrar, ni pantalla de gestión, ni casos límite de "me he
  quedado sin invitaciones".

**En contra**

- Un solo miembro podría, en teoría, meter a mucha gente. Se asume: es un grupo de
  amigos, no una red abierta.
- No hay defensa técnica contra un bucle accidental o un miembro descuidado. Por
  eso el **rate limiting sobre `POST /v1/invitations` es la deuda técnica más
  clara** que deja esta decisión ([api.md](../api.md)).

**Mitigación**

`invitations.inviter_id` guarda la cadena completa de quién trajo a quién. Sin
límite, pero con trazabilidad: si alguien mete a quien no debe, se ve.

**Descartado**

- *Solo administrador*: más seguro y más burocrático; convierte a una persona en
  portera del grupo.
- *Cupo por miembro*: frena el abuso, pero añade una regla que explicar y
  administrar para un problema que a esta escala no existe.
- *Código compartido*: cómodo de repartir por WhatsApp y trivial de filtrar, sin
  saber quién lo usó.
