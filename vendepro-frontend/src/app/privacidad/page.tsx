import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Heading, Text } from '@/components/ui/Typography'

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Cómo VendéPro trata los datos personales y cómo pedir su eliminación.',
}

const CONTACTO = 'gastontobi@gmail.com'

function Seccion({ id, titulo, children }: { id?: string; titulo: string; children: ReactNode }) {
  return (
    <section id={id} className="space-y-3 scroll-mt-8">
      <Heading level={3}>{titulo}</Heading>
      {children}
    </section>
  )
}

function Parrafo({ children }: { children: ReactNode }) {
  return <Text tone="muted" className="leading-relaxed">{children}</Text>
}

function Lista({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((item, i) => (
        <Text key={i} as="li" tone="muted" className="leading-relaxed">{item}</Text>
      ))}
    </ul>
  )
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-8 flex items-center h-16">
          <Link href="/" className="font-bold text-ink">
            Vendé<span className="text-brand-pink">Pro</span>
          </Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-8">
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        <Heading level={1} className="mb-2">Política de Privacidad</Heading>
        <Text tone="muted" className="mb-10">Última actualización: octubre 2026</Text>

        <div className="space-y-8">
          <Seccion titulo="1. Quiénes somos">
            <Parrafo>
              VendéPro es una plataforma de gestión inmobiliaria (CRM) que usan inmobiliarias y sus agentes para
              ordenar su trabajo comercial: consultas, contactos, tasaciones, propiedades, reservas y ventas.
              VendéPro es responsable del tratamiento de los datos que se procesan en la plataforma, en los
              términos de la Ley 25.326 de Protección de los Datos Personales de la República Argentina.
            </Parrafo>
          </Seccion>

          <Seccion titulo="2. Qué datos tratamos">
            <Lista items={[
              <><strong>De los usuarios de la plataforma</strong> (agentes y administradores): nombre, email, teléfono y rol dentro de su inmobiliaria.</>,
              <><strong>De los clientes de cada inmobiliaria</strong> (personas que consultan, propietarios, compradores): nombre, teléfono, email, la consulta que hicieron y los datos de la propiedad que les interesa o quieren vender.</>,
              <><strong>De formularios de anuncios de Meta</strong> (Facebook e Instagram): las respuestas que la persona completó en el formulario, y el nombre de la campaña y del anuncio desde el que llegó.</>,
              <><strong>De mensajes</strong> que la persona envía a la inmobiliaria por WhatsApp, Instagram o Facebook, cuando la inmobiliaria conecta esos canales.</>,
              <><strong>Datos técnicos</strong> en las páginas públicas (formularios, fichas, landings): dirección IP y tipo de navegador, para seguridad y medición.</>,
            ]} />
          </Seccion>

          <Seccion titulo="3. Para qué los usamos">
            <Lista items={[
              'Registrar cada consulta y que la inmobiliaria pueda contactar a la persona y darle seguimiento.',
              'Gestionar tasaciones, propiedades, visitas, reservas y operaciones.',
              'Medir el resultado de las campañas publicitarias de la inmobiliaria.',
            ]} />
            <Parrafo>
              Para medir campañas, VendéPro informa a Meta y Google en qué etapa está cada consulta (por ejemplo,
              «tasación» o «captada»). Esos envíos usan el identificador que la propia plataforma publicitaria
              asignó a la consulta y el email y teléfono <strong>cifrados con un hash irreversible (SHA-256)</strong>:
              no se envían en texto legible.
            </Parrafo>
          </Seccion>

          <Seccion titulo="4. Con quién los compartimos">
            <Parrafo>
              VendéPro no vende ni cede datos personales. Sólo los procesan los proveedores que hacen funcionar
              el servicio, y únicamente para eso:
            </Parrafo>
            <Lista items={[
              'Cloudflare: alojamiento de la plataforma y la base de datos.',
              'Meta (Facebook, Instagram, WhatsApp): recepción de formularios y mensajes, y medición de campañas.',
              'Google: calendario, Drive y medición de campañas, cuando la inmobiliaria los conecta.',
              'Proveedores de inteligencia artificial: para leer documentos e imágenes que el usuario sube a la plataforma.',
              'Servicio de envío de emails: para los correos que la plataforma o la inmobiliaria envían.',
            ]} />
          </Seccion>

          <Seccion titulo="5. Cuánto tiempo los guardamos">
            <Parrafo>
              Los datos se conservan mientras la inmobiliaria use la plataforma y los necesite para su gestión
              comercial. Si una inmobiliaria cancela el servicio, sus datos se eliminan a los 90 días. Cualquier
              persona puede pedir antes la eliminación de sus datos (ver punto 8).
            </Parrafo>
          </Seccion>

          <Seccion titulo="6. Seguridad">
            <Parrafo>
              Los datos viajan cifrados y se almacenan cifrados en reposo. Las credenciales de las integraciones
              (por ejemplo, el acceso a la página de Facebook de la inmobiliaria) se guardan cifradas. Cada
              inmobiliaria sólo accede a sus propios datos.
            </Parrafo>
          </Seccion>

          <Seccion titulo="7. Tus derechos">
            <Parrafo>
              Podés pedir en cualquier momento acceder a tus datos, corregirlos o eliminarlos, escribiendo a{' '}
              <a href={`mailto:${CONTACTO}`} className="text-primary underline">{CONTACTO}</a>.
              El acceso es gratuito a intervalos no menores a seis meses, salvo interés legítimo (art. 14, inc. 3,
              Ley 25.326).
            </Parrafo>
            <Parrafo>
              La Agencia de Acceso a la Información Pública, como órgano de control de la Ley 25.326, tiene la
              atribución de atender las denuncias y reclamos de quienes resulten afectados en sus derechos por el
              incumplimiento de las normas vigentes en materia de protección de datos personales.
            </Parrafo>
          </Seccion>

          <Seccion id="eliminacion-de-datos" titulo="8. Cómo pedir la eliminación de tus datos">
            <Parrafo>
              Si dejaste tus datos en un formulario, un anuncio de Facebook o Instagram, o en un mensaje a una
              inmobiliaria que usa VendéPro, y querés que se borren:
            </Parrafo>
            <Lista items={[
              <>Escribí a <a href={`mailto:${CONTACTO}`} className="text-primary underline">{CONTACTO}</a> con el asunto «Eliminar mis datos».</>,
              'Indicá tu nombre y el email o teléfono que dejaste, y, si lo sabés, la inmobiliaria a la que consultaste.',
              'Eliminamos tus datos de contacto y tus consultas en un plazo máximo de 5 días hábiles y te confirmamos por email.',
            ]} />
            <Parrafo>
              Si conectaste tu cuenta de Facebook con VendéPro, también podés quitar el acceso desde Facebook:
              Configuración y privacidad → Configuración → Apps y sitios web.
            </Parrafo>
          </Seccion>

          <Seccion titulo="9. Cambios en esta política">
            <Parrafo>
              Si cambiamos esta política, actualizamos la fecha de arriba. Los cambios importantes se avisan a las
              inmobiliarias que usan la plataforma.
            </Parrafo>
          </Seccion>

          <Seccion titulo="10. Contacto">
            <Parrafo>
              Para cualquier consulta sobre privacidad:{' '}
              <a href={`mailto:${CONTACTO}`} className="text-primary underline">{CONTACTO}</a>.
            </Parrafo>
          </Seccion>
        </div>
      </main>
    </div>
  )
}
