import { describe, it, expect } from 'vitest'
import { CreatePropertyUseCase } from '../../../src/application/use-cases/properties/create-property'

function makePropRepo() {
  const saved: any[] = []
  return {
    save: async (p: any) => { saved.push(p) },
    _saved: () => saved,
  } as any
}

function makeIdGen(value = 'P-NEW-1') {
  return { generate: () => value } as any
}

describe('CreatePropertyUseCase', () => {
  // New properties default to commercial_stage='propuesta' so the
  // lead→property sync engine (which ignores null stages) fires when
  // the linked lead reaches captado. See Estados.md §12.
  it('initializes commercial_stage to propuesta', async () => {
    const repo = makePropRepo()
    const uc = new CreatePropertyUseCase(repo, makeIdGen())

    await uc.execute({
      org_id: 'O1',
      agent_id: 'A1',
      address: 'Av X 123',
      neighborhood: 'Palermo',
      city: 'CABA',
      property_type: 'departamento',
      owner_name: 'Owner',
      owner_phone: '+5491100000000',
    })

    const [property] = repo._saved()
    expect(property.commercial_stage).toBe('propuesta')
  })
})
