'use server'

import { getDB } from './db'
import { getCurrentUser } from './auth'

export interface AgentStats {
  id: string
  full_name: string
  email: string
  total_properties: number
  active_properties: number
  sold_properties: number
  inactive_properties: number
  total_reports: number
  total_impressions: number
  total_visits: number
  total_inquiries: number
  total_in_person_visits: number
}

export interface NeighborhoodStats {
  neighborhood: string
  total_properties: number
  sold_count: number
  active_count: number
  avg_impressions: number
  avg_visits: number
  avg_inquiries: number
  avg_days_on_market: number
  avg_price: number
}

export interface AgencyOverview {
  total_agents: number
  total_properties: number
  active_properties: number
  sold_properties: number
  inactive_properties: number
  total_reports: number
  total_impressions: number
  total_visits: number
  total_inquiries: number
  total_in_person_visits: number
  total_offers: number
  conversion_rate: number // inquiries / impressions
}

export async function getAgencyDashboard() {
  const user = await getCurrentUser()
  if (!user) return null

  const db = await getDB()
  const isAdmin = user.role === 'admin'

  // Agency overview
  const agentFilter = isAdmin ? '' : 'WHERE p.agent_id = ?'
  const agentBindings = isAdmin ? [] : [user.id]

  // Total counts
  const overview = await db.prepare(`
    SELECT
      COUNT(*) as total_properties,
      SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active_properties,
      SUM(CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END) as sold_properties,
      SUM(CASE WHEN p.status = 'inactive' THEN 1 ELSE 0 END) as inactive_properties,
      SUM(CASE WHEN p.status = 'suspended' THEN 1 ELSE 0 END) as suspended_properties
    FROM properties p ${agentFilter}
  `).bind(...agentBindings).first() as any

  // Total reports and metrics
  const metricsQuery = isAdmin
    ? `SELECT
        COUNT(DISTINCT r.id) as total_reports,
        COALESCE(SUM(rm.impressions), 0) as total_impressions,
        COALESCE(SUM(rm.portal_visits), 0) as total_visits,
        COALESCE(SUM(rm.inquiries), 0) as total_inquiries,
        COALESCE(SUM(rm.in_person_visits), 0) as total_in_person_visits,
        COALESCE(SUM(rm.offers), 0) as total_offers,
        COALESCE(SUM(rm.phone_calls), 0) as total_phone_calls,
        COALESCE(SUM(rm.whatsapp), 0) as total_whatsapp
      FROM reports r
      JOIN properties p ON r.property_id = p.id
      LEFT JOIN report_metrics rm ON rm.report_id = r.id
      WHERE r.status = 'published'`
    : `SELECT
        COUNT(DISTINCT r.id) as total_reports,
        COALESCE(SUM(rm.impressions), 0) as total_impressions,
        COALESCE(SUM(rm.portal_visits), 0) as total_visits,
        COALESCE(SUM(rm.inquiries), 0) as total_inquiries,
        COALESCE(SUM(rm.in_person_visits), 0) as total_in_person_visits,
        COALESCE(SUM(rm.offers), 0) as total_offers,
        COALESCE(SUM(rm.phone_calls), 0) as total_phone_calls,
        COALESCE(SUM(rm.whatsapp), 0) as total_whatsapp
      FROM reports r
      JOIN properties p ON r.property_id = p.id
      LEFT JOIN report_metrics rm ON rm.report_id = r.id
      WHERE r.status = 'published' AND p.agent_id = ?`

  const metrics = await db.prepare(metricsQuery).bind(...agentBindings).first() as any

  // Agent count
  const agentCount = isAdmin
    ? (await db.prepare('SELECT COUNT(*) as count FROM users').first() as any)?.count || 0
    : 1

  const agencyOverview: AgencyOverview = {
    total_agents: agentCount,
    total_properties: overview?.total_properties || 0,
    active_properties: overview?.active_properties || 0,
    sold_properties: overview?.sold_properties || 0,
    inactive_properties: overview?.inactive_properties || 0,
    total_reports: metrics?.total_reports || 0,
    total_impressions: metrics?.total_impressions || 0,
    total_visits: metrics?.total_visits || 0,
    total_inquiries: metrics?.total_inquiries || 0,
    total_in_person_visits: metrics?.total_in_person_visits || 0,
    total_offers: metrics?.total_offers || 0,
    conversion_rate: metrics?.total_impressions > 0
      ? ((metrics?.total_inquiries || 0) / metrics.total_impressions * 100)
      : 0,
  }

  // Per-agent stats (admin only gets all, agents get just themselves)
  const agentStatsQuery = isAdmin
    ? `SELECT
        u.id, u.full_name, u.email,
        COUNT(DISTINCT p.id) as total_properties,
        SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active_properties,
        SUM(CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END) as sold_properties,
        SUM(CASE WHEN p.status = 'inactive' THEN 1 ELSE 0 END) as inactive_properties,
        (SELECT COUNT(*) FROM reports r2 JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published') as total_reports,
        COALESCE((SELECT SUM(rm2.impressions) FROM report_metrics rm2 JOIN reports r2 ON rm2.report_id = r2.id JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published'), 0) as total_impressions,
        COALESCE((SELECT SUM(rm2.portal_visits) FROM report_metrics rm2 JOIN reports r2 ON rm2.report_id = r2.id JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published'), 0) as total_visits,
        COALESCE((SELECT SUM(rm2.inquiries) FROM report_metrics rm2 JOIN reports r2 ON rm2.report_id = r2.id JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published'), 0) as total_inquiries,
        COALESCE((SELECT SUM(rm2.in_person_visits) FROM report_metrics rm2 JOIN reports r2 ON rm2.report_id = r2.id JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published'), 0) as total_in_person_visits
      FROM users u
      LEFT JOIN properties p ON p.agent_id = u.id
      GROUP BY u.id
      ORDER BY total_properties DESC`
    : `SELECT
        u.id, u.full_name, u.email,
        COUNT(DISTINCT p.id) as total_properties,
        SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active_properties,
        SUM(CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END) as sold_properties,
        SUM(CASE WHEN p.status = 'inactive' THEN 1 ELSE 0 END) as inactive_properties,
        (SELECT COUNT(*) FROM reports r2 JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published') as total_reports,
        COALESCE((SELECT SUM(rm2.impressions) FROM report_metrics rm2 JOIN reports r2 ON rm2.report_id = r2.id JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published'), 0) as total_impressions,
        COALESCE((SELECT SUM(rm2.portal_visits) FROM report_metrics rm2 JOIN reports r2 ON rm2.report_id = r2.id JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published'), 0) as total_visits,
        COALESCE((SELECT SUM(rm2.inquiries) FROM report_metrics rm2 JOIN reports r2 ON rm2.report_id = r2.id JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published'), 0) as total_inquiries,
        COALESCE((SELECT SUM(rm2.in_person_visits) FROM report_metrics rm2 JOIN reports r2 ON rm2.report_id = r2.id JOIN properties p2 ON r2.property_id = p2.id WHERE p2.agent_id = u.id AND r2.status = 'published'), 0) as total_in_person_visits
      FROM users u
      LEFT JOIN properties p ON p.agent_id = u.id
      WHERE u.id = ?
      GROUP BY u.id`

  const agentStats = (await db.prepare(agentStatsQuery).bind(...agentBindings).all()).results as unknown as AgentStats[]

  // Neighborhood stats
  const neighborhoodQuery = isAdmin
    ? `SELECT
        p.neighborhood,
        COUNT(*) as total_properties,
        SUM(CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END) as sold_count,
        SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active_count,
        COALESCE(AVG(p.asking_price), 0) as avg_price,
        COALESCE(AVG(p.days_on_market), 0) as avg_days_on_market
      FROM properties p
      GROUP BY p.neighborhood
      ORDER BY total_properties DESC`
    : `SELECT
        p.neighborhood,
        COUNT(*) as total_properties,
        SUM(CASE WHEN p.status = 'sold' THEN 1 ELSE 0 END) as sold_count,
        SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) as active_count,
        COALESCE(AVG(p.asking_price), 0) as avg_price,
        COALESCE(AVG(p.days_on_market), 0) as avg_days_on_market
      FROM properties p
      WHERE p.agent_id = ?
      GROUP BY p.neighborhood
      ORDER BY total_properties DESC`

  const neighborhoods = (await db.prepare(neighborhoodQuery).bind(...agentBindings).all()).results as any[]

  // Enrich neighborhoods with metric averages
  for (const n of neighborhoods) {
    const metricAvgQuery = isAdmin
      ? `SELECT
          COALESCE(AVG(rm.impressions), 0) as avg_impressions,
          COALESCE(AVG(rm.portal_visits), 0) as avg_visits,
          COALESCE(AVG(rm.inquiries), 0) as avg_inquiries
        FROM report_metrics rm
        JOIN reports r ON rm.report_id = r.id
        JOIN properties p ON r.property_id = p.id
        WHERE p.neighborhood = ? AND r.status = 'published'`
      : `SELECT
          COALESCE(AVG(rm.impressions), 0) as avg_impressions,
          COALESCE(AVG(rm.portal_visits), 0) as avg_visits,
          COALESCE(AVG(rm.inquiries), 0) as avg_inquiries
        FROM report_metrics rm
        JOIN reports r ON rm.report_id = r.id
        JOIN properties p ON r.property_id = p.id
        WHERE p.neighborhood = ? AND r.status = 'published' AND p.agent_id = ?`

    const bindings = isAdmin ? [n.neighborhood] : [n.neighborhood, user.id]
    const metricAvg = await db.prepare(metricAvgQuery).bind(...bindings).first() as any

    n.avg_impressions = Math.round(metricAvg?.avg_impressions || 0)
    n.avg_visits = Math.round(metricAvg?.avg_visits || 0)
    n.avg_inquiries = Math.round(metricAvg?.avg_inquiries || 0)
  }

  // Sold vs not sold comparison
  const soldComparison = isAdmin
    ? await db.prepare(`
        SELECT
          p.status,
          COUNT(*) as count,
          COALESCE(AVG(total_imp.impressions), 0) as avg_impressions,
          COALESCE(AVG(total_imp.visits), 0) as avg_visits,
          COALESCE(AVG(total_imp.inquiries), 0) as avg_inquiries
        FROM properties p
        LEFT JOIN (
          SELECT r.property_id,
            SUM(rm.impressions) as impressions,
            SUM(rm.portal_visits) as visits,
            SUM(rm.inquiries) as inquiries
          FROM reports r
          JOIN report_metrics rm ON rm.report_id = r.id
          WHERE r.status = 'published'
          GROUP BY r.property_id
        ) total_imp ON total_imp.property_id = p.id
        WHERE p.status IN ('sold', 'active', 'inactive')
        GROUP BY p.status
      `).all()
    : await db.prepare(`
        SELECT
          p.status,
          COUNT(*) as count,
          COALESCE(AVG(total_imp.impressions), 0) as avg_impressions,
          COALESCE(AVG(total_imp.visits), 0) as avg_visits,
          COALESCE(AVG(total_imp.inquiries), 0) as avg_inquiries
        FROM properties p
        LEFT JOIN (
          SELECT r.property_id,
            SUM(rm.impressions) as impressions,
            SUM(rm.portal_visits) as visits,
            SUM(rm.inquiries) as inquiries
          FROM reports r
          JOIN report_metrics rm ON rm.report_id = r.id
          WHERE r.status = 'published'
          GROUP BY r.property_id
        ) total_imp ON total_imp.property_id = p.id
        WHERE p.status IN ('sold', 'active', 'inactive') AND p.agent_id = ?
        GROUP BY p.status
      `).bind(user.id).all()

  return {
    user,
    isAdmin,
    overview: agencyOverview,
    agentStats,
    neighborhoods: neighborhoods as NeighborhoodStats[],
    soldComparison: soldComparison.results as any[],
  }
}
