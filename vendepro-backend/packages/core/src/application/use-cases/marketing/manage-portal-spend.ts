import type { PortalSpendRepository } from '../../ports/repositories/portal-spend-repository'
import type { FxRateService } from '../../ports/services/fx-rate'
import type { IdGenerator } from '../../ports/id-generator'
import { PortalSpend } from '../../../domain/entities/portal-spend'
import { NotFoundError } from '../../../domain/errors/not-found'

export class ListPortalSpendUseCase {
  constructor(private readonly repo: PortalSpendRepository) {}

  async execute(orgId: string, opts?: { fromMonth?: string; toMonth?: string; ownerUserId?: string }) {
    const rows = await this.repo.findByOrg(orgId, opts)
    return rows.map(r => r.toObject())
  }
}

export interface SavePortalSpendInput {
  orgId: string
  provider: string
  provider_label?: string | null
  /** 'YYYY-MM' */
  period_month: string
  amount: number
  currency?: string
  /** Si viene, se respeta y no se consulta la cotización online. */
  usd_rate?: number | null
  notes?: string | null
  createdBy?: string | null
  /** Dueño del presupuesto: por defecto, quien lo carga. */
  ownerUserId?: string | null
}

export class SavePortalSpendUseCase {
  constructor(
    private readonly repo: PortalSpendRepository,
    private readonly ids: IdGenerator,
    private readonly fx: FxRateService,
  ) {}

  /**
   * Alta o corrección del gasto de un portal en un mes. El upsert es por
   * (org, portal, mes): recargar septiembre de ZonaProp corrige la fila en vez
   * de duplicarla.
   *
   * La cotización se resuelve acá y queda congelada con la fila. Si la fuente
   * no responde, se guarda igual con `usd_rate` en null y la UI pide
   * completarla: perder el dato del gasto por no poder cotizarlo sería peor,
   * y un tipo de cambio inventado contamina el ROI del período entero.
   */
  async execute(input: SavePortalSpendInput) {
    const currency = (input.currency ?? 'ARS').trim().toUpperCase()

    let rate = input.usd_rate ?? null
    let source: string | null = rate !== null ? 'manual' : null
    let at: string | null = rate !== null ? new Date().toISOString() : null

    if (rate === null) {
      const fx = await this.fx.usdRate(currency).catch(() => null)
      if (fx) { rate = fx.rate; source = fx.source; at = fx.at }
    }

    const spend = PortalSpend.create({
      id: this.ids.generate(),
      org_id: input.orgId,
      owner_user_id: input.ownerUserId ?? input.createdBy ?? null,
      provider: input.provider,
      provider_label: input.provider_label ?? null,
      period_month: input.period_month,
      amount: input.amount,
      currency,
      usd_rate: rate,
      usd_rate_source: source,
      usd_rate_at: at,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })

    await this.repo.save(spend)
    return spend.toObject()
  }
}

export class DeletePortalSpendUseCase {
  constructor(private readonly repo: PortalSpendRepository) {}

  async execute(id: string, orgId: string) {
    const existing = await this.repo.findById(id, orgId)
    if (!existing) throw new NotFoundError('PortalSpend', id)
    await this.repo.delete(id, orgId)
  }
}
