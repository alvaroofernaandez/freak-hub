# @freak-hub/assets

Genera el banner del README y la imagen social del repositorio, y valida los
diagramas Mermaid de toda la documentación.

```sh
pnpm assets:render     # docs/assets/hero.png y docs/assets/og.png
pnpm diagrams:check    # parsea cada bloque ```mermaid del repo
```

## La dirección visual

**Pantalla de selección de personaje de recreativa.** Los amigos son la party: es
lo que conecta la estética con el producto (un grupo cerrado) en vez de decorar por
decorar.

La paleta sale del propio arte, no de un catálogo:

| Rol | Color | De dónde sale |
| :--- | :--- | :--- |
| Acento primario | ámbar `oklch(0.80 0.150 78)` | El dorado de Edward |
| Acento secundario | verde ácido `oklch(0.80 0.190 148)` | El pelo de Gon |
| Acento terciario | cian `oklch(0.80 0.130 225)` | Los ojos de Killua |
| Alarma | carmesí `oklch(0.62 0.190 22)` | El abrigo, para el "solo por invitación" |
| Fondo | `oklch(0.145 0.022 275)` | Casi negro azulado |

Tipografía: **Bungee** (marquesina), **Sora** (texto), **JetBrains Mono**
(etiquetas). La moldura tricolor del borde inferior es una por miembro de la party.

## Las dos salidas, y por qué son distintas

| | `hero.png` | `og.png` |
| :--- | :--- | :--- |
| Tamaño | 1800 × 470 | 1280 × 640 |
| Fondo | transparente en las esquinas | opaco |
| Dónde | cabecera del README | Settings → Social preview |

El hero conserva las esquinas con alfa para asentarse igual de bien en el tema
claro y en el oscuro de GitHub. La OG es opaca porque las redes sociales
recodifican a JPEG y convertirían la transparencia en un borde negro.

## Subir la imagen social

GitHub **no expone API** para el social preview, así que ese paso es manual:
`Settings → General → Social preview → Upload an image` con `docs/assets/og.png`.

## Cambiar el arte

Sustituye `docs/assets/char-*.png` (PNG con transparencia real) y ajusta en
`banner.html` las variables `--ed-w/-h` y `--duo-w/-h` **respetando el ratio
nativo** de cada imagen: el encuadre usa `object-fit: contain`, así que un ratio
equivocado deja aire en vez de recortar.
