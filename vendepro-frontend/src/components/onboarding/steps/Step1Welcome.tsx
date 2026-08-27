import { Home, Target, RefreshCw, CalendarCheck } from 'lucide-react'
import { StepLayout } from './StepLayout'

export default function Step1Welcome({ name }: { name: string }) {
  return (
    <StepLayout
      hero
      icon={<Home className="w-10 h-10" />}
      title={`¡Bienvenido${name ? `, ${name.split(' ')[0]}` : ''}!`}
      description="VendéPro es el CRM diseñado para inmobiliarias. En unos minutos te mostramos cómo sacarle el máximo provecho."
      points={[
        { icon: <Target className="w-4 h-4" />, text: 'Gestioná leads, tasaciones y propiedades en un solo lugar' },
        { icon: <RefreshCw className="w-4 h-4" />, text: 'Seguí cada operación desde el primer contacto hasta la venta' },
        { icon: <CalendarCheck className="w-4 h-4" />, text: 'Automatizá tu seguimiento y nunca pierdas un cliente' },
      ]}
    />
  )
}
