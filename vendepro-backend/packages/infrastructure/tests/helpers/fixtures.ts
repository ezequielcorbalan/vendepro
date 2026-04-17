let seq = 0
export const nextId = (prefix = 'id') => `${prefix}_${++seq}_${Date.now()}`

export async function seedOrg(
  db: D1Database,
  overrides: Partial<{ id: string; slug: string; name: string }> = {},
) {
  const id = overrides.id ?? nextId('org')
  const slug = overrides.slug ?? `org-${id}`
  const name = overrides.name ?? 'Test Org'
  await db
    .prepare(
      `INSERT INTO organizations (id, slug, name, created_at) VALUES (?, ?, ?, datetime('now'))`,
    )
    .bind(id, slug, name)
    .run()
  return { id, slug, name }
}

export async function seedUser(
  db: D1Database,
  orgId: string,
  overrides: Partial<{ id: string; email: string; role: string; full_name: string }> = {},
) {
  const id = overrides.id ?? nextId('user')
  const email = overrides.email ?? `${id}@test.com`
  const role = overrides.role ?? 'agent'
  const full_name = overrides.full_name ?? 'Test User'
  await db
    .prepare(
      `INSERT INTO users (id, org_id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, 'x', ?, ?, datetime('now'))`,
    )
    .bind(id, orgId, email, full_name, role)
    .run()
  return { id, email, role, full_name, org_id: orgId }
}
