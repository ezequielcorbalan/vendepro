export interface WhatsappConfig {
  id: string
  org_id: string
  provider: 'callbell' | 'meta_cloud'
  api_token_encrypted: string | null
  webhook_secret: string | null
  welcome_template: string
  bot_enabled: boolean
  notify_agent_email: boolean
  notify_admin_email: boolean
  created_at: string
  updated_at: string
}

export interface WhatsappConfigRepository {
  findByOrgId(orgId: string): Promise<WhatsappConfig | null>
  save(config: WhatsappConfig): Promise<void>
}
