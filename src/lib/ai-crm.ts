// AI CRM — Groq integration for structured entity extraction
import { LEAD_STAGES, ACTIVITY_TYPES } from './crm-config'

// Fallback chain: if one model is decommissioned, try the next
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama3-70b-8192',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
]

// ── System prompt ─────────────────────────────────────────
const SYSTEM_PROMPT = `Sos un asistente de CRM inmobiliario argentino.
Tu trabajo es extraer intents y entidades de mensajes de agentes inmobiliarios.

REGLAS:
- Responde SOLO JSON válido, sin markdown, sin explicación, sin backticks
- Detectá múltiples acciones si el mensaje las contiene
- Si no estás seguro de un campo, poné null, no inventes
- Si detectás un teléfono, normalizalo: si empieza con 11 o 15, agregá +5411
- "Depto" = departamento, "PH" = ph, "3 amb" = rooms: 3
- Barrios de CABA y GBA: normalizá al nombre estándar (Villa Urquiza, Palermo, Belgrano, etc)
- Para fechas relativas: "la semana que viene" = 7 días, "mañana" = 1 día, "en 3 días" = 3 días

INTENTS POSIBLES:
- create_lead: nuevo contacto comercial (vendedor o comprador)
- update_lead: actualizar datos de un lead existente
- create_activity: registrar acción realizada (llamada, visita, reunión, etc)
- create_appraisal: iniciar tasación de propiedad
- schedule_followup: agendar tarea o seguimiento futuro
- append_note: agregar nota libre a un lead existente

ACTIVITY_TYPES: ${Object.keys(ACTIVITY_TYPES).join(', ')}
OPERATIONS: venta, alquiler, alquiler_temporario
PROPERTY_TYPES: departamento, casa, ph, local, terreno, oficina
LEAD_STAGES: ${Object.keys(LEAD_STAGES).join(', ')}

FORMATO DE RESPUESTA (SOLO ESTE JSON, NADA MÁS):
{
  "intents": [
    {
      "action": "create_lead | update_lead | create_activity | create_appraisal | schedule_followup | append_note",
      "confidence": 0.0 a 1.0,
      "data": {
        // campos relevantes según el intent
      },
      "missing_fields": ["campo1", "campo2"],
      "reasoning": "explicación breve de por qué elegiste este intent"
    }
  ]
}

CAMPOS POR INTENT:
create_lead: full_name, phone, email, operation (venta/alquiler), property_type, rooms, neighborhood, address, estimated_value, source, notes, next_step, next_step_date (YYYY-MM-DD)
update_lead: lead_identifier (nombre o teléfono para buscar), + cualquier campo de arriba
create_activity: activity_type, description, lead_name (para vincular), result, duration_minutes
create_appraisal: address, neighborhood, property_type, rooms, covered_area, total_area, contact_name, contact_phone, contact_email, estimated_value, notes
schedule_followup: title, event_type (llamada/reunion/visita_captacion/seguimiento/etc), start_date (YYYY-MM-DD), start_time (HH:MM), lead_name (para vincular), description
append_note: lead_identifier, note_text`

// ── Context enhancement ───────────────────────────────────
function buildContextPrompt(context?: { module?: string; entity_id?: string; entity_data?: any }): string {
  if (!context?.module) return ''
  let ctx = `\nCONTEXTO: El usuario está en el módulo de ${context.module}.`
  if (context.entity_data) {
    const d = context.entity_data
    ctx += `\nEntidad actual: ${d.full_name || d.title || d.address || 'desconocido'}`
    if (d.phone) ctx += `, tel: ${d.phone}`
    if (d.stage) ctx += `, etapa: ${d.stage}`
    if (d.operation) ctx += `, operación: ${d.operation}`
  }
  ctx += `\nPriorizá intents relevantes a este módulo.`
  return ctx
}

// ── Call Groq API ─────────────────────────────────────────
export async function processWithGroq(
  text: string,
  source: string,
  context?: { module?: string; entity_id?: string; entity_data?: any },
  groqApiKey?: string
): Promise<{ intents: any[]; raw?: string; error?: string }> {
  const apiKey = groqApiKey || process.env.GROQ_API_KEY || ''
  if (!apiKey) return { intents: [], error: 'GROQ_API_KEY not configured' }

  const contextPrompt = buildContextPrompt(context)
  const userMessage = contextPrompt
    ? `${text}\n\n---\n${contextPrompt}`
    : text

  try {
    let data: any = null
    let lastError = ''

    for (const model of GROQ_MODELS) {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      })

      if (res.ok) {
        data = (await res.json()) as any
        break // Model worked, stop trying
      }

      // Model failed (decommissioned, rate limited, etc.) — try next
      lastError = await res.text()
      console.warn(`Groq model ${model} failed, trying next...`)
    }

    if (!data) {
      return { intents: [], error: `All Groq models failed. Last error: ${lastError}` }
    }
    const content = data.choices?.[0]?.message?.content || '{}'

    let parsed: any
    try {
      parsed = JSON.parse(content)
    } catch {
      return { intents: [], raw: content, error: 'Failed to parse Groq response as JSON' }
    }

    const intents = Array.isArray(parsed.intents) ? parsed.intents : []

    // Normalize confidence to 0-1
    intents.forEach((intent: any) => {
      if (typeof intent.confidence === 'number' && intent.confidence > 1) {
        intent.confidence = intent.confidence / 100
      }
      // Ensure data object exists
      intent.data = intent.data || {}
      intent.missing_fields = intent.missing_fields || []
    })

    return { intents }
  } catch (err: any) {
    return { intents: [], error: err.message }
  }
}

// ── Match leads by name/phone ─────────────────────────────
export async function findMatchingLeads(
  db: any,
  orgId: string,
  name?: string | null,
  phone?: string | null
): Promise<any[]> {
  if (!name && !phone) return []

  const matches: any[] = []

  if (name) {
    const nameResults = (await db.prepare(`
      SELECT id, full_name, phone, property_address, stage, operation, neighborhood, assigned_to
      FROM leads WHERE org_id = ? AND LOWER(full_name) LIKE ? AND stage != 'perdido'
      ORDER BY updated_at DESC LIMIT 5
    `).bind(orgId, `%${name.toLowerCase()}%`).all()).results as any[]
    matches.push(...nameResults.map((r: any) => ({
      ...r, match_type: 'name',
      display_name: r.full_name + (r.property_address ? ` · ${r.property_address}` : r.neighborhood ? ` · ${r.neighborhood}` : '')
    })))
  }

  if (phone) {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length >= 6) {
      const phoneResults = (await db.prepare(`
        SELECT id, full_name, phone, stage, operation, neighborhood, assigned_to
        FROM leads WHERE org_id = ? AND REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', '') LIKE ? AND stage != 'perdido'
        ORDER BY updated_at DESC LIMIT 5
      `).bind(orgId, `%${cleanPhone.slice(-8)}%`).all()).results as any[]
      // Deduplicate
      for (const r of phoneResults) {
        if (!matches.find(m => m.id === r.id)) {
          matches.push({ ...r, match_type: 'phone' })
        }
      }
    }
  }

  return matches
}

// ── Compute relative dates ────────────────────────────────
export function resolveRelativeDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  // Already YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr

  const now = new Date(Date.now() - 3 * 3600000) // AR timezone
  const lower = dateStr.toLowerCase().trim()

  // Spanish relative dates
  if (lower === 'hoy' || lower === 'today') return now.toISOString().split('T')[0]
  if (lower === 'mañana' || lower === 'manana' || lower === 'tomorrow') {
    now.setDate(now.getDate() + 1)
    return now.toISOString().split('T')[0]
  }
  if (lower === 'pasado mañana' || lower === 'pasado manana') {
    now.setDate(now.getDate() + 2)
    return now.toISOString().split('T')[0]
  }
  if (lower.includes('semana que viene') || lower.includes('proxima semana') || lower.includes('próxima semana') || lower === 'next week') {
    now.setDate(now.getDate() + 7)
    return now.toISOString().split('T')[0]
  }

  // "en N días" / "en N dias"
  const enDias = lower.match(/en\s+(\d+)\s*d[ií]as?/)
  if (enDias) {
    now.setDate(now.getDate() + parseInt(enDias[1]))
    return now.toISOString().split('T')[0]
  }

  // +N days format
  const plusDays = dateStr.match(/\+(\d+)\s*d/)
  if (plusDays) {
    now.setDate(now.getDate() + parseInt(plusDays[1]))
    return now.toISOString().split('T')[0]
  }

  // "lunes", "martes", etc → next occurrence
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'miercoles', 'jueves', 'viernes', 'sábado', 'sabado']
  const dayIdx = dayNames.findIndex(d => lower.includes(d))
  if (dayIdx >= 0) {
    const targetDay = dayIdx >= 4 ? dayIdx - 1 : dayIdx // adjust for miercoles duplicate
    const currentDay = now.getDay()
    let daysAhead = targetDay - currentDay
    if (daysAhead <= 0) daysAhead += 7
    now.setDate(now.getDate() + daysAhead)
    return now.toISOString().split('T')[0]
  }

  return dateStr
}
