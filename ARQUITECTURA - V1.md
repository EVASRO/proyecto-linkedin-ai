# 🚀 Documentación Arquitectónica y PRD - Plataforma LinkedIn AI

## 1. Visión General del Producto
Plataforma SaaS omnicanal (LinkedIn + Email) enfocada en la prospección B2B automatizada y gestión de leads. Combina flujos de trabajo programados con intervenciones de Inteligencia Artificial en etapas críticas, manteniendo un modelo "Human-in-the-Loop" (el usuario siempre tiene el control final).

## 2. Módulos Principales (Core Features)

### A. Conexión de Cuentas (LinkedIn & Sales Navigator)
* **Mecanismo:** No usaremos usuario y contraseña directamente (es alto riesgo de baneo). Usaremos una **Extensión de Chrome** propia (o ingreso manual en su defecto) para extraer la cookie de sesión (`li_at`).
* **Validación:** El backend validará la cookie. Si el usuario tiene Sales Navigator, el sistema detectará el tipo de cuenta según los permisos de la cookie y habilitará el scraping avanzado.

### B. Módulo de Campañas (Secuencias)
* **Input:** El usuario pega la URL de una búsqueda filtrada de LinkedIn o Sales Navigator.
* **Flujo Lógico:** Constructor visual de pasos (Ej: Visitar Perfil -> Esperar 1 día -> Enviar Conexión + Mensaje IA -> Esperar 3 días -> Enviar Email).
* **Activación IA:** Nodos específicos donde la IA lee el perfil del lead y personaliza el texto bajo reglas predefinidas.

### C. Módulo de Conversaciones (Smart Inbox)
* **Bandeja Unificada:** Centraliza los mensajes de LinkedIn y correos.
* **Visibilidad IA:** Indicadores visuales claros (etiquetas o colores) para saber si el último mensaje fue enviado por el humano o por la IA.
* **Kill-Switch (Human-in-the-loop):** Botón de "Pausar IA" en cada chat. Si el usuario toma el control para cerrar la venta, la IA deja de intervenir automáticamente en ese hilo.

### D. Módulo CRM (Pipeline de Contactos)
* **Base de Datos de Leads:** Tabla enriquecida con nombre, URL, empresa, puesto, y datos scrapeados/enriquecidos (email, teléfono).
* **Vista Pipeline (Kanban):** Columnas arrastrables estilo Trello/Pipedrive: *Nuevos, Contactados, Respondieron, Reunión Agendada, Perdidos*. Mueve a los leads automáticamente según sus respuestas.

### E. Módulo de Generación de Contenido (Inbound)
* **Auto-Posting:** Creación y programación automática de posts, artículos cortos y carruseles en el perfil del usuario.
* **Objetivo:** Calentar la cuenta y generar autoridad (Inbound) mientras la plataforma prospecta en frío (Outbound).

### F. Módulo de Configuración de Agentes IA
* **Knowledge Base (Base de Conocimiento):** Sección donde el usuario define: Tono de voz, cliente ideal (ICP), propuesta de valor, manejo de objeciones y objetivo (ej. "Agendar llamada de 15 min"). Esta información alimentará los *prompts* del agente.

### G. Módulo de Límites y Seguridad (Settings)
* **Control Granular:** Configuración diaria/semanal de límites: Conexiones, Mensajes, InMails, Likes, Unfollows, etc.

---

## 3. Mejores Prácticas y Estrategia Anti-Ban (Crucial)

1.  **Proxies Residenciales Dedicados:** Cada usuario DEBE tener asignada una IP fija de su mismo país. Si el usuario se conecta desde México, el bot debe usar una IP de México.
2.  **Calentamiento de Cuentas (Warm-up):** Las cuentas nuevas no deben enviar 100 conexiones el día 1. El sistema debe tener un modo de escalado gradual automático (ej. 10 el lunes, 15 el martes...).
3.  **Límites Duros Globales:** Aunque el usuario quiera configurar 500 conexiones diarias, el sistema debe bloquearlo por seguridad (Límite sugerido de LinkedIn actual: ~100-150 conexiones a la semana).
4.  **Comportamiento Humano:** El motor de automatización (Playwright) debe tener retrasos aleatorios (ej. esperar entre 3 y 8 segundos entre clics) y no ir en línea recta de un botón a otro.

---

## 4. Stack Tecnológico

| Componente | Tecnología |
| :--- | :--- |
| **Frontend UI/UX** | Next.js, TailwindCSS, Zustand (Manejo de estado) |
| **Backend Orquestador**| Python, FastAPI, PostgreSQL (Supabase) |
| **Motor Scraping** | Playwright (Python) + Stealth Plugins + Proxies |
| **Cerebro IA** | Anthropic API (Claude 3.5 Sonnet / Haiku) |
| **Extensión (Auth)** | React o Vanilla JS (Manifest V3) |

## 5. Roadmap de Evolución (Autenticación y Sesiones)
Para asegurar el lanzamiento rápido y la mejor experiencia de usuario a largo plazo, el acceso a las cuentas evolucionará en tres fases:
* **Fase 1 (MVP actual):** Ingreso manual de la cookie de sesión (`li_at`) por parte del usuario. Prioridad: Validar el modelo de scraping y la IA rápido.
* **Fase 2 (Mejora UX):** Desarrollo de Extensión de Google Chrome. El usuario instala la extensión y sincroniza su cuenta con un clic, inyectando la cookie de forma invisible al backend.
* **Fase 3 (Escalabilidad):** Sistema de inicio de sesión directo estilo Dripify. Infraestructura de proxies residenciales avanzados y resolución automática de Captchas/2FA para que el usuario solo use correo y contraseña.

