import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Reportes | Marcela Genta Operaciones Inmobiliarias",
  description: "Reportes de desempeño de propiedades",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
