import type { Metadata } from 'next'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vendepro.com.ar'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'VendéPro — CRM Inmobiliario para Agentes',
    template: '%s | VendéPro',
  },
  description:
    'CRM inmobiliario para agentes y equipos. Gestioná leads, tasaciones, propiedades, reservas y reportes de gestión desde un solo lugar.',
  keywords: [
    'CRM inmobiliario',
    'gestión inmobiliaria',
    'software inmobiliario Argentina',
    'tasaciones online',
    'leads inmobiliarios',
    'pipeline inmobiliario',
    'agente inmobiliario',
    'VendéPro',
  ],
  authors: [{ name: 'Marcela Genta Operaciones Inmobiliarias' }],
  creator: 'VendéPro',
  publisher: 'VendéPro',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'es_AR',
    url: SITE_URL,
    siteName: 'VendéPro',
    title: 'VendéPro — CRM Inmobiliario para Agentes',
    description:
      'Gestioná todo tu negocio inmobiliario desde un solo lugar: leads, tasaciones, propiedades, reservas y reportes.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VendéPro — CRM Inmobiliario',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VendéPro — CRM Inmobiliario para Agentes',
    description:
      'Gestioná todo tu negocio inmobiliario desde un solo lugar: leads, tasaciones, propiedades, reservas y reportes.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
