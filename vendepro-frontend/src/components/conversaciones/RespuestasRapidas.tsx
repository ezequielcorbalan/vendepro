'use client'

import { useRouter } from 'next/navigation'
import { Zap, Settings } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui/Dropdown'
import { useWhatsAppTemplates, renderWhatsAppTemplate } from '@/lib/whatsapp-templates'

/**
 * Respuestas rápidas del compositor: los mismos "mensajes predeterminados de
 * WhatsApp" que la inmobiliaria ya carga en Configuración, con sus variables
 * resueltas para este cliente. El texto se pega en la caja —no se manda—
 * para que el agente lo ajuste antes de enviar.
 */
interface RespuestasRapidasProps {
  /** Nombre del contacto, para {{nombre}}. */
  nombre: string | null
  onElegir: (texto: string) => void
  /** Sólo admin/owner editan las plantillas: a ellos se les ofrece el atajo. */
  puedeConfigurar: boolean
}

export function RespuestasRapidas({ nombre, onElegir, puedeConfigurar }: RespuestasRapidasProps) {
  const { templates, orgName, loading } = useWhatsAppTemplates()
  const router = useRouter()

  return (
    <Dropdown
      align="right"
      trigger={
        <Button variant="outline" size="icon" aria-label="Respuestas rápidas" title="Respuestas rápidas" icon={<Zap className="w-4 h-4" />} />
      }
    >
      {loading ? (
        <DropdownItem>Cargando…</DropdownItem>
      ) : templates.length === 0 ? (
        <DropdownItem>No hay respuestas rápidas cargadas</DropdownItem>
      ) : (
        templates.map(t => (
          <DropdownItem key={t.id} onClick={() => onElegir(renderWhatsAppTemplate(t.body, { name: nombre }, { orgName }))}>
            {t.name}
          </DropdownItem>
        ))
      )}
      {puedeConfigurar && (
        <>
          <DropdownSeparator />
          <DropdownItem icon={<Settings className="w-3.5 h-3.5" />} onClick={() => router.push('/configuracion/whatsapp')}>
            Editar respuestas rápidas
          </DropdownItem>
        </>
      )}
    </Dropdown>
  )
}
