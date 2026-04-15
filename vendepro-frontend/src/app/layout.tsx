import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VendéPro | CRM Inmobiliario',
  description: 'CRM inmobiliario para la gestión del pipeline comercial',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
