'use client'

import { ArrowRight, Rocket, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Heading, Text } from '@/components/ui/Typography'

interface Props {
  name: string
  onClose: () => void
}

export default function Step8Ready({ name, onClose }: Props) {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center text-center px-4 py-6 gap-6">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center shadow-lg shadow-primary/20">
        <Rocket className="w-10 h-10 text-white" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <Heading level={2}>
          ¡Todo listo{name ? `, ${name.split(' ')[0]}` : ''}!
        </Heading>
        <Text tone="muted" className="max-w-sm">
          Ya conocés VendéPro. Empezá cargando tu primer lead o explorando el dashboard.
        </Text>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Button variant="outline" onClick={onClose} className="flex-1 justify-center">
          Ir al Dashboard
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button onClick={() => { onClose(); router.push('/leads') }} className="flex-1 justify-center">
          <Users className="w-4 h-4" aria-hidden="true" />
          Cargar mi primer Lead
        </Button>
      </div>

      <Text size="xs" tone="muted">
        Podés volver a ver este tutorial desde{' '}
        <span className="text-gray-500 font-medium">Configuración → Ayuda</span>
      </Text>
    </div>
  )
}
