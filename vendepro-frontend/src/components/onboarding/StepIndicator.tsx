import { Text } from '@/components/ui/Typography'

// ds-todo: candidato a componente "Stepper" — el patrón (puntos + paso activo
// estirado) está en el muestrario pero no existe como componente del DS.
interface Props {
  total: number
  current: number
}

export default function StepIndicator({ total, current }: Props) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1
        const isActive = step === current
        const isDone = step < current
        return (
          <div
            key={step}
            className={`rounded-full transition-all duration-300 ${
              isActive
                ? 'w-6 h-2 bg-gradient-to-r from-brand-pink to-brand-orange'
                : isDone
                ? 'w-2 h-2 bg-primary'
                : 'w-2 h-2 bg-gray-200'
            }`}
          />
        )
      })}
      <Text size="xs" tone="muted" as="span" className="ml-1">{current}/{total}</Text>
    </div>
  )
}
