import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function getDB() {
  const { env } = await getCloudflareContext()
  return (env as any).DB as D1Database
}

export function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '')
}
