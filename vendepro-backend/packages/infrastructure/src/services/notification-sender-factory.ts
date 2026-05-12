import {
  type NotificationRepository,
  type UserRepository,
  type WhatsappConfigRepository,
  type BotConversationRepository,
  type WhatsappService,
  type EmailService,
  type IdGenerator,
  Notification,
} from '@vendepro/core'
import { D1WhatsappConfigRepository } from '../repositories/d1-whatsapp-config-repository'
import { D1BotConversationRepository } from '../repositories/d1-bot-conversation-repository'
import { D1NotificationRepository } from '../repositories/d1-notification-repository'
import { D1UserRepository } from '../repositories/d1-user-repository'
import { CallbellWhatsappService } from './callbell-whatsapp-service'
import { EmBlueEmailService } from './emblue-email-service'
import { CryptoIdGenerator } from './crypto-id-generator'
import { decrypt } from './token-encryption'

export interface NotifyNewLeadInput {
  orgId: string
  leadId: string
  leadName: string
  leadPhone: string | null
  leadEmail: string | null
  leadSource: string
  assignedToUserId: string | null
}

export async function fireNewLeadNotification(
  env: { DB: D1Database; JWT_SECRET: string; EMBLUE_API_KEY?: string },
  input: NotifyNewLeadInput,
): Promise<void> {
  try {
    const waConfigRepo = new D1WhatsappConfigRepository(env.DB)
    const config = await waConfigRepo.findByOrgId(input.orgId)
    if (!config) return

    const idGen = new CryptoIdGenerator()
    const userRepo = new D1UserRepository(env.DB)
    const notifRepo = new D1NotificationRepository(env.DB)

    // 1. Email al agente asignado
    if (config.notify_agent_email && input.assignedToUserId && env.EMBLUE_API_KEY) {
      try {
        const agent = await userRepo.findById(input.assignedToUserId, input.orgId)
        if (agent) {
          const emailSvc = new EmBlueEmailService(env.EMBLUE_API_KEY)
          await emailSvc.send({
            to: { email: agent.email, name: agent.full_name },
            from: { email: 'notificaciones@vendepro.app', name: 'VendéPro' },
            subject: `Nuevo lead: ${input.leadName}`,
            html: buildNewLeadEmailHtml(input),
            text: `Nuevo lead: ${input.leadName}. Tel: ${input.leadPhone ?? 'sin teléfono'}. Fuente: ${input.leadSource}.`,
          })
        }
      } catch (err) {
        console.error('[notification] email to agent failed:', (err as Error)?.message)
      }
    }

    // 2. Email al admin
    if (config.notify_admin_email && env.EMBLUE_API_KEY) {
      try {
        const admin = await userRepo.findFirstAdminByOrg(input.orgId)
        if (admin && admin.id !== input.assignedToUserId) {
          const emailSvc = new EmBlueEmailService(env.EMBLUE_API_KEY)
          await emailSvc.send({
            to: { email: admin.email, name: admin.full_name },
            from: { email: 'notificaciones@vendepro.app', name: 'VendéPro' },
            subject: `Nuevo lead: ${input.leadName}`,
            html: buildNewLeadEmailHtml(input),
            text: `Nuevo lead: ${input.leadName}. Tel: ${input.leadPhone ?? 'sin teléfono'}. Fuente: ${input.leadSource}.`,
          })
        }
      } catch (err) {
        console.error('[notification] email to admin failed:', (err as Error)?.message)
      }
    }

    // 3. Notification in-app
    if (input.assignedToUserId) {
      try {
        const notif = Notification.create({
          id: idGen.generate(),
          org_id: input.orgId,
          user_id: input.assignedToUserId,
          kind: 'new_lead',
          title: `Nuevo lead: ${input.leadName}`,
          body: input.leadPhone ? `Tel: ${input.leadPhone}` : null,
          link_url: `/leads?id=${input.leadId}`,
          read: false,
        })
        await notifRepo.save(notif)
      } catch (err) {
        console.error('[notification] in-app notification failed:', (err as Error)?.message)
      }
    }

    // 4. WhatsApp bienvenida + iniciar bot
    if (config.bot_enabled && input.leadPhone && config.api_token_encrypted) {
      try {
        const token = await decrypt(config.api_token_encrypted, env.JWT_SECRET)
        if (!token) return

        const waSvc = new CallbellWhatsappService(token)
        const message = config.welcome_template.replace(/\{\{name\}\}/g, input.leadName || 'Hola')
        await waSvc.sendMessage({ to: input.leadPhone, text: message })

        const botRepo = new D1BotConversationRepository(env.DB)
        const now = new Date().toISOString()
        await botRepo.save({
          id: idGen.generate(),
          org_id: input.orgId,
          lead_id: input.leadId,
          phone: input.leadPhone,
          current_step: 'welcome',
          answers: {},
          status: 'active',
          created_at: now,
          updated_at: now,
        })
      } catch (err) {
        console.error('[notification] whatsapp welcome failed:', (err as Error)?.message)
      }
    }
  } catch (err) {
    console.error('[notification] fireNewLeadNotification failed (swallowed):', (err as Error)?.message ?? err)
  }
}

function buildNewLeadEmailHtml(input: NotifyNewLeadInput): string {
  return `
    <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #ff007c, #ff8017); padding: 20px; border-radius: 12px 12px 0 0;">
        <h2 style="color: white; margin: 0;">Nuevo Lead</h2>
      </div>
      <div style="background: #f9f9f9; padding: 20px; border-radius: 0 0 12px 12px;">
        <p style="font-size: 18px; font-weight: 600; margin-top: 0;">${input.leadName}</p>
        ${input.leadPhone ? `<p>📞 <a href="tel:${input.leadPhone}">${input.leadPhone}</a></p>` : ''}
        ${input.leadEmail ? `<p>✉️ <a href="mailto:${input.leadEmail}">${input.leadEmail}</a></p>` : ''}
        <p style="color: #666;">Fuente: ${input.leadSource}</p>
        <a href="https://app.vendepro.app/leads?id=${input.leadId}"
           style="display: inline-block; background: #ff007c; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Ver Lead en CRM
        </a>
      </div>
    </div>
  `
}
