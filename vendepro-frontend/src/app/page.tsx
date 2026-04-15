import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vendepro.app'

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
            <Link
              href="/login"
              className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
              style={{ background: '#ff007c' }}
            >
              Ingresar
            </Link>
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
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl text-white font-semibold text-base shadow-lg transition-all hover:shadow-xl hover:opacity-95"
                style={{ background: 'linear-gradient(135deg, #ff007c, #ff8017)' }}
              >
                Empezar gratis
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-medium text-base border-2 border-gray-200 text-gray-700 hover:border-gray-300 transition-colors"
              >
                Ya tengo cuenta
              </Link>
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
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl text-white font-semibold text-base shadow-lg transition-all hover:shadow-xl hover:opacity-95"
              style={{ background: 'linear-gradient(135deg, #ff007c, #ff8017)' }}
            >
              Crear mi cuenta gratis
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
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
              <Link href="/login" className="hover:text-gray-600">Ingresar</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
