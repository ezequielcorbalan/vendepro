import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, getEnvVar } from '@/lib/db'
import { processWithGroq, findMatchingLeads } from '@/lib/ai-crm'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const body = (await request.json()) as any
  const { text, source, context } = body

  if (!text || typeof text !== 'string' || text.trim().length < 3) {
    return NextResponse.json({ error: 'Texto demasiado corto' }, { status: 400 })
  }

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const groqKey = await getEnvVar('GROQ_API_KEY')

  // 1. Process with Groq
  const result = await processWithGroq(text, source || 'chat', context, groqKey)

  if (result.error) {
    return NextResponse.json({ error: result.error, intents: [] }, { status: 200 })
  }

  // 2. For each intent, find matching leads if relevant
  const enrichedIntents = []
  for (const intent of result.intents) {
    const enriched = { ...intent, matches: [] as any[] }

    // Extract name/phone for matching
    const name = intent.data?.full_name || intent.data?.lead_name || intent.data?.lead_identifier || intent.data?.contact_name
    const phone = intent.data?.phone || intent.data?.contact_phone

    if (name || phone) {
      enriched.matches = await findMatchingLeads(db, orgId, name, phone)

      // If creating a lead and we found exact match, suggest update instead
      if (intent.action === 'create_lead' && enriched.matches.length > 0) {
        const exactName = enriched.matches.find((m: any) =>
          m.full_name?.toLowerCase() === name?.toLowerCase()
        )
        if (exactName) {
          enriched.suggested_action = 'update_lead'
          enriched.suggested_lead_id = exactName.id
          enriched.suggestion_reason = `Ya existe "${exactName.display_name || exactName.full_name}" (${exactName.stage})`
        }
      }
    }

    enrichedIntents.push(enriched)
  }

  return NextResponse.json({
    intents: enrichedIntents,
    agent_id: user.id,
    agent_name: user.full_name,
  })
}
