import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ingresar',
  description: 'Accedé a tu cuenta de VendéPro. CRM inmobiliario para agentes profesionales.',
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
