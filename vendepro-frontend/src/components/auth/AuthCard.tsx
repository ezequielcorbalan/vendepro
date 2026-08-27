import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Heading, Text } from '@/components/ui/Typography'

/**
 * Marco de las pantallas de acceso (login, registro, recuperar y cambiar
 * contraseña): fondo de marca, card centrada, logo y encabezado.
 *
 * Las cuatro pantallas repetían este marco con diferencias que no eran
 * intencionales — el login tenía el fondo con gradiente y los elementos de
 * marca, y las otras tres un gris plano. Vive acá y no en `ui/` porque es el
 * molde de una sección, no un componente del sistema.
 */
interface AuthCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  /** Contenido al pie, fuera de la card (ej. "¿No tenés cuenta?"). */
  footer?: ReactNode
  /** Ancho de la card. Default max-w-md. */
  width?: string
}

export function AuthCard({ title, subtitle, children, footer, width = 'max-w-md' }: AuthCardProps) {
  return (
    // Fondo blanco, sin elementos gráficos ni degradado: la card es lo único
    // que ocupa la pantalla.
    <div className="min-h-screen flex items-center justify-center bg-white px-4 py-8">
      <div className={cn('w-full', width)}>
        <div className="bg-white rounded-card shadow-pop p-5 sm:p-8 relative overflow-hidden">
          {/* Acento de marca: el gradiente se reserva para esto. */}
          <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-brand-pink to-brand-orange" />

          <div className="text-center mb-6 sm:mb-8">
            <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-16 sm:h-20 mx-auto mb-3 sm:mb-4" />
            <Heading level={3}>{title}</Heading>
            {subtitle && <Text tone="muted" className="mt-1">{subtitle}</Text>}
          </div>

          {children}
        </div>

        {footer && <div className="text-center mt-4">{footer}</div>}
      </div>
    </div>
  )
}
