import { describe, it, expect, beforeEach } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AutomationAction, MAX_DELAY_MINUTES } from '../../src/domain/entities/automation-action'
import { Automation } from '../../src/domain/entities/automation'

/**
 * La migración 045 absorbe las secuencias drip (`email_automations`) dentro del
 * motor de automatizaciones. Es una migración de DATOS sobre producción: si
 * convierte mal, no hay forma de reconstruir lo perdido.
 *
 * Este test la corre de verdad contra SQLite y verifica lo que importa:
 * la conversión de tiempos (relativo → absoluto), el mapeo de disparadores,
 * qué queda encendido, y que el módulo viejo quede cortado para que nadie
 * reciba el mismo email dos veces.
 */

const MIGRATIONS = resolve(__dirname, '../../../../migrations_v2')
const sql = (name: string) => readFileSync(resolve(MIGRATIONS, name), 'utf8')

function stepsJson(delays: number[]): string {
  return JSON.stringify(delays.map((delay_hours, i) => ({
    delay_hours,
    subject: `Paso ${i + 1}`,
    preheader: 'p',
    html: `<p>Cuerpo ${i + 1}</p>`,
    text: `Cuerpo ${i + 1}`,
  })))
}

let db: DatabaseSync

function seedAutomation(row: {
  id: string
  name?: string
  status?: string
  trigger?: string | null
  steps?: string | null
}) {
  db.prepare(`INSERT INTO email_automations (id, org_id, name, status, trigger_event, steps_json)
              VALUES (?,?,?,?,?,?)`)
    .run(row.id, 'org_mg', row.name ?? row.id, row.status ?? 'active',
         row.trigger === undefined ? 'lead_created' : row.trigger,
         row.steps === undefined ? stepsJson([0, 48, 72]) : row.steps)
}

function absorb() {
  db.exec(sql('045_absorb_email_automations.sql'))
}

function rows(query: string): any[] {
  return db.prepare(query).all() as any[]
}

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(sql('039_email_automations.sql'))
  db.exec(sql('043_automations.sql'))
})

describe('migración 045 — absorción de las secuencias de email', () => {
  it('convierte los delays relativos en absolutos desde el disparo', () => {
    // 0h, +48h, +72h  →  0min, 2880min, 7200min
    seedAutomation({ id: 'ea1' })
    absorb()

    const actions = rows(`SELECT order_index, delay_minutes FROM automation_actions
                          WHERE automation_id = 'mig-ea1' ORDER BY order_index`)
    expect(actions.map(a => a.delay_minutes)).toEqual([0, 2880, 7200])
  })

  it('mapea cada disparador viejo al nuevo', () => {
    seedAutomation({ id: 'creado', trigger: 'lead_created' })
    seedAutomation({ id: 'tasado', trigger: 'appraisal_created' })
    seedAutomation({ id: 'etapa', trigger: 'stage:captado' })
    absorb()

    const byId = new Map(
      rows(`SELECT id, trigger_type, trigger_config FROM automations WHERE id LIKE 'mig-%'`)
        .map(r => [r.id, r]),
    )
    expect(byId.get('mig-creado').trigger_type).toBe('lead.created')
    expect(byId.get('mig-tasado').trigger_type).toBe('appraisal.created')
    expect(byId.get('mig-etapa').trigger_type).toBe('lead.stage_changed')
    expect(JSON.parse(byId.get('mig-etapa').trigger_config)).toEqual({ to_stage: 'captado' })
  })

  it('sólo deja encendida la que estaba activa Y tenía disparador por evento', () => {
    seedAutomation({ id: 'activa', status: 'active', trigger: 'lead_created' })
    seedAutomation({ id: 'borrador', status: 'draft', trigger: 'lead_created' })
    seedAutomation({ id: 'pausada', status: 'paused', trigger: 'lead_created' })
    // Inscripción manual: su disparador es una aproximación, no se enciende sola.
    seedAutomation({ id: 'manual', status: 'active', trigger: null })
    absorb()

    const active = new Map(
      rows(`SELECT id, is_active FROM automations WHERE id LIKE 'mig-%'`).map(r => [r.id, r.is_active]),
    )
    expect(active.get('mig-activa')).toBe(1)
    expect(active.get('mig-borrador')).toBe(0)
    expect(active.get('mig-pausada')).toBe(0)
    expect(active.get('mig-manual')).toBe(0)
  })

  it('avisa en la descripción cuando la original era de inscripción manual', () => {
    seedAutomation({ id: 'manual', trigger: null })
    absorb()
    const [row] = rows(`SELECT description FROM automations WHERE id = 'mig-manual'`)
    expect(row.description).toContain('revisá el disparador')
  })

  it('corta el módulo viejo para que nadie reciba el mismo email dos veces', () => {
    seedAutomation({ id: 'ea1' })
    db.prepare(`INSERT INTO email_automation_enrollments (id, org_id, automation_id, email, status)
                VALUES (?,?,?,?,?)`).run('en1', 'org_mg', 'ea1', 'ana@mail.com', 'active')
    absorb()

    expect(rows(`SELECT status FROM email_automation_enrollments`)[0].status).toBe('cancelled')
    expect(rows(`SELECT status FROM email_automations WHERE id = 'ea1'`)[0].status).toBe('paused')
  })

  it('no borra nada del módulo viejo: queda como respaldo e historial', () => {
    seedAutomation({ id: 'ea1' })
    db.prepare(`INSERT INTO email_automation_sends (id, org_id, automation_id, enrollment_id, step_order, email)
                VALUES (?,?,?,?,?,?)`).run('s1', 'org_mg', 'ea1', 'en1', 0, 'ana@mail.com')
    absorb()

    expect(rows(`SELECT COUNT(*) AS n FROM email_automations`)[0].n).toBe(1)
    expect(rows(`SELECT COUNT(*) AS n FROM email_automation_sends`)[0].n).toBe(1)
  })

  it('ignora las secuencias sin pasos o con JSON roto en vez de romperse', () => {
    seedAutomation({ id: 'vacia', steps: null })
    seedAutomation({ id: 'rota', steps: '{no es json' })
    seedAutomation({ id: 'lista-vacia', steps: '[]' })
    seedAutomation({ id: 'buena' })
    absorb()

    const ids = rows(`SELECT id FROM automations WHERE id LIKE 'mig-%'`).map(r => r.id)
    expect(ids).toEqual(['mig-buena'])
  })

  it('clampea al tope del dominio para no generar una fila que rompa la hidratación', () => {
    // 200 días en horas: por encima de MAX_DELAY_MINUTES.
    seedAutomation({ id: 'larga', steps: stepsJson([0, 200 * 24]) })
    absorb()

    const delays = rows(`SELECT delay_minutes FROM automation_actions
                         WHERE automation_id = 'mig-larga' ORDER BY order_index`)
      .map(r => r.delay_minutes)
    expect(Math.max(...delays)).toBeLessThanOrEqual(MAX_DELAY_MINUTES)
  })

  it('lo migrado hidrata por las entidades reales del motor', () => {
    seedAutomation({ id: 'ea1', trigger: 'stage:captado' })
    absorb()

    for (const row of rows(`SELECT * FROM automations WHERE id LIKE 'mig-%'`)) {
      expect(() => Automation.create({
        ...row,
        is_system: row.is_system === 1,
        is_active: row.is_active === 1,
      })).not.toThrow()
    }
    for (const row of rows(`SELECT * FROM automation_actions WHERE automation_id LIKE 'mig-%'`)) {
      expect(() => AutomationAction.create(row)).not.toThrow()
    }
  })

  it('es idempotente: correrla dos veces no duplica nada', () => {
    seedAutomation({ id: 'ea1' })
    absorb()
    absorb()

    expect(rows(`SELECT COUNT(*) AS n FROM automations WHERE id LIKE 'mig-%'`)[0].n).toBe(1)
    expect(rows(`SELECT COUNT(*) AS n FROM automation_actions WHERE automation_id LIKE 'mig-%'`)[0].n).toBe(3)
  })
})
