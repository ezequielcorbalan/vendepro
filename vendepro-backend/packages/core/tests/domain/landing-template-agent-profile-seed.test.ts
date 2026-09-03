import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { validateBlocks } from '../../src/domain/value-objects/block-schemas'

/**
 * El template "Perfil de agente" vive en SQL, así que el compilador no lo
 * mira. Sin este test, un `blocks_json` roto recién se descubre en
 * producción, cuando un agente intenta crear su landing.
 *
 * Se parsea el archivo de seed y se valida su `blocks_json` contra el Zod
 * real del dominio — el mismo que corre en runtime.
 */

const SEED_PATH = resolve(__dirname, '../../../../migrations_v2/049_landing_template_agent_profile.sql')
const seed = readFileSync(SEED_PATH, 'utf8')

const match = seed.match(/'(\[[\s\S]*\])'/)
if (!match) throw new Error('No se encontró el blocks_json en la migración 049')
const blocks = JSON.parse(match[1].replace(/''/g, "'")) as Array<{ type: string; binding?: string }>

describe('seed del template "Perfil de agente" (migración 049)', () => {
  it('el blocks_json valida contra el Zod real de bloques', () => {
    const result = validateBlocks(blocks)
    expect(result.success, !result.success ? result.error : undefined).toBe(true)
  })

  it('tiene exactamente 9 bloques', () => {
    expect(blocks.length).toBe(9)
  })

  it('tiene exactamente 1 lead-form', () => {
    const leadForms = blocks.filter((b) => b.type === 'lead-form')
    expect(leadForms.length).toBe(1)
  })

  it('los bloques con binding agent_profile son exactamente agent-hero, agent-credentials, cta-whatsapp y footer', () => {
    const bound = blocks.filter((b) => b.binding === 'agent_profile').map((b) => b.type).sort()
    expect(bound).toEqual(['agent-credentials', 'agent-hero', 'cta-whatsapp', 'footer'].sort())
  })
})
