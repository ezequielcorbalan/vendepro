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
  const file = formData.get('pdf') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')

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
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `Este es un PDF de estadísticas de KiteProp (CRM inmobiliario argentino).

Extraé todos los datos que puedas. Respondé SOLO con JSON válido:
{
  "property_title": string | null,
  "property_address": string | null,
  "portals": [
    {
      "source": "zonaprop" | "argenprop" | "mercadolibre" | "manual",
      "inquiries": number | null,
      "portal_visits": number | null
    }
  ],
  "total_inquiries": number | null,
  "total_visits_presenciales": number | null,
  "visits_by_source": [
    { "source": string, "count": number }
  ],
  "tasks": {
    "llamadas": number | null,
    "visitas": number | null,
    "reuniones": number | null,
    "emails": number | null,
    "notas": number | null
  },
  "market_comparison": {
    "avg_market_price": number | null,
    "property_price": number | null,
    "result": string | null
  },
  "consultation_trend": [
    { "date": string, "count": number }
  ]
}

Si un dato no está visible, usá null. Extraé todo lo que puedas del PDF.`,
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

    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json(extracted)
  } catch (err: any) {
    console.error('Extract KiteProp error:', err?.message || err)
    return NextResponse.json(
      { error: `Error al extraer datos del PDF: ${err?.message || 'Error desconocido'}. Cargalos manualmente.` },
      { status: 500 }
    )
  }
}
