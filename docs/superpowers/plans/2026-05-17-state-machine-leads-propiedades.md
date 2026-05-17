# State Machine Lead+Property Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar y extender los state machines de Lead y Property, agregando estados (`propuesta`, `invalida`, `perdida` en property; `invalido`, `finalizado` en lead) y sincronización automática cruzada via reglas declarativas en `sync-policies.ts`.

**Architecture:** Patrón State con value objects extendidos (`LeadStage`, `PropertyStage`) + módulo declarativo `sync-policies.ts` (tabla de reglas) + `sync-engine.ts` que aplica las reglas + use cases extendidos para orquestar. Sin event bus, sincronización síncrona dentro de la transacción.

**Tech Stack:** TypeScript, Vitest, Cloudflare Workers + D1 (SQLite), Next.js 15 frontend, Tailwind. Backend monorepo hexagonal en `vendepro-backend/packages/core/`.

---

## File Structure

**Backend (domain):**
- Modificar: `vendepro-backend/packages/core/src/domain/value-objects/lead-stage.ts`
- Modificar: `vendepro-backend/packages/core/src/domain/value-objects/property-stage.ts`
- Crear: `vendepro-backend/packages/core/src/domain/rules/sync-policies.ts`
- Crear: `vendepro-backend/packages/core/src/domain/rules/sync-engine.ts`

**Backend (application):**
- Modificar: `vendepro-backend/packages/core/src/application/ports/repositories/stage-history-repository.ts` (extender entity_type y agregar triggered_by)
- Modificar: `vendepro-backend/packages/core/src/application/use-cases/leads/advance-lead-stage.ts` (invocar sync engine)
- Modificar: `vendepro-backend/packages/core/src/application/use-cases/properties/update-property-stage.ts` (invocar sync engine + logging history)

**Backend (infra/adapter):**
- Modificar: cualquier adapter D1 que implemente `StageHistoryRepository` para soportar entity_type `property` y campo `triggered_by` (buscar implementadores)

**Migration:**
- Crear: `vendepro-backend/migrations_v2/027_state_machine_unification.sql`

**Frontend:**
- Modificar: `vendepro-frontend/src/lib/crm-config.ts` (agregar nuevos estados + grupos)
- Modificar: `vendepro-frontend/src/app/(dashboard)/propiedades/pipeline/page.tsx` (MAIN_STAGES con propuesta)
- Modificar: `vendepro-frontend/src/components/properties/PropertyFilters.tsx` (nuevos filtros)
- Revisar (sin tocar salvo necesidad): los 9 archivos frontend con `commercial_stage`

**Tests:**
- Modificar: `vendepro-backend/packages/core/tests/domain/lead-stage.test.ts`
- Crear: `vendepro-backend/packages/core/tests/domain/property-stage.test.ts`
- Crear: `vendepro-backend/packages/core/tests/domain/sync-policies.test.ts`
- Crear: `vendepro-backend/packages/core/tests/domain/sync-engine.test.ts`

---

## Task 1: Extender LeadStage value object

**Files:**
- Modify: `vendepro-backend/packages/core/src/domain/value-objects/lead-stage.ts`
- Test: `vendepro-backend/packages/core/tests/domain/lead-stage.test.ts`

- [ ] **Step 1.1: Escribir tests para nuevos estados y transiciones**

Reemplazar el contenido del test (mantener describe block, agregar/ajustar tests). El archivo nuevo `lead-stage.test.ts` queda así:

```typescript
import { describe, it, expect } from 'vitest'
import { LeadStage } from '../../src/domain/value-objects/lead-stage'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('LeadStage value object', () => {
  it('creates valid stage', () => {
    const stage = LeadStage.create('nuevo')
    expect(stage.value).toBe('nuevo')
  })

  it('throws for invalid stage', () => {
    expect(() => LeadStage.create('invalid')).toThrow(ValidationError)
  })

  it('allows valid transitions from nuevo', () => {
    const stage = LeadStage.create('nuevo')
    expect(stage.canTransitionTo('asignado')).toBe(true)
    expect(stage.canTransitionTo('contactado')).toBe(true)
    expect(stage.canTransitionTo('invalido')).toBe(true)
    expect(stage.canTransitionTo('perdido')).toBe(true)
  })

  it('blocks invalid transitions from nuevo', () => {
    const stage = LeadStage.create('nuevo')
    expect(stage.canTransitionTo('captado')).toBe(false)
    expect(stage.canTransitionTo('presentada')).toBe(false)
    expect(stage.canTransitionTo('finalizado')).toBe(false)
  })

  it('allows invalido from any pre-captado stage', () => {
    for (const from of ['nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion', 'presentada', 'seguimiento'] as const) {
      expect(LeadStage.create(from).canTransitionTo('invalido')).toBe(true)
    }
  })

  it('captado cannot manually go to finalizado or perdido (sync-only)', () => {
    const stage = LeadStage.create('captado')
    expect(stage.canTransitionTo('finalizado', { source: 'user' })).toBe(false)
    expect(stage.canTransitionTo('perdido', { source: 'user' })).toBe(false)
  })

  it('captado can sync-transition to finalizado and perdido', () => {
    const stage = LeadStage.create('captado')
    expect(stage.canTransitionTo('finalizado', { source: 'sync' })).toBe(true)
    expect(stage.canTransitionTo('perdido', { source: 'sync' })).toBe(true)
  })

  it('final terminal states have no outgoing transitions', () => {
    for (const final of ['invalido', 'finalizado', 'perdido'] as const) {
      const stage = LeadStage.create(final)
      expect(stage.canTransitionTo('captado')).toBe(false)
      expect(stage.canTransitionTo('nuevo')).toBe(false)
    }
  })

  it('isFinal returns true for terminal states', () => {
    for (const final of ['invalido', 'finalizado', 'perdido'] as const) {
      expect(LeadStage.create(final).isFinal()).toBe(true)
    }
  })

  it('isFinal returns false for captado (agente-final but not terminal)', () => {
    expect(LeadStage.create('captado').isFinal()).toBe(false)
  })

  it('isAgentFinal returns true for captado and terminals', () => {
    for (const s of ['captado', 'invalido', 'finalizado', 'perdido'] as const) {
      expect(LeadStage.create(s).isAgentFinal()).toBe(true)
    }
  })

  it('transitionTo throws for invalid transition', () => {
    const stage = LeadStage.create('nuevo')
    expect(() => stage.transitionTo('captado')).toThrow(ValidationError)
  })

  it('transitionTo with sync source allows captado→finalizado', () => {
    const stage = LeadStage.create('captado')
    const next = stage.transitionTo('finalizado', { source: 'sync' })
    expect(next.value).toBe('finalizado')
  })
})
```

- [ ] **Step 1.2: Correr tests para verificar que fallan**

Run: `cd vendepro-backend/packages/core && npm test -- lead-stage`
Expected: FAIL — los nuevos estados (`invalido`, `finalizado`) no existen aún, y el método `isAgentFinal()` no existe.

- [ ] **Step 1.3: Implementar nuevos estados y transiciones en lead-stage.ts**

Reemplazar el contenido completo de `vendepro-backend/packages/core/src/domain/value-objects/lead-stage.ts`:

```typescript
import { ValidationError } from '../errors/validation-error'

export const LEAD_STAGES = [
  'nuevo', 'asignado', 'contactado', 'calificado', 'en_tasacion',
  'presentada', 'seguimiento', 'captado',
  'invalido', 'finalizado', 'perdido',
] as const
export type LeadStageValue = typeof LEAD_STAGES[number]

export type TransitionSource = 'user' | 'sync' | 'system'

const MANUAL_TRANSITIONS: Record<LeadStageValue, LeadStageValue[]> = {
  nuevo:       ['asignado', 'contactado', 'invalido', 'perdido'],
  asignado:    ['contactado', 'invalido', 'perdido'],
  contactado:  ['calificado', 'seguimiento', 'invalido', 'perdido'],
  calificado:  ['en_tasacion', 'seguimiento', 'invalido', 'perdido'],
  en_tasacion: ['presentada', 'seguimiento', 'invalido', 'perdido'],
  presentada:  ['captado', 'seguimiento', 'invalido', 'perdido'],
  seguimiento: ['calificado', 'en_tasacion', 'presentada', 'captado', 'invalido', 'perdido'],
  captado:     [],
  invalido:    [],
  finalizado:  [],
  perdido:     [],
}

const SYNC_TRANSITIONS: Record<LeadStageValue, LeadStageValue[]> = {
  nuevo: [], asignado: [], contactado: [], calificado: [], en_tasacion: [],
  presentada: [], seguimiento: [],
  captado:    ['finalizado', 'perdido'],
  invalido: [], finalizado: [], perdido: [],
}

const TERMINAL: LeadStageValue[] = ['invalido', 'finalizado', 'perdido']

export interface TransitionOptions {
  source?: TransitionSource
}

export class LeadStage {
  private constructor(readonly value: LeadStageValue) {}

  static create(value: string): LeadStage {
    if (!LEAD_STAGES.includes(value as LeadStageValue)) {
      throw new ValidationError(`Stage inválido: "${value}". Permitidos: ${LEAD_STAGES.join(', ')}`)
    }
    return new LeadStage(value as LeadStageValue)
  }

  canTransitionTo(next: LeadStageValue, opts: TransitionOptions = {}): boolean {
    const source = opts.source ?? 'user'
    const allowedManual = MANUAL_TRANSITIONS[this.value]
    const allowedSync = SYNC_TRANSITIONS[this.value]
    if (source === 'sync') return allowedSync.includes(next) || allowedManual.includes(next)
    return allowedManual.includes(next)
  }

  transitionTo(next: LeadStageValue, opts: TransitionOptions = {}): LeadStage {
    if (!this.canTransitionTo(next, opts)) {
      const source = opts.source ?? 'user'
      throw new ValidationError(
        `Transición ${source} inválida de "${this.value}" a "${next}".`
      )
    }
    return new LeadStage(next)
  }

  isFinal(): boolean {
    return TERMINAL.includes(this.value)
  }

  isAgentFinal(): boolean {
    return this.value === 'captado' || this.isFinal()
  }

  equals(other: LeadStage): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
```

- [ ] **Step 1.4: Correr tests para verificar que pasan**

Run: `cd vendepro-backend/packages/core && npm test -- lead-stage`
Expected: PASS — todos los tests pasan.

- [ ] **Step 1.5: Verificar typecheck**

Run: `cd vendepro-backend/packages/core && npm run typecheck`
Expected: sin errores. Si aparece error en `lead.ts` (porque `advanceStage` llama `transitionTo` sin opts), el código antiguo sigue funcionando: la firma default a `source: 'user'`.

---

## Task 2: Extender PropertyStage value object

**Files:**
- Modify: `vendepro-backend/packages/core/src/domain/value-objects/property-stage.ts`
- Create: `vendepro-backend/packages/core/tests/domain/property-stage.test.ts`

- [ ] **Step 2.1: Escribir tests para PropertyStage extendido**

Crear archivo `vendepro-backend/packages/core/tests/domain/property-stage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { PropertyStage } from '../../src/domain/value-objects/property-stage'
import { ValidationError } from '../../src/domain/errors/validation-error'

describe('PropertyStage value object', () => {
  it('accepts new stages: propuesta, invalida, perdida', () => {
    expect(PropertyStage.create('propuesta').value).toBe('propuesta')
    expect(PropertyStage.create('invalida').value).toBe('invalida')
    expect(PropertyStage.create('perdida').value).toBe('perdida')
  })

  it('rejects unknown stage', () => {
    expect(() => PropertyStage.create('foo')).toThrow(ValidationError)
  })

  it('propuesta can go to captada or invalida', () => {
    const s = PropertyStage.create('propuesta')
    expect(s.canTransitionTo('captada')).toBe(true)
    expect(s.canTransitionTo('invalida')).toBe(true)
    expect(s.canTransitionTo('publicada')).toBe(false)
  })

  it('captada can branch to documentacion, publicada, perdida, invalida, suspendida', () => {
    const s = PropertyStage.create('captada')
    expect(s.canTransitionTo('documentacion')).toBe(true)
    expect(s.canTransitionTo('publicada')).toBe(true)
    expect(s.canTransitionTo('perdida')).toBe(true)
    expect(s.canTransitionTo('invalida')).toBe(true)
    expect(s.canTransitionTo('suspendida')).toBe(true)
  })

  it('reservada can go to vendida (manual or sync)', () => {
    const s = PropertyStage.create('reservada')
    expect(s.canTransitionTo('vendida')).toBe(true)
  })

  it('publicada can go to perdida', () => {
    expect(PropertyStage.create('publicada').canTransitionTo('perdida')).toBe(true)
  })

  it('suspendida is reversible to publicada and reservada', () => {
    const s = PropertyStage.create('suspendida')
    expect(s.canTransitionTo('publicada')).toBe(true)
    expect(s.canTransitionTo('reservada')).toBe(true)
    expect(s.canTransitionTo('archivada')).toBe(true)
  })

  it('vencida can renew to publicada or archive', () => {
    const s = PropertyStage.create('vencida')
    expect(s.canTransitionTo('publicada')).toBe(true)
    expect(s.canTransitionTo('archivada')).toBe(true)
    expect(s.canTransitionTo('captada')).toBe(false)
  })

  it('terminal stages (vendida/perdida/invalida) can only go to archivada', () => {
    for (const t of ['vendida', 'perdida', 'invalida'] as const) {
      const s = PropertyStage.create(t)
      expect(s.canTransitionTo('archivada')).toBe(true)
      expect(s.canTransitionTo('captada')).toBe(false)
    }
  })

  it('archivada has no outgoing transitions', () => {
    const s = PropertyStage.create('archivada')
    expect(s.canTransitionTo('captada')).toBe(false)
    expect(s.canTransitionTo('publicada')).toBe(false)
  })

  it('transitionTo throws on invalid', () => {
    const s = PropertyStage.create('propuesta')
    expect(() => s.transitionTo('vendida')).toThrow(ValidationError)
  })

  it('isFinal returns true for vendida/perdida/invalida/archivada', () => {
    for (const f of ['vendida', 'perdida', 'invalida', 'archivada'] as const) {
      expect(PropertyStage.create(f).isFinal()).toBe(true)
    }
  })

  it('isFinal returns false for non-terminal', () => {
    expect(PropertyStage.create('propuesta').isFinal()).toBe(false)
    expect(PropertyStage.create('captada').isFinal()).toBe(false)
    expect(PropertyStage.create('suspendida').isFinal()).toBe(false)
  })
})
```

- [ ] **Step 2.2: Correr tests para verificar que fallan**

Run: `cd vendepro-backend/packages/core && npm test -- property-stage`
Expected: FAIL — los nuevos estados no existen en el VO actual.

- [ ] **Step 2.3: Reescribir property-stage.ts**

Reemplazar completo el contenido de `vendepro-backend/packages/core/src/domain/value-objects/property-stage.ts`:

```typescript
import { ValidationError } from '../errors/validation-error'

export const PROPERTY_STAGES = [
  'propuesta', 'captada', 'documentacion', 'publicada', 'reservada',
  'suspendida', 'vencida',
  'vendida', 'perdida', 'invalida', 'archivada',
] as const
export type PropertyStageValue = typeof PROPERTY_STAGES[number]

const VALID_TRANSITIONS: Record<PropertyStageValue, PropertyStageValue[]> = {
  propuesta:     ['captada', 'invalida'],
  captada:       ['documentacion', 'publicada', 'perdida', 'invalida', 'suspendida'],
  documentacion: ['publicada', 'perdida', 'invalida', 'suspendida'],
  publicada:     ['reservada', 'perdida', 'vencida', 'suspendida'],
  reservada:     ['vendida', 'publicada', 'perdida', 'vencida', 'suspendida'],
  suspendida:    ['publicada', 'reservada', 'archivada'],
  vencida:       ['publicada', 'archivada'],
  vendida:       ['archivada'],
  perdida:       ['archivada'],
  invalida:      ['archivada'],
  archivada:     [],
}

const TERMINAL: PropertyStageValue[] = ['vendida', 'perdida', 'invalida', 'archivada']

export class PropertyStage {
  private constructor(readonly value: PropertyStageValue) {}

  static create(value: string): PropertyStage {
    if (!PROPERTY_STAGES.includes(value as PropertyStageValue)) {
      throw new ValidationError(`Stage comercial inválido: "${value}". Permitidos: ${PROPERTY_STAGES.join(', ')}`)
    }
    return new PropertyStage(value as PropertyStageValue)
  }

  canTransitionTo(next: PropertyStageValue): boolean {
    return VALID_TRANSITIONS[this.value].includes(next)
  }

  transitionTo(next: PropertyStageValue): PropertyStage {
    if (!this.canTransitionTo(next)) {
      throw new ValidationError(`Transición inválida de "${this.value}" a "${next}"`)
    }
    return new PropertyStage(next)
  }

  isFinal(): boolean {
    return TERMINAL.includes(this.value)
  }

  equals(other: PropertyStage): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
```

- [ ] **Step 2.4: Correr tests para verificar que pasan**

Run: `cd vendepro-backend/packages/core && npm test -- property-stage`
Expected: PASS — todos los tests pasan.

- [ ] **Step 2.5: Typecheck**

Run: `cd vendepro-backend/packages/core && npm run typecheck`
Expected: sin errores.

---

## Task 3: Crear sync-policies.ts

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/rules/sync-policies.ts`
- Create: `vendepro-backend/packages/core/tests/domain/sync-policies.test.ts`

- [ ] **Step 3.1: Escribir tests**

Crear `vendepro-backend/packages/core/tests/domain/sync-policies.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { LEAD_TO_PROPERTY_SYNC, PROPERTY_TO_LEAD_SYNC, NON_FINAL_PROPERTY_STAGES } from '../../src/domain/rules/sync-policies'

describe('sync-policies', () => {
  it('declares lead→property rule for captado→captada', () => {
    const rule = LEAD_TO_PROPERTY_SYNC.find(r => r.when === 'captado')
    expect(rule).toBeDefined()
    expect(rule!.thenIfTargetIn).toEqual(['propuesta'])
    expect(rule!.setTargetTo).toBe('captada')
  })

  it('declares lead→property rule for invalido→invalida', () => {
    const rule = LEAD_TO_PROPERTY_SYNC.find(r => r.when === 'invalido')
    expect(rule).toBeDefined()
    expect(rule!.setTargetTo).toBe('invalida')
    expect(rule!.thenIfTargetIn).toEqual(NON_FINAL_PROPERTY_STAGES)
  })

  it('declares property→lead rule for vendida→finalizado', () => {
    const rule = PROPERTY_TO_LEAD_SYNC.find(r => r.when === 'vendida')
    expect(rule).toBeDefined()
    expect(rule!.thenIfTargetIn).toEqual(['captado'])
    expect(rule!.setTargetTo).toBe('finalizado')
  })

  it('declares property→lead rule for perdida→perdido', () => {
    const rule = PROPERTY_TO_LEAD_SYNC.find(r => r.when === 'perdida')
    expect(rule).toBeDefined()
    expect(rule!.setTargetTo).toBe('perdido')
  })

  it('NON_FINAL_PROPERTY_STAGES excludes terminals', () => {
    expect(NON_FINAL_PROPERTY_STAGES).not.toContain('vendida')
    expect(NON_FINAL_PROPERTY_STAGES).not.toContain('perdida')
    expect(NON_FINAL_PROPERTY_STAGES).not.toContain('invalida')
    expect(NON_FINAL_PROPERTY_STAGES).not.toContain('archivada')
    expect(NON_FINAL_PROPERTY_STAGES).toContain('propuesta')
    expect(NON_FINAL_PROPERTY_STAGES).toContain('captada')
  })
})
```

- [ ] **Step 3.2: Correr tests para verificar que fallan**

Run: `cd vendepro-backend/packages/core && npm test -- sync-policies`
Expected: FAIL — `sync-policies.ts` no existe.

- [ ] **Step 3.3: Implementar sync-policies.ts**

Crear `vendepro-backend/packages/core/src/domain/rules/sync-policies.ts`:

```typescript
import type { LeadStageValue } from '../value-objects/lead-stage'
import { PROPERTY_STAGES, type PropertyStageValue } from '../value-objects/property-stage'

export const NON_FINAL_PROPERTY_STAGES: PropertyStageValue[] = PROPERTY_STAGES.filter(
  s => !(['vendida', 'perdida', 'invalida', 'archivada'] as PropertyStageValue[]).includes(s)
)

export interface SyncRule<From extends string, To extends string> {
  when: From
  thenIfTargetIn: To[]
  setTargetTo: To
}

export const LEAD_TO_PROPERTY_SYNC: SyncRule<LeadStageValue, PropertyStageValue>[] = [
  { when: 'captado',  thenIfTargetIn: ['propuesta'],            setTargetTo: 'captada'  },
  { when: 'invalido', thenIfTargetIn: NON_FINAL_PROPERTY_STAGES, setTargetTo: 'invalida' },
]

export const PROPERTY_TO_LEAD_SYNC: SyncRule<PropertyStageValue, LeadStageValue>[] = [
  { when: 'vendida', thenIfTargetIn: ['captado'], setTargetTo: 'finalizado' },
  { when: 'perdida', thenIfTargetIn: ['captado'], setTargetTo: 'perdido'    },
]
```

- [ ] **Step 3.4: Correr tests para verificar que pasan**

Run: `cd vendepro-backend/packages/core && npm test -- sync-policies`
Expected: PASS.

---

## Task 4: Crear sync-engine.ts

**Files:**
- Create: `vendepro-backend/packages/core/src/domain/rules/sync-engine.ts`
- Create: `vendepro-backend/packages/core/tests/domain/sync-engine.test.ts`

- [ ] **Step 4.1: Escribir tests**

Crear `vendepro-backend/packages/core/tests/domain/sync-engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { SyncEngine } from '../../src/domain/rules/sync-engine'

describe('SyncEngine', () => {
  describe('applyLeadToProperty', () => {
    it('returns captada when lead→captado and property in propuesta', () => {
      const result = SyncEngine.applyLeadToProperty('captado', 'propuesta')
      expect(result).toBe('captada')
    })

    it('returns null when lead→captado but property already in publicada', () => {
      const result = SyncEngine.applyLeadToProperty('captado', 'publicada')
      expect(result).toBeNull()
    })

    it('returns invalida when lead→invalido and property is non-final', () => {
      expect(SyncEngine.applyLeadToProperty('invalido', 'propuesta')).toBe('invalida')
      expect(SyncEngine.applyLeadToProperty('invalido', 'captada')).toBe('invalida')
      expect(SyncEngine.applyLeadToProperty('invalido', 'publicada')).toBe('invalida')
    })

    it('returns null when lead→invalido but property already final', () => {
      expect(SyncEngine.applyLeadToProperty('invalido', 'vendida')).toBeNull()
      expect(SyncEngine.applyLeadToProperty('invalido', 'archivada')).toBeNull()
    })

    it('returns null for lead stages that have no rule (e.g. presentada)', () => {
      expect(SyncEngine.applyLeadToProperty('presentada', 'propuesta')).toBeNull()
    })

    it('returns null when property is null (lead has no associated property)', () => {
      expect(SyncEngine.applyLeadToProperty('captado', null)).toBeNull()
    })
  })

  describe('applyPropertyToLead', () => {
    it('returns finalizado when property→vendida and lead is captado', () => {
      expect(SyncEngine.applyPropertyToLead('vendida', 'captado')).toBe('finalizado')
    })

    it('returns perdido when property→perdida and lead is captado', () => {
      expect(SyncEngine.applyPropertyToLead('perdida', 'captado')).toBe('perdido')
    })

    it('returns null when property→vendida but lead is not captado', () => {
      expect(SyncEngine.applyPropertyToLead('vendida', 'presentada')).toBeNull()
    })

    it('returns null when property→publicada (no rule)', () => {
      expect(SyncEngine.applyPropertyToLead('publicada', 'captado')).toBeNull()
    })

    it('returns null when lead is null', () => {
      expect(SyncEngine.applyPropertyToLead('vendida', null)).toBeNull()
    })
  })
})
```

- [ ] **Step 4.2: Correr tests para verificar que fallan**

Run: `cd vendepro-backend/packages/core && npm test -- sync-engine`
Expected: FAIL — `sync-engine.ts` no existe.

- [ ] **Step 4.3: Implementar sync-engine.ts**

Crear `vendepro-backend/packages/core/src/domain/rules/sync-engine.ts`:

```typescript
import type { LeadStageValue } from '../value-objects/lead-stage'
import type { PropertyStageValue } from '../value-objects/property-stage'
import { LEAD_TO_PROPERTY_SYNC, PROPERTY_TO_LEAD_SYNC } from './sync-policies'

export class SyncEngine {
  static applyLeadToProperty(
    leadStage: LeadStageValue,
    propertyStage: PropertyStageValue | null,
  ): PropertyStageValue | null {
    if (propertyStage === null) return null
    const rule = LEAD_TO_PROPERTY_SYNC.find(r => r.when === leadStage)
    if (!rule) return null
    if (!rule.thenIfTargetIn.includes(propertyStage)) return null
    return rule.setTargetTo
  }

  static applyPropertyToLead(
    propertyStage: PropertyStageValue,
    leadStage: LeadStageValue | null,
  ): LeadStageValue | null {
    if (leadStage === null) return null
    const rule = PROPERTY_TO_LEAD_SYNC.find(r => r.when === propertyStage)
    if (!rule) return null
    if (!rule.thenIfTargetIn.includes(leadStage)) return null
    return rule.setTargetTo
  }
}
```

- [ ] **Step 4.4: Correr tests para verificar que pasan**

Run: `cd vendepro-backend/packages/core && npm test -- sync-engine`
Expected: PASS.

- [ ] **Step 4.5: Typecheck**

Run: `cd vendepro-backend/packages/core && npm run typecheck`
Expected: sin errores.

---

## Task 5: Extender StageHistoryRepository

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/ports/repositories/stage-history-repository.ts`

- [ ] **Step 5.1: Extender entity_type y agregar triggered_by**

Reemplazar contenido completo:

```typescript
export type StageHistoryEntityType = 'lead' | 'reservation' | 'property'
export type StageHistoryTrigger = 'user' | 'sync' | 'system'

export interface StageHistoryEntry {
  id: string
  org_id: string
  entity_type: StageHistoryEntityType
  entity_id: string
  from_stage: string | null
  to_stage: string
  changed_by: string
  changed_at: string
  notes: string | null
  triggered_by?: StageHistoryTrigger
  changed_by_name?: string | null
}

export interface StageHistoryRepository {
  findByEntity(entityType: StageHistoryEntityType, entityId: string, orgId: string): Promise<StageHistoryEntry[]>
  log(entry: Omit<StageHistoryEntry, 'id' | 'changed_at'>): Promise<void>
}
```

- [ ] **Step 5.2: Buscar implementadores del repo y adaptar**

Run: `grep -rn "implements StageHistoryRepository\|StageHistoryRepository {" vendepro-backend/packages --include="*.ts" | grep -v node_modules`
Expected: lista de archivos. Esperablemente uno en `vendepro-backend/packages/core/src/infrastructure/` o equivalente.

Para cada implementador encontrado:
- Si la implementación INSERT en la tabla `stage_history` no incluye `triggered_by`, agregar la columna al INSERT con default `'user'`.
- Si el filtro de `entity_type` está hardcoded a `'lead'/'reservation'`, ampliarlo.

(Plan asume que existe un adapter D1; si no lo hay, este paso queda como no-op y la migration agrega la columna.)

- [ ] **Step 5.3: Typecheck**

Run: `cd vendepro-backend/packages/core && npm run typecheck`
Expected: sin errores. Si hay errores en infra, ajustar firmas.

- [ ] **Step 5.4: Commit acumulado de Tasks 1-5**

```bash
git add vendepro-backend/packages/core/src/domain/value-objects/lead-stage.ts
git add vendepro-backend/packages/core/src/domain/value-objects/property-stage.ts
git add vendepro-backend/packages/core/src/domain/rules/sync-policies.ts
git add vendepro-backend/packages/core/src/domain/rules/sync-engine.ts
git add vendepro-backend/packages/core/src/application/ports/repositories/stage-history-repository.ts
git add vendepro-backend/packages/core/tests/domain/lead-stage.test.ts
git add vendepro-backend/packages/core/tests/domain/property-stage.test.ts
git add vendepro-backend/packages/core/tests/domain/sync-policies.test.ts
git add vendepro-backend/packages/core/tests/domain/sync-engine.test.ts
git commit -m "feat(domain): extender state machines de lead y property con sync engine

- Lead: agrega estados invalido, finalizado; transitions con source (user/sync)
- Property: agrega propuesta, perdida, invalida; transitions completas
- sync-policies: tabla declarativa de reglas cruzadas
- sync-engine: aplica reglas lead<->property
- stage-history: soporta entity_type=property y triggered_by"
```

---

## Task 6: Extender AdvanceLeadStageUseCase con sync

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/use-cases/leads/advance-lead-stage.ts`

- [ ] **Step 6.1: Leer el use case actual**

Run: `cat vendepro-backend/packages/core/src/application/use-cases/leads/advance-lead-stage.ts`
Expected: ver el archivo completo (familiarizarse antes de modificar).

- [ ] **Step 6.2: Modificar el use case para inyectar PropertyRepository y SyncEngine**

Reemplazar el archivo `vendepro-backend/packages/core/src/application/use-cases/leads/advance-lead-stage.ts`:

```typescript
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { CalendarRepository } from '../../ports/repositories/calendar-repository'
import type { StageHistoryRepository } from '../../ports/repositories/stage-history-repository'
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { IdGenerator } from '../../ports/id-generator'
import { NotFoundError } from '../../../domain/errors/not-found'
import { CalendarEvent } from '../../../domain/entities/calendar-event'
import type { LeadStageValue } from '../../../domain/value-objects/lead-stage'
import { SyncEngine } from '../../../domain/rules/sync-engine'
import type { SendMetaConversionEventUseCase } from '../marketing/send-meta-conversion-event'

export interface AdvanceLeadStageInput {
  leadId: string
  orgId: string
  newStage: LeadStageValue
  changedBy: string
  notes?: string | null
}

export interface AdvanceLeadStageOutput {
  autoFollowup: object | null
  syncedPropertyId: string | null
}

export class AdvanceLeadStageUseCase {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly calendarRepo: CalendarRepository,
    private readonly stageHistoryRepo: StageHistoryRepository,
    private readonly idGen: IdGenerator,
    private readonly propertyRepo?: PropertyRepository,
    private readonly metaSender?: SendMetaConversionEventUseCase,
  ) {}

  async execute(input: AdvanceLeadStageInput): Promise<AdvanceLeadStageOutput> {
    const lead = await this.leadRepo.findById(input.leadId, input.orgId)
    if (!lead) throw new NotFoundError('Lead no encontrado')

    const fromStage = lead.stage
    const { firstContactAt } = lead.advanceStage(input.newStage)

    await this.leadRepo.save(lead)

    await this.stageHistoryRepo.log({
      org_id: input.orgId,
      entity_type: 'lead',
      entity_id: lead.id,
      from_stage: fromStage,
      to_stage: input.newStage,
      changed_by: input.changedBy,
      notes: input.notes ?? null,
      triggered_by: 'user',
    })

    let syncedPropertyId: string | null = null
    if (this.propertyRepo) {
      const propertyId = (lead.toObject() as any).property_id ?? null
      if (propertyId) {
        const property = await this.propertyRepo.findById(propertyId, input.orgId)
        const currentPropStage = property?.commercial_stage ?? null
        const newPropStage = SyncEngine.applyLeadToProperty(input.newStage, currentPropStage as any)
        if (property && newPropStage && newPropStage !== currentPropStage) {
          await this.propertyRepo.updateStage(propertyId, input.orgId, newPropStage)
          await this.stageHistoryRepo.log({
            org_id: input.orgId,
            entity_type: 'property',
            entity_id: propertyId,
            from_stage: currentPropStage,
            to_stage: newPropStage,
            changed_by: input.changedBy,
            notes: `Sync desde lead ${lead.id} (${input.newStage})`,
            triggered_by: 'sync',
          })
          syncedPropertyId = propertyId
        }
      }
    }

    let autoFollowup: object | null = null
    if (input.newStage === 'presentada') {
      const followupDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const event = CalendarEvent.create({
        id: this.idGen.generate(),
        org_id: input.orgId,
        agent_id: lead.assigned_to,
        title: `Seguimiento: ${lead.full_name}`,
        event_type: 'seguimiento',
        start_at: followupDate,
        end_at: followupDate,
        all_day: 0,
        description: 'Seguimiento automático post-presentación',
        lead_id: lead.id,
        contact_id: null,
        property_id: null,
        appraisal_id: null,
        reservation_id: null,
        color: null,
        completed: 0,
      })
      await this.calendarRepo.save(event)
      autoFollowup = event.toObject()
    }

    if (this.metaSender) {
      try {
        await this.metaSender.execute({
          orgId: input.orgId,
          leadId: lead.id,
          stageKey: input.newStage,
        })
      } catch (err) {
        console.error('[meta-capi] sender failed (swallowed):', (err as Error)?.message ?? err)
      }
    }

    return { autoFollowup, syncedPropertyId }
  }
}
```

Notas:
- `propertyRepo` y `metaSender` son **opcionales**: si el wiring actual del worker no los pasa, el comportamiento sin sync es el mismo de antes.
- `lead.toObject().property_id` se accede via cast porque `Lead` no expone getter público para `property_id`. Si tu `Lead` no lo tiene en `LeadProps`, agregar la columna en una migration aparte (verificar primero — probablemente exista como `property_id` o `appraisal_id`).

- [ ] **Step 6.3: Verificar typecheck**

Run: `cd vendepro-backend/packages/core && npm run typecheck`
Expected: sin errores. Si falla porque `property_id` no existe en `LeadProps`, agregar el campo `property_id?: string | null` en `vendepro-backend/packages/core/src/domain/entities/lead.ts` y exponer un getter `get property_id() { return this.props.property_id ?? null }`. Luego cambiar el cast por `lead.property_id`.

- [ ] **Step 6.4: Actualizar wiring en api-crm**

Run: `grep -rn "AdvanceLeadStageUseCase" vendepro-backend/packages/api-crm --include="*.ts" | grep -v node_modules`
Expected: ubicar donde se instancia. Agregar `propertyRepo` como argumento (probablemente disponible en el container). Si no está en el container, agregarlo.

- [ ] **Step 6.5: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/leads/advance-lead-stage.ts
git add vendepro-backend/packages/core/src/domain/entities/lead.ts  # si modificaste por property_id
git add vendepro-backend/packages/api-crm  # wiring
git commit -m "feat(leads): AdvanceLeadStageUseCase invoca SyncEngine para property"
```

---

## Task 7: Extender UpdatePropertyStageUseCase con sync y logging

**Files:**
- Modify: `vendepro-backend/packages/core/src/application/use-cases/properties/update-property-stage.ts`

- [ ] **Step 7.1: Reescribir el use case**

Reemplazar `vendepro-backend/packages/core/src/application/use-cases/properties/update-property-stage.ts`:

```typescript
import type { PropertyRepository } from '../../ports/repositories/property-repository'
import type { LeadRepository } from '../../ports/repositories/lead-repository'
import type { StageHistoryRepository } from '../../ports/repositories/stage-history-repository'
import type { PropertyStageValue } from '../../../domain/value-objects/property-stage'
import { PropertyStage } from '../../../domain/value-objects/property-stage'
import { SyncEngine } from '../../../domain/rules/sync-engine'
import { NotFoundError } from '../../../domain/errors/not-found'

export interface UpdatePropertyStageInput {
  propertyId: string
  orgId: string
  newStage: PropertyStageValue
  changedBy: string
  notes?: string | null
}

export interface UpdatePropertyStageOutput {
  syncedLeadId: string | null
}

export class UpdatePropertyStageUseCase {
  constructor(
    private readonly propRepo: PropertyRepository,
    private readonly stageHistoryRepo: StageHistoryRepository,
    private readonly leadRepo?: LeadRepository,
  ) {}

  async execute(input: UpdatePropertyStageInput): Promise<UpdatePropertyStageOutput> {
    const property = await this.propRepo.findById(input.propertyId, input.orgId)
    if (!property) throw new NotFoundError('Propiedad no encontrada')

    const currentStage = (property.commercial_stage ?? 'propuesta') as PropertyStageValue
    const current = PropertyStage.create(currentStage)
    current.transitionTo(input.newStage)

    await this.propRepo.updateStage(input.propertyId, input.orgId, input.newStage)

    await this.stageHistoryRepo.log({
      org_id: input.orgId,
      entity_type: 'property',
      entity_id: input.propertyId,
      from_stage: currentStage,
      to_stage: input.newStage,
      changed_by: input.changedBy,
      notes: input.notes ?? null,
      triggered_by: 'user',
    })

    let syncedLeadId: string | null = null
    if (this.leadRepo) {
      const leadId = (property as any).lead_id ?? null
      if (leadId) {
        const lead = await this.leadRepo.findById(leadId, input.orgId)
        const currentLeadStage = lead?.stage ?? null
        const newLeadStage = SyncEngine.applyPropertyToLead(input.newStage, currentLeadStage as any)
        if (lead && newLeadStage && newLeadStage !== currentLeadStage) {
          lead.advanceStage(newLeadStage, undefined) // VO valida con MANUAL; necesitamos source: 'sync' — alt: setter directo
          await this.leadRepo.save(lead)
          await this.stageHistoryRepo.log({
            org_id: input.orgId,
            entity_type: 'lead',
            entity_id: leadId,
            from_stage: currentLeadStage,
            to_stage: newLeadStage,
            changed_by: input.changedBy,
            notes: `Sync desde property ${property.id} (${input.newStage})`,
            triggered_by: 'sync',
          })
          syncedLeadId = leadId
        }
      }
    }

    return { syncedLeadId }
  }
}
```

**Nota crítica:** `lead.advanceStage(newLeadStage)` falla porque las transiciones `captado→finalizado` y `captado→perdido` no son manuales (Task 1 las separa). Hay dos opciones:

- **Opción A (recomendada):** agregar un método `lead.syncStage(newStage)` que use `transitionTo(newStage, { source: 'sync' })`. Mantiene la separación user/sync.
- **Opción B:** método protected `lead.setStage(newStage)` que salta validación (menos seguro).

Vamos por A. Modificar `vendepro-backend/packages/core/src/domain/entities/lead.ts` agregando:

```typescript
syncStage(newStage: LeadStageValue): void {
  const current = LeadStage.create(this.props.stage)
  current.transitionTo(newStage, { source: 'sync' })
  this.props.stage = newStage
  this.props.updated_at = new Date().toISOString()
}
```

Y en el use case reemplazar `lead.advanceStage(newLeadStage, undefined)` por `lead.syncStage(newLeadStage)`.

- [ ] **Step 7.2: Agregar Lead.syncStage()**

Modificar `vendepro-backend/packages/core/src/domain/entities/lead.ts` agregando el método dentro de la clase, después de `advanceStage`:

```typescript
syncStage(newStage: LeadStageValue): void {
  const current = LeadStage.create(this.props.stage)
  current.transitionTo(newStage, { source: 'sync' })
  this.props.stage = newStage
  this.props.updated_at = new Date().toISOString()
}
```

- [ ] **Step 7.3: Ajustar el use case para usar syncStage**

En el archivo `update-property-stage.ts` cambiar la línea:

```typescript
lead.advanceStage(newLeadStage, undefined) // VO valida con MANUAL; necesitamos source: 'sync' — alt: setter directo
```

Por:

```typescript
lead.syncStage(newLeadStage)
```

- [ ] **Step 7.4: Typecheck**

Run: `cd vendepro-backend/packages/core && npm run typecheck`
Expected: sin errores.

- [ ] **Step 7.5: Actualizar wiring en api-properties**

Run: `grep -rn "UpdatePropertyStageUseCase" vendepro-backend/packages/api-properties --include="*.ts" | grep -v node_modules`
Expected: ubicar la instancia. Agregar `stageHistoryRepo` y `leadRepo` como argumentos.

- [ ] **Step 7.6: Commit**

```bash
git add vendepro-backend/packages/core/src/application/use-cases/properties/update-property-stage.ts
git add vendepro-backend/packages/core/src/domain/entities/lead.ts
git add vendepro-backend/packages/api-properties  # wiring
git commit -m "feat(properties): UpdatePropertyStageUseCase con sync engine y stage history"
```

---

## Task 8: Migration SQL

**Files:**
- Create: `vendepro-backend/migrations_v2/027_state_machine_unification.sql`

- [ ] **Step 8.1: Verificar el siguiente número de migration**

Run: `ls vendepro-backend/migrations_v2/ | sort | tail -5`
Expected: la última debería ser `026_*`. Si es otra, ajustar el nombre del archivo (substituir `027_` por el siguiente disponible).

- [ ] **Step 8.2: Crear el archivo de migration**

Crear `vendepro-backend/migrations_v2/027_state_machine_unification.sql`:

```sql
-- 027_state_machine_unification.sql
-- Unifica state machines de lead y property con estados nuevos y sincronización cruzada.

-- 1. Nuevos commercial_stages para VENTA (operation_type_id=1 según seed estándar)
INSERT OR IGNORE INTO commercial_stages (operation_type_id, slug, label, sort_order, is_terminal, color) VALUES
  (1, 'propuesta', 'Propuesta',  0,  0, 'gray'),
  (1, 'perdida',   'Perdida',    98, 1, 'red'),
  (1, 'invalida',  'Inválida',   97, 1, 'gray');

-- 2. Nuevos commercial_stages para ALQUILER (operation_type_id=2)
--    Mismo grafo que venta, mismos slugs.
INSERT OR IGNORE INTO commercial_stages (operation_type_id, slug, label, sort_order, is_terminal, color) VALUES
  (2, 'propuesta', 'Propuesta',  0,  0, 'gray'),
  (2, 'perdida',   'Perdida',    98, 1, 'red'),
  (2, 'invalida',  'Inválida',   97, 1, 'gray');

-- 3. Unificar slugs legacy de alquiler con los de venta
UPDATE commercial_stages SET slug='captada'    WHERE operation_type_id=2 AND slug='captacion';
UPDATE commercial_stages SET slug='vendida'    WHERE operation_type_id=2 AND slug='alquilada';
UPDATE commercial_stages SET slug='publicada'  WHERE operation_type_id=2 AND slug='con_interesados';

UPDATE properties SET commercial_stage='captada'   WHERE commercial_stage='captacion';
UPDATE properties SET commercial_stage='vendida'   WHERE commercial_stage='alquilada';
UPDATE properties SET commercial_stage='publicada' WHERE commercial_stage='con_interesados';

-- 4. Backfill: properties asociadas a leads no-captados que están en 'captada' sin avance
--    → mover a 'propuesta' (criterio conservador: sin stage_history previo).
UPDATE properties
SET commercial_stage='propuesta'
WHERE lead_id IS NOT NULL
  AND commercial_stage='captada'
  AND lead_id IN (SELECT id FROM leads WHERE stage NOT IN ('captado','finalizado','perdido','invalido'))
  AND id NOT IN (SELECT entity_id FROM stage_history WHERE entity_type='property');

-- 5. Agregar columna triggered_by a stage_history (default 'user')
ALTER TABLE stage_history ADD COLUMN triggered_by TEXT NOT NULL DEFAULT 'user';

-- 6. Property_statuses: no se eliminan en esta release.
-- (Se removerán en migration futura una vez validado que ningún código las consume.)

-- 7. Lead stages nuevos: no requieren cambio en schema porque stage es TEXT libre,
--    pero documentamos los valores válidos para futura referencia:
--    nuevo, asignado, contactado, calificado, en_tasacion, presentada, seguimiento,
--    captado, invalido, finalizado, perdido
```

- [ ] **Step 8.3: Verificar dry-run local con wrangler d1**

Run: `cd vendepro-backend && npx wrangler d1 execute reportes-mg-db --local --file=migrations_v2/027_state_machine_unification.sql`
Expected: sin errores. Si una columna ya existe (rerun), `ALTER TABLE ADD COLUMN` falla — agregar guard manualmente si es necesario (D1 SQLite no soporta `IF NOT EXISTS` para columnas).

Si el operation_type_id de venta y alquiler no son 1 y 2 en tu instalación, verificar con:
`npx wrangler d1 execute reportes-mg-db --local --command="SELECT * FROM operation_types"`
Y ajustar la migration.

- [ ] **Step 8.4: Commit**

```bash
git add vendepro-backend/migrations_v2/027_state_machine_unification.sql
git commit -m "feat(db): migration 027 — unifica state machines de lead y property

- Agrega commercial_stages propuesta/perdida/invalida (venta y alquiler)
- Unifica slugs legacy de alquiler (captacion/alquilada/con_interesados)
- Backfill: properties pre-captadas → propuesta
- stage_history: agrega columna triggered_by (default 'user')"
```

---

## Task 9: Frontend — crm-config.ts

**Files:**
- Modify: `vendepro-frontend/src/lib/crm-config.ts`

- [ ] **Step 9.1: Leer el archivo actual**

Run: `cat vendepro-frontend/src/lib/crm-config.ts | head -100`
Expected: ver `PROPERTY_STAGES`, `LEAD_STAGES` o equivalente.

- [ ] **Step 9.2: Agregar nuevos estados de propiedad y agrupamientos**

En `vendepro-frontend/src/lib/crm-config.ts`, modificar el bloque `PROPERTY_STAGES` (alrededor de la línea 42) para que incluya los nuevos estados:

```typescript
export const PROPERTY_STAGES = {
  propuesta:     { label: 'Propuesta',       color: 'bg-gray-100 text-gray-700',       order: 0 },
  captada:       { label: 'Captada',         color: 'bg-green-100 text-green-800',     order: 1 },
  publicada:     { label: 'Publicada',       color: 'bg-blue-100 text-blue-800',       order: 2 },
  reservada:     { label: 'Reservada',       color: 'bg-purple-100 text-purple-800',   order: 3 },
  suspendida:    { label: 'Suspendida',      color: 'bg-orange-100 text-orange-800',   order: 4 },
  vendida:       { label: 'Vendida',         color: 'bg-emerald-100 text-emerald-800', order: 5 },
  perdida:       { label: 'Perdida',         color: 'bg-red-100 text-red-700',         order: 6 },
  invalida:      { label: 'Inválida',        color: 'bg-gray-100 text-gray-700',       order: 7 },
  vencida:       { label: 'Vencida',         color: 'bg-red-100 text-red-800',         order: 8 },
  archivada:     { label: 'Archivada',       color: 'bg-gray-100 text-gray-500',       order: 9 },
  documentacion: { label: 'Documentación',   color: 'bg-amber-100 text-amber-800',     order: 99 },
} as const

export type PropertyStage = keyof typeof PROPERTY_STAGES
export const PROPERTY_STAGE_KEYS = Object.keys(PROPERTY_STAGES) as PropertyStage[]

// Agrupamientos UI (no son stages del backend)
export const ACTIVE_PROPERTY_STAGES: PropertyStage[] = ['captada', 'documentacion', 'publicada', 'reservada']
export const PROPOSED_PROPERTY_STAGES: PropertyStage[] = ['propuesta']
export const FINAL_PROPERTY_STAGES: PropertyStage[] = ['vendida', 'perdida', 'invalida', 'archivada']
export const PAUSED_PROPERTY_STAGES: PropertyStage[] = ['suspendida', 'vencida']
```

- [ ] **Step 9.3: Agregar nuevos estados de lead**

Buscar el bloque `LEAD_STAGES` o equivalente. Si existe (similar a PROPERTY_STAGES), agregar:

```typescript
  invalido:   { label: 'Inválido',   color: 'bg-gray-100 text-gray-700',     order: 90 },
  finalizado: { label: 'Finalizado', color: 'bg-emerald-100 text-emerald-700', order: 95 },
```

Si no existe `LEAD_STAGES` como objeto explícito, agregar el bloque o saltar este paso si el frontend obtiene labels del backend (`/property-config` o equivalente).

- [ ] **Step 9.4: Typecheck**

Run: `cd vendepro-frontend && npx tsc --noEmit`
Expected: sin errores en `crm-config.ts`. Posibles errores en otros archivos que importan `PROPERTY_STAGES` se solucionarán en los pasos siguientes (Tasks 10-11).

---

## Task 10: Frontend — pipeline page

**Files:**
- Modify: `vendepro-frontend/src/app/(dashboard)/propiedades/pipeline/page.tsx`

- [ ] **Step 10.1: Actualizar MAIN_STAGES y agregar propuesta al kanban**

En `pipeline/page.tsx`, líneas 11-14, reemplazar:

```typescript
// Progresión lineal del pipeline — captada → publicada → reservada → vendida
const MAIN_STAGES: PropertyStage[] = ['captada', 'publicada', 'reservada', 'vendida']
// Suspendida aparece aparte — solo se puede archivar, no avanzar
const ALL_PIPELINE_STAGES: PropertyStage[] = [...MAIN_STAGES, 'suspendida']
```

Por:

```typescript
// Progresión lineal del pipeline — propuesta → captada → publicada → reservada → vendida
const MAIN_STAGES: PropertyStage[] = ['propuesta', 'captada', 'publicada', 'reservada', 'vendida']
// Suspendida aparece aparte — solo se puede archivar, no avanzar
const ALL_PIPELINE_STAGES: PropertyStage[] = [...MAIN_STAGES, 'suspendida']
```

- [ ] **Step 10.2: Verificar comportamiento visual de archiveProperty**

Run: `grep -n "archivada\|MAIN_STAGES" vendepro-frontend/src/app/\(dashboard\)/propiedades/pipeline/page.tsx`
Expected: confirmar que `advanceStage` solo avanza dentro de MAIN_STAGES y `archiveProperty` funciona como hasta ahora.

- [ ] **Step 10.3: Typecheck**

Run: `cd vendepro-frontend && npx tsc --noEmit src/app/\(dashboard\)/propiedades/pipeline/page.tsx`
Expected: sin errores.

---

## Task 11: Frontend — PropertyFilters

**Files:**
- Modify: `vendepro-frontend/src/components/properties/PropertyFilters.tsx`

- [ ] **Step 11.1: Leer filtros actuales**

Run: `cat vendepro-frontend/src/components/properties/PropertyFilters.tsx | head -80`
Expected: ver cómo se listan los stages en el dropdown.

- [ ] **Step 11.2: Agregar los nuevos stages al filtro**

Si el componente usa `PROPERTY_STAGE_KEYS` o `Object.keys(PROPERTY_STAGES)`, ya están incluidos automáticamente. Si hay una lista hardcoded, agregar `propuesta`, `perdida`, `invalida` a esa lista preservando el orden visual.

- [ ] **Step 11.3: Verificar archivos restantes con commercial_stage**

Run: `grep -rln "commercial_stage" vendepro-frontend/src --include="*.tsx" --include="*.ts" | grep -v node_modules`
Expected: 9 archivos. Para cada uno revisar si lista valores hardcoded; si sí, agregar los nuevos. Si itera sobre `PROPERTY_STAGES`, no hace falta tocar.

- [ ] **Step 11.4: Typecheck completo del frontend**

Run: `cd vendepro-frontend && npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 11.5: Commit del bloque frontend**

```bash
git add vendepro-frontend/src/lib/crm-config.ts
git add vendepro-frontend/src/app/\(dashboard\)/propiedades/pipeline/page.tsx
git add vendepro-frontend/src/components/properties/PropertyFilters.tsx
git commit -m "feat(frontend): soporte de nuevos estados (propuesta, invalida, perdida, finalizado)

- crm-config: agrega stages + agrupamientos ACTIVE/PROPOSED/FINAL/PAUSED
- pipeline: incluye propuesta al inicio de MAIN_STAGES
- PropertyFilters: nuevos estados en dropdown"
```

---

## Task 12: Test de integración end-to-end (use cases)

**Files:**
- Create: `vendepro-backend/packages/core/tests/application/advance-lead-stage.test.ts`
- Create: `vendepro-backend/packages/core/tests/application/update-property-stage.test.ts`

- [ ] **Step 12.1: Test del use case AdvanceLeadStage con sync**

Crear `vendepro-backend/packages/core/tests/application/advance-lead-stage.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { AdvanceLeadStageUseCase } from '../../src/application/use-cases/leads/advance-lead-stage'

// Mocks in-memory
function makeFakeLeadRepo() {
  const leads = new Map<string, any>()
  return {
    seed: (l: any) => leads.set(l.id, l),
    findById: async (id: string) => leads.get(id),
    save: async (l: any) => { leads.set(l.id, l) },
    _all: () => Array.from(leads.values()),
  }
}

function makeFakePropertyRepo() {
  const props = new Map<string, any>()
  return {
    seed: (p: any) => props.set(p.id, p),
    findById: async (id: string) => props.get(id),
    updateStage: async (id: string, _org: string, stage: string) => {
      const p = props.get(id); if (p) { p.commercial_stage = stage }
    },
  }
}

function makeFakeHistoryRepo() {
  const entries: any[] = []
  return {
    log: async (e: any) => { entries.push(e) },
    findByEntity: async () => entries,
    _all: () => entries,
  }
}

function makeFakeCalendar() {
  return { save: async () => {} }
}

function makeIdGen() {
  let i = 0
  return { generate: () => `gen-${++i}` }
}

describe('AdvanceLeadStageUseCase with property sync', () => {
  it('promotes property from propuesta to captada when lead reaches captado', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()
    // Simula entity Lead con stage=presentada y property_id=p1
    leadRepo.seed({
      id: 'L1', org_id: 'O1', stage: 'presentada',
      property_id: 'P1',
      advanceStage: function (s: any) { this.stage = s; return { firstContactAt: null } },
      toObject() { return { ...this } },
    })
    propRepo.seed({ id: 'P1', org_id: 'O1', commercial_stage: 'propuesta' })

    const uc = new AdvanceLeadStageUseCase(leadRepo as any, makeFakeCalendar() as any, histRepo as any, makeIdGen() as any, propRepo as any)
    const out = await uc.execute({ leadId: 'L1', orgId: 'O1', newStage: 'captado', changedBy: 'agent1' })

    expect(out.syncedPropertyId).toBe('P1')
    expect((await propRepo.findById('P1')).commercial_stage).toBe('captada')
    const events = histRepo._all()
    expect(events.find(e => e.entity_type === 'lead' && e.triggered_by === 'user')).toBeDefined()
    expect(events.find(e => e.entity_type === 'property' && e.triggered_by === 'sync')).toBeDefined()
  })

  it('does not touch property if it already advanced past propuesta', async () => {
    const leadRepo = makeFakeLeadRepo()
    const propRepo = makeFakePropertyRepo()
    const histRepo = makeFakeHistoryRepo()
    leadRepo.seed({
      id: 'L1', org_id: 'O1', stage: 'presentada', property_id: 'P1',
      advanceStage: function (s: any) { this.stage = s; return { firstContactAt: null } },
      toObject() { return { ...this } },
    })
    propRepo.seed({ id: 'P1', org_id: 'O1', commercial_stage: 'publicada' })

    const uc = new AdvanceLeadStageUseCase(leadRepo as any, makeFakeCalendar() as any, histRepo as any, makeIdGen() as any, propRepo as any)
    const out = await uc.execute({ leadId: 'L1', orgId: 'O1', newStage: 'captado', changedBy: 'agent1' })

    expect(out.syncedPropertyId).toBeNull()
    expect((await propRepo.findById('P1')).commercial_stage).toBe('publicada')
  })
})
```

- [ ] **Step 12.2: Correr tests**

Run: `cd vendepro-backend/packages/core && npm test -- advance-lead-stage`
Expected: PASS.

- [ ] **Step 12.3: Test del use case UpdatePropertyStage con sync**

Crear `vendepro-backend/packages/core/tests/application/update-property-stage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { UpdatePropertyStageUseCase } from '../../src/application/use-cases/properties/update-property-stage'

function makeFakePropRepo() {
  const props = new Map<string, any>()
  return {
    seed: (p: any) => props.set(p.id, p),
    findById: async (id: string) => props.get(id),
    updateStage: async (id: string, _o: string, s: string) => { const p = props.get(id); if (p) p.commercial_stage = s },
  }
}

function makeFakeLeadRepo() {
  const leads = new Map<string, any>()
  return {
    seed: (l: any) => leads.set(l.id, l),
    findById: async (id: string) => leads.get(id),
    save: async (l: any) => leads.set(l.id, l),
  }
}

function makeFakeHistory() {
  const events: any[] = []
  return { log: async (e: any) => events.push(e), findByEntity: async () => events, _all: () => events }
}

describe('UpdatePropertyStageUseCase with lead sync', () => {
  it('marks lead as finalizado when property goes to vendida', async () => {
    const propRepo = makeFakePropRepo()
    const leadRepo = makeFakeLeadRepo()
    const histRepo = makeFakeHistory()
    propRepo.seed({ id: 'P1', org_id: 'O1', commercial_stage: 'reservada', lead_id: 'L1' })
    leadRepo.seed({
      id: 'L1', org_id: 'O1', stage: 'captado',
      syncStage: function (s: any) { this.stage = s },
    })

    const uc = new UpdatePropertyStageUseCase(propRepo as any, histRepo as any, leadRepo as any)
    const out = await uc.execute({ propertyId: 'P1', orgId: 'O1', newStage: 'vendida', changedBy: 'agent1' })

    expect(out.syncedLeadId).toBe('L1')
    expect((await leadRepo.findById('L1')).stage).toBe('finalizado')
    expect(histRepo._all().find(e => e.entity_type === 'lead' && e.triggered_by === 'sync')).toBeDefined()
  })

  it('marks lead as perdido when property goes to perdida', async () => {
    const propRepo = makeFakePropRepo()
    const leadRepo = makeFakeLeadRepo()
    const histRepo = makeFakeHistory()
    propRepo.seed({ id: 'P1', org_id: 'O1', commercial_stage: 'publicada', lead_id: 'L1' })
    leadRepo.seed({
      id: 'L1', org_id: 'O1', stage: 'captado',
      syncStage: function (s: any) { this.stage = s },
    })

    const uc = new UpdatePropertyStageUseCase(propRepo as any, histRepo as any, leadRepo as any)
    const out = await uc.execute({ propertyId: 'P1', orgId: 'O1', newStage: 'perdida', changedBy: 'agent1' })

    expect(out.syncedLeadId).toBe('L1')
    expect((await leadRepo.findById('L1')).stage).toBe('perdido')
  })

  it('does not touch lead if lead is not in captado', async () => {
    const propRepo = makeFakePropRepo()
    const leadRepo = makeFakeLeadRepo()
    const histRepo = makeFakeHistory()
    propRepo.seed({ id: 'P1', org_id: 'O1', commercial_stage: 'publicada', lead_id: 'L1' })
    leadRepo.seed({
      id: 'L1', org_id: 'O1', stage: 'seguimiento',
      syncStage: function (s: any) { this.stage = s },
    })

    const uc = new UpdatePropertyStageUseCase(propRepo as any, histRepo as any, leadRepo as any)
    const out = await uc.execute({ propertyId: 'P1', orgId: 'O1', newStage: 'perdida', changedBy: 'agent1' })

    expect(out.syncedLeadId).toBeNull()
    expect((await leadRepo.findById('L1')).stage).toBe('seguimiento')
  })
})
```

- [ ] **Step 12.4: Correr tests**

Run: `cd vendepro-backend/packages/core && npm test -- update-property-stage`
Expected: PASS.

- [ ] **Step 12.5: Correr **toda** la suite del core**

Run: `cd vendepro-backend/packages/core && npm test`
Expected: PASS — sin regresiones en tests existentes (`activity`, `appraisal-*`, `lead`, `landing-*`, etc.).

- [ ] **Step 12.6: Commit final del bloque tests**

```bash
git add vendepro-backend/packages/core/tests/application
git commit -m "test(application): integration tests para sync engine en use cases"
```

---

## Task 13: Verificación manual end-to-end y rollout

**Files:** ninguno (verificación)

- [ ] **Step 13.1: Build local backend**

Run: `cd vendepro-backend && npm run build 2>/dev/null || (cd vendepro-backend/packages/core && npm run typecheck)`
Expected: sin errores.

- [ ] **Step 13.2: Build local frontend**

Run: `cd vendepro-frontend && npx next build`
Expected: build exitoso. Si falla por TS o ESLint, fijarlo antes de proceder.

- [ ] **Step 13.3: Push a main (deploy)**

```bash
git push origin main
```

El workflow `migrate.yml` aplicará la migration 027 automáticamente al pushear `migrations_v2/**`. Los workers afectados (api-crm, api-properties) se deployarán por sus respectivos workflows. El frontend se deploya por Cloudflare Pages al pushear `vendepro-frontend/`.

- [ ] **Step 13.4: Verificación manual en producción**

Tras el deploy, abrir en navegador:

1. `/leads` — verificar que no haya errores 500 y que los leads se listen.
2. `/leads/[id]` — abrir un lead existente, verificar que muestra estados correctos.
3. `/propiedades` — verificar listado, filtros incluyen los nuevos estados.
4. `/propiedades/pipeline` — verificar columnas: propuesta, captada, publicada, reservada, vendida + suspendida.
5. Crear una propiedad desde un lead — verificar que arranca en `propuesta`.
6. Avanzar el lead a `captado` — verificar que la propiedad pasa a `captada` automáticamente y `stage_history` registra ambos eventos.
7. Llevar la propiedad a `vendida` — verificar que el lead pasa a `finalizado` y se loguea en history con `triggered_by='sync'`.

- [ ] **Step 13.5: Documentar y cerrar**

Si todo OK, marcar el spec como `Estado: implementado` y archivar el plan.

---

## Self-Review

**Spec coverage:**
- Lead states (10) → Task 1 ✓
- Property states (11) → Task 2 ✓
- Sync rules declarativas → Task 3 ✓
- Sync engine → Task 4 ✓
- StageHistoryRepository extensions (property + triggered_by) → Task 5 ✓
- AdvanceLeadStageUseCase con sync → Task 6 ✓
- UpdatePropertyStageUseCase con sync + history → Task 7 ✓
- Migration SQL → Task 8 ✓
- Frontend crm-config + grupos UI → Task 9 ✓
- Frontend pipeline page → Task 10 ✓
- Frontend filtros y archivos auxiliares → Task 11 ✓
- Tests end-to-end → Task 12 ✓
- Rollout y verificación → Task 13 ✓

**Type consistency:** `LeadStageValue` y `PropertyStageValue` se mantienen como antes; `TransitionSource = 'user' | 'sync' | 'system'` se usa consistentemente; `SyncRule<From, To>` es genérica.

**Decisiones implícitas confirmadas:**
- `Lead.syncStage(newStage)` se agrega como método paralelo a `advanceStage` (separa intent user vs sync).
- `propertyRepo` y `metaSender` son opcionales en `AdvanceLeadStageUseCase` para no romper consumidores. Si en infra ya están disponibles, conectarlos.
- La migration mantiene `property_statuses` y `status_id` (deprecados, no eliminados).
- Tests usan mocks in-memory simples — no requieren Cloudflare bindings.
