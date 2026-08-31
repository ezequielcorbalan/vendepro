# 🗺️ Mapa de Contenidos — VendéPro KB

CRM inmobiliario multi-tenant para **Marcela Genta Operaciones Inmobiliarias**, con arquitectura hexagonal sobre Cloudflare Workers + D1 + R2 y frontend Next.js 15 en Cloudflare Pages.

> Esta KB se generó scaneando los proyectos `vendepro-backend`, `vendepro-frontend` y `vendepro-landing` (mayo 2026). Sirve como referencia para entender el sistema y hacer features nuevas.

---

## 🏛️ Arquitectura

- [[Arquitectura]] — visión hexagonal + diagrama del sistema
- [[Stack]] — todas las tecnologías y librerías por proyecto
- [[Reglas-criticas]] — reglas de negocio + reglas de ingeniería
- [[Deploy]] — CI/CD, GitHub Actions, Cloudflare
- [[Auth-flow]] — JWT + middleware + roles

## ⚙️ Backend (8 Cloudflare Workers)

- [[Backend-overview]] — monorepo hexagonal con Turborepo
- [[Infraestructura]] — D1 repos, services, middleware
- [[Servicios-externos]] — Anthropic, Groq, Meta CAPI, GA4, R2, CF Browser Rendering
- APIs:
  - [[API-auth]] · [[API-crm]] · [[API-properties]] · [[API-transactions]]
  - [[API-analytics]] · [[API-ai]] · [[API-admin]] · [[API-public]]

## 🧩 Dominios (15)

Cada dominio agrupa entidades + tablas + use cases + endpoints + páginas:

- [[Dominio-Leads]] · [[Dominio-Contactos]] · [[Dominio-Tags]]
- [[Dominio-Propiedades]] · [[Dominio-Visit-forms]]
- [[Dominio-Tasaciones]] · [[Dominio-Prefactibilidades]]
- [[Dominio-Reportes]] · [[Dominio-Reservas]]
- [[Dominio-Calendario]] · [[Dominio-Actividades]]
- [[Dominio-Landings]] · [[Dominio-Marketing]]
- [[Dominio-Objetivos]] · [[Dominio-Notificaciones]]
- [[Dominio-Usuarios-Org]]
- [[Estados]] — máquinas de estado de lead/property/reservation + sync

## 💾 Base de datos D1

- [[DB-overview]] — 51 tablas agrupadas por dominio + migrations

## 🎨 Frontend (Next.js 15)

- [[Frontend-overview]] — App Router, Cloudflare Pages
- [[Frontend-rutas]] — mapa completo de rutas
- [[Frontend-componentes]] — catálogo
- [[Frontend-lib]] — `api.ts`, `auth.ts`, `types.ts`, `crm-config.ts`, `property-config.ts`
- [[Frontend-auth-flow]] — login → cookie → middleware
- [[Frontend-editor-tasaciones]] — sistema de bloques y variables
- [[Frontend-editor-landings]] — builder + IA + versionado

## 🌐 Landing pública

- [[Landing-publica]] — `vendepro.com.ar` (HTML estático)

## 🧭 Producto

- [[Roadmap-producto]] — roadmap de features candidatos (pivote: CRM gratis + módulo de marketing pago)
- [[Roadmap-estado-implementacion]] — en qué instancia está cada proceso en el código

## 🛠️ Guías para hacer features

- [[Como-agregar-endpoint]]
- [[Como-agregar-pagina]]
- [[Como-agregar-migration]]
- [[Como-agregar-dominio]]
- [[Convenciones]]

---

## Recursos Cloudflare en producción

- **D1**: `vendepro-db` (ID `45d18f94-807b-466f-8742-32bbc61fc7fb`)
- **R2**: `vendepro-assets` (+ legacy `reportes-mg-assets`)
- **JWT salt**: `reportes-mg-salt-2026` (⚠️ no rotar, invalida passwords)

## Subdominios productivos

| Subdominio | Worker |
|---|---|
| `vendepro.com.ar` | landing estática |
| (Cloudflare Pages) | frontend Next.js |
| `auth.api.vendepro.com.ar` | [[API-auth]] |
| `crm.api.vendepro.com.ar` | [[API-crm]] |
| `properties.api.vendepro.com.ar` | [[API-properties]] |
| `transactions.api.vendepro.com.ar` | [[API-transactions]] |
| `analytics.api.vendepro.com.ar` | [[API-analytics]] |
| `ai.api.vendepro.com.ar` | [[API-ai]] |
| `admin.api.vendepro.com.ar` | [[API-admin]] |
| `public.api.vendepro.com.ar` | [[API-public]] |
