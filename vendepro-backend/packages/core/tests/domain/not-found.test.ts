import { describe, it, expect } from 'vitest'
import { NotFoundError } from '../../src/domain/errors/not-found'

describe('NotFoundError', () => {
  it('con entidad + id arma el mensaje canónico', () => {
    expect(new NotFoundError('SoldProperty', 'sp_1').message)
      .toBe('SoldProperty con id "sp_1" no encontrado')
  })

  // Regresión: `id` era obligatorio en el tipo pero 25 call sites lo omitían,
  // así que el mensaje salía como `Contacto no encontrado con id "undefined" no
  // encontrado`. Con un solo argumento el mensaje va tal cual.
  it('con un solo argumento usa el mensaje tal cual, sin "undefined"', () => {
    const err = new NotFoundError('Contacto no encontrado')
    expect(err.message).toBe('Contacto no encontrado')
    expect(err.message).not.toContain('undefined')
  })

  it('mantiene code y httpStatus', () => {
    const err = new NotFoundError('Lead no encontrado')
    expect(err.code).toBe('NOT_FOUND')
    expect(err.httpStatus).toBe(404)
  })
})
