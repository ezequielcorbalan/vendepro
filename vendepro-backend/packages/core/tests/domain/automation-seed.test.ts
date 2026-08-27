import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Automation } from '../../src/domain/entities/automation'
import { AutomationAction } from '../../src/domain/entities/automation-action'
import {
  getTriggerDefinition,
  getActionDefinition,
} from '../../src/domain/value-objects/automation-catalog'
import { extractTokens } from '../../src/domain/rules/automation-interpolation'
import { variablesForTrigger } from '../../src/domain/value-objects/automation-catalog'

/**
 * El catálogo de recetas vive en SQL, así que el compilador no lo mira. Sin
 * este test, un `action_config` con una coma de más o un `action_type` mal
 * escrito recién se descubre en producción, cuando la receta no arranca.
 *
 * Se parsea el archivo de seed y se hidrata cada fila por las mismas entidades
 * que usa el motor en runtime.
 */

const SEED_PATH = resolve(__dirname, '../../../../migrations_v2/044_automations_seed.sql')
const seed = readFileSync(SEED_PATH, 'utf8')

interface SeededAutomation {
  id: string
  name: string
  template_key: string
  trigger_type: string
  trigger_config: string
  conditions: string
  dedupe_scope: string
}

interface SeededAction {
  id: string
  automation_id: string
  action_type: string
  action_config: string
  delay_minutes: number
}

/**
 * Los VALUES del seed son tuplas con literales SQL. Se parsean respetando el
 * escape de comilla simple duplicada (`''`), que es como SQLite escapa las
 * comillas dentro de un string.
 */
function parseTuples(block: string): string[][] {
  const tuples: string[][] = []
  let current: string[] = []
  let field = ''
  let inString = false
  let depth = 0

  for (let i = 0; i < block.length; i++) {
    const ch = block[i]
    if (inString) {
      if (ch === "'" && block[i + 1] === "'") { field += "'"; i++; continue }
      if (ch === "'") { inString = false; continue }
      field += ch
      continue
    }
    if (ch === "'") { inString = true; continue }
    if (ch === '(') { depth++; if (depth === 1) { current = []; field = '' }; continue }
    if (ch === ')') {
      depth--
      if (depth === 0) { current.push(field.trim()); tuples.push(current); field = '' }
      continue
    }
    if (ch === ',' && depth === 1) { current.push(field.trim()); field = ''; continue }
    if (depth === 1) field += ch
  }
  return tuples
}

function extractBlock(marker: string): string[][] {
  // Cada bloque va desde su INSERT hasta el `;` que lo cierra.
  const parts: string[][] = []
  const re = new RegExp(`INSERT OR IGNORE INTO ${marker}[\\s\\S]*?VALUES([\\s\\S]*?);`, 'g')
  for (const match of seed.matchAll(re)) parts.push(...parseTuples(match[1]))
  return parts
}

const automationRows: SeededAutomation[] = extractBlock('automations').map((t) => ({
  id: t[0], name: t[2], template_key: t[4], trigger_type: t[6],
  trigger_config: t[7], conditions: t[8], dedupe_scope: t[9],
}))

const actionRows: SeededAction[] = extractBlock('automation_actions').map((t) => ({
  id: t[0], automation_id: t[1], action_type: t[4],
  action_config: t[5], delay_minutes: Number(t[6]),
}))

describe('seed del catálogo de recetas', () => {
  it('el parser encuentra las recetas y sus acciones', () => {
    expect(automationRows.length).toBeGreaterThanOrEqual(10)
    expect(actionRows.length).toBeGreaterThanOrEqual(automationRows.length)
  })

  it('cada receta hidrata como Automation válida', () => {
    for (const row of automationRows) {
      expect(() =>
        Automation.create({
          id: row.id,
          org_id: null,
          name: row.name,
          description: null,
          template_key: row.template_key,
          is_system: true,
          trigger_type: row.trigger_type as any,
          trigger_config: row.trigger_config,
          conditions: row.conditions,
          dedupe_scope: row.dedupe_scope,
          is_active: false,
          created_by: null,
        }),
      ).not.toThrow()
    }
  })

  it('cada acción hidrata como AutomationAction válida', () => {
    for (const row of actionRows) {
      expect(() =>
        AutomationAction.create({
          id: row.id,
          automation_id: row.automation_id,
          org_id: null,
          order_index: 0,
          action_type: row.action_type as any,
          action_config: row.action_config,
          delay_minutes: row.delay_minutes,
        }),
      ).not.toThrow()
    }
  })

  it('todos los triggers y acciones existen en el catálogo', () => {
    for (const row of automationRows) expect(() => getTriggerDefinition(row.trigger_type)).not.toThrow()
    for (const row of actionRows) expect(() => getActionDefinition(row.action_type)).not.toThrow()
  })

  it('cada acción aplica a la entidad de su trigger', () => {
    const triggerByAutomation = new Map(automationRows.map((a) => [a.id, a.trigger_type]))
    for (const row of actionRows) {
      const trigger = triggerByAutomation.get(row.automation_id)
      expect(trigger, `acción ${row.id} apunta a una automatización inexistente`).toBeDefined()
      const entity = getTriggerDefinition(trigger!).entity_type
      expect(
        getActionDefinition(row.action_type).applies_to,
        `${row.id}: "${row.action_type}" no aplica a ${entity}`,
      ).toContain(entity)
    }
  })

  it('los template_key son únicos', () => {
    const keys = automationRows.map((a) => a.template_key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('no usa variables que no existan para su trigger', () => {
    const triggerByAutomation = new Map(automationRows.map((a) => [a.id, a.trigger_type]))
    for (const row of actionRows) {
      const trigger = triggerByAutomation.get(row.automation_id)!
      const available = new Set(variablesForTrigger(trigger).map((v) => v.key))
      const config = JSON.parse(row.action_config) as Record<string, unknown>

      for (const value of Object.values(config)) {
        if (typeof value !== 'string') continue
        for (const token of extractTokens(value)) {
          const derivable = token.endsWith('.first_name')
            && available.has(token.replace(/\.first_name$/, '.full_name'))
          expect(
            available.has(token) || derivable,
            `${row.id}: {{${token}}} no está disponible para el trigger "${trigger}"`,
          ).toBe(true)
        }
      }
    }
  })

  it('las recetas se seedean apagadas: activarlas es decisión del cliente', () => {
    // is_active es la columna 11 de la tupla de `automations`.
    for (const tuple of extractBlock('automations')) {
      expect(tuple[10], `${tuple[4]} debería seedearse apagada`).toBe('0')
    }
  })
})
