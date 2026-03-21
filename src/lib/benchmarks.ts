'use server'

import { getDB } from './db'

export interface SoldBenchmark {
  avg_impressions: number
  avg_visits: number
  avg_inquiries: number
  sold_count: number
}

export async function getSoldBenchmarks(neighborhood?: string): Promise<SoldBenchmark | null> {
  const db = await getDB()

  // Get average metrics of sold properties, optionally filtered by neighborhood
  const query = neighborhood
    ? `SELECT
        COUNT(DISTINCT p.id) as sold_count,
        COALESCE(AVG(totals.impressions), 0) as avg_impressions,
        COALESCE(AVG(totals.visits), 0) as avg_visits,
        COALESCE(AVG(totals.inquiries), 0) as avg_inquiries
      FROM properties p
      JOIN (
        SELECT r.property_id,
          SUM(rm.impressions) as impressions,
          SUM(rm.portal_visits) as visits,
          SUM(rm.inquiries) as inquiries
        FROM reports r
        JOIN report_metrics rm ON rm.report_id = r.id
        WHERE r.status = 'published'
        GROUP BY r.property_id
      ) totals ON totals.property_id = p.id
      WHERE p.status = 'sold' AND p.neighborhood = ?`
    : `SELECT
        COUNT(DISTINCT p.id) as sold_count,
        COALESCE(AVG(totals.impressions), 0) as avg_impressions,
        COALESCE(AVG(totals.visits), 0) as avg_visits,
        COALESCE(AVG(totals.inquiries), 0) as avg_inquiries
      FROM properties p
      JOIN (
        SELECT r.property_id,
          SUM(rm.impressions) as impressions,
          SUM(rm.portal_visits) as visits,
          SUM(rm.inquiries) as inquiries
        FROM reports r
        JOIN report_metrics rm ON rm.report_id = r.id
        WHERE r.status = 'published'
        GROUP BY r.property_id
      ) totals ON totals.property_id = p.id
      WHERE p.status = 'sold'`

  const bindings = neighborhood ? [neighborhood] : []
  const result = await db.prepare(query).bind(...bindings).first() as any

  if (!result || result.sold_count === 0) return null

  return {
    avg_impressions: Math.round(result.avg_impressions),
    avg_visits: Math.round(result.avg_visits),
    avg_inquiries: Math.round(result.avg_inquiries),
    sold_count: result.sold_count,
  }
}
