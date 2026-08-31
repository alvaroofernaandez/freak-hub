# ADR-0002 · Clerk para autenticación

**Estado**: Aceptada · 2026-08-31

## Contexto

Hace falta registro por invitación, login social (Google y Discord), contraseñas
seguras y protección contra bots. Implementarlo a mano son semanas de trabajo y,
sobre todo, es el área donde un error propio se paga más caro.

## Decisión

**Clerk** como proveedor de identidad, en modo `restricted`. Postgres guarda una
proyección local (`members`) sincronizada por webhooks.

## Consecuencias

**A favor**

- El modo `restricted` es exactamente el requisito de "solo por invitación", y lo
  aplica Clerk, no nuestro código.
- Social, verificación de correo, HIBP, bloqueo de cuenta y CAPTCHA vienen dados.
- La configuración de la instancia es **reproducible por CLI** (`clerk config
  patch`), no clics en un panel.
- La API verifica los JWT contra el JWKS: sin llamadas a Clerk por petición.

**En contra**

- Dependencia de un tercero para entrar en el producto.
- El plan gratuito tiene un tope de usuarios activos. Para decenas de amigos sobra.
- Hay una ventana entre el registro y la llegada del webhook en la que la sesión
  es válida pero el miembro aún no existe. Se afronta explícitamente con
  `404 unknown_identity`.

**Cómo se limita la exposición**

El dominio **no importa el SDK de Clerk**. `internal/auth` define el puerto
`Verifier` y el adaptador vive en `internal/platform/clerkadapter`. Cambiar de
proveedor sería reescribir ese adaptador y los webhooks, no el dominio.
