import { NextResponse } from 'next/server'
import { getEnvVar } from '@/lib/db'

export async function POST(request: Request) {
  const apiKey = await getEnvVar('ANTHROPIC_API_KEY')
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Extracción automática no configurada.' },
      { status: 501 }
    )
  }

  const formData = await request.formData()
  const file = formData.get('pdf') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No se envió ningún archivo' }, { status: 400 })
  }

  // Convert PDF to base64 for Claude
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
      console.error('Claude API error:', errText)
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json() as any
    const text = data.content[0]?.text || '{}'

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No se pudo parsear la respuesta')
    }

    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json(extracted)
  } catch (err: any) {
    console.error('Extract KiteProp error:', err)
    return NextResponse.json(
      { error: 'Error al extraer datos del PDF. Cargalos manualmente.' },
      { status: 500 }
    )
  }
}
