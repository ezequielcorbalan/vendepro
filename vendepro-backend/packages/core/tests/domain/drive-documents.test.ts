import { describe, it, expect } from 'vitest'
import {
  parseN8nDocName,
  documentValidUntil,
  planAuthorizationUpdate,
  isIgnoredFolderName,
  normalizeAddress,
  matchFolderToProperty,
} from '../../src/domain/rules/drive-documents'

describe('parseN8nDocName', () => {
  it('lee tipo y fecha de los nombres que pone n8n', () => {
    expect(parseN8nDocName('Titulo de propiedad - 2010-08-10.pdf')).toEqual({ docType: 'titulo', issuedAt: '2010-08-10' })
    expect(parseN8nDocName('Autorizacion de venta firmada - 2026-10-08.pdf')).toEqual({
      docType: 'autorizacion_venta', issuedAt: '2026-10-08',
    })
    expect(parseN8nDocName('Reglamento de copropiedad - 2009-01-19 (2).pdf')).toEqual({
      docType: 'reglamento_copropiedad', issuedAt: '2009-01-19',
    })
    expect(parseN8nDocName('Informe de dominio - 2026-10-01.pdf')?.docType).toBe('informe_dominio')
  })

  it('lo que no tiene nombre de n8n va a la IA', () => {
    expect(parseN8nDocName('A revisar.pdf')).toBeNull()
    expect(parseN8nDocName('Escaneo 0001.pdf')).toBeNull()
    expect(parseN8nDocName('Cualquier cosa - 2026-10-08.pdf')).toBeNull()
  })
})

describe('documentValidUntil', () => {
  it('los informes vencen a los 30 días de emitidos', () => {
    expect(documentValidUntil('informe_dominio', '2026-10-01')).toBe('2026-10-31')
    expect(documentValidUntil('informe_inhibicion', '2026-10-01')).toBe('2026-10-31')
  })

  it('el resto no vence', () => {
    expect(documentValidUntil('titulo', '2026-10-01')).toBeNull()
    expect(documentValidUntil('informe_dominio', null)).toBeNull()
  })
})

describe('planAuthorizationUpdate', () => {
  it('completa la fecha si está vacía', () => {
    expect(
      planAuthorizationUpdate({ auth_start_date: null, auth_duration_days: 180 }, { start_date: '2026-10-08', duration_days: 120 }),
    ).toEqual({ patch: { auth_start_date: '2026-10-08', auth_duration_days: 120 }, conflict: null })
  })

  it('sin plazo leído no toca la duración', () => {
    expect(
      planAuthorizationUpdate({ auth_start_date: '', auth_duration_days: 180 }, { start_date: '2026-10-08', duration_days: null }).patch,
    ).toEqual({ auth_start_date: '2026-10-08' })
  })

  it('nunca pisa una fecha cargada: avisa si difiere', () => {
    expect(
      planAuthorizationUpdate({ auth_start_date: '2026-05-01', auth_duration_days: 180 }, { start_date: '2026-10-08', duration_days: 90 }),
    ).toEqual({ patch: null, conflict: { current: '2026-05-01', fromDocument: '2026-10-08' } })
    expect(
      planAuthorizationUpdate({ auth_start_date: '2026-10-08', auth_duration_days: 180 }, { start_date: '2026-10-08', duration_days: 90 }),
    ).toEqual({ patch: null, conflict: null })
  })

  it('sin fecha leída no hace nada', () => {
    expect(planAuthorizationUpdate({ auth_start_date: null, auth_duration_days: null }, null)).toEqual({ patch: null, conflict: null })
  })
})

describe('isIgnoredFolderName', () => {
  it('reconoce las carpetas de servicio aunque tengan emoji o mayúsculas', () => {
    expect(isIgnoredFolderName('📦 VENDIDAS-CERRADAS')).toBe(true)
    expect(isIgnoredFolderName('MODELOS ')).toBe(true)
    expect(isIgnoredFolderName('Sin identificar - alguien@example.com')).toBe(true)
    expect(isIgnoredFolderName('Calle Falsa 123')).toBe(false)
    expect(isIgnoredFolderName('Archivo viejo', ['archivo'])).toBe(true)
  })
})

describe('normalizeAddress', () => {
  it('saca relleno, acentos y ordinales; barrio y ciudad quedan en el resto', () => {
    expect(normalizeAddress('Av. Inventada 2652 Piso 3° Dpto "B", Barrio, CABA')).toEqual({
      street: 'inventada', number: '2652', rest: ['3', 'b', 'barrio', 'caba'],
    })
    expect(normalizeAddress('Pasaje Ficticio 1956 6to B')).toEqual({ street: 'pasaje ficticio', number: '1956', rest: ['6', 'b'] })
  })

  it('una calle que empieza con número no confunde la altura', () => {
    expect(normalizeAddress('25 de Mayo 1234')).toEqual({ street: '25 de mayo', number: '1234', rest: [] })
  })

  it('sin altura no hay dirección', () => {
    expect(normalizeAddress('MODELOS')).toBeNull()
  })
})

describe('matchFolderToProperty', () => {
  const props = [
    { id: 'p1', address: 'Inventada 4429' },
    { id: 'p2', address: 'Ficticia 335, Piso 2, Dpto 9' },
    { id: 'p3', address: 'Ficticia 335, Piso 5, Dpto 2' },
    { id: 'p4', address: 'Imaginaria 100' },
    { id: 'p5', address: null },
  ]

  it('calle por inclusión y número exacto', () => {
    expect(matchFolderToProperty('Crisologo Inventada 4429 + Cochera', props)).toEqual({ propertyId: 'p1', status: 'auto' })
  })

  it('piso y unidad como subconjunto: "2° 9" no es "5° 2"', () => {
    expect(matchFolderToProperty('Ficticia 335 Piso 2° Dpto 9', props)).toEqual({ propertyId: 'p2', status: 'auto' })
  })

  it('una carpeta sin unidad en un edificio con varias es ambigua: no adivina', () => {
    expect(matchFolderToProperty('Ficticia 335', props)).toEqual({ propertyId: null, status: 'ambiguous' })
  })

  it('el barrio en el nombre de la carpeta no impide el match', () => {
    expect(matchFolderToProperty('Imaginaria 100, Barrio Inventado, CABA', props)).toEqual({ propertyId: 'p4', status: 'auto' })
  })

  it('número distinto o calle distinta: ninguna', () => {
    expect(matchFolderToProperty('Inventada 4430', props).status).toBe('none')
    expect(matchFolderToProperty('Otra 4429', props).status).toBe('none')
  })
})
