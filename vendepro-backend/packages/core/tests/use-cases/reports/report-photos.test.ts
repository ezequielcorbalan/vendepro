import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AddReportPhotoUseCase } from '../../../src/application/use-cases/reports/add-report-photo'
import { DeleteReportPhotoUseCase } from '../../../src/application/use-cases/reports/delete-report-photo'

const repo = () => ({
  findReportRaw: vi.fn().mockResolvedValue({ id: 'rep-1', property_id: 'prop-1' }),
  addPhoto: vi.fn().mockResolvedValue(undefined),
  deletePhoto: vi.fn().mockResolvedValue({ photo_url: 'https://r2/x.jpg', r2_key: 'reports/org/rep-1/x.jpg' }),
}) as any

const storage = () => ({
  upload: vi.fn().mockResolvedValue('https://r2.public/reports/foo.jpg'),
  delete: vi.fn().mockResolvedValue(undefined),
  getUrl: vi.fn(),
}) as any

const idGen = { generate: vi.fn().mockReturnValue('photo-1') } as any

beforeEach(() => vi.clearAllMocks())

describe('AddReportPhotoUseCase', () => {
  const input = {
    reportId: 'rep-1',
    orgId: 'org-1',
    fileName: 'ficha visita.jpg',
    contentType: 'image/jpeg',
    buffer: new ArrayBuffer(1024),
    photoType: 'visit_form',
    sortOrder: 2,
  }

  it('sube a R2 Y escribe report_photos — la ruta vieja solo hacía lo primero', async () => {
    const r = repo(); const st = storage()
    const uc = new AddReportPhotoUseCase(r, st, idGen)
    const result = await uc.execute(input)

    expect(st.upload).toHaveBeenCalledOnce()
    const [key] = st.upload.mock.calls[0]
    expect(key).toMatch(/^reports\/org-1\/rep-1\//)
    expect(r.addPhoto).toHaveBeenCalledWith(expect.objectContaining({
      id: 'photo-1',
      report_id: 'rep-1',
      photo_url: 'https://r2.public/reports/foo.jpg',
      r2_key: key,
      photo_type: 'visit_form',
      sort_order: 2,
    }), 'org-1')
    expect(result).toEqual({ id: 'photo-1', photo_url: 'https://r2.public/reports/foo.jpg' })
  })

  it('404 si el reporte no es de la org — y no sube nada a R2', async () => {
    const r = repo(); r.findReportRaw.mockResolvedValue(null)
    const st = storage()
    const uc = new AddReportPhotoUseCase(r, st, idGen)
    await expect(uc.execute(input)).rejects.toMatchObject({ statusCode: 404 })
    expect(st.upload).not.toHaveBeenCalled()
  })

  it('400 si no es una imagen, 413 si pesa de más', async () => {
    const uc = new AddReportPhotoUseCase(repo(), storage(), idGen)
    await expect(uc.execute({ ...input, contentType: 'application/pdf' }))
      .rejects.toMatchObject({ statusCode: 400 })
    await expect(uc.execute({ ...input, buffer: new ArrayBuffer(16 * 1024 * 1024) }))
      .rejects.toMatchObject({ statusCode: 413 })
  })

  it('un photo_type desconocido cae a visit_form (CHECK de la tabla)', async () => {
    const r = repo()
    const uc = new AddReportPhotoUseCase(r, storage(), idGen)
    await uc.execute({ ...input, photoType: 'lo-que-sea' })
    expect(r.addPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ photo_type: 'visit_form' }), 'org-1',
    )
  })
})

describe('DeleteReportPhotoUseCase', () => {
  it('borra la fila y limpia R2 con la key guardada', async () => {
    const r = repo(); const st = storage()
    const uc = new DeleteReportPhotoUseCase(r, st)
    const result = await uc.execute('photo-1', 'org-1')
    expect(r.deletePhoto).toHaveBeenCalledWith('photo-1', 'org-1')
    expect(st.delete).toHaveBeenCalledWith('reports/org/rep-1/x.jpg')
    expect(result).toEqual({ success: true })
  })

  it('404 si la foto no existe o es de otra org', async () => {
    const r = repo(); r.deletePhoto.mockResolvedValue(null)
    const uc = new DeleteReportPhotoUseCase(r, storage())
    await expect(uc.execute('photo-x', 'org-1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('si R2 falla, la baja igual se confirma — el objeto huérfano es tolerable', async () => {
    const st = storage(); st.delete.mockRejectedValue(new Error('boom'))
    const uc = new DeleteReportPhotoUseCase(repo(), st)
    await expect(uc.execute('photo-1', 'org-1')).resolves.toEqual({ success: true })
  })
})
