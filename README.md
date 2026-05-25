# NexusAI — SaaS Starter

Proyecto SaaS inicial con **Next.js 16** (App Router), **React 19**, **TypeScript** y **Tailwind CSS 4**.

## Estructura

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── login/page.tsx        # Inicio de sesión (mock)
│   └── dashboard/            # Panel tras login
│       ├── layout.tsx
│       ├── page.tsx
│       ├── contenido/
│       ├── analitica/
│       └── configuracion/
├── components/
│   ├── auth/
│   ├── landing/
│   ├── layout/
│   └── ui/
└── lib/
```

## Desarrollo

```bash
npm run dev
```

Abre [http://127.0.0.1:3000](http://127.0.0.1:3000) (o [http://localhost:3000](http://localhost:3000)).

**Si no carga:** puede haber otro proceso usando el puerto 3000. Detén servidores anteriores y vuelve a arrancar:

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

Si la terminal muestra otro puerto (p. ej. 3001), abre esa URL en el navegador.

- **/** — Landing corporativa
- **/login** — Inicio de sesión con Auth.js (credenciales + Google opcional)
- **/dashboard** — Panel protegido (requiere sesión activa)

## Autenticación

Usa [Auth.js](https://authjs.dev) (NextAuth v5) con middleware que protege `/dashboard/*`.

1. Copia las variables de entorno:

```bash
cp .env.example .env.local
```

2. Genera `AUTH_SECRET` si no lo tienes:

```bash
openssl rand -base64 32
```

3. Credenciales demo por defecto:

| Campo      | Valor              |
|------------|--------------------|
| Email      | `demo@nexusai.app` |
| Contraseña | `demo1234`         |

4. **Google OAuth** (opcional): añade `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en `.env.local` y configura la URI de redirección `http://localhost:3000/api/auth/callback/google` en Google Cloud Console.

## Scripts

| Comando        | Descripción        |
|----------------|--------------------|
| `npm run dev`  | Servidor desarrollo |
| `npm run build`| Build producción   |
| `npm run start`| Servidor producción |
| `npm run lint` | ESLint             |
