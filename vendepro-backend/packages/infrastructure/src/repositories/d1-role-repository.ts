import { Role } from '@vendepro/core'
import type { RoleRepository } from '@vendepro/core'

export class D1RoleRepository implements RoleRepository {
  constructor(private readonly db: D1Database) {}

  async findAll(): Promise<Role[]> {
    const rows = (await this.db
      .prepare('SELECT id, name, label FROM roles ORDER BY id')
      .all()).results as any[]
    return rows.map((r) => this.toEntity(r))
  }

  async findById(id: number): Promise<Role | null> {
    const row = (await this.db
      .prepare('SELECT id, name, label FROM roles WHERE id = ?')
      .bind(id)
      .first()) as any
    return row ? this.toEntity(row) : null
  }

  private toEntity(row: any): Role {
    return Role.create({
      id: Number(row.id),
      name: row.name,
      label: row.label,
    })
  }
}
