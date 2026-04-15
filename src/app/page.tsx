import Link from 'next/link'
import {
  BarChart3, FileBarChart, Camera, Layout,
  Users, Shield, Zap, CheckCircle, ArrowRight, MessageCircle,
  Star, Phone
} from 'lucide-react'

const features = [
  { icon: Camera, title: 'Tasaciones profesionales', desc: 'Generá páginas de tasación con diseño premium que podés compartir con el propietario.' },
  { icon: FileBarChart, title: 'Reportes quincenales', desc: 'Métricas de impresiones, consultas, visitas y ofertas de cada propiedad en un solo lugar.' },
  { icon: Zap, title: 'Asistente con IA', desc: 'Cargá datos de propiedades con inteligencia artificial. Extrae métricas de ZonaProp automáticamente.' },
  { icon: Users, title: 'CRM de leads', desc: 'Capturá, calificá y seguí cada lead desde la consulta hasta el cierre.' },
  { icon: BarChart3, title: 'Dashboard de performance', desc: 'Visualizá el rendimiento de cada agente y propiedad con gráficos claros.' },
  { icon: Layout, title: 'Template editable', desc: 'Personalizá los bloques de tu propuesta comercial con tu marca, logo y colores.' },
]

const plans = [
  {
    name: 'Gratis',
    price: '0',
    period: 'por siempre',
    desc: 'Para probar el sistema',
    highlight: false,
    features: [
      '1 agente',
      '3 tasaciones/mes',
      '5 reportes/mes',
      'Página pública de tasación',
      'Template con marca VendéPro',
      'Sin asistente IA',
    ],
    cta: 'Empezar gratis',
  },
  {
    name: 'Agente',
    price: '25',
    period: '/mes',
    desc: 'Para el agente independiente',
    highlight: false,
    features: [
      '1 agente',
      '15 tasaciones/mes',
      '20 reportes/mes',
      'Logo y colores propios',
      'Bloques editables',
      'CRM de leads completo',
      'Dashboard de performance',
      'Asistente IA (150 consultas/mes)',
      'Integración Google Calendar',
    ],
    cta: 'Elegir Agente',
  },
  {
    name: 'Inmobiliaria',
    price: '79',
    period: '/mes',
    desc: 'Para inmobiliarias con equipo',
    highlight: true,
    features: [
      'Hasta 5 agentes',
      '50 tasaciones/mes',
      'Reportes ilimitados',
      'Logo y colores propios',
      'Bloques editables',
      'CRM de leads completo',
      'Dashboard equipo + individual',
      'Objetivos por agente',
      'Asistente IA (500 consultas/mes)',
      'Integración Google Calendar',
      'Soporte prioritario',
    ],
    cta: 'Elegir Inmobiliaria',
  },
  {
    name: 'Inmobiliaria Pro',
    price: '249',
    period: '/mes',
    desc: 'Para inmobiliarias grandes',
    highlight: false,
    features: [
      'Hasta 15 agentes',
      'Tasaciones ilimitadas',
      'Reportes ilimitados',
      'Todo lo de Inmobiliaria +',
      'Asistente IA (1500 consultas/mes)',
      'Integraciones con portales',
      'API de acceso',
      'Soporte dedicado',
      '+15 agentes: contactar',
    ],
    cta: 'Elegir Pro',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center shadow-sm">
              <span className="text-white font-black text-xs tracking-tight">VP</span>
            </div>
            <span className="font-black text-gray-800 text-lg">Vendé<span className="text-[#ff007c]">Pro</span></span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#planes" className="text-xs font-medium text-gray-500 hover:text-[#ff007c] hidden sm:block uppercase tracking-wider">Planes</a>
            <a href="#features" className="text-xs font-medium text-gray-500 hover:text-[#ff007c] hidden sm:block uppercase tracking-wider">Features</a>
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-800 font-medium">Ingresar</Link>
            <a href="#planes" className="text-sm bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white px-5 py-2 rounded-full font-semibold hover:opacity-90 uppercase tracking-wide text-xs">
              Probar gratis
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="bg-gradient-to-br from-[#ff007c] via-[#ff3d6e] to-[#ff8017] px-4 sm:px-8 py-20 sm:py-28 rounded-b-[3rem] sm:rounded-b-[4rem]">
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur text-white px-4 py-1.5 rounded-full text-sm font-medium mb-8">
              <Star className="w-4 h-4" /> BETA ABIERTA — PROBALO GRATIS
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight mb-6">
              El CRM que necesita<br />tu inmobiliaria
            </h1>
            <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed">
              Tasaciones profesionales, reportes de gestión, seguimiento de leads y performance de tu equipo. Todo en un solo lugar.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#planes" className="inline-flex items-center gap-2 bg-white text-[#ff007c] px-8 py-4 rounded-full font-bold text-base hover:bg-gray-50 shadow-lg uppercase tracking-wide text-sm">
                EMPEZAR GRATIS <ArrowRight className="w-5 h-5" />
              </a>
              <a href="https://wa.me/5491158905594?text=Hola%2C%20quiero%20saber%20más%20sobre%20VendéPro" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white border-2 border-white/30 px-8 py-4 rounded-full font-semibold text-sm hover:bg-white/20 uppercase tracking-wide">
                <MessageCircle className="w-5 h-5" /> WHATSAPP
              </a>
            </div>
          </div>
        </div>
        <div className="max-w-4xl mx-auto text-center mt-6 mb-12">
          <p className="text-sm text-gray-400">
            Creado por <span className="font-semibold text-gray-600">Marcela Genta Operaciones Inmobiliarias</span>
          </p>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-10 border-y border-gray-100 bg-[#fafafa]">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16 text-center">
          <div>
            <p className="text-3xl font-black text-gray-800">130+</p>
            <p className="text-sm text-gray-500">Colegas en la red</p>
          </div>
          <div>
            <p className="text-3xl font-black text-gray-800">196K</p>
            <p className="text-sm text-gray-500">Seguidores TikTok</p>
          </div>
          <div>
            <p className="text-3xl font-black text-gray-800">4.6M</p>
            <p className="text-sm text-gray-500">Vistas en YouTube</p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#ff007c] uppercase tracking-[0.2em] mb-3">Funcionalidades</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">Todo lo que necesitás para vender más</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Herramientas diseñadas por inmobiliarios, para inmobiliarios.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg hover:border-pink-100 transition-all group">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff007c]/10 to-[#ff8017]/10 flex items-center justify-center mb-4 group-hover:from-[#ff007c]/20 group-hover:to-[#ff8017]/20 transition-colors">
                  <f.icon className="w-6 h-6 text-[#ff007c]" />
                </div>
                <h3 className="font-bold text-gray-800 text-base mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="py-20 px-4 sm:px-8 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-[#ff007c] uppercase tracking-[0.2em] mb-3">Planes y precios</p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">Planes para cada necesidad</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Desde agentes independientes hasta inmobiliarias con equipo.</p>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-400">
              <Shield className="w-4 h-4" />
              <span>Pagos seguros con <span className="font-semibold text-blue-500">Mercado Pago</span> · Cancelá cuando quieras</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl p-6 flex flex-col ${
                  plan.highlight
                    ? 'bg-white border-2 border-[#ff007c] shadow-xl shadow-pink-100'
                    : 'bg-white border border-gray-200'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white text-xs font-bold px-4 py-1 rounded-full">
                    Popular
                  </div>
                )}
                <h3 className="font-bold text-lg text-gray-800 mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-400 mb-4">{plan.desc}</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-gray-900">
                    {plan.price === '0' ? 'Gratis' : `$${plan.price}`}
                  </span>
                  {plan.price !== '0' && (
                    <span className="text-sm text-gray-400 ml-1">USD{plan.period}</span>
                  )}
                  {plan.price === '0' && (
                    <span className="text-sm text-gray-400 ml-2">{plan.period}</span>
                  )}
                </div>
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={`https://wa.me/5491158905594?text=${encodeURIComponent(`Hola, quiero el plan ${plan.name} de VendéPro`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-[#ff007c] to-[#ff8017] text-white hover:opacity-90'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-4 sm:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-4">
            ¿Listo para profesionalizar tu gestión?
          </h2>
          <p className="text-gray-500 text-lg mb-10 max-w-lg mx-auto">
            Sumate a la beta abierta y empezá a usar VendéPro gratis. Sin compromiso, sin tarjeta.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href={`https://wa.me/5491158905594?text=${encodeURIComponent('Hola, quiero probar VendéPro')}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-green-500 text-white px-8 py-4 rounded-full font-semibold text-base hover:bg-green-600 shadow-lg shadow-green-200">
              <MessageCircle className="w-5 h-5" /> Escribinos por WhatsApp
            </a>
            <a href="tel:+5491158905594"
              className="inline-flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-8 py-4 rounded-full font-semibold text-base hover:bg-gray-50">
              <Phone className="w-5 h-5" /> Llamar
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 bg-[#fafafa]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center">
                <span className="text-white font-black text-[10px] tracking-tight">VP</span>
              </div>
              <span className="font-bold text-gray-800 text-sm">Vendé<span className="text-[#ff007c]">Pro</span></span>
            </div>
            <p className="text-sm text-gray-400">
              Creado por Marcela Genta Operaciones Inmobiliarias · CUCICBA Mat. N°3906
            </p>
            <div className="flex items-center gap-4">
              <Link href="/terminos" className="text-sm text-gray-500 hover:text-gray-800">Términos y condiciones</Link>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800">Ingresar</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
