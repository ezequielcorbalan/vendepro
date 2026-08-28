import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SendEmailActionExecutor } from '../../src/services/automation-executors'

/**
 * El envío de las automatizaciones es el camino por el que sale la mayoría de
 * los emails a clientes. Estos tests fijan lo que garantiza el ejecutor: que el
 * mensaje sale envuelto en el template base, con la marca de la inmobiliaria y
 * con el link de baja en un solo lugar.
 */

const SETTINGS = {
  from_email: 'hola@mg.com.ar',
  from_name: 'Marcela Genta',
  reply_to: 'respuestas@mg.com.ar',
  enabled: true,
}

const CONTEXT = {
  lead: { id: 'L1', full_name: 'Ana Pérez', email: 'ana@mail.com' },
  agent: { id: 'U1', email: 'agente@mg.com.ar' },
  org: { id: 'org_mg', name: 'MG Operaciones', logo_url: 'https://cdn.mg.com/logo.png', brand_color: '#00aa55' },
}

function makeExecutor(overrides: { settings?: any } = {}) {
  const email = { send: vi.fn().mockResolvedValue(undefined) }
  const settingsRepo = { findByOrg: vi.fn().mockResolvedValue(overrides.settings ?? SETTINGS) }
  const suppressions = { findByEmail: vi.fn().mockResolvedValue(null) }
  const signer = { sign: vi.fn().mockResolvedValue('tok-123') }
  const executor = new SendEmailActionExecutor(
    settingsRepo as any,
    suppressions as any,
    email as any,
    signer as any,
    'https://vendepro.com.ar/',
  )
  return { executor, email, suppressions }
}

const run = (executor: any, config: Record<string, unknown>) =>
  executor.execute({
    orgId: 'org_mg',
    config,
    rawConfig: config,
    context: CONTEXT,
    automationId: 'auto-1',
    runId: 'run-1',
  })

const BASE_CONFIG = { subject: 'Gracias por contactarte', body_html: '<p>Hola Ana</p>' }

describe('SendEmailActionExecutor — template base', () => {
  beforeEach(() => vi.clearAllMocks())

  it('envuelve el contenido en el template de VendéPro', async () => {
    const { executor, email } = makeExecutor()
    const out = await run(executor, BASE_CONFIG)

    expect(out.status).toBe('success')
    const sent = email.send.mock.calls[0][0]
    expect(sent.html).toMatch(/^<!DOCTYPE html>/)
    expect(sent.html).toContain('<p>Hola Ana</p>')
    expect(sent.html).toContain('Enviado con VendéPro')
    expect(sent.html.match(/<html/gi)).toHaveLength(1)
  })

  it('usa el logo y el color de la org en el encabezado', async () => {
    const { executor, email } = makeExecutor()
    await run(executor, BASE_CONFIG)

    const sent = email.send.mock.calls[0][0]
    expect(sent.html).toContain('https://cdn.mg.com/logo.png')
    expect(sent.html).toContain('#00aa55')
  })

  it('pone el link de baja en el footer del template', async () => {
    const { executor, email } = makeExecutor()
    await run(executor, BASE_CONFIG)

    const sent = email.send.mock.calls[0][0]
    expect(sent.html).toContain('https://vendepro.com.ar/u/tok-123')
    expect(sent.html).toContain('Cancelar suscripción')
  })

  // Si el autor eligió dónde va el link, el template no lo repite abajo.
  it('no duplica la baja cuando el cuerpo ya trae {{unsubscribe_url}}', async () => {
    const { executor, email } = makeExecutor()
    await run(executor, {
      ...BASE_CONFIG,
      body_html: '<p>Hola</p><a href="{{unsubscribe_url}}">baja</a>',
    })

    const sent = email.send.mock.calls[0][0]
    expect(sent.html).toContain('href="https://vendepro.com.ar/u/tok-123"')
    expect(sent.html).not.toContain('Cancelar suscripción')
    expect(sent.html).not.toContain('{{unsubscribe_url}}')
  })

  it('respeta include_unsubscribe: false', async () => {
    const { executor, email } = makeExecutor()
    await run(executor, { ...BASE_CONFIG, include_unsubscribe: false })

    const sent = email.send.mock.calls[0][0]
    expect(sent.html).not.toContain('/u/tok-123')
    expect(sent.html).not.toContain('Cancelar suscripción')
  })

  // El texto plano se arma del contenido, no del documento envuelto: si saliera
  // del HTML final arrastraría el encabezado y el footer del marco.
  it('el texto plano lleva el contenido y una sola firma', async () => {
    const { executor, email } = makeExecutor()
    await run(executor, BASE_CONFIG)

    const sent = email.send.mock.calls[0][0]
    expect(sent.text).toContain('Hola Ana')
    expect(sent.text.match(/Enviado con VendéPro/g)).toHaveLength(1)
    expect(sent.text).toContain('https://vendepro.com.ar/u/tok-123')
  })

  it('no manda nada a un contacto dado de baja', async () => {
    const { executor, email, suppressions } = makeExecutor()
    suppressions.findByEmail.mockResolvedValue({ email: 'ana@mail.com' })

    const out = await run(executor, BASE_CONFIG)
    expect(out).toEqual({ status: 'skipped', reason: 'suppressed' })
    expect(email.send).not.toHaveBeenCalled()
  })

  it('se saltea si la org no configuró el remitente', async () => {
    const { executor, email } = makeExecutor({ settings: { ...SETTINGS, from_email: null } })

    const out = await run(executor, BASE_CONFIG)
    expect(out).toEqual({ status: 'skipped', reason: 'email_not_configured' })
    expect(email.send).not.toHaveBeenCalled()
  })
})
