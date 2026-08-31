# Documentación de Freak Hub

Todo lo que hay que saber antes de escribir una línea de código. Cada documento
responde a una pregunta concreta; si tu duda no está aquí, probablemente falte
un documento.

| Documento | Responde a… |
| :--- | :--- |
| [product.md](product.md) | Qué es Freak Hub, para quién y qué NO es |
| [domain.md](domain.md) | El modelo: categorías, entradas, estados, valoraciones, listas |
| [architecture.md](architecture.md) | Cómo encajan la web, la API y la base de datos |
| [auth.md](auth.md) | Clerk, sesiones, invitaciones y el perímetro de seguridad |
| [api.md](api.md) | El contrato HTTP y cómo evolucionarlo |
| [data-model.md](data-model.md) | Esquema, migraciones y convenciones de SQL |
| [catalogs.md](catalogs.md) | Las APIs externas de anime, cine, juegos y TCG |
| [development.md](development.md) | Cómo levantar el proyecto y trabajar día a día |
| [testing.md](testing.md) | La estrategia de tests y el flujo TDD |
| [deployment.md](deployment.md) | Cómo se despliega en el VPS |
| [roadmap.md](roadmap.md) | Qué está hecho y en qué orden viene lo demás |
| [decisions/](decisions/) | Registro de decisiones de arquitectura (ADR) |

## Convenciones de esta documentación

- **Español** para la prosa; **inglés** para código, identificadores, nombres de
  ficheros, mensajes de commit y descripciones del repositorio en GitHub.
- Cuando un documento y el código se contradigan, **el código gana** y el
  documento es un bug: arréglalo en el mismo cambio.
- Las decisiones con alternativas reales se registran como ADR en
  [decisions/](decisions/), no como un párrafo suelto perdido en un documento.
