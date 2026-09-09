import type { PropertyIncomeRepository } from '../../ports/repositories/property-income-repository'
import type { FxRateService } from '../../ports/services/fx-rate'
import { ValidationError } from '../../../domain/errors/validation-error'

export interface SavePropertyIncomeUseCaseInput {
  orgId: string
  propertyId: string
  /** Honorarios cobrados. `null` borra el ingreso cargado. */
  commissionAmount: number | null
  commissionCurrency?: string
  /** Si viene, se respeta y no se consulta la cotización online. */
  usdRate?: number | null
  soldPrice?: number | null
  soldDate?: string | null
  /** Fecha del ingreso; por defecto, hoy. */
  incomeAt?: string | null
}

const CURRENCIES = ['USD', 'ARS']

/**
 * Registra cuánto cobró la inmobiliaria por una operación cerrada.
 *
 * Igual que el gasto de portales: si el importe está en pesos y no se pudo
 * resolver el dólar, se guarda igual con la cotización en null y la UI pide
 * completarla. Perder el dato del ingreso por no poder cotizarlo sería peor, y
 * un tipo de cambio inventado contamina el ROI de todo el período.
 */
export class SavePropertyIncomeUseCase {
  constructor(
    private readonly repo: PropertyIncomeRepository,
    private readonly fx: FxRateService,
  ) {}

  async execute(input: SavePropertyIncomeUseCaseInput): Promise<{ commission_usd_rate: number | null }> {
    if (!input.propertyId) throw new ValidationError('Falta la propiedad')

    const currency = (input.commissionCurrency ?? 'USD').trim().toUpperCase()
    if (!CURRENCIES.includes(currency)) throw new ValidationError(`Moneda no soportada: ${currency}`)

    if (input.commissionAmount !== null) {
      if (!Number.isFinite(input.commissionAmount) || input.commissionAmount < 0) {
        throw new ValidationError('Los honorarios deben ser un número mayor o igual a cero')
      }
    }

    // Borrar el ingreso limpia todo el bloque, incluida la fecha: si no, la
    // propiedad quedaría contada como cierre del período sin importe.
    if (input.commissionAmount === null) {
      await this.repo.saveIncome({
        propertyId: input.propertyId,
        orgId: input.orgId,
        commissionAmount: null,
        commissionCurrency: currency,
        commissionUsdRate: null,
        commissionUsdRateSource: null,
        commissionUsdRateAt: null,
        incomeAt: null,
        soldPrice: input.soldPrice ?? null,
        soldDate: input.soldDate ?? null,
      })
      return { commission_usd_rate: null }
    }

    let rate: number | null = currency === 'USD' ? 1 : (input.usdRate ?? null)
    let source: string | null = currency === 'USD' ? 'identity' : (rate !== null ? 'manual' : null)
    let at: string | null = rate !== null ? new Date().toISOString() : null

    if (rate === null) {
      const fx = await this.fx.usdRate(currency).catch(() => null)
      if (fx) { rate = fx.rate; source = fx.source; at = fx.at }
    }

    if (rate !== null && (!Number.isFinite(rate) || rate <= 0)) {
      throw new ValidationError('La cotización debe ser mayor a cero')
    }

    await this.repo.saveIncome({
      propertyId: input.propertyId,
      orgId: input.orgId,
      commissionAmount: input.commissionAmount,
      commissionCurrency: currency,
      commissionUsdRate: rate,
      commissionUsdRateSource: source,
      commissionUsdRateAt: at,
      incomeAt: input.incomeAt ?? new Date().toISOString().slice(0, 10),
      soldPrice: input.soldPrice ?? null,
      soldDate: input.soldDate ?? null,
    })

    return { commission_usd_rate: rate }
  }
}
