import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { url } = (await request.json()) as any

  if (!url || !url.includes('zonaprop.com')) {
    return NextResponse.json({ success: false, error: 'URL de ZonaProp invalida' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY_2 || process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'API key no configurada' }, { status: 500 })
  }

  try {
    // Fetch the ZonaProp page HTML
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-AR,es;q=0.9',
      },
    })

    if (!pageRes.ok) {
      return NextResponse.json({ success: false, error: 'No se pudo acceder a la URL' }, { status: 400 })
    }

    const html = await pageRes.text()

    // Extract text content (remove scripts, styles, tags)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .substring(0, 8000) // Limit to avoid token limits

    // Use Claude to extract structured data
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
          content: `Extraé los siguientes datos de esta publicación inmobiliaria de ZonaProp. Respondé SOLO en formato JSON sin markdown:

{
  "address": "dirección completa",
  "price": numero_en_usd (sin puntos ni comas),
  "total_area": numero_m2_totales,
  "covered_area": numero_m2_cubiertos,
  "usd_per_m2": precio_dividido_m2,
  "days_on_market": dias_publicado (numero),
  "views_per_day": vistas_por_dia (numero),
  "age": antiguedad_en_anos (numero),
  "rooms": ambientes (numero)
}

Si un dato no está disponible, poné null. El precio siempre en USD.

Texto de la publicación:
${textContent}`
        }],
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      return NextResponse.json({ success: false, error: 'Error de Claude API: ' + err }, { status: 500 })
    }

    const claudeData = await claudeRes.json()
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
