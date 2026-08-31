'use client'

import { ArrowRight, Users, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { StepLayout } from '../StepLayout'

interface Props {
  name: string
  onClose: () => void
}

export default function Step8Ready({ name, onClose }: Props) {
  return (
    <StepLayout
      icon={<Rocket className="w-7 h-7" />}
      title={`¡Todo listo${name ? `, ${name.split(' ')[0]}` : ''}!`}
      subtitle="Ya conocés VendéPro. Empezá cargando tu primer lead o explorando el dashboard."
    >
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
        <Button
          variant="outline"
          size="lg"
          onClick={onClose}
          className="flex-1 whitespace-nowrap"
        >
          Ir al Dashboard <ArrowRight className="w-4 h-4" />
        </Button>
        <Button
          href="/leads"
          size="lg"
          onClick={onClose}
          icon={<Users className="w-4 h-4" />}
          className="flex-1 whitespace-nowrap"
        >
          Cargar mi primer lead
        </Button>
      </div>

      <Text size="xs" tone="muted">
        Podés volver a ver este tutorial desde{' '}
        <span className="text-gray-500 font-medium">Configuración → Ayuda</span>
      </Text>
    </StepLayout>
  )
}
