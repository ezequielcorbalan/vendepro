import { describe, it, expect } from 'vitest'
import {
  computeDocChecklist,
  summarizeDocChecklist,
  applyDocumentToDocStatus,
  toDocPropertyKind,
  toDocOperation,
} from '../../src/domain/rules/document-checklist'

describe('computeDocChecklist', () => {
  it('venta de depto: reglamento y expensas, sin AySA', () => {
    const c = computeDocChecklist({ operation: 'venta', kind: 'depto', succession: 'no', married: null })
    expect(c.required).toEqual([
      'autorizacion_venta', 'titulo', 'plano_mensura', 'dni', 'abl', 'factura_luz',
      'reglamento_copropiedad', 'liquidacion_expensas',
    ])
    expect(c.required).not.toContain('aysa')
    expect(c.optional).toEqual(['certificado_matrimonio', 'factura_gas'])
  })

  it('venta de casa: AySA en vez de reglamento y expensas', () => {
    const c = computeDocChecklist({ operation: 'venta', kind: 'casa', succession: 'no', married: null })
    expect(c.required).toContain('aysa')
    expect(c.required).not.toContain('reglamento_copropiedad')
    expect(c.required).not.toContain('liquidacion_expensas')
  })

  it('casado: el certificado de matrimonio pasa a requerido', () => {
    const c = computeDocChecklist({ operation: 'venta', kind: 'ph', succession: 'no', married: true })
    expect(c.required).toContain('certificado_matrimonio')
    expect(c.optional).not.toContain('certificado_matrimonio')
  })

  it('sucesión: testimonio y carátula requeridos; si no sabe, opcionales', () => {
    const si = computeDocChecklist({ operation: 'venta', kind: 'casa', succession: 'si', married: null })
    expect(si.required).toEqual(expect.arrayContaining(['testimonio', 'caratula_sucesorio']))
    const nose = computeDocChecklist({ operation: 'venta', kind: 'casa', succession: 'nose', married: null })
    expect(nose.required).not.toContain('testimonio')
    expect(nose.optional).toEqual(expect.arrayContaining(['testimonio', 'caratula_sucesorio']))
  })

  it('los informes de dominio e inhibición nunca son tarea del propietario', () => {
    const c = computeDocChecklist({ operation: 'venta', kind: 'depto', succession: 'si', married: true })
    expect(c.internal).toEqual(['informe_dominio', 'informe_inhibicion'])
    expect([...c.required, ...c.optional]).not.toContain('informe_dominio')
    expect([...c.required, ...c.optional]).not.toContain('informe_inhibicion')
  })

  it('alquiler de PH: título, DNI, ABL, luz y expensas', () => {
    const c = computeDocChecklist({ operation: 'alquiler', kind: 'ph', succession: 'no', married: null })
    expect(c.required).toEqual(['titulo', 'dni', 'abl', 'factura_luz', 'liquidacion_expensas'])
    expect(c.optional).toEqual(['factura_gas'])
  })
})

describe('summarizeDocChecklist', () => {
  it('cuenta los requeridos recibidos y lista los que faltan', () => {
    const c = computeDocChecklist({ operation: 'alquiler', kind: 'casa', succession: 'no', married: null })
    const s = summarizeDocChecklist(c, ['titulo', 'dni', 'factura_gas'])
    expect(s.required_total).toBe(5)
    expect(s.required_done).toBe(2)
    expect(s.missing).toEqual(['abl', 'factura_luz', 'aysa'])
    expect(s.optional.find((i) => i.type === 'factura_gas')?.received).toBe(true)
  })
})

describe('mapeos desde la propiedad', () => {
  it('property_type → tipo del checklist', () => {
    expect(toDocPropertyKind('departamento')).toBe('depto')
    expect(toDocPropertyKind('terreno')).toBe('otro')
    expect(toDocPropertyKind(null)).toBe('otro')
  })
  it('operation_type → venta salvo alquiler', () => {
    expect(toDocOperation('Alquiler')).toBe('alquiler')
    expect(toDocOperation('venta')).toBe('venta')
    expect(toDocOperation(null)).toBe('venta')
  })
})

describe('applyDocumentToDocStatus', () => {
  it('tilda la clave equivalente del checklist manual', () => {
    const out = applyDocumentToDocStatus(null, { type: 'titulo' })
    expect(JSON.parse(out!).status).toEqual({ title: 'done' })
  })

  it('un documento sin equivalente exacto entra como ítem propio', () => {
    // La boleta de ABL no es el libre deuda municipal: no se tilda ese.
    const out = JSON.parse(applyDocumentToDocStatus(null, { type: 'abl' })!)
    expect(out.status).toEqual({ doc_abl: 'done' })
    expect(out.custom).toEqual([{ key: 'doc_abl', label: 'Boleta de ABL' }])
  })

  it('no pisa un "no aplica" puesto a mano', () => {
    const raw = JSON.stringify({ status: { title: 'na' }, cloud_url: '', custom: [], hidden: [] })
    expect(applyDocumentToDocStatus(raw, { type: 'titulo' })).toBeNull()
  })

  it('convierte el formato viejo y completa la carpeta si estaba vacía', () => {
    const out = JSON.parse(applyDocumentToDocStatus(JSON.stringify({ title: 'pending' }), {
      type: 'titulo',
      folderUrl: 'https://drive.google.com/drive/folders/x',
    })!)
    expect(out.status.title).toBe('done')
    expect(out.cloud_url).toBe('https://drive.google.com/drive/folders/x')
  })

  it('no reemplaza un link de carpeta cargado a mano', () => {
    const raw = JSON.stringify({ status: {}, cloud_url: 'https://mi-carpeta', custom: [], hidden: [] })
    expect(applyDocumentToDocStatus(raw, { type: 'otro', folderUrl: 'https://otra' })).toBeNull()
  })

  it('un archivo no reconocido no cambia nada', () => {
    expect(applyDocumentToDocStatus(null, { type: 'otro' })).toBeNull()
  })
})
