import { describe, it, expect, vi } from 'vitest'
import { N8nDocumentIntakeGateway } from '../../src/services/n8n-document-intake-gateway'

const config = {
  upload_url: 'https://n8n.test/webhook/documentacion-subir',
  done_url: 'https://n8n.test/webhook/documentacion-listo',
  agent_map: {},
}
const fields = {
  direccion: 'Inexistente 99999', operacion: 'venta', tipo: 'depto', sucesion: 'no',
  nombre: 'Ana', telefono: '11', email: '', sid: 'sid-1', agente: 'andres',
}
const file = { name: 'dni.jpg', type: 'image/jpeg', size: 3, data: new Blob(['abc'], { type: 'image/jpeg' }) }
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

describe('N8nDocumentIntakeGateway', () => {
  it('manda el multipart con los mismos campos que la página de n8n', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ ok: true, tipo: 'dni', tipo_label: 'DNI', reconocido: true }))
    await new N8nDocumentIntakeGateway(fetchFn as any).upload(config, file, fields)

    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(config.upload_url)
    const body = init.body as FormData
    expect((body.get('archivo') as File).name).toBe('dni.jpg')
    expect(body.get('direccion')).toBe('Inexistente 99999')
    expect(body.get('sid')).toBe('sid-1')
    expect(body.get('agente')).toBe('andres')
  })

  it('lee la respuesta de la página y, si vienen, los datos de Drive', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({
      ok: true, tipo: 'titulo', tipo_label: 'Título', reconocido: true,
      file_id: 'f1', link_carpeta: 'https://drive/folder', fecha_emision: '2010-08-10',
    }))
    const out = await new N8nDocumentIntakeGateway(fetchFn as any).upload(config, file, fields)
    expect(out).toMatchObject({
      ok: true, doc_type: 'titulo', recognized: true, drive_file_id: 'f1',
      drive_folder_url: 'https://drive/folder', issued_at: '2010-08-10',
    })
  })

  it('propaga el error de n8n y no tira si se cae la red', async () => {
    const conError = new N8nDocumentIntakeGateway(vi.fn().mockResolvedValue(json({ ok: false, error: 'Archivo vacío' })) as any)
    expect(await conError.upload(config, file, fields)).toMatchObject({ ok: false, error: 'Archivo vacío' })

    const sinRed = new N8nDocumentIntakeGateway(vi.fn().mockRejectedValue(new Error('timeout')) as any)
    expect((await sinRed.upload(config, file, fields)).ok).toBe(false)
  })

  it('cierra la sesión con { sid } en text/plain', async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ ok: true }))
    await new N8nDocumentIntakeGateway(fetchFn as any).finish(config, 'sid-1')
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe(config.done_url)
    expect(init.headers['Content-Type']).toBe('text/plain')
    expect(JSON.parse(init.body)).toEqual({ sid: 'sid-1' })
  })
})
