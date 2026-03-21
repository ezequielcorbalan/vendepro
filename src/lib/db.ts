import { getCloudflareContext } from '@opennextjs/cloudflare'

export interface CloudflareEnv {
  DB: D1Database
  R2: R2Bucket
  ANTHROPIC_API_KEY?: string
}

export async function getDB(): Promise<D1Database> {
  const { env } = await getCloudflareContext()
  return (env as unknown as CloudflareEnv).DB
}

export async function getR2(): Promise<R2Bucket> {
  const { env } = await getCloudflareContext()
  return (env as unknown as CloudflareEnv).R2
}

export async function getEnvVar(key: keyof CloudflareEnv): Promise<string | undefined> {
  const { env } = await getCloudflareContext()
  return (env as unknown as CloudflareEnv)[key] as string | undefined
}

// Helper to generate IDs
export function generateId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}
