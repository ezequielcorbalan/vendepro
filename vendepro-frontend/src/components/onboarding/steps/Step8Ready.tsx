'use client'

import { ArrowRight, Rocket, Users } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Text } from '@/components/ui/Typography'
import { StepLayout } from './StepLayout'

interface Props {
  name: string
  onClose: () => void
}

export default function Step8Ready({ name, onClose }: Props) {
  const router = useRouter()

  return (
    <StepLayout
      hero
      icon={<Rocket className="w-10 h-10" />}
      title={`¡Todo listo${name ? `, ${name.split(' ')[0]}` : ''}!`}
      description="Ya conocés VendéPro. Empezá cargando tu primer lead o explorando el dashboard."
      points={[]}
      footer={
        <>
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button variant="outline" onClick={onClose} className="flex-1 justify-center">
              Ir al Dashboard
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              onClick={() => { onClose(); router.push('/leads') }}
              className="flex-1 justify-center"
            >
              <Users className="w-4 h-4" aria-hidden="true" />
              Cargar mi primer Lead
            </Button>
          </div>

          <Text size="xs" tone="muted">
            Podés volver a ver este tutorial desde{' '}
            <Text size="xs" weight="medium" as="span" className="text-gray-500">Configuración → Ayuda</Text>
          </Text>
        </>
      }
    />
  )
}
