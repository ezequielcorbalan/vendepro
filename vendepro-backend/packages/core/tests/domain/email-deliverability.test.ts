import { describe, it, expect } from 'vitest'
import { isUndeliverableEmail } from '../../src/domain/rules/email-deliverability'

describe('isUndeliverableEmail', () => {
  it('bloquea las direcciones que genera el smoke de produccion', () => {
    // El smoke crea ~15 leads por corrida, y crear un lead dispara
    // automatizaciones (api-crm:167, trigger lead.created). Cada deploy mandaba
    // una tanda de emails a direcciones que rebotan duro.
    expect(isUndeliverableEmail('smoke-a1-abc123@test.local')).toBe(true)
    expect(isUndeliverableEmail('smoke-import-xyz@test.local')).toBe(true)
  })

  it('bloquea los TLD reservados por RFC 2606 y 6762', () => {
    for (const e of [
      'a@algo.test', 'a@algo.example', 'a@algo.invalid',
      'a@algo.localhost', 'a@algo.local', 'a@localhost', 'a@test',
    ]) {
      expect(isUndeliverableEmail(e), e).toBe(true)
    }
  })

  it('bloquea los dominios de documentacion de RFC 2606', () => {
    expect(isUndeliverableEmail('juan@example.com')).toBe(true)
    expect(isUndeliverableEmail('juan@EXAMPLE.NET')).toBe(true)
    expect(isUndeliverableEmail('juan@example.org')).toBe(true)
  })

  it('bloquea lo que no se puede parsear: sin dominio no hay a donde mandar', () => {
    for (const e of [null, undefined, '', 'sinarroba', '@sinlocal.com', 'juan@', 'juan@ dominio.com']) {
      expect(isUndeliverableEmail(e as any), String(e)).toBe(true)
    }
  })

  it('NO bloquea direcciones reales — el falso positivo es el riesgo caro', () => {
    for (const e of [
      'juan@gmail.com', 'maria@marcelagenta.com.ar', 'a@vendepro.com.ar',
      'contacto@inmobiliaria.com.ar', 'x@hotmail.com', 'test@gmail.com',
      // 'local' y 'test' como parte del nombre, no como TLD:
      'juan@local.com.ar', 'ana@testing.com', 'z@mitest.com.ar',
    ]) {
      expect(isUndeliverableEmail(e), e).toBe(false)
    }
  })
})
