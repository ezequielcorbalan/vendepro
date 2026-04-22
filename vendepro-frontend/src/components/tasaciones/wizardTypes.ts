export interface AppraisalProposal {
  title?: string
  subtitle?: string | null
  body?: string | null
  show_agent_signature?: boolean
}

export interface AppraisalMarketSituation {
  title?: string
  body?: string | null
  media_urls?: string[]
}

export interface AppraisalWorkConditions {
  honorarios_pct?: number | null
  honorarios_usd?: number | null
  exclusividad?: boolean
  exclusividad_meses?: number | null
  extras?: string[]
  legal_text?: string | null
}
