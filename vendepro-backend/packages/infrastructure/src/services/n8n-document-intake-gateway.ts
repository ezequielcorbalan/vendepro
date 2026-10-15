import type {
  DocsIntegrationConfig,
  DocumentIntakeFields,
  DocumentIntakeFile,
  DocumentIntakeGateway,
  DocumentIntakeResult,
} from '@vendepro/core'

/** Clasificar con Claude puede tardar: n8n responde recién cuando el archivo está en Drive. */
const UPLOAD_TIMEOUT_MS = 120_000
const FINISH_TIMEOUT_MS = 15_000

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)

/**
 * Adapter del workflow n8n "Documentacion de propiedades". Habla exactamente
 * como su página de carga (`GET /webhook/documentacion`): multipart con
 * `archivo` + campos del formulario, y `{ sid }` en text/plain para cerrar.
 *
 * SIN reintentos: si n8n recibió el archivo y se perdió la respuesta, un
 * reintento lo duplica en Drive.
 */
export class N8nDocumentIntakeGateway implements DocumentIntakeGateway {
  // El default envuelve a `fetch`: guardado como propiedad y llamado como
  // `this.fetchFn(...)`, workerd tira "Illegal invocation" (pierde su `this`).
  constructor(private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init)) {}

  async upload(config: DocsIntegrationConfig, file: DocumentIntakeFile, fields: DocumentIntakeFields): Promise<DocumentIntakeResult> {
    const fd = new FormData()
    fd.append('archivo', file.data, file.name)
    fd.append('direccion', fields.direccion)
    fd.append('operacion', fields.operacion)
    fd.append('tipo', fields.tipo)
    fd.append('sucesion', fields.sucesion)
    fd.append('nombre', fields.nombre)
    fd.append('telefono', fields.telefono)
    fd.append('email', fields.email)
    fd.append('sid', fields.sid)
    if (fields.agente) fd.append('agente', fields.agente)

    let res: Response
    try {
      res = await this.fetchFn(config.upload_url, {
        method: 'POST',
        body: fd,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      })
    } catch (err) {
      console.error('[n8n-docs] upload sin respuesta', err)
      return failure('No pudimos subir el archivo, probá de nuevo')
    }

    const j = (await res.json().catch(() => null)) as any
    if (!res.ok || !j) {
      console.error('[n8n-docs] upload respondió', res.status)
      return failure('No pudimos subir el archivo, probá de nuevo')
    }
    if (!j.ok) return failure(str(j.error) ?? 'No pudimos subir el archivo, probá de nuevo')

    // `tipo`, `tipo_label` y `reconocido` son los que usa la página de n8n.
    // El resto es best-effort: si el workflow los agrega a la respuesta, se guardan.
    return {
      ok: true,
      error: null,
      doc_type: str(j.tipo) ?? str(j.tipo_id) ?? 'otro',
      doc_label: str(j.tipo_label) ?? str(j.documento),
      recognized: j.reconocido === true || j.reconocido === 'true' || j.reconocido === 1,
      issued_at: str(j.fecha_emision),
      drive_file_id: str(j.file_id) ?? str(j.fileId),
      drive_file_url: str(j.link_archivo) ?? str(j.webViewLink),
      drive_folder_url: str(j.link_carpeta),
      observations: str(j.observaciones),
    }
  }

  async finish(config: DocsIntegrationConfig, sessionId: string): Promise<void> {
    if (!config.done_url) return
    try {
      await this.fetchFn(config.done_url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ sid: sessionId }),
        signal: AbortSignal.timeout(FINISH_TIMEOUT_MS),
      })
    } catch (err) {
      // El cron de n8n (12/16/20 h) igual manda el resumen de lo incompleto.
      console.error('[n8n-docs] cierre de sesión falló', err)
    }
  }
}

function failure(error: string): DocumentIntakeResult {
  return {
    ok: false,
    error,
    doc_type: 'otro',
    doc_label: null,
    recognized: false,
    issued_at: null,
    drive_file_id: null,
    drive_file_url: null,
    drive_folder_url: null,
    observations: null,
  }
}
