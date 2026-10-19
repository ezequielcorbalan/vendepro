/**
 * Lectura de un lead de Meta Lead Ads (formulario instantáneo de Facebook o
 * Instagram). El webhook `leadgen` sólo trae el ID: los datos que cargó la
 * persona se piden aparte, con el page access token de la página.
 */

export interface MetaLeadField {
  /** Clave de la pregunta: `full_name`, `email`, `phone_number`, o la de una pregunta propia. */
  name: string
  values: string[]
}

export interface MetaLeadData {
  id: string
  created_time: string | null
  field_data: MetaLeadField[]
  form_id: string | null
  campaign_name: string | null
  ad_name: string | null
  /** `fb` | `ig` según dónde se completó el formulario. */
  platform: string | null
}

export interface MetaLeadAdsGateway {
  fetchLead(leadgenId: string, pageAccessToken: string): Promise<MetaLeadData>
}
