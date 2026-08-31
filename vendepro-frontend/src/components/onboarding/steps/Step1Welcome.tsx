import { Home, LayoutDashboard, Workflow, CalendarDays } from 'lucide-react'
import { StepLayout, StepBullets } from '../StepLayout'

export default function Step1Welcome({ name }: { name: string }) {
  return (
    <StepLayout
      icon={<Home className="w-7 h-7" />}
      title={`¡Bienvenido${name ? `, ${name.split(' ')[0]}` : ''}!`}
      subtitle="VendéPro es el CRM diseñado para inmobiliarias. En unos minutos te mostramos cómo sacarle el máximo provecho."
    >
      <StepBullets
        items={[
          [<LayoutDashboard key="a" className="w-4 h-4" />, 'Gestioná leads, tasaciones y propiedades en un solo lugar'],
          [<Workflow key="b" className="w-4 h-4" />, 'Seguí cada operación desde el primer contacto hasta la venta'],
          [<CalendarDays key="c" className="w-4 h-4" />, 'Automatizá tu seguimiento y nunca pierdas un cliente'],
        ]}
      />
    </StepLayout>
  )
}
