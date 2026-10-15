import { describe, it, expect, vi } from 'vitest'
import {
  CreateDocPortalLinkUseCase,
  RevokeDocPortalLinkUseCase,
} from '../../../src/application/use-cases/doc-portal/manage-doc-portal-link'
import {
  UploadPortalDocumentUseCase,
  FinishDocPortalSessionUseCase,
  GetPublicDocPortalUseCase,
  DOC_PORTAL_MAX_FILES_PER_DAY,
} from '../../../src/application/use-cases/doc-portal/public-doc-portal'
import type { DocPortalLink } from '../../../src/domain/entities/doc-portal'

const CONFIG_JSON = JSON.stringify({
  upload_url: 'https://n8n.test/webhook/documentacion-subir',
  done_url: 'https://n8n.test/webhook/documentacion-listo',
  agent_map: { 'agent-1': 'andres' },
})

function property(over: Record<string, any> = {}) {
  return {
    id: 'prop-1',
    org_id: 'org-1',
    address: 'Inexistente 99999 2° B',
    property_type: 'departamento',
    operation_type: 'venta',
    owner_name: 'Ana Dueña',
    owner_phone: '11 5555 5555',
    owner_email: 'ana@mail.com',
    agent_id: 'agent-1',
    status: 'active',
    doc_status_json: null,
    ...over,
  }
}

function link(over: Partial<DocPortalLink> = {}): DocPortalLink {
  return {
    id: 'link-1',
    org_id: 'org-1',
    property_id: 'prop-1',
    agent_id: 'agent-1',
    token: 'tok',
    operation: 'venta',
    property_kind: 'depto',
    succession: 'no',
    married: null,
    session_id: 'sid-1',
    files_count: 0,
    last_upload_at: null,
    last_finished_at: null,
    revoked_at: null,
    created_at: '2026-10-15T10:00:00.000Z',
    updated_at: '2026-10-15T10:00:00.000Z',
    ...over,
  }
}

function deps(over: Record<string, any> = {}) {
  let n = 0
  const links = {
    findByToken: vi.fn().mockResolvedValue(link()),
    findActiveByProperty: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(undefined),
    revoke: vi.fn().mockResolvedValue(undefined),
    registerUpload: vi.fn().mockResolvedValue(undefined),
    markFinished: vi.fn().mockResolvedValue(undefined),
    ...(over.links ?? {}),
  }
  const documents = {
    listByProperty: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue(undefined),
    countByLinkSince: vi.fn().mockResolvedValue(0),
    ...(over.documents ?? {}),
  }
  const properties = {
    findById: vi.fn().mockResolvedValue(property(over.property)),
    update: vi.fn().mockResolvedValue(undefined),
    ...(over.properties ?? {}),
  }
  const integrations = {
    findByOrgAndProvider: vi.fn().mockResolvedValue(
      over.integration === null ? null : { enabled: true, config_json: CONFIG_JSON, ...(over.integration ?? {}) },
    ),
  }
  const gateway = {
    upload: vi.fn().mockResolvedValue({
      ok: true, error: null, doc_type: 'titulo', doc_label: 'Título de propiedad', recognized: true,
      issued_at: '2010-08-10', drive_file_id: 'f1', drive_file_url: 'https://drive/f1',
      drive_folder_url: 'https://drive/folder', observations: null,
    }),
    finish: vi.fn().mockResolvedValue(undefined),
    ...(over.gateway ?? {}),
  }
  const ids = { generate: vi.fn(() => `id-${++n}`) }
  return { links, documents, properties, integrations, gateway, ids }
}

const pdf = (size = 1000) => ({ name: 'escritura.pdf', type: 'application/pdf', size, data: new Blob(['x']) })
const agent = { org_id: 'org-1', user_id: 'agent-1', role: 'agent' }

describe('CreateDocPortalLinkUseCase', () => {
  it('crea el link con lo que sabe la propiedad y revoca el anterior', async () => {
    const d = deps({ links: { findActiveByProperty: vi.fn().mockResolvedValue(link({ id: 'viejo' })) } })
    const uc = new CreateDocPortalLinkUseCase(d.links as any, d.properties as any, d.integrations as any, d.ids as any)
    const out = await uc.execute({ actor: agent, property_id: 'prop-1' })

    expect(d.links.revoke).toHaveBeenCalledWith('viejo', 'org-1', expect.any(String))
    expect(out.operation).toBe('venta')
    expect(out.property_kind).toBe('depto')
    expect(out.token).toBeTruthy()
    expect(d.links.create).toHaveBeenCalledOnce()
  })

  it('un agente no puede pedir la documentación de una propiedad ajena', async () => {
    const d = deps({ property: { agent_id: 'otro-agente' } })
    const uc = new CreateDocPortalLinkUseCase(d.links as any, d.properties as any, d.integrations as any, d.ids as any)
    await expect(uc.execute({ actor: agent, property_id: 'prop-1' })).rejects.toThrow(/agente de la propiedad/)
  })

  it('sin integración configurada no se genera el link', async () => {
    const d = deps({ integration: null })
    const uc = new CreateDocPortalLinkUseCase(d.links as any, d.properties as any, d.integrations as any, d.ids as any)
    await expect(uc.execute({ actor: agent, property_id: 'prop-1' })).rejects.toThrow(/no está configurada/)
  })
})

describe('RevokeDocPortalLinkUseCase', () => {
  it('revoca el link vivo', async () => {
    const d = deps({ links: { findActiveByProperty: vi.fn().mockResolvedValue(link()) } })
    const uc = new RevokeDocPortalLinkUseCase(d.links as any, d.properties as any)
    expect(await uc.execute(agent, 'prop-1')).toEqual({ revoked: true })
  })
})

describe('UploadPortalDocumentUseCase', () => {
  const build = (d: ReturnType<typeof deps>) =>
    new UploadPortalDocumentUseCase(d.links as any, d.documents as any, d.properties as any, d.integrations as any, d.gateway as any, d.ids as any)

  it('manda a n8n los datos de la propiedad, no los que tipea el propietario', async () => {
    const d = deps()
    await build(d).execute('tok', pdf())
    expect(d.gateway.upload).toHaveBeenCalledWith(
      expect.objectContaining({ upload_url: 'https://n8n.test/webhook/documentacion-subir' }),
      expect.anything(),
      expect.objectContaining({
        direccion: 'Inexistente 99999 2° B',
        operacion: 'venta',
        tipo: 'depto',
        sucesion: 'no',
        sid: 'sid-1',
        agente: 'andres',
      }),
    )
  })

  it('registra el documento y tilda el checklist de la propiedad', async () => {
    const d = deps()
    const out = await build(d).execute('tok', pdf())
    expect(out).toMatchObject({ doc_type: 'titulo', recognized: true })
    expect(d.documents.create).toHaveBeenCalledWith(expect.objectContaining({ drive_file_id: 'f1', link_id: 'link-1' }))
    expect(d.links.registerUpload).toHaveBeenCalledOnce()
    const patch = d.properties.update.mock.calls[0][2]
    expect(JSON.parse(patch.doc_status_json).status.title).toBe('done')
  })

  it('si n8n falla no escribe nada y devuelve el error', async () => {
    const d = deps({ gateway: { upload: vi.fn().mockResolvedValue({ ok: false, error: 'Archivo ilegible', doc_type: 'otro', recognized: false }) } })
    await expect(build(d).execute('tok', pdf())).rejects.toThrow('Archivo ilegible')
    expect(d.documents.create).not.toHaveBeenCalled()
  })

  it('un tipo que no está en el catálogo queda como "otro" a revisar', async () => {
    const d = deps({ gateway: { upload: vi.fn().mockResolvedValue({ ok: true, doc_type: 'boleto', recognized: true, drive_folder_url: null }) } })
    const out = await build(d).execute('tok', pdf())
    expect(out).toMatchObject({ doc_type: 'otro', recognized: false })
  })

  it('rechaza archivos de más de 15 MB sin llamar a n8n', async () => {
    const d = deps()
    await expect(build(d).execute('tok', pdf(16 * 1024 * 1024))).rejects.toThrow(/15 MB/)
    expect(d.gateway.upload).not.toHaveBeenCalled()
  })

  it('frena un link filtrado con el límite diario', async () => {
    const d = deps({ documents: { countByLinkSince: vi.fn().mockResolvedValue(DOC_PORTAL_MAX_FILES_PER_DAY) } })
    await expect(build(d).execute('tok', pdf())).rejects.toThrow(/límite/)
  })

  it('un link revocado o de una propiedad vendida ya no recibe archivos', async () => {
    const revocado = deps({ links: { findByToken: vi.fn().mockResolvedValue(link({ revoked_at: '2026-10-15' })) } })
    await expect(build(revocado).execute('tok', pdf())).rejects.toThrow(/ya no está activo/)
    const vendida = deps({ property: { status: 'sold' } })
    await expect(build(vendida).execute('tok', pdf())).rejects.toThrow(/ya no está activo/)
  })

  it('token inexistente → no encontrado', async () => {
    const d = deps({ links: { findByToken: vi.fn().mockResolvedValue(null) } })
    await expect(build(d).execute('nada', pdf())).rejects.toThrow(/no encontrado/)
  })
})

describe('FinishDocPortalSessionUseCase', () => {
  const build = (d: ReturnType<typeof deps>) =>
    new FinishDocPortalSessionUseCase(d.links as any, d.properties as any, d.integrations as any, d.gateway as any)

  it('avisa a n8n cuando hubo archivos nuevos', async () => {
    const d = deps({ links: { findByToken: vi.fn().mockResolvedValue(link({ last_upload_at: new Date().toISOString() })) } })
    expect(await build(d).execute('tok')).toEqual({ notified: true })
    expect(d.gateway.finish).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      sessionId: 'sid-1',
      propertyId: 'prop-1',
      agentId: 'agent-1',
      address: 'Inexistente 99999 2° B',
    }))
  })

  it('no repite el resumen si no llegó nada desde el último', async () => {
    const d = deps({
      links: {
        findByToken: vi.fn().mockResolvedValue(link({
          last_upload_at: '2026-10-15T10:00:00.000Z',
          last_finished_at: '2026-10-15T10:05:00.000Z',
        })),
      },
    })
    expect(await build(d).execute('tok')).toEqual({ notified: false })
    expect(d.gateway.finish).not.toHaveBeenCalled()
  })

  it('sin subidas no avisa', async () => {
    const d = deps()
    expect(await build(d).execute('tok')).toEqual({ notified: false })
  })
})

describe('GetPublicDocPortalUseCase', () => {
  it('muestra la checklist con lo recibido y sin links de Drive', async () => {
    const d = deps({
      documents: {
        listByProperty: vi.fn().mockResolvedValue([{
          id: 'doc-1', original_name: 'dni.jpg', doc_type: 'dni', recognized: true,
          drive_file_url: 'https://drive/secret', created_at: '2026-10-15',
        }]),
      },
    })
    const orgs = { findById: vi.fn().mockResolvedValue({ name: 'Marcela Genta', logo_url: null, brand_color: '#ff007c' }) }
    const users = { findById: vi.fn().mockResolvedValue({ full_name: 'Andrés', phone: '11 4444 4444', photo_url: null }) }
    const uc = new GetPublicDocPortalUseCase(d.links as any, d.documents as any, d.properties as any, orgs as any, users as any)
    const view = await uc.execute('tok')

    expect(view.address).toBe('Inexistente 99999 2° B')
    expect(view.checklist.required.find((i) => i.type === 'dni')?.received).toBe(true)
    expect(view.checklist.internal.map((i) => i.type)).toEqual(['informe_dominio', 'informe_inhibicion'])
    expect(JSON.stringify(view)).not.toContain('drive/secret')
    expect(view.agent?.phone).toBe('11 4444 4444')
  })
})
