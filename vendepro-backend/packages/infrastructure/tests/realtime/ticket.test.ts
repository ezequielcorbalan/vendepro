import { describe, it, expect } from 'vitest'
import { emitirTicket, verificarTicket } from '../../src/realtime/ticket'

const datos = { userId: 'agent-1', orgId: 'org_mg', veTodo: false }

describe('ticket de tiempo real', () => {
  it('ida y vuelta', async () => {
    const t = await emitirTicket('secreto', datos)
    expect(await verificarTicket('secreto', t)).toEqual(datos)
  })

  it('vence al minuto', async () => {
    const t = await emitirTicket('secreto', datos, 1_000_000)
    expect(await verificarTicket('secreto', t, 1_000_000 + 59_000)).toEqual(datos)
    expect(await verificarTicket('secreto', t, 1_000_000 + 61_000)).toBeNull()
  })

  // Sin esto un agente se podría fabricar un ticket "veTodo" y escuchar toda la bandeja.
  it('no acepta un contenido modificado', async () => {
    const t = await emitirTicket('secreto', datos)
    const [, firma] = t.split('.')
    const falso = btoa(JSON.stringify({ ...datos, veTodo: true, exp: Date.now() + 60_000 }))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(await verificarTicket('secreto', `${falso}.${firma}`)).toBeNull()
  })

  it('no acepta otro secreto ni basura', async () => {
    const t = await emitirTicket('secreto', datos)
    expect(await verificarTicket('otro', t)).toBeNull()
    expect(await verificarTicket('secreto', 'basura')).toBeNull()
  })
})
