# 🌐 Landing pública — `vendepro.com.ar`

Sitio marketing estático. NO es Next.js — es un `index.html` único servido como asset binding por un Cloudflare Worker.

## Path

`vendepro-landing/`

## Estructura

```
vendepro-landing/
├── index.html         # ~390 líneas, todo en uno
├── terminos/
│   └── index.html
├── wrangler.jsonc     # config CF Worker
└── node_modules/      # vacío en prod, solo dev tooling
```

## Stack

- **HTML estático** (sin build)
- **TailwindCSS via CDN** (`cdn.tailwindcss.com`)
- **Poppins** via Google Fonts
- **Sin frameworks**: vanilla JS inline para tabs interactivos

## Secciones del index

1. **Hero** (`pt-16 pb-20`) — headline + CTA
2. **Stats bar** (`bg-gray-50 py-14`) — métricas
3. **Features** (`py-20`) — feature tabs con categorías (clases `.ct`, `.ct-on`, `.fp`, `.fc`)
4. **CTA gradient** (`linear-gradient(135deg, #ff007c08, #ff801708)`)
5. **Footer/contact** (`py-16`)

## Deploy

- `wrangler.jsonc`:
  ```json
  {
    "name": "vendepro-landing",
    "assets": { "directory": "." },
    "routes": [
      { "pattern": "vendepro.com.ar", "custom_domain": true },
      { "pattern": "www.vendepro.com.ar", "custom_domain": true }
    ]
  }
  ```
- Deploy: `wrangler deploy` (via Dashboard o GitHub Actions). Ver [[Reglas-criticas]] — nunca desde terminal.

## SEO

- `<title>` y meta description optimizados
- `<link rel="canonical">` a `https://vendepro.com.ar`
- Open Graph completo (`og:title`, `og:description`, `og:image`, `og:type=website`, `twitter:card=summary_large_image`)
- JSON-LD structured data: `SoftwareApplication`
- Creator: Marcela Genta Operaciones Inmobiliarias

## Identidad visual

Mismos colores y fuente que la app:
- `#ff007c` (rosa primario)
- `#ff8017` (naranja acento)
- Poppins (400-800)

## Independiente del CRM

No comparte código con `vendepro-frontend`. No consume APIs (es pura landing marketing). El único link al CRM es probable que esté en el CTA "Iniciar sesión" hacia el dominio del frontend (Pages).

## Cuándo tocarla

- Copy / hero / features marketing → editar `index.html`
- T&Cs legales → editar `terminos/index.html`
- Nuevas secciones → agregar `<section>` y CSS inline

No es candidata a refactor a Next/Astro sin justificación clara — su simplicidad es feature.
