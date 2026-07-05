/**
 * Puerto hacia KiteProp (CRM externo). La implementación de infrastructure
 * habla con su servidor MCP; el dominio solo ve estos tipos neutrales.
 */
export interface KitepropContactDTO {
  external_id: string // String(id) de KiteProp
  full_name: string
  email: string | null
  phone: string | null // phone ?? whatsapp_formatted
  source: string | null // 'zonaprop' | 'mercadolibre' | 'whatsapp_bot_instagram' | ...
  tags: string[]
  category: string | null // 'Nuevo' | 'Pendiente contactar' | ...
  created_at: string // ISO
}

export interface KitepropContactsPage {
  data: KitepropContactDTO[]
  current_page: number
  last_page: number
  total: number
}

export interface KitepropTestResult {
  ok: boolean
  profileName?: string | null
  error?: string
}

export interface KitepropGateway {
  /** Valida la API key contra KiteProp (get_my_profile). No lanza: devuelve ok/error. */
  testConnection(apiKey: string): Promise<KitepropTestResult>
  /** Página de contactos, más recientes primero. dateFrom (YYYY-MM-DD) filtra por fecha de alta. */
  fetchContacts(apiKey: string, opts: { page: number; limit?: number; dateFrom?: string }): Promise<KitepropContactsPage>
}
