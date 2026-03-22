import { NextRequest, NextResponse } from 'next/server'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

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
    const bytes = await screenshot.arrayBuffer()
    const base64 = arrayBufferToBase64(bytes)
    const mediaType = screenshot.type || 'image/png'

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64 },
            },
            {
              type: 'text',
              text: `Este es un screenshot de una publicación inmobiliaria de ZonaProp o Argenprop. Extraé los siguientes datos. Respondé SOLO en formato JSON sin markdown ni explicaciones ni backticks:

{
  "address": "dirección completa de la propiedad",
  "price": numero_en_usd (sin puntos ni comas, solo el numero entero),
  "total_area": numero_m2_totales (superficie total incluyendo descubierto),
  "covered_area": numero_m2_cubiertos (superficie cubierta),
  "usd_per_m2": precio_dividido_superficie_total (redondeado a entero),
  "days_on_market": dias_publicado (numero entero),
  "views_30d": vistas_totales_ultimos_30_dias (numero entero, ZonaProp muestra "X visitas en los últimos 30 días"),
  "views_per_day": vistas_30d dividido 30 (redondeado a 1 decimal),
  "age": antiguedad_en_anos (numero entero),
  "rooms": cantidad_de_ambientes (numero entero),
  "property_type": tipo de propiedad (departamento, casa, ph, local, terreno, oficina)
}

REGLAS:
- Si el precio está en pesos o en otra moneda, convertilo a USD estimando.
- Si un dato no está visible, poné null.
- Si dice "hace X días" eso son los days_on_market.
- ZonaProp muestra las vistas de los ÚLTIMOS 30 DÍAS, no totales. Ese dato va en views_30d.
- views_per_day = views_30d / 30.
- usd_per_m2 = price / total_area (redondeado).
- covered_area es la superficie CUBIERTA, distinta de total_area.`,
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

    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ success: false, error: 'No se pudo parsear: ' + responseText.substring(0, 200) }, { status: 500 })
    }

    const extracted = JSON.parse(jsonMatch[0])
    return NextResponse.json({ success: true, data: extracted })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Error desconocido' }, { status: 500 })
  }
}
