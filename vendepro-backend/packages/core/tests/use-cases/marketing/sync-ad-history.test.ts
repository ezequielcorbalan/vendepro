import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SyncAdHistoryUseCase } from '../../../src/application/use-cases/marketing/sync-ad-history'
import { adSyncWindow } from '../../../src/domain/value-objects/marketing-period'
import type { AdAccountRow } from '../../../src/application/ports/repositories/ad-history-repository'

const NOW = new Date('2026-09-08T10:00:00.000Z')

const ACCOUNT: AdAccountRow = {
  id: 'adacc_1', org_id: 'org_mg', provider: 'meta', external_id: 'act_123',
  name: 'MG Ads', currency: 'ARS', owner_user_id: 'usr_1', enabled: true, last_synced_at: null,
}

const INSIGHT = (over: Partial<any> = {}) => ({
  date: '2026-09-07', ad_id: 'ad_1', ad_name: 'Video tasación', ad_set_id: 'set_1',
  ad_set_name: 'Palermo 35-55', campaign_id: 'camp_1', campaign_name: 'Tasaciones Palermo',
  spend: 12000, impressions: 4000, clicks: 80, leads: 3,
  reach: 3500, frequency: 1.14, account_currency: 'ARS', ...over,
})

function makeDeps(over: { insights?: any; ads?: any; integration?: any } = {}) {
  const history = {
    listAccounts: vi.fn().mockResolvedValue([ACCOUNT]),
    upsertStructure: vi.fn().mockResolvedValue(undefined),
    upsertDailyMetrics: vi.fn().mockResolvedValue(undefined),
    markSynced: vi.fn().mockResolvedValue(undefined),
  }
  const integrations = {
    findByAgent: vi.fn().mockResolvedValue(
      over.integration === undefined ? { access_token_encrypted: 'cipher' } : over.integration,
    ),
  }
  const insights = {
    getCampaignInsights: vi.fn(),
    getAdInsights: vi.fn().mockResolvedValue(
      over.insights ?? { ok: true, status: 200, insights: [INSIGHT(), INSIGHT({ date: '2026-09-08' })] },
    ),
    getAds: vi.fn().mockResolvedValue(
      over.ads ?? { ok: true, status: 200, ads: [{ ad_id: 'ad_1', name: 'Video tasación', status: 'ACTIVE', campaign_id: 'camp_1', ad_set_id: 'set_1', thumbnail_url: 'https://x/t.jpg', title: 't', body: 'b', permalink: null, destination_url: 'https://vendepro.com.ar/l/tasacion' }] },
    ),
  }
  const decrypt = vi.fn().mockResolvedValue('token-plano')
  return { history, integrations, insights, decrypt }
}

function build(over = {}) {
  const d = makeDeps(over)
  return {
    ...d,
    useCase: new SyncAdHistoryUseCase(d.history as any, d.integrations as any, d.insights as any, d.decrypt),
  }
}

beforeEach(() => vi.clearAllMocks())

describe('SyncAdHistoryUseCase', () => {
  it('baja la ventana con re-escritura y guarda estructura y métricas', async () => {
    const { useCase, history, insights } = build()
    const out = await useCase.execute({ now: NOW })

    const window = adSyncWindow(NOW)
    expect(insights.getAdInsights).toHaveBeenCalledWith(expect.objectContaining({
      adAccountId: 'act_123', accessToken: 'token-plano', since: window.since, until: window.until,
    }))
    expect(history.upsertStructure).toHaveBeenCalledOnce()
    expect(history.upsertDailyMetrics).toHaveBeenCalledOnce()
    expect(out.accounts[0]).toMatchObject({ status: 'ok', days: 2, ads: 1, rows: 2 })
  })

  it('marca la cuenta como sincronizada sin error', async () => {
    const { useCase, history } = build()
    await useCase.execute({ now: NOW })
    expect(history.markSynced).toHaveBeenCalledWith('adacc_1', expect.any(String), null)
  })

  /**
   * La ventana se re-pide entera en vez de sólo ayer porque Meta reatribuye
   * hacia atrás. Sin esto, una conversión que aparece tarde nunca se guardaría.
   */
  it('la ventana cubre varios días hacia atrás, no sólo ayer', async () => {
    const { useCase } = build()
    const out = await useCase.execute({ now: NOW })
    expect(out.since).toBe('2026-09-01')
    expect(out.until).toBe('2026-09-08')
  })

  it('respeta un lookback más corto si se lo piden', async () => {
    const { useCase } = build()
    const out = await useCase.execute({ now: NOW, lookbackDays: 2 })
    expect(out.since).toBe('2026-09-06')
  })

  describe('cuentas que no se pueden sincronizar', () => {
    it('la cuenta de la agencia queda pendiente de OAuth, no da error', async () => {
      const d = makeDeps()
      d.history.listAccounts.mockResolvedValue([{ ...ACCOUNT, owner_user_id: null }])
      const useCase = new SyncAdHistoryUseCase(d.history as any, d.integrations as any, d.insights as any, d.decrypt)

      const out = await useCase.execute({ now: NOW })
      expect(out.accounts[0]!.status).toBe('no_owner')
      expect(d.insights.getAdInsights).not.toHaveBeenCalled()
    })

    it('sin integración del agente no llama a Meta', async () => {
      const { useCase, insights } = build({ integration: null })
      const out = await useCase.execute({ now: NOW })
      expect(out.accounts[0]!.status).toBe('no_token')
      expect(insights.getAdInsights).not.toHaveBeenCalled()
    })

    it('un token que no desencripta se registra en la cuenta', async () => {
      const d = makeDeps()
      d.decrypt.mockResolvedValue(null)
      const useCase = new SyncAdHistoryUseCase(d.history as any, d.integrations as any, d.insights as any, d.decrypt)

      const out = await useCase.execute({ now: NOW })
      expect(out.accounts[0]!.status).toBe('token_error')
      expect(d.history.markSynced).toHaveBeenCalledWith('adacc_1', expect.any(String), 'token_error')
    })

    it('un error de la API no guarda nada y deja el motivo en la cuenta', async () => {
      const { useCase, history } = build({
        insights: { ok: false, status: 400, insights: [], error: 'permiso ads_read faltante' },
      })
      const out = await useCase.execute({ now: NOW })
      expect(out.accounts[0]).toMatchObject({ status: 'api_error', error: 'permiso ads_read faltante' })
      expect(history.upsertDailyMetrics).not.toHaveBeenCalled()
      expect(history.markSynced).toHaveBeenCalledWith('adacc_1', expect.any(String), 'permiso ads_read faltante')
    })
  })

  /**
   * Perder la miniatura del creativo es mucho menos grave que perder el gasto
   * del día: si la llamada de fichas falla, las métricas se guardan igual.
   */
  it('si fallan las fichas de anuncios, las métricas se guardan igual', async () => {
    const { useCase, history } = build({ ads: { ok: false, status: 500, ads: [] } })
    const out = await useCase.execute({ now: NOW })
    expect(out.accounts[0]!.status).toBe('ok')
    expect(out.accounts[0]!.ads).toBe(0)
    expect(history.upsertDailyMetrics).toHaveBeenCalledOnce()
  })

  // Un token vencido de una inmobiliaria no puede dejar sin histórico a las otras.
  it('una cuenta rota no frena a las demás', async () => {
    const d = makeDeps()
    d.history.listAccounts.mockResolvedValue([
      { ...ACCOUNT, id: 'adacc_rota', owner_user_id: null },
      ACCOUNT,
    ])
    const useCase = new SyncAdHistoryUseCase(d.history as any, d.integrations as any, d.insights as any, d.decrypt)

    const out = await useCase.execute({ now: NOW })
    expect(out.accounts.map(a => a.status)).toEqual(['no_owner', 'ok'])
    expect(d.history.upsertDailyMetrics).toHaveBeenCalledOnce()
  })

  it('sin cuentas configuradas no rompe', async () => {
    const d = makeDeps()
    d.history.listAccounts.mockResolvedValue([])
    const useCase = new SyncAdHistoryUseCase(d.history as any, d.integrations as any, d.insights as any, d.decrypt)

    const out = await useCase.execute({ now: NOW })
    expect(out.accounts).toEqual([])
  })
})
