import type { PortalSpendRepository, PortalLeadCountRepository } from '../../ports/repositories/portal-spend-repository'
import type { PropertyIncomeRepository } from '../../ports/repositories/property-income-repository'
import {
  aggregateSpendForRange,
  computePortalCosts,
  summarizePortalCosts,
  type PortalCostRow,
} from '../../../domain/rules/portal-cost-rules'
import {
  aggregateIncome,
  computeRoi,
  computeRoas,
} from '../../../domain/rules/property-income-rules'

export interface GetPortalCostsInput {
  orgId: string
  /** YYYY-MM-DD inclusive */
  from: string
  /** YYYY-MM-DD exclusive */
  to: string
  /** Acota a un agente. Sin esto, la vista es de toda la inmobiliaria (admin). */
  ownerUserId?: string
}

export interface PortalCostRowWithIncome extends PortalCostRow {
  /** Honorarios de las operaciones que cerró ese portal en el período. */
  income_usd: number | null
  operations: number
  roi: number | null
  roas: number | null
}

export interface GetPortalCostsOutput {
  rows: PortalCostRowWithIncome[]
  summary: ReturnType<typeof summarizePortalCosts> & {
    income_usd: number | null
    operations: number
    roi: number | null
    /** Cierres que entraron sin poder atribuirse a ningún portal. */
    unattributed_income_usd: number
    unattributed_operations: number
    /** Cierres cuyos honorarios no se pudieron convertir a USD. */
    income_pending_rate: number
  }
}

/**
 * Costo por lead de cada portal en el rango pedido.
 *
 * El gasto se guarda por mes y el rango puede ser parcial ("mes a hoy"), así
 * que se prorratea por días antes de cruzarlo — ver `portal-cost-rules`.
 */
export class GetPortalCostsUseCase {
  constructor(
    private readonly spend: PortalSpendRepository,
    private readonly leadCounts: PortalLeadCountRepository,
    /** Opcional: sin él la tabla sale con costos pero sin ROI. */
    private readonly income?: PropertyIncomeRepository,
  ) {}

  async execute(input: GetPortalCostsInput): Promise<GetPortalCostsOutput> {
    const [spendRows, leadRows, incomeRows] = await Promise.all([
      // Se piden los meses que tocan el rango; los que no lo tocan de verdad
      // quedan con 0 días de solape y no suman nada.
      this.spend.findByOrg(input.orgId, {
        fromMonth: input.from.slice(0, 7),
        toMonth: input.to.slice(0, 7),
        ownerUserId: input.ownerUserId,
      }),
      this.leadCounts.countBuyerLeadsBySource(input.orgId, input.from, input.to, input.ownerUserId),
      this.income
        ? this.income.findIncomeByBuyerSource(input.orgId, input.from, input.to, input.ownerUserId).catch(() => [])
        : Promise.resolve([]),
    ])

    const aggregates = aggregateSpendForRange(
      spendRows.map(s => ({
        provider: s.provider,
        provider_label: s.provider_label,
        period_month: s.period_month,
        amount: s.amount,
        currency: s.currency,
        usd_rate: s.usd_rate,
      })),
      input.from,
      input.to,
    )

    const baseRows = computePortalCosts(aggregates, leadRows)
    const income = aggregateIncome(incomeRows)

    const rows: PortalCostRowWithIncome[] = baseRows.map(r => {
      const attributed = income.byAttribution.get(r.provider) ?? null
      const incomeUsd = attributed?.income_usd ?? null
      return {
        ...r,
        income_usd: incomeUsd,
        operations: attributed?.operations ?? 0,
        roi: computeRoi(incomeUsd, r.spend_usd),
        roas: computeRoas(incomeUsd, r.spend_usd),
      }
    })

    const base = summarizePortalCosts(baseRows)
    // Sólo entra al total lo que se pudo atribuir a un portal: los cierres sin
    // origen conocido viajan aparte para no inflar el ROI de ningún canal.
    const totalIncome = rows.reduce((a, r) => a + (r.income_usd ?? 0), 0)
    const anyIncome = rows.some(r => r.income_usd !== null)

    return {
      rows,
      summary: {
        ...base,
        income_usd: anyIncome ? Math.round(totalIncome * 100) / 100 : null,
        operations: rows.reduce((a, r) => a + r.operations, 0),
        roi: computeRoi(anyIncome ? totalIncome : null, base.spend_usd),
        unattributed_income_usd: income.unattributed.income_usd,
        unattributed_operations: income.unattributed.operations,
        income_pending_rate: income.pending_rate,
      },
    }
  }
}
