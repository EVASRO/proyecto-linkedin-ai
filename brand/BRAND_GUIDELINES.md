# cazary.ai — Brand Guidelines
> Fuente oficial: `cazary-brand-guidelines.pdf` · Versión 2026

---

## Identidad

**Nombre:** cazary.ai  
**Dominio:** cazary.ai  
**Categoría:** SaaS B2B · Prospección Inteligente en LinkedIn

---

## El Logo

Wordmark con la letra **'Z'** como identificador de marca. La Z integra un gradiente **Cobalto → Cian** con una flecha ascendente que comunica crecimiento e inteligencia artificial.

### Variantes disponibles
| Archivo | Fondo | Uso |
|---------|-------|-----|
| `logo/cazary-dark-bg.png` | `#0F172A` / oscuro | Dashboard, sidebar, emails dark |
| `logo/cazary-light-bg.png` | `#F8FAFC` / blanco | Reportes, PDFs, emails light |
| `logo/cazary-black-bg.png` | Negro puro | Redes sociales, presentaciones |
| `logo/cazary-icon-dark.png` | Negro puro | Avatar, favicon cuadrado |
| `logo/cazary-icon-dark2.png` | Negro muy oscuro | Variante icono |

### Reglas de uso del logo
- ❌ No cambiar el gradiente de la Z/flecha
- ❌ No usar la versión dark sobre fondo claro
- ✅ Exportar como **SVG inline** en producción para cambios dinámicos de fondo
- ✅ Mantener peso **Bold / SemiBold** en cualquier re-renderización tipográfica

---

## Paleta de Colores

### Identidad de Marca (Inmutable)
| Token | Hex | Uso |
|-------|-----|-----|
| `--cazary-cobalt` | `#2563EB` | Inicio gradiente / cuerpo de la 'Z' |
| `--cazary-cyan` | `#06B6D4` | Fin gradiente / flecha / acentos IA |

### UI — Modo Oscuro (Default)
| Token | Hex | Uso |
|-------|-----|-----|
| `--background` | `#0F172A` | Fondo principal de la app |
| `--surface` | `#1E293B` | Cards, paneles, modales |
| `--border` | `#2D3F55` | Bordes de componentes |
| `--foreground` | `#F8FAFC` | Texto principal |
| `--foreground-muted` | `#94A3B8` | Texto secundario |
| `--sidebar-bg` | `#080F1E` | Sidebar (siempre dark) |

### UI — Modo Claro
| Token | Hex | Uso |
|-------|-----|-----|
| `--background` | `#F8FAFC` | Fondo principal |
| `--surface` | `#FFFFFF` | Cards y paneles |
| `--foreground` | `#1E293B` | Texto principal |

### Estados Semánticos
| Token | Hex | Uso |
|-------|-----|-----|
| `--success` | `#10B981` | Confirmaciones, métricas positivas |
| `--warning` | `#F59E0B` | Alertas, límites cercanos |
| `--danger` | `#EF4444` | Errores, cancelaciones |
| `--info` | `#06B6D4` | Info IA, tips (mismo que accent) |

---

## Tipografía

**Orden de prioridad:**
1. **Inter** (Google Fonts — recomendada)
2. Plus Jakarta Sans
3. Helvetica Neue

**Pesos:**
- Logotipo: **Bold (700)** o **SemiBold (600)**
- Headings UI: **SemiBold (600)**
- Body: **Regular (400)** / **Medium (500)**

---

## Principios de Diseño UI

1. **Dark-first** — El dark mode es el modo por defecto y principal
2. **Sidebar siempre dark** — Incluso en light mode, el sidebar mantiene `#0F172A`
3. **Gradiente de marca como acento** — Usar en CTAs primarios, estados activos, y elementos IA
4. **Minimalismo inteligente** — Referencia: ElevenLabs, Linear, Vercel
5. **Densidad funcional** — Referencia: Apollo.io (mucha data, sin saturar)

---

## Archivos de Tokens

```
brand/
  tokens/
    brand-tokens.css    ← Variables CSS para globals.css
    brand-tokens.ts     ← Constantes TypeScript + Tailwind extension
  logo/
    cazary-*.png        ← Variantes del logo
  cazary-brand-guidelines.pdf  ← Manual oficial
  BRAND_GUIDELINES.md  ← Este archivo
```

---

*cazary.ai © 2026 — Marca Registrada de Software B2B de Prospección Inteligente*
