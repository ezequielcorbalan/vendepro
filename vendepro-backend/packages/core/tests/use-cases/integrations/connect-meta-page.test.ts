import { describe, it, expect, vi } from 'vitest'
import { ConnectMetaPageUseCase } from '../../../src/application/use-cases/integrations/connect-meta-page'
import { OrgIntegration } from '../../../src/domain/entities/org-integration'

const ids = { generate: () => 'int_1' }
const encrypt = vi.fn(async (plain: string) => `enc(${plain})`)

const PAGINAS = [
  { id: 'p1', name: 'Marcela Genta', access_token: 'page-token-1' },
  { id: 'p2', name: 'Otra página', access_token: 'page-token-2' },
]

function build(opts: { pages?: typeof PAGINAS; previa?: OrgIntegration | null } = {}) {
  const repo = {
    findByOrgAndProvider: vi.fn().mockResolvedValue(opts.previa ?? null),
    save: vi.fn().mockResolvedValue(undefined),
  } as any
  const connector = {
    listPages: vi.fn().mockResolvedValue(opts.pages ?? PAGINAS),
    subscribeLeadgen: vi.fn().mockResolvedValue(undefined),
  }
  return { uc: new ConnectMetaPageUseCase(repo, connector, ids, encrypt), repo, connector }
}

const BASE = { orgId: 'org1', provider: 'instagram', userAccessToken: 'user-token', connectedBy: 'gaston' }

describe('ConnectMetaPageUseCase', () => {
  it('con varias páginas y sin elegir, devuelve las opciones sin tokens y no guarda nada', async () => {
    const { uc, repo, connector } = build()
    const r = await uc.execute(BASE)
    expect(r).toEqual({ status: 'elegir', pages: [{ id: 'p1', name: 'Marcela Genta' }, { id: 'p2', name: 'Otra página' }] })
    expect(connector.subscribeLeadgen).not.toHaveBeenCalled()
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('guarda cifrado el token de la PÁGINA (no el pegado) y suscribe la página a los leads', async () => {
    const { uc, repo, connector } = build()
    const r = await uc.execute({ ...BASE, pageId: 'p2' })

    expect(r).toEqual({ status: 'conectada', page: { id: 'p2', name: 'Otra página' } })
    expect(connector.subscribeLeadgen).toHaveBeenCalledWith('p2', 'page-token-2')
    const guardada = repo.save.mock.calls[0][0] as OrgIntegration
    expect(guardada.credentials_encrypted).toBe('enc(page-token-2)')
    expect(guardada.enabled).toBe(true)
    expect(guardada.getConfig()).toEqual({ page_id: 'p2', page_name: 'Otra página', lead_owner_id: 'gaston' })
  })

  it('con una sola página la conecta directo', async () => {
    const { uc } = build({ pages: [PAGINAS[0]!] })
    const r = await uc.execute(BASE)
    expect(r).toEqual({ status: 'conectada', page: { id: 'p1', name: 'Marcela Genta' } })
  })

  it('conserva la config previa de la bandeja (account_id) y el id de la fila', async () => {
    const previa = OrgIntegration.create({
      id: 'vieja', org_id: 'org1', provider: 'instagram', name: 'Instagram',
      config_json: JSON.stringify({ account_id: 'ig1', api_version: 'v24.0' }), enabled: true,
    })
    const { uc, repo } = build({ previa })
    await uc.execute({ ...BASE, pageId: 'p1' })
    const guardada = repo.save.mock.calls[0][0] as OrgIntegration
    expect(guardada.id).toBe('vieja')
    expect(guardada.getConfig()).toEqual({ account_id: 'ig1', api_version: 'v24.0', page_id: 'p1', page_name: 'Marcela Genta', lead_owner_id: 'gaston' })
  })

  it('rechaza un token sin páginas, una página ajena y un token vacío', async () => {
    await expect(build({ pages: [] }).uc.execute(BASE)).rejects.toThrow('ninguna página')
    await expect(build().uc.execute({ ...BASE, pageId: 'p9' })).rejects.toThrow('página elegida')
    await expect(build().uc.execute({ ...BASE, userAccessToken: '  ' })).rejects.toThrow('token')
  })
})
