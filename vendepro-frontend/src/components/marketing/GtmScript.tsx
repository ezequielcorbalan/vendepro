// ============================================================
// GtmScript — inyecta Google Tag Manager (head + noscript)
// Soporta Stape (server-side GTM) reemplazando el dominio.
// ============================================================

import Script from 'next/script'

interface Props {
  containerId?: string | null
  stapeEndpoint?: string | null
}

function sanitizeStape(url: string): string | null {
  try {
    const u = new URL(url)
    return `${u.protocol}//${u.host}`
  } catch {
    return null
  }
}

export default function GtmScript({ containerId, stapeEndpoint }: Props) {
  if (!containerId) return null

  const id = containerId.trim()
  if (!id) return null

  const baseUrl = stapeEndpoint
    ? sanitizeStape(stapeEndpoint) ?? 'https://www.googletagmanager.com'
    : 'https://www.googletagmanager.com'

  const inline = `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'${baseUrl}/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${id}');
`.trim()

  const noscriptSrc = `${baseUrl}/ns.html?id=${encodeURIComponent(id)}`

  return (
    <>
      <Script
        id={`gtm-${id}`}
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: inline }}
      />
      <noscript>
        <iframe
          src={noscriptSrc}
          height="0"
          width="0"
          style={{ display: 'none', visibility: 'hidden' }}
        />
      </noscript>
    </>
  )
}
