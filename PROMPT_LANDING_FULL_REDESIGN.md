PROMPT MAESTRO — CAZARY.AI LANDING COMPLETA + LOGIN
Redesign total con animaciones, interacciones y dark mode

---

CONTEXTO

Producto: cazary.ai — SaaS B2B de automatizacion de prospeccion en LinkedIn con IA.
Competencia directa: Apollo.io, ElevenLabs, Waalaxy, Dripify.
Estandar visual objetivo: ElevenLabs.io (dark, minimalista, premium, animado).
Stack: Next.js 14 App Router, TypeScript, Tailwind CSS, framer-motion, shadcn/ui.
Paleta de marca (NO usar otros colores principales):
  - Gradiente: #2563EB a #06B6D4
  - Fondo dark: #0F172A
  - Surface: #1E293B
  - Border: #2D3F55
  - Texto: #F8FAFC
  - Texto muted: #94A3B8
  - Success: #10B981

El design system ya fue aplicado en globals.css con las variables CSS correctas.
El hero y header ya fueron rediseniados y estan funcionando.

---

TAREA 0 — CORRECCION INMEDIATA (hacer primero)

En src/components/layout/marketing-header.tsx, en el componente Image del logo,
cambiar width={120} height={32} a width={168} height={45}.
Tambien actualizar className a "h-11 w-auto object-contain".
Esto aumenta el logo aproximadamente un 40% para mejor visibilidad.

---

TAREA 1 — FEATURES SECTION
Archivo: src/components/landing/features.tsx

Redisenar completamente con estas especificaciones:

ESTRUCTURA:
- Fondo: var(--background) — #0F172A
- Seccion con paddingY de 32 en mobile, 40 en desktop
- Label superior: "CARACTERISTICAS" en uppercase tracking-widest, color con gradiente de marca usando bg-clip-text
- Titulo h2: texto blanco, bold, 3xl en mobile, 4xl en desktop
- Subtitulo: color var(--foreground-muted)

GRID DE CARDS:
- 6 cards en grid 1 columna mobile, 2 columnas tablet, 3 columnas desktop
- Cada card tiene:
  - Fondo: var(--surface) con border var(--border)
  - Border-radius: rounded-2xl
  - Padding: p-6
  - En hover: border cambia a rgba(37,99,235,0.4), fondo cambia a color intermedio entre surface y primary-soft, sombra con glow sutil
  - Transicion en todos los estados: duration-300 ease-out
  - Icono: contenedor de 48x48px con fondo gradient de marca (from-[#2563EB] to-[#06B6D4]) y opacity-10, icono en color gradient (text con gradiente usando bg-clip-text trick), rounded-xl
  - Titulo: text-base font-semibold text-[var(--foreground)]
  - Descripcion: text-sm text-[var(--foreground-muted)] leading-relaxed mt-2

ANIMACIONES CON FRAMER-MOTION:
- El contenedor del grid usa variants con staggerChildren: 0.08
- Cada card usa motion.div con initial opacity:0 y y:20, animate opacity:1 y:0
- Usar whileInView en lugar de animate para que se active al hacer scroll
- viewport: { once: true, margin: "-50px" }
- Cada card tiene whileHover: scale: 1.01 con spring stiffness:400

ICONOS:
- Reemplazar los colores hardcodeados de indigo/emerald/violet/blue/amber/rose
- Todos los iconos ahora usan el gradiente de marca como color base
- Implementar con un wrapper SVG que use fill="url(#grad)" o con text-transparent bg-gradient-to-r bg-clip-text segun aplique

ACTUALIZACION DE CONTENIDO:
- Cambiar todas las menciones de "NexusAI" por "cazary.ai" en el texto descriptivo

---

TAREA 2 — COMPARISON TABLE (dentro de pricing.tsx)
Archivo: src/components/landing/pricing.tsx

TABLA DE COMPARATIVA:

Fondo de seccion: var(--surface) con border-t border-[var(--border)]

Header de tabla:
- La columna de cazary.ai tiene fondo con gradiente sutil del brand
- Badge "cazary.ai" con fondo gradient from-[#2563EB] to-[#06B6D4] y texto blanco
- Columnas Waalaxy y Dripify en texto var(--foreground-muted)

Filas:
- Fondo alterno entre var(--background) y var(--surface)
- Celda de cazary.ai highlighted con fondo rgba(37,99,235,0.05)
- El precio $49 de cazary.ai en texto gradient de marca, font-bold text-lg
- Precios competidores en var(--foreground-muted) con tachado visual si son mas caros
- Checkmarks (bien): color #10B981
- X (mal): color var(--foreground-faint)

Animacion: motion.div con whileInView fade-in desde abajo, once:true

Titulo de seccion:
- Cambiar "Por que NexusAI?" a "Por que cazary.ai?"
- Mantener el subtitulo existente

PLANES DE PRECIOS (si existen en el archivo):
- Fondo de cards: var(--surface)
- Card destacada: border con gradiente (usar el truco de background: linear-gradient + padding-box/border-box)
- Glow exterior en card destacada: box-shadow con var(--shadow-glow-primary)
- En hover de cada plan: ligero scale(1.01) y border con mas opacidad
- Botones de precio: mismo estilo que el CTA del hero (gradiente de marca)

---

TAREA 3 — CTA SECTION
Archivo: src/components/landing/cta.tsx

Redisenar completamente:

LAYOUT:
- Seccion full-width con overflow hidden
- Fondo base: var(--background)
- Fondo animado: dos blobs de glow posicionados absolutos
  - Blob 1: top-0 left-1/4, size 400px, color #2563EB, opacity 0.10, blur-3xl
  - Blob 2: bottom-0 right-1/4, size 300px, color #06B6D4, opacity 0.08, blur-3xl
- Linea decorativa superior: h-px bg-gradient-to-r from-transparent via-[#2563EB] to-transparent

CONTENIDO:
- Icono grande centrado: el simbolo de cazary.ai o un icono de cohete/rayo con gradiente de marca, size 64px
- H2 grande: "Empieza hoy. Tus primeras 50 conexiones son gratis." en texto blanco, bold, text-3xl md:text-5xl, tracking-tight
- Parrafo: "Sin tarjeta de credito. Sin contratos. Sin riesgo." en var(--foreground-muted)
- CTA principal: mismo estilo del hero, con gradiente de marca, shadow-glow-primary
- CTA secundario: "Ver demo" con border var(--border), hover con border en color primario
- Contador social: "Mas de 50 SDRs en LATAM ya automatizan con cazary.ai" con avatares circulares (3-4 circulos con letras o colores, tipo -ml-2 para overlap)

ANIMACIONES:
- Todo el contenido entra con motion.div stagger desde abajo
- Los blobs de fondo tienen animacion de pulse muy suave (keyframes en CSS o motion.div animate con scale entre 1 y 1.1, duration 4s, repeat infinitely, yoyo)

---

TAREA 4 — FOOTER
Archivo: src/components/layout/marketing-footer.tsx

CAMBIOS:

- Fondo: var(--sidebar) que es #080F1E — mas oscuro que el fondo principal
- Border superior: 1px con gradiente from-[#2563EB]/20 via-[#06B6D4]/20 to-transparent
- Logo: usar Image next/image con src="/logo-rect-navy.png" width={120} height={32}
- Descripcion: actualizar texto a "Automatiza tu prospeccion en LinkedIn con IA. Mas reuniones, menos trabajo manual. — cazary.ai"
- Links de texto: color var(--foreground-muted), hover color var(--foreground), transition-colors duration-150
- Cambiar email de "hola@nexusai.io" a "hola@cazary.ai"
- Cambiar copyright: "cazary.ai 2026 — Todos los derechos reservados"
- Cambiar mencion de NexusAI a cazary.ai en cualquier texto

REDES SOCIALES (agregar):
- Iconos SVG simples de LinkedIn y Twitter/X, size 18px
- Color var(--foreground-faint), hover var(--foreground), sin background
- Href="#" por ahora

DIVISOR INFERIOR:
- Linea hr con border-color var(--border)
- Texto de copyright centrado en mobile, flex justify-between en desktop
- Agregar "Terminos de uso" y "Privacidad" como links a la derecha del copyright

---

TAREA 5 — LOGIN PAGE
Archivo: src/app/login/page.tsx

Redisenar completamente con split-screen premium:

PANEL IZQUIERDO (hidden en mobile, visible en lg+):
- Fondo: var(--sidebar) — #080F1E
- Width: 45% en desktop
- Glow decorativo: dos blobs posicionados como en el CTA
- Logo en top-left: Image con logo-rect-navy.png
- Contenido central:
  - Badge: "Plataforma #1 de prospeccion IA en LATAM"
  - Titulo grande (text-3xl bold blanco): "Convierte LinkedIn en tu maquina de ventas"
  - Subtitulo: var(--foreground-muted), max-w-sm
  - 3 bullets con checkmark en color #10B981:
    - "500+ prospectos calificados al mes"
    - "IA que negocia y agenda reuniones"
    - "Sin riesgo para tu cuenta de LinkedIn"
  - Testimonial card en la parte inferior:
    - Fondo: var(--surface) con border var(--border)
    - Texto: la cita existente actualizada a mencionar cazary.ai
    - Avatar: circulo con iniciales "MG" y fondo gradient de marca
    - Nombre y cargo: correctos
  - Linea decorativa superior en el panel: h-0.5 bg-gradient-to-r from-[#2563EB] to-[#06B6D4]

PANEL DERECHO (formulario):
- Fondo: var(--background)
- Centrado vertical y horizontal
- Max-width: max-w-[400px]
- Logo en mobile: mostrar logo-rect-navy.png en fondo oscuro (el body ya es dark)
- Titulo: "Bienvenido de nuevo" en var(--foreground), font-bold text-2xl
- Subtitulo: var(--foreground-muted) text-sm
- El formulario (LoginForm) ya existe — NO tocarlo internamente
- Debajo del formulario: "No tienes cuenta? Registrate gratis" con link usando color del gradiente de marca
- Agregar al fondo del panel derecho un glow muy sutil: radial-gradient centrado en rgba(37,99,235,0.04)

ANIMACIONES DEL LOGIN:
- Panel izquierdo: motion.div con initial x:-30 opacity:0, animate x:0 opacity:1, duration:0.6
- Panel derecho: motion.div con initial x:30 opacity:0, animate x:0 opacity:1, duration:0.6, delay:0.1
- El card del formulario: initial y:20 opacity:0, animate y:0 opacity:1, duration:0.5, delay:0.2

ACTUALIZACION DE CONTENIDO:
- Cambiar toda mencion de "NexusAI" por "cazary.ai"

---

TAREA 6 — MICRO-INTERACCIONES GLOBALES

Agregar en globals.css o en un archivo src/styles/interactions.css importado desde globals.css:

EFECTOS DE BOTON:
Los botones primarios (con gradiente) deben tener:
  - Transition: all 200ms ease
  - Hover: brightness(1.08) y box-shadow ampliado
  - Active: scale(0.98)
  - Focus-visible: outline 2px offset 2px con color var(--cazary-cobalt)

SPOTLIGHT EN CARDS (efecto de luz que sigue el mouse):
Para las cards de features, implementar el efecto "spotlight" de Magic UI o implementarlo manualmente:
- Escuchar onMouseMove en el contenedor del grid
- Calcular posicion relativa del mouse
- Aplicar radial-gradient en el pseudo-elemento o via CSS custom property
- El glow sigue el cursor suavemente dando sensacion de profundidad
- Implementacion sugerida: usar CSS custom properties --mouse-x y --mouse-y actualizadas via JS

SCROLLBAR:
Personalizar scrollbar para mantener consistencia dark:
  - scrollbar-width: thin (Firefox)
  - scrollbar-color: var(--border) transparent
  - Para Webkit: ::-webkit-scrollbar width:6px, track transparent, thumb var(--border) rounded

FOCUS STATES:
- Todos los inputs y links interactivos: outline con color var(--cazary-cobalt) opacity 0.6
- No usar el outline azul nativo del browser

SELECTION COLOR:
::selection {
  background: rgba(37, 99, 235, 0.3);
  color: var(--foreground);
}

---

TAREA 7 — VERIFICACION DE CONSISTENCIA

Buscar y reemplazar en TODOS los archivos de landing y login:
- "NexusAI" -> "cazary.ai"
- "nexusai.io" -> "cazary.ai"
- "app.nexusai.io" -> "app.cazary.ai"
- "hola@nexusai.io" -> "hola@cazary.ai"
- Cualquier color hardcodeado de indigo (indigo-50, indigo-100, indigo-600, etc.) -> usar los tokens CSS correspondientes

Verificar que NO quede ningun fondo blanco bg-white o bg-zinc-* en las secciones principales.
Las secciones alternadas pueden usar var(--background) y var(--surface) para diferenciar.

---

INSTRUCCIONES DE USO DE MCPs

21st.dev MCP:
- Buscar "dark glassmorphism card hover effect" para referencia de las feature cards
- Buscar "dark split screen login premium" para referencia del login
- Usar el resultado como referencia visual, no copiar codigo directamente

Magic UI MCP:
Intentar instalar los siguientes componentes. Si el CLI falla, crear los archivos manualmente en src/components/magicui/:
  npx magicui-cli add number-ticker
  npx magicui-cli add border-beam
  npx magicui-cli add animated-gradient-text
  npx magicui-cli add spotlight

Si BorderBeam esta disponible, usarlo en el card destacado del pricing plan.
Si Spotlight esta disponible, usarlo como efecto en las feature cards.
Si NumberTicker esta disponible, aplicarlo a las estadisticas del hero (500, 19, 14).

shadcn MCP:
- Verificar que Button variant="outline" use border var(--border) y hover var(--border-subtle) con texto var(--foreground)
- Verificar que los inputs del LoginForm tengan fondo var(--surface), border var(--border), focus-ring con color var(--cazary-cobalt)

Playwright MCP:
Despues de completar todas las tareas, ejecutar:
  npm run dev
  npx playwright test --reporter=html
Tomar screenshot de:
  - localhost:3000 (landing completa, scroll hasta abajo)
  - localhost:3000/login

---

ORDEN DE EJECUCION RECOMENDADO

1. Tarea 0 (logo fix — 2 lineas de codigo)
2. globals.css verificar que esta correcto
3. Tarea 6 (micro-interacciones en CSS — base que afecta todo)
4. Tarea 1 (features — seccion mas visible)
5. Tarea 2 (comparison + pricing)
6. Tarea 3 (CTA)
7. Tarea 4 (footer)
8. Tarea 5 (login — pagina separada)
9. Tarea 7 (busqueda y reemplazo final)
10. npm run build — verificar cero errores TypeScript
11. Playwright screenshot — validar resultado visual

---

RESULTADO ESPERADO

Al terminar, la landing de cazary.ai debe sentirse al nivel de ElevenLabs.io:
- Dark mode consistente en todas las secciones
- Gradiente de marca (#2563EB a #06B6D4) como elemento visual unificador
- Animaciones suaves al hacer scroll (framer-motion whileInView)
- Hover states con feedback visual claro en todos los elementos interactivos
- Logo cazary.ai visible y correcto en header, footer y login
- Zero menciones de NexusAI
- Login page premium con historia de marca a la izquierda
- Mobile responsive en todas las secciones
- Build sin errores
