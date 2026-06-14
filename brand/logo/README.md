# cazary.ai — Logos

Coloca los archivos PNG en esta carpeta con exactamente estos nombres:

## Formato Cuadrado (1:1) — Para avatar, favicon, app icon
```
logo-icon-dark.png          ← Fondo negro puro, texto blanco, alto contraste
logo-icon-dark-ghost.png    ← Fondo negro puro, texto gris/semitransparente
```

## Formato Rectangular (Horizontal) — Para sidebar, header, emails
```
logo-rect-navy.png          ← Fondo #0F172A (slate oscuro), texto blanco  ← USO PRINCIPAL EN APP
logo-rect-black.png         ← Fondo negro puro, texto blanco
logo-rect-black-ghost.png   ← Fondo negro puro, texto muted/ghost
logo-rect-light.png         ← Fondo blanco, texto #1E293B                 ← USO EN LIGHT MODE
```

## Uso en código
- **Sidebar dark mode** → `logo-rect-navy.png`
- **Sidebar light mode** → `logo-rect-navy.png` (el sidebar siempre es dark)
- **Reportes / PDFs** → `logo-rect-light.png`
- **Favicon / pestaña** → `logo-icon-dark.png`
- **Open Graph / redes** → `logo-icon-dark.png`

## Cómo agregar los archivos
1. Abre Finder
2. Navega a `proyecto-linkedin-ai/brand/logo/`
3. Arrastra los PNGs exportados con los nombres exactos de arriba
