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

/** Consulta de portal: mensaje + propiedad + persona en un solo objeto. */
export interface KitepropMessageDTO {
  external_id: string // id del mensaje (String)
  body: string // texto de la consulta
  source: string | null // portal: 'argenprop' | 'zonaprop' | ...
  property_id: number | null
  created_at: string // ISO
  contact: {
    external_id: string // id del contacto en KiteProp
    full_name: string
    email: string | null
    phone: string | null
  }
}

export interface KitepropMessagesPage {
  data: KitepropMessageDTO[]
  current_page: number
  last_page: number
  total: number
}

/** Referencia liviana de una propiedad + su agente (no importamos la propiedad entera). */
export interface KitepropPropertyRef {
  code: string | null // 'KP522301'
  title: string | null // 'Oficina en alquiler. Villa Urquiza'
  address: string | null
  agent_email: string | null // property.user.email
  agent_name: string | null
}

export interface KitepropGateway {
  /** Valida la API key contra KiteProp (get_my_profile). No lanza: devuelve ok/error. */
  testConnection(apiKey: string): Promise<KitepropTestResult>
  /** Página de contactos, más recientes primero. dateFrom (YYYY-MM-DD) filtra por fecha de alta. */
  fetchContacts(apiKey: string, opts: { page: number; limit?: number; dateFrom?: string }): Promise<KitepropContactsPage>
  /** Página de consultas de portal (search_messages), más recientes primero. */
  fetchMessages(apiKey: string, opts: { page: number; limit?: number }): Promise<KitepropMessagesPage>
  /** Referencia + agente de una propiedad por id. null si no existe o falla. */
  getPropertyRef(apiKey: string, propertyId: number): Promise<KitepropPropertyRef | null>
}
