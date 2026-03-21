import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function POST(request: Request) {
  let apiKey: string | undefined

  try {
    const { env } = await getCloudflareContext()
    apiKey = (env as any).ANTHROPIC_API_KEY
  } catch (e) {
    console.error('Failed to get Cloudflare context:', e)
  }

  // Fallback to process.env
  if (!apiKey) {
    apiKey = process.env.ANTHROPIC_API_KEY
  }

  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not found in env or context')
    return NextResponse.json(
      { error: 'Extracción automática no configurada. Falta ANTHROPIC_API_KEY.' },
      { status: 501 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('screenshot') as File | null
  const source = formData.get('source') as string || 'zonaprop'

  if (!file) {
    return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mediaType = file.type || 'image/png'

  const portalName = {
    zonaprop: 'ZonaProp',
    argenprop: 'Argenprop',
    mercadolibre: 'MercadoLibre',
    manual: 'portal inmobiliario',
  }[source] || source

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `Analizá esta captura de pantalla de estadísticas de ${portalName} (portal inmobiliario argentino).

Extraé los siguientes datos numéricos. Si un dato no es visible, devolvé null.

Respondé SOLO con JSON válido, sin explicaciones:
{
  "impressions": number | null,
  "portal_visits": number | null,
  "inquiries": number | null,
  "phone_calls": number | null,
  "whatsapp": number | null,
  "ranking_position": number | null,
  "source": "${source}",
  "confidence": "high" | "medium" | "low"
}

Notas:
- "impressions" = impresiones, veces que apareció el aviso en búsquedas
- "portal_visits" = visitas al aviso, clicks en el aviso
- "inquiries" = consultas, mensajes recibidos
- "phone_calls" = llamadas telefónicas
- "whatsapp" = mensajes de WhatsApp
- "ranking_position" = posición en el ranking de la zona
- "confidence" = qué tan seguro estás de la extracción`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Claude API error status:', response.status, 'body:', errText)
      throw new Error(`API error: ${response.status} - ${errText}`)
    }

    const data = await response.json() as any
    const text = data.content[0]?.text || '{}'

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('Could not parse JSON from Claude response:', text)
      throw new Error('No se pudo parsear la respuesta')
    }

    const metrics = JSON.parse(jsonMatch[0])
    return NextResponse.json(metrics)
  } catch (err: any) {
    console.error('Extract metrics error:', err?.message || err)
    return NextResponse.json(
      { error: `Error al extraer métricas: ${err?.message || 'Error desconocido'}. Cargalos manualmente.` },
      { status: 500 }
    )
  }
}
