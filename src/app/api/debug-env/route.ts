import { NextResponse } from 'next/server'
import { getCloudflareContext } from '@opennextjs/cloudflare'

export async function GET() {
  const result: Record<string, string> = {}

  try {
    const { env } = await getCloudflareContext()
    const e = env as any
    result.has_DB = e.DB ? 'yes' : 'no'
    result.has_R2 = e.R2 ? 'yes' : 'no'
    result.has_ANTHROPIC_API_KEY = e.ANTHROPIC_API_KEY ? 'yes (length: ' + e.ANTHROPIC_API_KEY.length + ')' : 'no'
    result.env_keys = Object.keys(e).join(', ')
  } catch (err: any) {
    result.context_error = err?.message || 'unknown'
  }

  // Also check process.env
  result.process_env_ANTHROPIC = process.env.ANTHROPIC_API_KEY ? 'yes' : 'no'

  return NextResponse.json(result)
}
