# @freak-hub/contracts

El contrato HTTP entre `apps/web` y `apps/api`. `openapi.yaml` es la **fuente de
verdad**: primero se cambia aquí, después se implementa en los dos lados.

```sh
pnpm contracts:generate   # regenera generated/api.ts
pnpm --filter @freak-hub/contracts validate
```

`generated/api.ts` está versionado a propósito: así el CI detecta cuando alguien
cambia un endpoint sin regenerar los tipos.
