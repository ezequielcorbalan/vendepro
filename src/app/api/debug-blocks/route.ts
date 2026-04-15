import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
  const db = await getDB()
  const results: any = {}

  // Check if table exists
  try {
    const blocks = (await db.prepare(
      'SELECT id, title, block_type, sort_order, enabled, section FROM tasacion_template_blocks WHERE org_id = ? ORDER BY sort_order'
    ).bind('org_mg').all()).results
    results.blocks = blocks
    results.blocks_count = blocks.length
  } catch (e: any) {
    results.blocks_error = e.message
  }

  // Check org branding
  try {
    const org = await db.prepare(
      'SELECT name, brand_color, brand_accent_color, logo_url FROM organizations WHERE id = ?'
    ).bind('org_mg').first()
    results.org = org
  } catch (e: any) {
    results.org_error = e.message
  }

  return NextResponse.json(results)
}
