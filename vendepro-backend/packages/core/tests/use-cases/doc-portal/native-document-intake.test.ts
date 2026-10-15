import { describe, it, expect, vi } from 'vitest'
import {
  NativeDocumentIntakeGateway,
  EngineRoutingIntakeGateway,
} from '../../../src/application/use-cases/doc-portal/native-document-intake'
import { authorizationPatch, UploadPortalDocumentUseCase } from '../../../src/application/use-cases/doc-portal/public-doc-portal'
import { loadDocsIntegration } from '../../../src/application/use-cases/doc-portal/manage-doc-portal-link'
import { SaveDocsIntegrationSettingsUseCase } from '../../../src/application/use-cases/doc-portal/docs-integration-settings'
import { storedDocumentName, propertyFolderName } from '../../../src/domain/rules/document-checklist'
import { parseDocsIntegrationConfig } from '../../../src/domain/entities/doc-portal'

const config = { engine: 'google_drive' as const, upload_url: '', done_url: '', agent_map: {} }
const fields = {
  direccion: 'Inexistente 99999 2° B', operacion: 'venta', tipo: 'depto', sucesion: 'no',
  nombre: 'Ana', telefono: '', email: '', sid: 'sid-1', org_id: 'org-1', property_id: 'prop-1',
  declared_type: 'titulo' as const,
}
const file = { name: 'IMG_0001.pdf', type: 'application/pdf', size: 10, data: new Blob(['x']) }

function build(over: Record<string, any> = {}) {
  const storage = {
    ensureRootFolder: vi.fn(),
    ensurePropertyFolder: vi.fn().mockResolvedValue({ id: 'folder-1', url: 'https://drive/folder-1' }),
    upload: vi.fn().mockResolvedValue({ id: 'file-1', url: 'https://drive/file-1' }),
    ...(over.storage ?? {}),
  }
  const classifier = {
    classify: vi.fn().mockResolvedValue({ docType: 'titulo', issuedAt: '2010-08-10', authorization: null, observations: null }),
    ...(over.classifier ?? {}),
  }
  const cloud = { forOrg: vi.fn().mockResolvedValue(over.noCloud ? null : { storage, rootFolderId: 'root-1' }) }
  const notifications = { save: vi.fn().mockResolvedValue(undefined) }
  const ids = { generate: vi.fn(() => 'id-1') }
  const gw = new NativeDocumentIntakeGateway(classifier as any, cloud as any, notifications as any, ids as any)
  return { gw, storage, classifier, cloud, notifications }
}

describe('NativeDocumentIntakeGateway', () => {
  it('clasifica, guarda en la carpeta de la propiedad y lo renombra', async () => {
    const { gw, storage, classifier } = build()
    const out = await gw.upload(config, file, fields)

    expect(classifier.classify).toHaveBeenCalledWith(expect.objectContaining({ declaredType: 'titulo', mimeType: 'application/pdf' }))
    expect(storage.ensurePropertyFolder).toHaveBeenCalledWith({ rootFolderId: 'root-1', propertyId: 'prop-1', name: 'Inexistente 99999 2° B' })
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ folderId: 'folder-1', name: 'Título de propiedad - 2010-08-10.pdf' }))
    expect(out).toMatchObject({
      ok: true, doc_type: 'titulo', recognized: true, issued_at: '2010-08-10',
      drive_file_id: 'file-1', drive_file_url: 'https://drive/file-1', drive_folder_url: 'https://drive/folder-1',
    })
  })

  it('si la IA falla, igual guarda el archivo como "a revisar"', async () => {
    const { gw, storage } = build({ classifier: { classify: vi.fn().mockRejectedValue(new Error('429')) } })
    const out = await gw.upload(config, file, fields)
    expect(out).toMatchObject({ ok: true, doc_type: 'otro', recognized: false })
    expect(storage.upload).toHaveBeenCalledWith(expect.objectContaining({ name: 'A revisar - IMG_0001.pdf' }))
  })

  it('si Drive falla, la subida falla (el propietario reintenta)', async () => {
    const { gw } = build({ storage: { upload: vi.fn().mockRejectedValue(new Error('quota')) } })
    expect(await gw.upload(config, file, fields)).toMatchObject({ ok: false, error: 'No pudimos guardar el archivo, probá de nuevo' })
  })

  it('sin la nube conectada no intenta nada', async () => {
    const { gw, classifier } = build({ noCloud: true })
    expect((await gw.upload(config, file, fields)).ok).toBe(false)
    expect(classifier.classify).not.toHaveBeenCalled()
  })

  it('al cerrar, avisa al agente en la campana con lo que falta', async () => {
    const { gw, notifications } = build()
    await gw.finish(config, {
      sessionId: 'sid-1', orgId: 'org-1', propertyId: 'prop-1', address: 'Inexistente 99999',
      agentId: 'agent-1', missing: ['Plano de mensura'],
    })
    const n = notifications.save.mock.calls[0][0]
    expect(n.user_id).toBe('agent-1')
    expect(n.body).toBe('Todavía falta: Plano de mensura')
    expect(n.link_url).toBe('/propiedades/prop-1')
  })
})

describe('EngineRoutingIntakeGateway', () => {
  it('usa el gateway del motor configurado', async () => {
    const n8n = { upload: vi.fn().mockResolvedValue({ ok: true }), finish: vi.fn() }
    const drive = { upload: vi.fn().mockResolvedValue({ ok: true }), finish: vi.fn() }
    const router = new EngineRoutingIntakeGateway({ n8n: n8n as any, google_drive: drive as any })
    await router.upload({ ...config, engine: 'n8n' }, file, fields)
    expect(n8n.upload).toHaveBeenCalled()
    expect(drive.upload).not.toHaveBeenCalled()
  })
})

describe('authorizationPatch', () => {
  it('completa inicio y plazo si estaban vacíos', () => {
    expect(authorizationPatch({ auth_start_date: null, auth_duration_days: null } as any, {
      startDate: '2026-10-01', durationDays: 180, endDate: null, exclusive: true,
    })).toEqual({ auth_start_date: '2026-10-01', auth_duration_days: 180 })
  })
  it('calcula el plazo desde la fecha de fin', () => {
    expect(authorizationPatch({ auth_start_date: null, auth_duration_days: null } as any, {
      startDate: '2026-10-01', durationDays: null, endDate: '2027-01-29', exclusive: null,
    })).toEqual({ auth_start_date: '2026-10-01', auth_duration_days: 120 })
  })
  it('no pisa lo que se cargó a mano', () => {
    expect(authorizationPatch({ auth_start_date: '2026-09-01', auth_duration_days: 90 } as any, {
      startDate: '2026-10-01', durationDays: 180, endDate: null, exclusive: null,
    })).toEqual({})
  })
})

describe('UploadPortalDocumentUseCase con autorización', () => {
  it('lleva el tipo declarado al motor y completa la autorización leída', async () => {
    const link = {
      id: 'link-1', org_id: 'org-1', property_id: 'prop-1', agent_id: 'agent-1', token: 'tok',
      operation: 'venta', property_kind: 'depto', succession: 'no', married: null, session_id: 'sid-1',
      revoked_at: null,
    }
    const property = {
      id: 'prop-1', address: 'Inexistente 99999', owner_name: 'Ana', owner_phone: '', owner_email: '',
      agent_id: 'agent-1', status: 'active', doc_status_json: null, auth_start_date: null, auth_duration_days: null,
    }
    const gateway = {
      upload: vi.fn().mockResolvedValue({
        ok: true, error: null, doc_type: 'autorizacion_venta', doc_label: 'Autorización', recognized: true,
        issued_at: '2026-10-01', drive_file_id: 'f', drive_file_url: 'u', drive_folder_url: 'fu', observations: null,
        authorization: { startDate: '2026-10-01', durationDays: 180, endDate: null, exclusive: true },
      }),
      finish: vi.fn(),
    }
    const properties = { findById: vi.fn().mockResolvedValue(property), update: vi.fn() }
    const uc = new UploadPortalDocumentUseCase(
      { findByToken: vi.fn().mockResolvedValue(link), registerUpload: vi.fn() } as any,
      { countByLinkSince: vi.fn().mockResolvedValue(0), create: vi.fn() } as any,
      properties as any,
      { findByOrgAndProvider: vi.fn().mockResolvedValue({ enabled: true, config_json: JSON.stringify({ upload_url: 'https://x' }) }) } as any,
      gateway as any,
      { generate: () => 'id' } as any,
    )
    await uc.execute('tok', file, { declaredType: 'autorizacion_venta' })

    expect(gateway.upload.mock.calls[0][2]).toMatchObject({ declared_type: 'autorizacion_venta', property_id: 'prop-1', org_id: 'org-1' })
    expect(properties.update.mock.calls[0][2]).toMatchObject({ auth_start_date: '2026-10-01', auth_duration_days: 180 })
  })
})

describe('config del motor', () => {
  it('las filas viejas sin engine son de n8n; Drive no pide URL', () => {
    expect(parseDocsIntegrationConfig(JSON.stringify({ upload_url: 'https://x' }))?.engine).toBe('n8n')
    expect(parseDocsIntegrationConfig(JSON.stringify({ engine: 'google_drive' }))?.engine).toBe('google_drive')
    expect(parseDocsIntegrationConfig(JSON.stringify({ engine: 'n8n' }))).toBeNull()
  })

  it('motor Drive sin Drive conectado → no hay carga disponible', async () => {
    const repo = {
      findByOrgAndProvider: vi.fn(async (_o: string, provider: string) =>
        provider === 'docs_n8n' ? { enabled: true, config_json: JSON.stringify({ engine: 'google_drive' }) } : null),
    }
    expect(await loadDocsIntegration(repo as any, 'org-1')).toBeNull()
  })

  it('no deja activar el motor Drive sin conectarlo', async () => {
    const repo = { findByOrgAndProvider: vi.fn().mockResolvedValue(null), save: vi.fn() }
    const uc = new SaveDocsIntegrationSettingsUseCase(repo as any, { generate: () => 'id' } as any)
    await expect(uc.execute({ org_id: 'org-1', role: 'admin', enabled: true, engine: 'google_drive' })).rejects.toThrow(/Conectá el Google Drive/)
  })
})

describe('nombres en la nube', () => {
  it('nombre del documento reconocido, sin aclaraciones', () => {
    expect(storedDocumentName('dni', null, 'IMG.JPG')).toBe('DNI del propietario.jpg')
    expect(storedDocumentName('otro', null, 'raro:nombre?.pdf')).toBe('A revisar - raro nombre.pdf')
  })
  it('carpeta = dirección limpia', () => {
    expect(propertyFolderName('Av. Libertador 2340 / 5° A')).toBe('Av. Libertador 2340 5° A')
    expect(propertyFolderName('  ')).toBe('Propiedad sin dirección')
  })
})
