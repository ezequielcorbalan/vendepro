import { describe, it, expect, vi } from 'vitest'
import {
  SaveDriveDocsSettingsUseCase,
  GetDriveDocsSettingsUseCase,
  LinkDriveFolderUseCase,
  SyncPropertyDriveDocumentsUseCase,
  DRIVE_AI_FILES_ON_DEMAND,
} from '../../../src/application/use-cases/doc-portal/drive-docs-settings'
import { parseDriveDocsConfig } from '../../../src/domain/entities/drive-documents'

const ids = { generate: () => 'int-1' }

describe('parseDriveDocsConfig', () => {
  it('arranca en sólo lectura salvo que se apague a propósito', () => {
    expect(parseDriveDocsConfig('{"shared_drive_id":"0Aabcdefghij"}')).toEqual({ shared_drive_id: '0Aabcdefghij', read_only: true, ignore: [] })
    expect(parseDriveDocsConfig('{"shared_drive_id":"0Aabcdefghij","read_only":false}')?.read_only).toBe(false)
    expect(parseDriveDocsConfig('{}')).toBeNull()
    expect(parseDriveDocsConfig('basura')).toBeNull()
  })
})

describe('SaveDriveDocsSettingsUseCase', () => {
  it('sólo un admin configura', async () => {
    const repo = { findByOrgAndProvider: vi.fn(), save: vi.fn(), findEnabledByProvider: vi.fn() }
    await expect(new SaveDriveDocsSettingsUseCase(repo, ids).execute({
      org_id: 'o', role: 'agent', enabled: true, shared_drive_id: '0Aabcdefghij',
    })).rejects.toThrow(/administrador/)
    expect(repo.save).not.toHaveBeenCalled()
  })

  it('valida el id de la unidad y guarda en sólo lectura por defecto', async () => {
    const repo = { findByOrgAndProvider: vi.fn().mockResolvedValue(null), save: vi.fn(), findEnabledByProvider: vi.fn() }
    const uc = new SaveDriveDocsSettingsUseCase(repo, ids)
    await expect(uc.execute({ org_id: 'o', role: 'admin', enabled: true, shared_drive_id: 'x' })).rejects.toThrow(/unidad compartida/)

    const view = await uc.execute({ org_id: 'o', role: 'admin', enabled: true, shared_drive_id: '0Aabcdefghij', ignore: [' ARCHIVO ', ''] })
    expect(view).toEqual({ enabled: true, shared_drive_id: '0Aabcdefghij', read_only: true, ignore: ['ARCHIVO'] })
    const saved = repo.save.mock.calls[0]![0]
    expect(saved.provider).toBe('google_drive_docs')

    const get = await new GetDriveDocsSettingsUseCase({
      ...repo, findByOrgAndProvider: vi.fn().mockResolvedValue(saved),
    }).execute('o')
    expect(get).toMatchObject({ enabled: true, shared_drive_id: '0Aabcdefghij', read_only: true })
  })
})

describe('LinkDriveFolderUseCase', () => {
  const folders = () => ({ listByOrg: vi.fn(), upsert: vi.fn(), setProperty: vi.fn().mockResolvedValue(true) })

  it('vincular a mano deja la carpeta "manual"', async () => {
    const f = folders()
    const properties = { findById: vi.fn().mockResolvedValue({ id: 'p1' }) }
    const out = await new LinkDriveFolderUseCase(f, properties as any).execute({ org_id: 'o', role: 'admin', folder_id: 'f1', property_id: 'p1' })
    expect(out).toEqual({ folder_id: 'f1', property_id: 'p1', match_status: 'manual' })
    expect(f.setProperty).toHaveBeenCalledWith('f1', 'o', 'p1', 'manual')
  })

  it('ignorar y volver a automático', async () => {
    const f = folders()
    const uc = new LinkDriveFolderUseCase(f, { findById: vi.fn() } as any)
    await uc.execute({ org_id: 'o', role: 'admin', folder_id: 'f1', property_id: null, ignore: true })
    await uc.execute({ org_id: 'o', role: 'admin', folder_id: 'f1', property_id: null })
    expect(f.setProperty).toHaveBeenNthCalledWith(1, 'f1', 'o', null, 'ignored')
    expect(f.setProperty).toHaveBeenNthCalledWith(2, 'f1', 'o', null, 'none')
  })

  it('una propiedad de otra org no se puede vincular', async () => {
    const uc = new LinkDriveFolderUseCase(folders(), { findById: vi.fn().mockResolvedValue(null) } as any)
    await expect(uc.execute({ org_id: 'o', role: 'admin', folder_id: 'f1', property_id: 'ajena' })).rejects.toThrow()
  })
})

describe('SyncPropertyDriveDocumentsUseCase', () => {
  it('el agente de la propiedad puede revisar su carpeta, con tope chico de IA', async () => {
    const sync = { execute: vi.fn().mockResolvedValue([{ org_id: 'o', documents: 2 }]) }
    const properties = { findById: vi.fn().mockResolvedValue({ id: 'p1', agent_id: 'u1' }) }
    const out = await new SyncPropertyDriveDocumentsUseCase(properties as any, sync as any)
      .execute({ org_id: 'o', user_id: 'u1', role: 'agent' }, 'p1')
    expect(out).toEqual({ org_id: 'o', documents: 2 })
    expect(sync.execute).toHaveBeenCalledWith({ orgId: 'o', propertyId: 'p1', maxAiFiles: DRIVE_AI_FILES_ON_DEMAND })
  })

  it('otro agente no', async () => {
    const sync = { execute: vi.fn() }
    const properties = { findById: vi.fn().mockResolvedValue({ id: 'p1', agent_id: 'u1' }) }
    await expect(new SyncPropertyDriveDocumentsUseCase(properties as any, sync as any)
      .execute({ org_id: 'o', user_id: 'u2', role: 'agent' }, 'p1')).rejects.toThrow(/agente de la propiedad/)
    expect(sync.execute).not.toHaveBeenCalled()
  })
})
