import { describe, it, expect, vi } from 'vitest'
import { SyncDriveDocumentsUseCase, buildTree } from '../../../src/application/use-cases/doc-portal/sync-drive-documents'
import type { DriveItem } from '../../../src/application/ports/services/document-store'
import type { DriveFolder } from '../../../src/domain/entities/drive-documents'

const DRIVE = '0Adrive'
const NOW = new Date('2026-10-15T07:00:00Z')

function item(over: Partial<DriveItem> & { id: string; name: string }): DriveItem {
  return {
    mimeType: 'application/pdf',
    parentId: DRIVE,
    isFolder: false,
    sizeBytes: 100_000,
    modifiedTime: '2026-10-12T18:00:00.000Z',
    webViewLink: `https://drive.google.com/file/d/${over.id}/view`,
    description: null,
    ...over,
  }
}
const folder = (id: string, name: string, parentId: string): DriveItem =>
  item({ id, name, parentId, isFolder: true, mimeType: 'application/vnd.google-apps.folder', webViewLink: `https://drive.google.com/drive/folders/${id}` })

/** Unidad de prueba: un área, una carpeta de propiedad con subcarpeta, y carpetas de servicio. */
function tree(extraFiles: DriveItem[] = []): DriveItem[] {
  return [
    folder('area-1', 'OFICINA PROPIEDADES', DRIVE),
    folder('f-prop', 'Inexistente 99999 2° B', 'area-1'),
    folder('f-sub', 'informes', 'f-prop'),
    folder('f-modelos', 'MODELOS', 'area-1'),
    folder('f-otra', 'Desconocida 12345', 'area-1'),
    item({ id: 'modelo-1', name: 'Autorizacion modelo.pdf', parentId: 'f-modelos' }),
    item({ id: 'suelto', name: 'suelto en el area.pdf', parentId: 'area-1' }),
    ...extraFiles,
  ]
}

function property(over: Record<string, any> = {}) {
  return {
    id: 'prop-1',
    address: 'Inexistente 99999, Piso 2, Dpto B',
    agent_id: 'agent-1',
    auth_start_date: null,
    auth_duration_days: 180,
    doc_status_json: null,
    ...over,
  }
}

function deps(over: {
  items?: DriveItem[]
  config?: Record<string, unknown>
  properties?: any[]
  folders?: DriveFolder[]
  index?: Array<{ drive_file_id: string; drive_modified_at: string | null }>
  driveDocs?: any[]
  classify?: any
} = {}) {
  const config = { shared_drive_id: DRIVE, read_only: false, ...(over.config ?? {}) }
  let n = 0
  const created: any[] = []
  return {
    created,
    integrations: {
      findByOrgAndProvider: vi.fn().mockResolvedValue({ org_id: 'org-1', enabled: true, config_json: JSON.stringify(config) }),
      findEnabledByProvider: vi.fn().mockResolvedValue([{ org_id: 'org-1', enabled: true, config_json: JSON.stringify(config) }]),
      save: vi.fn(),
    },
    store: {
      listTree: vi.fn().mockResolvedValue(over.items ?? tree()),
      download: vi.fn().mockResolvedValue({ base64: 'AAAA', mimeType: 'application/pdf' }),
    },
    classifier: {
      classify: over.classify ?? vi.fn().mockResolvedValue({ docType: 'dni', issuedAt: null, authorization: null, observations: null }),
    },
    folders: {
      listByOrg: vi.fn().mockResolvedValue(over.folders ?? []),
      upsert: vi.fn(),
      setProperty: vi.fn(),
    },
    documents: {
      listDriveIndex: vi.fn().mockResolvedValue(over.index ?? []),
      // Lo que se registra en la pasada también se ve en el reflejo.
      listByOrgAndSource: vi.fn().mockImplementation(async () => [...(over.driveDocs ?? []), ...created]),
      createFromDrive: vi.fn().mockImplementation(async (d: any) => { created.push(d) }),
      updateFromDrive: vi.fn(),
      listByProperty: vi.fn(),
      create: vi.fn(),
      countByLinkSince: vi.fn(),
    },
    properties: {
      findByOrg: vi.fn().mockResolvedValue(over.properties ?? [property()]),
      update: vi.fn(),
    },
    notifications: { save: vi.fn() },
    ids: { generate: () => `id-${++n}` },
  }
}

const run = (d: ReturnType<typeof deps>, input: Record<string, unknown> = {}) =>
  new SyncDriveDocumentsUseCase(d as any).execute({ orgId: 'org-1', now: NOW, ...input })

describe('buildTree', () => {
  it('toma las carpetas de propiedad bajo un área y sus archivos a cualquier profundidad', () => {
    const t = buildTree(tree([item({ id: 'x', name: 'x.pdf', parentId: 'f-sub' })]), { shared_drive_id: DRIVE, ignore: [] })
    expect(t.propertyFolders.map((p) => p.folder.id).sort()).toEqual(['f-otra', 'f-prop'])
    expect(t.files.map((f) => f.id)).toEqual(['x'])
    expect(t.propertyFolderOf.get('x')).toBe('f-prop')
  })
})

describe('SyncDriveDocumentsUseCase', () => {
  it('vincula la carpeta por dirección y deja la que no matchea sin propiedad', async () => {
    const d = deps()
    const [r] = await run(d)
    expect(d.folders.upsert).toHaveBeenCalledWith(expect.objectContaining({ folder_id: 'f-prop', property_id: 'prop-1', match_status: 'auto' }))
    expect(d.folders.upsert).toHaveBeenCalledWith(expect.objectContaining({ folder_id: 'f-otra', property_id: null, match_status: 'none' }))
    expect(r).toMatchObject({ folders: 2, matched: 1, unmatched: 1 })
  })

  it('una vinculación manual no se recalcula', async () => {
    const d = deps({
      folders: [{ folder_id: 'f-otra', org_id: 'org-1', area: null, name: 'x', web_url: null, property_id: 'prop-1', match_status: 'manual', last_scanned_at: null }],
      items: tree([item({ id: 'a', name: 'Titulo de propiedad - 2010-08-10.pdf', parentId: 'f-otra' })]),
    })
    await run(d)
    expect(d.folders.upsert).toHaveBeenCalledWith(expect.objectContaining({ folder_id: 'f-otra', property_id: 'prop-1', match_status: 'manual' }))
    expect(d.documents.createFromDrive).toHaveBeenCalledWith(expect.objectContaining({ drive_file_id: 'a', property_id: 'prop-1' }))
  })

  it('lo que nombró n8n se registra sin IA; los informes quedan con vencimiento', async () => {
    const d = deps({
      items: tree([
        item({ id: 'a', name: 'Titulo de propiedad - 2010-08-10.pdf', parentId: 'f-prop', description: 'Original: escritura.pdf | Escritura de compraventa' }),
        item({ id: 'b', name: 'Informe de dominio - 2026-10-01.pdf', parentId: 'f-sub' }),
      ]),
    })
    const [r] = await run(d)
    expect(d.classifier.classify).not.toHaveBeenCalled()
    expect(d.documents.createFromDrive).toHaveBeenCalledWith(expect.objectContaining({
      drive_file_id: 'a', doc_type: 'titulo', issued_at: '2010-08-10', classified_by: 'nombre_n8n',
      source: 'drive', observations: 'Escritura de compraventa', drive_folder_url: 'https://drive.google.com/drive/folders/f-prop',
    }))
    expect(d.documents.createFromDrive).toHaveBeenCalledWith(expect.objectContaining({ drive_file_id: 'b', valid_until: '2026-10-31' }))
    expect(r!.by_name).toBe(2)
  })

  it('lo de las carpetas ignoradas y lo suelto en el área no se toca', async () => {
    const d = deps()
    await run(d)
    expect(d.documents.createFromDrive).not.toHaveBeenCalled()
  })

  it('es idempotente: lo ya registrado (también por el portal) no se vuelve a leer', async () => {
    const d = deps({
      items: tree([
        item({ id: 'a', name: 'scan.pdf', parentId: 'f-prop' }),
        item({ id: 'b', name: 'otro.pdf', parentId: 'f-prop' }),
      ]),
      index: [
        { drive_file_id: 'a', drive_modified_at: '2026-10-12T18:00:00.000Z' },
        { drive_file_id: 'b', drive_modified_at: null },
      ],
    })
    await run(d)
    expect(d.classifier.classify).not.toHaveBeenCalled()
    expect(d.documents.createFromDrive).not.toHaveBeenCalled()
  })

  it('si el archivo cambió en Drive lo vuelve a leer y actualiza', async () => {
    const d = deps({
      items: tree([item({ id: 'a', name: 'scan.pdf', parentId: 'f-prop', modifiedTime: '2026-10-14T10:00:00.000Z' })]),
      index: [{ drive_file_id: 'a', drive_modified_at: '2026-10-12T18:00:00.000Z' }],
    })
    await run(d)
    expect(d.documents.updateFromDrive).toHaveBeenCalledWith(expect.objectContaining({ drive_file_id: 'a', doc_type: 'dni', classified_by: 'ia' }))
  })

  it('respeta el tope de IA por pasada: lo que no entra queda para la próxima', async () => {
    const d = deps({
      items: tree([
        item({ id: 'a', name: 'a.pdf', parentId: 'f-prop' }),
        item({ id: 'b', name: 'b.pdf', parentId: 'f-prop' }),
        item({ id: 'c', name: 'c.pdf', parentId: 'f-prop' }),
      ]),
    })
    const [r] = await run(d, { maxAiFiles: 2 })
    expect(d.classifier.classify).toHaveBeenCalledTimes(2)
    expect(r).toMatchObject({ by_ai: 2, pending: 1, documents: 2 })
  })

  it('un archivo muy grande no se descarga: queda "sin leer" para revisión', async () => {
    const d = deps({ items: tree([item({ id: 'a', name: 'escritura escaneada.pdf', parentId: 'f-prop', sizeBytes: 60_000_000 })]) })
    const [r] = await run(d)
    expect(d.store.download).not.toHaveBeenCalled()
    expect(d.documents.createFromDrive).toHaveBeenCalledWith(expect.objectContaining({ doc_type: 'otro', recognized: false, classified_by: 'sin_leer' }))
    expect(r!.unreadable).toBe(1)
  })

  it('si la IA falla no registra nada: se reintenta la próxima noche', async () => {
    const d = deps({
      items: tree([item({ id: 'a', name: 'a.pdf', parentId: 'f-prop' })]),
      classify: vi.fn().mockRejectedValue(new Error('503')),
    })
    const [r] = await run(d)
    expect(d.documents.createFromDrive).not.toHaveBeenCalled()
    expect(r!.pending).toBe(1)
  })

  it('tilda el checklist y completa la autorización vacía con lo leído', async () => {
    const d = deps({
      items: tree([
        item({ id: 'a', name: 'Autorizacion de venta firmada - 2026-10-08.pdf', parentId: 'f-prop' }),
        item({ id: 'b', name: 'Titulo de propiedad - 2010-08-10.pdf', parentId: 'f-prop' }),
      ]),
      classify: vi.fn().mockResolvedValue({
        docType: 'autorizacion_venta', issuedAt: '2026-10-08',
        authorization: { start_date: '2026-10-08', duration_days: 120 }, observations: null,
      }),
    })
    const [r] = await run(d)
    expect(d.properties.update).toHaveBeenCalledTimes(1)
    const [id, org, patch] = d.properties.update.mock.calls[0]!
    expect([id, org]).toEqual(['prop-1', 'org-1'])
    expect(patch).toMatchObject({ auth_start_date: '2026-10-08', auth_duration_days: 120 })
    const status = JSON.parse(patch.doc_status_json)
    expect(status.status).toMatchObject({ auth_signed: 'done', title: 'done' })
    expect(status.cloud_url).toBe('https://drive.google.com/drive/folders/f-prop')
    expect(r).toMatchObject({ properties_updated: 1, authorizations_filled: 1 })
  })

  it('una fecha de autorización ya cargada no se pisa: avisa al agente', async () => {
    const d = deps({
      properties: [property({ auth_start_date: '2026-05-01' })],
      items: tree([item({ id: 'a', name: 'autorizacion.pdf', parentId: 'f-prop' })]),
      classify: vi.fn().mockResolvedValue({
        docType: 'autorizacion_venta', issuedAt: null, authorization: { start_date: '2026-10-08', duration_days: 90 }, observations: null,
      }),
    })
    const [r] = await run(d)
    const patch = d.properties.update.mock.calls[0]?.[2] ?? {}
    expect(patch).not.toHaveProperty('auth_start_date')
    expect(d.notifications.save).toHaveBeenCalledTimes(1)
    expect(r!.conflicts).toBe(1)
  })

  it('en modo sólo lectura registra pero no toca las propiedades ni avisa', async () => {
    const d = deps({
      config: { read_only: true },
      items: tree([item({ id: 'a', name: 'Titulo de propiedad - 2010-08-10.pdf', parentId: 'f-prop' })]),
    })
    const [r] = await run(d)
    expect(d.documents.createFromDrive).toHaveBeenCalled()
    expect(d.properties.update).not.toHaveBeenCalled()
    expect(r!.read_only).toBe(true)
  })

  it('el reflejo es idempotente: si no cambia nada, no escribe', async () => {
    const d = deps({
      properties: [property({
        doc_status_json: JSON.stringify({ status: { title: 'done' }, cloud_url: 'x', custom: [], hidden: [] }),
      })],
      driveDocs: [{ property_id: 'prop-1', doc_type: 'titulo', recognized: true, drive_folder_url: 'y', extracted_json: null }],
    })
    await run(d)
    expect(d.properties.update).not.toHaveBeenCalled()
  })

  it('con propertyId sólo procesa esa propiedad', async () => {
    const d = deps({
      properties: [property(), property({ id: 'prop-2', address: 'Desconocida 12345' })],
      items: tree([
        item({ id: 'a', name: 'Titulo de propiedad - 2010-08-10.pdf', parentId: 'f-prop' }),
        item({ id: 'b', name: 'Titulo de propiedad - 2011-01-01.pdf', parentId: 'f-otra' }),
      ]),
    })
    await run(d, { propertyId: 'prop-2' })
    expect(d.documents.createFromDrive).toHaveBeenCalledTimes(1)
    expect(d.documents.createFromDrive).toHaveBeenCalledWith(expect.objectContaining({ drive_file_id: 'b' }))
  })

  it('sin la integración configurada, la sincronización a pedido avisa', async () => {
    const d = deps()
    d.integrations.findByOrgAndProvider.mockResolvedValue(null)
    await expect(run(d)).rejects.toThrow(/Drive de documentación/)
  })

  it('en el cron, una org que falla no frena a las demás', async () => {
    const d = deps()
    d.integrations.findEnabledByProvider.mockResolvedValue([
      { org_id: 'org-rota', enabled: true, config_json: JSON.stringify({ shared_drive_id: 'nope' }) },
      { org_id: 'org-1', enabled: true, config_json: JSON.stringify({ shared_drive_id: DRIVE }) },
    ])
    d.store.listTree.mockImplementation(async (id: string) => {
      if (id === 'nope') throw new Error('404')
      return tree()
    })
    const results = await new SyncDriveDocumentsUseCase(d as any).execute({ now: NOW })
    expect(results.map((r) => r.org_id)).toEqual(['org-1'])
  })
})
