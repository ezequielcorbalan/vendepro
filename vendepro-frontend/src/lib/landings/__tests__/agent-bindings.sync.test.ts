import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AGENT_BINDINGS } from '../agent-bindings'

/**
 * `AGENT_BINDINGS` en este paquete es un espejo manual del mapa real, que
 * vive en el backend (vendepro-backend/packages/core/src/domain/value-objects/agent-bindings.ts,
 * ver Task 6). Backend y frontend no comparten paquete (se hablan por HTTP),
 * así que nada evita que alguien edite un lado y no el otro — y el editor
 * empezaría a bloquear (o dejar de bloquear) campos equivocados en silencio,
 * sin que ningún otro test falle.
 *
 * Este test lee el archivo fuente del backend (mismo patrón que
 * `landing-template-agent-profile-seed.test.ts` en el backend: `readFileSync`
 * + `resolve(__dirname, ...)` sobre un archivo de otra capa/paquete), evalúa
 * el literal `AGENT_BINDINGS` como el objeto JS que es (no es JSON: claves y
 * strings van con comillas simples) y lo compara contra el mapa importado acá.
 * Si alguien agrega, quita, renombra o reasigna una entrada de un solo lado,
 * este test falla.
 */

const BACKEND_PATH = resolve(
  __dirname,
  '../../../../../vendepro-backend/packages/core/src/domain/value-objects/agent-bindings.ts',
)
const source = readFileSync(BACKEND_PATH, 'utf8')

// Extrae el literal de objeto asignado a `export const AGENT_BINDINGS: ... = { ... }`.
// Non-greedy hasta el primer "}" sin indentar en su propia línea: los cierres
// anidados (uno por bloque) están indentados, así que no matchean antes de tiempo.
const match = source.match(/export const AGENT_BINDINGS[^=]*=\s*(\{[\s\S]*?\r?\n\})\r?\n/)
if (!match) {
  throw new Error(`No se encontró el literal de AGENT_BINDINGS en ${BACKEND_PATH}`)
}

// No es JSON (comillas simples, claves sin comillas) pero sí un literal de
// objeto JS válido — se evalúa como tal, no se parsea como JSON.
// eslint-disable-next-line no-new-func
const backendBindings = new Function(`return (${match[1]});`)() as typeof AGENT_BINDINGS

describe('AGENT_BINDINGS — sincronización frontend/backend', () => {
  it('el mapa del frontend es idéntico al del backend (mismos bloques, campos y paths)', () => {
    expect(AGENT_BINDINGS).toEqual(backendBindings)
  })

  it('el backend define al menos un bloque bindeado (sanity check del parseo)', () => {
    expect(Object.keys(backendBindings).length).toBeGreaterThan(0)
  })
})
