import type {
  BotConversation,
  BotStep,
  LeadIntent,
} from '@vendepro/core'
import { Notification } from '@vendepro/core'
import { D1WhatsappConfigRepository } from '../repositories/d1-whatsapp-config-repository'
import { D1BotConversationRepository } from '../repositories/d1-bot-conversation-repository'
import { D1LeadRepository } from '../repositories/d1-lead-repository'
import { D1UserRepository } from '../repositories/d1-user-repository'
import { D1NotificationRepository } from '../repositories/d1-notification-repository'
import { CallbellWhatsappService } from './callbell-whatsapp-service'
import { GroqAIService } from './groq-ai-service'
import { CryptoIdGenerator } from './crypto-id-generator'
import { decrypt } from './token-encryption'

export interface ProcessBotMessageInput {
  orgId: string
  phone: string
  text: string
}

export interface ProcessBotMessageResult {
  handled: boolean
  step?: string
  error?: string
}

const BOT_QUESTIONS: Record<BotStep, string> = {
  welcome: '', // welcome is the first message sent on lead creation
  zone: '¿En qué zona o barrio te interesa?',
  budget: '¿Tenés un presupuesto estimado en USD?',
  done: 'Perfecto, ya le paso tus datos a un agente que te va a contactar en breve. ¡Gracias!',
}

const STEP_ORDER: BotStep[] = ['welcome', 'zone', 'budget', 'done']

function nextStep(current: BotStep): BotStep {
  const idx = STEP_ORDER.indexOf(current)
  if (idx === -1 || idx >= STEP_ORDER.length - 1) return 'done'
  return STEP_ORDER[idx + 1]!
}

export async function processBotMessage(
  env: { DB: D1Database; JWT_SECRET: string; GROQ_API_KEY?: string },
  input: ProcessBotMessageInput,
): Promise<ProcessBotMessageResult> {
  try {
    const waConfigRepo = new D1WhatsappConfigRepository(env.DB)
    const config = await waConfigRepo.findByOrgId(input.orgId)
    if (!config || !config.bot_enabled || !config.api_token_encrypted) {
      return { handled: false }
    }

    const token = await decrypt(config.api_token_encrypted, env.JWT_SECRET)
    if (!token) return { handled: false }

    const botRepo = new D1BotConversationRepository(env.DB)
    const conversation = await botRepo.findActiveByPhone(input.phone, input.orgId)
    if (!conversation) return { handled: false }

    const waSvc = new CallbellWhatsappService(token)
    const now = new Date().toISOString()

    // Extract intent from the response using AI
    let intent: LeadIntent = {}
    if (env.GROQ_API_KEY && input.text) {
      try {
        const ai = new GroqAIService(env.GROQ_API_KEY)
        intent = await ai.extractLeadIntent(input.text)
      } catch (err) {
        console.error('[bot] AI extraction failed:', (err as Error)?.message)
      }
    }

    // Save answer based on current step
    const answers = { ...conversation.answers }
    switch (conversation.current_step) {
      case 'welcome':
        answers.operation = intent.operation || input.text
        break
      case 'zone':
        answers.zone = intent.neighborhood || input.text
        break
      case 'budget':
        answers.budget = intent.budget?.toString() || input.text
        break
    }

    // Advance to next step
    const next = nextStep(conversation.current_step)
    const updated: BotConversation = {
      ...conversation,
      current_step: next,
      answers,
      status: next === 'done' ? 'completed' : 'active',
      updated_at: now,
    }
    await botRepo.save(updated)

    // Update lead with extracted data
    if (conversation.lead_id) {
      try {
        const leadRepo = new D1LeadRepository(env.DB)
        const lead = await leadRepo.findById(conversation.lead_id, input.orgId)
        if (lead) {
          const obj = lead.toObject()
          const patch: Record<string, unknown> = { updated_at: now }
          if (answers.operation && !obj.operation) patch.operation = normalizeOperation(answers.operation)
          if (answers.zone && !obj.neighborhood) patch.neighborhood = answers.zone
          if (answers.budget && !obj.budget) patch.budget = answers.budget

          if (Object.keys(patch).length > 1) {
            await env.DB
              .prepare(
                `UPDATE leads SET
                  operation = COALESCE(?, operation),
                  neighborhood = COALESCE(?, neighborhood),
                  budget = COALESCE(?, budget),
                  updated_at = ?
                WHERE id = ? AND org_id = ?`,
              )
              .bind(
                patch.operation as string ?? null,
                patch.neighborhood as string ?? null,
                patch.budget as string ?? null,
                now,
                conversation.lead_id,
                input.orgId,
              )
              .run()
          }
        }
      } catch (err) {
        console.error('[bot] lead update failed:', (err as Error)?.message)
      }
    }

    // Send next question or closing message
    const questionText = BOT_QUESTIONS[next]
    if (questionText) {
      await waSvc.sendMessage({ to: input.phone, text: questionText })
    }

    // If done, advance lead stage and notify agent
    if (next === 'done' && conversation.lead_id) {
      try {
        await env.DB
          .prepare(
            `UPDATE leads SET stage = 'contactado', first_contact_at = COALESCE(first_contact_at, ?), updated_at = ? WHERE id = ? AND org_id = ? AND stage IN ('nuevo', 'asignado')`,
          )
          .bind(now, now, conversation.lead_id, input.orgId)
          .run()

        // Notify assigned agent
        const leadRow = await env.DB
          .prepare('SELECT assigned_to, full_name FROM leads WHERE id = ? AND org_id = ?')
          .bind(conversation.lead_id, input.orgId)
          .first() as any
        if (leadRow?.assigned_to) {
          const idGen = new CryptoIdGenerator()
          const notifRepo = new D1NotificationRepository(env.DB)
          const notif = Notification.create({
            id: idGen.generate(),
            org_id: input.orgId,
            user_id: leadRow.assigned_to,
            kind: 'lead_qualified',
            title: `Lead calificado: ${leadRow.full_name}`,
            body: `Op: ${answers.operation ?? '?'} | Zona: ${answers.zone ?? '?'} | Presup: ${answers.budget ?? '?'}`,
            link_url: `/leads?id=${conversation.lead_id}`,
            read: false,
          })
          await notifRepo.save(notif)
        }
      } catch (err) {
        console.error('[bot] lead stage advance / notification failed:', (err as Error)?.message)
      }
    }

    return { handled: true, step: next }
  } catch (err) {
    console.error('[bot] processBotMessage failed (swallowed):', (err as Error)?.message ?? err)
    return { handled: false, error: (err as Error)?.message }
  }
}

function normalizeOperation(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('compr') || lower.includes('busco') || lower.includes('alquil')) {
    if (lower.includes('alquil')) return 'alquiler'
    return 'compra'
  }
  if (lower.includes('vend') || lower.includes('tas')) return 'venta'
  return 'otro'
}
