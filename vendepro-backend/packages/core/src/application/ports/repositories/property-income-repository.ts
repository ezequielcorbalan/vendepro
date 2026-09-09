import type { PropertyIncomeRow } from '../../../domain/rules/property-income-rules'

export interface SavePropertyIncomeInput {
  propertyId: string
  orgId: string
  soldPrice?: number | null
  soldDate?: string | null
  commissionAmount: number | null
  commissionCurrency: string
  commissionUsdRate: number | null
  commissionUsdRateSource: string | null
  commissionUsdRateAt: string | null
  incomeAt: string | null
}

export interface PropertyIncomeRepository {
  saveIncome(input: SavePropertyIncomeInput): Promise<void>

  /**
   * Honorarios de las operaciones cerradas en el rango, atribuidos al **lead
   * comprador** que las cerró (su `source` es el portal). Alimenta el ROI de la
   * sección Demanda.
   */
  findIncomeByBuyerSource(orgId: string, from: string, to: string, ownerUserId?: string): Promise<PropertyIncomeRow[]>

  /**
   * Honorarios de las operaciones cerradas en el rango, atribuidos a la
   * **campaña que captó la propiedad** (el `source_detail` del lead de
   * captación que la originó). Alimenta el ROI de la sección Captación.
   */
  findIncomeByCaptureCampaign(orgId: string, from: string, to: string, ownerUserId?: string): Promise<PropertyIncomeRow[]>
}
