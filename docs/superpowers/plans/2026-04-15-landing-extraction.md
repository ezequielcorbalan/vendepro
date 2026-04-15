# Landing Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extraer la landing de `vendepro-frontend` a `vendepro-landing` como app independiente en `vendepro.com.ar`, dejando `vendepro-frontend` solo como app autenticada en `app.vendepro.com.ar`.

**Architecture:** Nueva app Next.js 15 mínima en `vendepro-landing/` con solo las rutas públicas (`/` y `/terminos`). Los links de login apuntan a `https://app.vendepro.com.ar/login`. `vendepro-frontend/src/app/page.tsx` pasa a ser un redirect a `/dashboard`.

**Tech Stack:** Next.js 15, TailwindCSS 4, lucide-react, @opennextjs/cloudflare, Wrangler 4, GitHub Actions

---

## File Map

**Crear:**
- `vendepro-landing/package.json`
- `vendepro-landing/tsconfig.json`
- `vendepro-landing/postcss.config.mjs`
- `vendepro-landing/next.config.ts`
- `vendepro-landing/open-next.config.ts`
- `vendepro-landing/wrangler.jsonc`
- `vendepro-landing/src/app/globals.css`
- `vendepro-landing/src/app/layout.tsx`
- `vendepro-landing/src/app/page.tsx`
- `vendepro-landing/src/app/terminos/page.tsx`
- `.github/workflows/deploy-landing.yml`

**Modificar:**
- `vendepro-frontend/src/app/page.tsx` → redirect a `/dashboard`

---

## Task 1: Scaffold — package.json, tsconfig, postcss, configs

**Files:**
- Create: `vendepro-landing/package.json`
- Create: `vendepro-landing/tsconfig.json`
- Create: `vendepro-landing/postcss.config.mjs`
- Create: `vendepro-landing/next.config.ts`
- Create: `vendepro-landing/open-next.config.ts`

- [ ] **Step 1: Crear `vendepro-landing/package.json`**

```json
{
  "name": "vendepro-landing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "deploy": "next build && npx opennextjs-cloudflare build && wrangler deploy"
  },
  "dependencies": {
    "lucide-react": "^0.577.0",
    "next": "^15.5.14",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@opennextjs/cloudflare": "latest",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "typescript": "^5",
    "wrangler": "^4.76.0"
  }
}
```

- [ ] **Step 2: Crear `vendepro-landing/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Crear `vendepro-landing/postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 4: Crear `vendepro-landing/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 5: Crear `vendepro-landing/open-next.config.ts`**

```ts
import type { OpenNextConfig } from "@opennextjs/cloudflare";

const config: OpenNextConfig = {
  default: {
    override: {
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "direct",
    },
  },
};

export default config;
```

- [ ] **Step 6: Commit**

```bash
cd vendepro-landing
git add package.json tsconfig.json postcss.config.mjs next.config.ts open-next.config.ts
git commit -m "feat(landing): scaffold Next.js app config"
```

---

## Task 2: Wrangler config para vendepro.com.ar

**Files:**
- Create: `vendepro-landing/wrangler.jsonc`

- [ ] **Step 1: Crear `vendepro-landing/wrangler.jsonc`**

```jsonc
{
  "name": "vendepro-landing",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [
    { "pattern": "vendepro.com.ar", "custom_domain": true },
    { "pattern": "www.vendepro.com.ar", "custom_domain": true }
  ],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add vendepro-landing/wrangler.jsonc
git commit -m "feat(landing): wrangler config para vendepro.com.ar"
```

---

## Task 3: CSS y layout

**Files:**
- Create: `vendepro-landing/src/app/globals.css`
- Create: `vendepro-landing/src/app/layout.tsx`

- [ ] **Step 1: Crear `vendepro-landing/src/app/globals.css`**

```css
@import "tailwindcss";

:root {
  --brand-pink: #ff007c;
  --brand-orange: #ff8017;
}

body {
  font-family: 'Poppins', sans-serif;
}

.text-brand-pink { color: #ff007c; }
.text-brand-orange { color: #ff8017; }
.bg-brand-pink { background-color: #ff007c; }
.bg-brand-orange { background-color: #ff8017; }
```

- [ ] **Step 2: Crear `vendepro-landing/src/app/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vendepro.com.ar'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VendéPro — CRM Inmobiliario para Agentes',
    template: '%s | VendéPro',
  },
  description:
    'CRM inmobiliario para agentes y equipos. Gestioná leads, tasaciones, propiedades, reservas y reportes de gestión desde un solo lugar.',
  keywords: [
    'CRM inmobiliario',
    'gestión inmobiliaria',
    'software inmobiliario Argentina',
    'tasaciones online',
    'leads inmobiliarios',
    'pipeline inmobiliario',
    'agente inmobiliario',
    'VendéPro',
  ],
  authors: [{ name: 'Marcela Genta Operaciones Inmobiliarias' }],
  creator: 'VendéPro',
  publisher: 'VendéPro',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: SITE_URL,
    siteName: 'VendéPro',
    title: 'VendéPro — CRM Inmobiliario para Agentes',
    description:
      'Gestioná todo tu negocio inmobiliario desde un solo lugar: leads, tasaciones, propiedades, reservas y reportes.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VendéPro — CRM Inmobiliario',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VendéPro — CRM Inmobiliario para Agentes',
    description:
      'Gestioná todo tu negocio inmobiliario desde un solo lugar: leads, tasaciones, propiedades, reservas y reportes.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 3: Verificar typecheck**

```bash
cd vendepro-landing
npm install
npm run typecheck
```

Esperado: sin errores de TypeScript.

- [ ] **Step 4: Commit**

```bash
git add vendepro-landing/src/app/globals.css vendepro-landing/src/app/layout.tsx
git commit -m "feat(landing): layout y CSS base"
```

---

## Task 4: Landing page (page.tsx)

**Files:**
- Create: `vendepro-landing/src/app/page.tsx`

> Todos los links de login apuntan a `https://app.vendepro.com.ar/login` (absolutos). Los links a `/terminos` son relativos (mismo dominio landing).

- [ ] **Step 1: Crear `vendepro-landing/src/app/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.vendepro.com.ar'
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vendepro.com.ar'

export const metadata: Metadata = {
  title: 'VendéPro — CRM Inmobiliario para Agentes Profesionales',
  description:
    'Gestioná todo tu negocio inmobiliario desde un solo lugar. Leads, tasaciones, propiedades, reservas y reportes de gestión para agentes y equipos en Argentina.',
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: 'VendéPro — CRM Inmobiliario para Agentes Profesionales',
    description:
      'Gestioná todo tu negocio inmobiliario desde un solo lugar. Leads, tasaciones, propiedades, reservas y reportes de gestión.',
    url: SITE_URL,
    type: 'website',
  },
}

const FEATURES = [
  {
    icon: '📋',
    title: 'Pipeline de leads',
    description:
      'Seguí cada prospecto desde el primer contacto hasta la firma. Kanban visual, alertas de SLA y priorización automática.',
  },
  {
    icon: '🏠',
    title: 'Tasaciones profesionales',
    description:
      'Generá informes de tasación con comparables de mercado, análisis FODA y precio sugerido. Compartí con un link en segundos.',
  },
  {
    icon: '📊',
    title: 'Reportes de gestión',
    description:
      'Enviá a tu cliente un reporte periódico con métricas reales: impresiones, consultas y visitas de su propiedad.',
  },
  {
    icon: '📅',
    title: 'Calendario operativo',
    description:
      'Planificá llamadas, visitas, reuniones y seguimientos. Vinculados a leads y propiedades, con alertas de vencimiento.',
  },
  {
    icon: '📈',
    title: 'Dashboard ejecutivo',
    description:
      'Visualizá el funnel completo: lead → tasación → captación → reserva → venta con tasas de conversión en tiempo real.',
  },
  {
    icon: '🤝',
    title: 'Gestión de equipo',
    description:
      'Asigná leads, monitoreá la performance de cada agente y compartiles objetivos mensuales. Control total para el broker.',
  },
]

const PIPELINE_STEPS = [
  { step: 'Lead', desc: 'Ingresa el prospecto' },
  { step: 'Contacto', desc: 'Primera comunicación' },
  { step: 'Tasación', desc: 'Valuation de la propiedad' },
  { step: 'Captación', desc: 'Firma de exclusividad' },
  { step: 'Publicación', desc: 'Propiedad en portales' },
  { step: 'Reserva', desc: 'Oferta aceptada' },
  { step: 'Venta', desc: 'Operación cerrada' },
]

const schemaOrg = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'VendéPro',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'CRM inmobiliario para agentes y equipos. Gestión de leads, tasaciones, propiedades, reservas y reportes de gestión.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  creator: {
    '@type': 'Organization',
    name: 'Marcela Genta Operaciones Inmobiliarias',
    address: { '@type': 'PostalAddress', addressLocality: 'Buenos Aires', addressCountry: 'AR' },
  },
}

export default function HomePage() {
  const loginUrl = `${APP_URL}/login`

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
      />

      <div className="min-h-screen bg-white" style={{ fontFamily: 'Poppins, sans-serif' }}>
        {/* Nav */}
        <nav className="border-b border-gray-100 bg-white/95 backdrop-blur sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ff007c, #ff8017)' }}
              >
                <span className="text-white font-black text-xs tracking-tight">VP</span>
              </div>
              <span className="font-bold text-gray-900 text-lg">
                Vendé<span style={{ color: '#ff007c' }}>Pro</span>
              </span>
            </div>
            <a
              href={loginUrl}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ background: '#ff007c' }}
            >
              Ingresar
            </a>
          </div>
        </nav>

        {/* Hero */}
        <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div
            className="absolute inset-0 opacity-5 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse 80% 60% at 50% -10%, #ff007c 0%, transparent 70%)',
            }}
          />
          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <div
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border"
              style={{ color: '#ff007c', borderColor: '#ff007c33', background: '#ff007c0a' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              CRM diseñado para el mercado inmobiliario argentino
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight mb-6">
              Todo tu negocio inmobiliario{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #ff007c, #ff8017)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                en un solo lugar
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
              Gestioná leads, tasaciones, propiedades, reservas y reportes de gestión.
              Del primer contacto a la escritura, sin perder ningún detalle.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={loginUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-base shadow-lg transition-all hover:shadow-xl hover:opacity-95"
                style={{ background: 'linear-gradient(135deg, #ff007c, #ff8017)' }}
              >
                Empezar gratis
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
              <a
                href={loginUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-medium text-base border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
              >
                Ya tengo cuenta
              </a>
            </div>
            <p className="text-xs text-gray-400 mt-4">Sin tarjeta de crédito. Setup en 2 minutos.</p>
          </div>
        </section>

        {/* Pipeline steps */}
        <section className="bg-gray-50 py-14 sm:py-16 border-y border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 mb-8">
              Pipeline comercial completo
            </p>
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-2 justify-start sm:justify-center">
              {PIPELINE_STEPS.map((s, i) => (
                <div key={s.step} className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <div className="text-center">
                    <div
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                      style={{ background: `linear-gradient(135deg, #ff007c, #ff8017)`, opacity: 0.7 + i * 0.04 }}
                    >
                      {i + 1}
                    </div>
                    <p className="text-[10px] sm:text-xs font-semibold text-gray-700 mt-1.5 whitespace-nowrap">
                      {s.step}
                    </p>
                    <p className="hidden sm:block text-[9px] text-gray-400 mt-0.5 whitespace-nowrap">{s.desc}</p>
                  </div>
                  {i < PIPELINE_STEPS.length - 1 && (
                    <svg className="w-4 h-4 text-gray-300 shrink-0 -mt-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-16 sm:py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
                Todo lo que necesita un agente profesional
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto">
                Herramientas diseñadas para el trabajo diario en campo y en oficina.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-200 hover:shadow-md transition-all"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                    style={{ background: '#ff007c0d' }}
                  >
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats strip */}
        <section className="py-14 sm:py-16" style={{ background: 'linear-gradient(135deg, #ff007c08, #ff801708)' }}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
              Desarrollado para el mercado porteño
            </h2>
            <p className="text-gray-500 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed mb-8">
              VendéPro nació de la operación diaria de{' '}
              <strong className="text-gray-700">Marcela Genta Operaciones Inmobiliarias</strong>{' '}
              en Buenos Aires. Cada pantalla resuelve un problema real del agente en campo.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { value: '9', label: 'tipos de evento en calendario' },
                { value: '7', label: 'etapas del pipeline' },
                { value: '100%', label: 'trazabilidad lead → venta' },
                { value: 'IA', label: 'extracción de datos con Claude' },
              ].map((stat) => (
                <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-2xl sm:text-3xl font-extrabold" style={{ color: '#ff007c' }}>
                    {stat.value}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 leading-snug">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 sm:py-20">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Empezá hoy, sin costo</h2>
            <p className="text-gray-500 mb-8">
              El plan gratuito incluye todas las funciones principales. Sin límite de tiempo.
            </p>
            <a
              href={loginUrl}
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-white font-semibold text-base shadow-lg transition-all hover:shadow-xl hover:opacity-95"
              style={{ background: 'linear-gradient(135deg, #ff007c, #ff8017)' }}
            >
              Crear mi cuenta gratis
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
            <p className="text-xs text-gray-400 mt-3">
              Al continuar, aceptás los{' '}
              <Link href="/terminos" className="underline hover:text-gray-600">
                Términos y Condiciones
              </Link>
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-100 py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #ff007c, #ff8017)' }}
              >
                <span className="text-white font-black text-[9px]">VP</span>
              </div>
              <span className="text-sm font-semibold text-gray-700">VendéPro</span>
            </div>
            <p className="text-xs text-gray-400 text-center">
              Marcela Genta Operaciones Inmobiliarias · Buenos Aires, Argentina
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <Link href="/terminos" className="hover:text-gray-600">Términos</Link>
              <a href={loginUrl} className="hover:text-gray-600">Ingresar</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd vendepro-landing
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vendepro-landing/src/app/page.tsx
git commit -m "feat(landing): landing page con links a app.vendepro.com.ar"
```

---

## Task 5: Términos y condiciones

**Files:**
- Create: `vendepro-landing/src/app/terminos/page.tsx`

- [ ] **Step 1: Crear `vendepro-landing/src/app/terminos/page.tsx`**

```tsx
import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Términos y Condiciones',
  description: 'Términos y condiciones de uso de VendéPro, CRM inmobiliario.',
  robots: { index: false, follow: false },
}

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 flex items-center h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center">
              <span className="text-white font-black text-[10px] tracking-tight">VP</span>
            </div>
            <span className="font-bold text-gray-800">Vendé<span className="text-[#ff007c]">Pro</span></span>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-600 mb-8">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <h1 className="text-3xl font-black text-gray-900 mb-2">Términos y Condiciones</h1>
        <p className="text-sm text-gray-400 mb-10">Última actualización: abril 2026</p>

        <div className="prose prose-gray max-w-none text-sm leading-relaxed space-y-6">
          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">1. Servicio</h2>
            <p className="text-gray-600">VendéPro es una plataforma de gestión inmobiliaria (CRM) desarrollada por Marcela Genta Operaciones Inmobiliarias. El servicio incluye herramientas de tasación, reportes de gestión, seguimiento de leads, dashboard de performance y asistente con inteligencia artificial, según el plan contratado.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">2. Planes y facturación</h2>
            <p className="text-gray-600">Los planes se facturan de forma mensual en dólares estadounidenses (USD) a través de Mercado Pago. El plan gratuito no tiene costo ni requiere método de pago. Los planes pagos se renuevan automáticamente salvo cancelación previa. Los precios pueden ser modificados con 30 días de preaviso.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">3. Límites de uso</h2>
            <p className="text-gray-600">Cada plan tiene límites definidos de agentes, tasaciones, reportes y consultas de IA por mes. Al alcanzar el límite, la funcionalidad se restringe hasta el próximo período de facturación. No se realizan cobros adicionales por exceso de uso; se limita el acceso a la funcionalidad correspondiente.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">4. Inteligencia artificial</h2>
            <p className="text-gray-600">El asistente de IA utiliza modelos de lenguaje para facilitar la carga de datos, extracción de métricas y gestión de leads. Las respuestas generadas por IA son orientativas y no constituyen asesoramiento profesional. El usuario es responsable de verificar la información procesada.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">5. Datos y privacidad</h2>
            <p className="text-gray-600">Los datos cargados por los usuarios son propiedad exclusiva de cada usuario u organización. VendéPro no comparte, vende ni cede datos de usuarios a terceros. Los datos se almacenan en servidores de Cloudflare con encriptación en tránsito y en reposo. El usuario puede solicitar la eliminación total de sus datos en cualquier momento.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">6. Cancelación</h2>
            <p className="text-gray-600">El usuario puede cancelar su suscripción en cualquier momento. La cancelación se hace efectiva al finalizar el período de facturación en curso. No se realizan reembolsos por períodos parciales. Al cancelar, los datos se mantienen por 90 días antes de ser eliminados permanentemente.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">7. Beta</h2>
            <p className="text-gray-600">Durante el período de beta, el servicio se ofrece de forma gratuita o con descuento. Las funcionalidades pueden cambiar, agregarse o eliminarse sin previo aviso. VendéPro no garantiza disponibilidad 100% durante el período de beta.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">8. Responsabilidad</h2>
            <p className="text-gray-600">VendéPro es una herramienta de gestión y no sustituye el asesoramiento profesional inmobiliario, legal, contable o financiero. Las tasaciones generadas son estimaciones basadas en datos del mercado y no constituyen una valuación oficial. El usuario es responsable del uso que haga de la información proporcionada por la plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-800 mb-3">9. Contacto</h2>
            <p className="text-gray-600">Para consultas sobre estos términos, contactar a: gastontobi@gmail.com o por WhatsApp al +54 9 11 5890-5594.</p>
          </section>
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verificar typecheck**

```bash
cd vendepro-landing
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vendepro-landing/src/app/terminos/page.tsx
git commit -m "feat(landing): página de términos y condiciones"
```

---

## Task 6: Actualizar vendepro-frontend — redirect en page.tsx

**Files:**
- Modify: `vendepro-frontend/src/app/page.tsx`

- [ ] **Step 1: Reemplazar `vendepro-frontend/src/app/page.tsx` con redirect**

Reemplazar todo el contenido del archivo con:

```tsx
import { redirect } from 'next/navigation'

export default function HomePage() {
  redirect('/dashboard')
}
```

- [ ] **Step 2: Verificar typecheck del frontend**

```bash
cd vendepro-frontend
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add vendepro-frontend/src/app/page.tsx
git commit -m "feat(frontend): / redirige a /dashboard — landing movida a vendepro-landing"
```

---

## Task 7: CI/CD — workflow de deploy del landing

**Files:**
- Create: `.github/workflows/deploy-landing.yml`

- [ ] **Step 1: Crear `.github/workflows/deploy-landing.yml`**

```yaml
name: Deploy landing

on:
  push:
    branches: [main]
    paths:
      - "vendepro-landing/**"
      - ".github/workflows/deploy-landing.yml"
      - ".github/workflows/_deploy-api.yml"
  workflow_dispatch:

concurrency:
  group: deploy-landing
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy vendepro-landing
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
          cache-dependency-path: vendepro-landing/package-lock.json

      - name: Install dependencies
        run: npm install
        working-directory: vendepro-landing

      - name: Build Next.js
        run: npx next build
        working-directory: vendepro-landing

      - name: Build for Cloudflare
        run: npx opennextjs-cloudflare build
        working-directory: vendepro-landing

      - name: Deploy
        run: npx wrangler deploy
        working-directory: vendepro-landing
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy-landing.yml
git commit -m "ci: workflow deploy vendepro-landing → vendepro.com.ar"
```

---

## Task 8: Build local de verificación y push final

- [ ] **Step 1: Build del landing**

```bash
cd vendepro-landing
npm run build
```

Esperado: build exitoso sin errores de TypeScript ni warnings de Next.js.

- [ ] **Step 2: Verificar que el frontend sigue compilando**

```bash
cd vendepro-frontend
npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 3: Push a main para disparar el workflow**

```bash
git push origin main
```

Verificar en GitHub Actions que el workflow `Deploy landing` se ejecuta correctamente.
