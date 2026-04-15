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
