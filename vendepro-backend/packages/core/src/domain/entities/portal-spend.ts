import { ValidationError } from '../errors/validation-error'

/**
 * Gasto mensual en un portal inmobiliario, cargado a mano (los portales no
 * exponen API de facturación).
 *
 * `provider` guarda el mismo valor que `leads.source` a propósito: es la única
 * forma de cruzar el gasto contra los leads que trajo. Si no matchea con una
 * fuente real, el gasto queda huérfano y no produce ninguna métrica.
 *
 * La cotización se congela con la fila (`usd_rate`, unidades de `currency` por
 * 1 USD). Recalcularla después haría que el gasto de julio valga lo de hoy, que
 * en Argentina es una diferencia de decenas de puntos.
 */
export interface PortalSpendProps {
  id: string
  org_id: string
  /** Dueño del gasto. Cada agente maneja su propio presupuesto (migración 054). */
  owner_user_id: string | null
  provider: string
  provider_label: string | null
  /** 'YYYY-MM' */
  period_month: string
  amount: number
  currency: string
  /** Unidades de `currency` por 1 USD. 1 si currency='USD'. `null` = pendiente de completar. */
  usd_rate: number | null
  usd_rate_source: string | null
  usd_rate_at: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export const PORTAL_SPEND_CURRENCIES = ['ARS', 'USD'] as const
export type PortalSpendCurrency = (typeof PORTAL_SPEND_CURRENCIES)[number]

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export class PortalSpend {
  private constructor(private props: PortalSpendProps) {}

  static create(
    props: Omit<PortalSpendProps, 'owner_user_id' | 'provider_label' | 'usd_rate' | 'usd_rate_source' | 'usd_rate_at' | 'notes' | 'created_by' | 'created_at' | 'updated_at'> &
      Partial<Pick<PortalSpendProps, 'owner_user_id' | 'provider_label' | 'usd_rate' | 'usd_rate_source' | 'usd_rate_at' | 'notes' | 'created_by' | 'created_at' | 'updated_at'>>,
  ): PortalSpend {
    const provider = props.provider?.trim().toLowerCase()
    if (!provider) throw new ValidationError('El portal es obligatorio')

    if (!MONTH_RE.test(props.period_month ?? '')) {
      throw new ValidationError('El período debe tener formato YYYY-MM')
    }

    if (typeof props.amount !== 'number' || !Number.isFinite(props.amount) || props.amount < 0) {
      throw new ValidationError('El importe debe ser un número mayor o igual a cero')
    }

    const currency = (props.currency ?? 'ARS').trim().toUpperCase()
    if (!(PORTAL_SPEND_CURRENCIES as readonly string[]).includes(currency)) {
      throw new ValidationError(`Moneda no soportada: ${currency}`)
    }

    // En dólares la conversión es la identidad: no hace falta ir a buscar nada
    // y guardar otra cosa sería un error silencioso.
    const usdRate = currency === 'USD' ? 1 : (props.usd_rate ?? null)
    if (usdRate !== null && (!Number.isFinite(usdRate) || usdRate <= 0)) {
      throw new ValidationError('La cotización debe ser mayor a cero')
    }

    const now = new Date().toISOString()
    return new PortalSpend({
      ...props,
      provider,
      owner_user_id: props.owner_user_id ?? null,
      provider_label: props.provider_label?.trim() || null,
      currency,
      usd_rate: usdRate,
      usd_rate_source: currency === 'USD' ? (props.usd_rate_source ?? 'identity') : (props.usd_rate_source ?? null),
      usd_rate_at: props.usd_rate_at ?? null,
      notes: props.notes?.trim() || null,
      created_by: props.created_by ?? null,
      created_at: props.created_at ?? now,
      updated_at: props.updated_at ?? now,
    })
  }

  get id() { return this.props.id }
  get org_id() { return this.props.org_id }
  get owner_user_id() { return this.props.owner_user_id }
  get provider() { return this.props.provider }
  get provider_label() { return this.props.provider_label }
  get period_month() { return this.props.period_month }
  get amount() { return this.props.amount }
  get currency() { return this.props.currency }
  get usd_rate() { return this.props.usd_rate }
  get usd_rate_source() { return this.props.usd_rate_source }
  get usd_rate_at() { return this.props.usd_rate_at }
  get notes() { return this.props.notes }
  get created_by() { return this.props.created_by }
  get created_at() { return this.props.created_at }
  get updated_at() { return this.props.updated_at }

  /** Importe en USD, o `null` si todavía no hay cotización cargada. */
  get amount_usd(): number | null {
    if (this.props.usd_rate === null || this.props.usd_rate <= 0) return null
    return this.props.amount / this.props.usd_rate
  }

  toObject(): PortalSpendProps & { amount_usd: number | null } {
    return { ...this.props, amount_usd: this.amount_usd }
  }
}
