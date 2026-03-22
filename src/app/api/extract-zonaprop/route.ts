import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const screenshot = formData.get('screenshot') as File | null

  if (!screenshot) {
    return NextResponse.json({ success: false, error: 'Se requiere un screenshot' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY_2 || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key no configurada' }, { status: 500 })
  }

  try {
    // Convert file to base64
    const bytes = await screenshot.arrayBuffer()
    const base64 = btoa(String.fromCharCode(...new Uint8Array(bytes)))
    const mediaType = screenshot.type || 'image/png'

    // Use Claude Vision to extract data from screenshot
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        messages: [{
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
              text: `Este es un screenshot de una publicación inmobiliaria de ZonaProp. Extraé los siguientes datos. Respondé SOLO en formato JSON sin markdown ni explicaciones:

{
  "address": "dirección completa",
  "price": numero_en_usd (sin puntos ni comas, solo el numero),
  "total_area": numero_m2_totales,
  "covered_area": numero_m2_cubiertos,
  "usd_per_m2": precio_dividido_m2_totales,
  "days_on_market": dias_publicado (numero),
  "views_per_day": vistas_por_dia (numero),
  "age": antiguedad_en_anos (numero),
  "rooms": ambientes (numero)
}

Si un dato no está visible en el screenshot, poné null. El precio siempre en USD.`,
            },
          ],
        }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      return NextResponse.json({ success: false, error: 'Error de Claude API: ' + err }, { status: 500 })
    }

    const claudeData = (await claudeRes.json()) as any
    const responseText = claudeData.content?.[0]?.text || ''

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: 'No se pudo parsear la respuesta' }, { status: 500 })
    }

    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, data: extracted })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
