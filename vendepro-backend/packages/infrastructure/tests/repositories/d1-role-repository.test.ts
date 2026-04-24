import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { createTestDB, closeTestDB, type TestEnv } from '../helpers/d1-test-env'
import { D1RoleRepository } from '../../src/repositories/d1-role-repository'

describe('D1RoleRepository', () => {
  let env: TestEnv

  beforeAll(async () => {
    env = await createTestDB()
  })

  afterAll(async () => {
    await closeTestDB(env)
  })

  it('findAll returns the 4 seeded roles ordered by id', async () => {
    const repo = new D1RoleRepository(env.DB)
    const roles = await repo.findAll()
    expect(roles.length).toBe(4)
    expect(roles[0]!.toObject()).toEqual({ id: 1, name: 'admin', label: 'Administrador' })
    expect(roles[1]!.toObject()).toEqual({ id: 2, name: 'agent', label: 'Agente' })
    expect(roles[2]!.toObject()).toEqual({ id: 3, name: 'supervisor', label: 'Supervisor' })
    expect(roles[3]!.toObject()).toEqual({ id: 4, name: 'owner', label: 'Propietario de cuenta' })
  })

  it('findById(1) returns admin', async () => {
    const repo = new D1RoleRepository(env.DB)
    const role = await repo.findById(1)
    expect(role).not.toBeNull()
    expect(role!.toObject()).toEqual({ id: 1, name: 'admin', label: 'Administrador' })
  })

  it('findById(2) returns agent', async () => {
    const repo = new D1RoleRepository(env.DB)
    const role = await repo.findById(2)
    expect(role).not.toBeNull()
    expect(role!.toObject()).toEqual({ id: 2, name: 'agent', label: 'Agente' })
  })

  it('findById(999) returns null for missing id', async () => {
    const repo = new D1RoleRepository(env.DB)
    const role = await repo.findById(999)
    expect(role).toBeNull()
  })
})
