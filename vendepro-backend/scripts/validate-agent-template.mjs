// vendepro-backend/scripts/validate-agent-template.mjs
// Valida el blocks_json del template de agente contra el Zod real del dominio.
// Uso: node scripts/validate-agent-template.mjs
import { readFileSync } from 'node:fs'
import { validateBlocks } from '../packages/core/dist/index.js'

const sql = readFileSync(new URL('../migrations_v2/049_landing_template_agent_profile.sql', import.meta.url), 'utf8')
const match = sql.match(/'(\[[\s\S]*\])'/)
if (!match) {
  console.error('No se encontró el blocks_json en la migración')
  process.exit(1)
}
const blocks = JSON.parse(match[1].replace(/''/g, "'"))
const result = validateBlocks(blocks)
if (!result.success) {
  console.error('blocks_json INVÁLIDO:', result.error)
  process.exit(1)
}
const leadForms = blocks.filter(b => b.type === 'lead-form').length
if (leadForms > 1) {
  console.error('El template tiene más de un lead-form')
  process.exit(1)
}
console.log(`blocks_json OK — ${blocks.length} bloques, ${leadForms} lead-form`)
