import type { TeamStatsRepository, AgentLeadAggregate, AgentFirstResponse, LeadPipeline } from '@vendepro/core'
import { isTerminalStage, WON_STAGE } from '@vendepro/core'

export class D1TeamStatsRepository implements TeamStatsRepository {
  constructor(private readonly db: D1Database) {}

  /**
   * Una fila por (agente, etapa). Son pocas decenas de filas aunque la org
   * tenga 50.000 leads, y el plegado por agente se hace acá en memoria.
   *
   * Los atrasos se calculan con `julianday` y no comparando strings: en la
   * base conviven dos formatos de fecha — ISO con `T`/`Z` (lo que escribe la
   * entidad) y `YYYY-MM-DD HH:MM:SS` (lo que escribe `datetime('now')` en las
   * migraciones y en los inserts viejos). Comparar esos textos entre sí da
   * cualquier cosa; `julianday` entiende los dos.
   *
   * `COALESCE(pipeline, 'vendedor')` porque los leads anteriores a la
   * migración 039 tienen la columna en NULL y son todos vendedores.
   */
  async aggregateLeadsByAgent(orgId: string, pipeline: LeadPipeline): Promise<AgentLeadAggregate[]> {
    const rows = (await this.db
      .prepare(`
        SELECT
          assigned_to AS agent_id,
          stage,
          COUNT(*) AS total,
          SUM(CASE WHEN stage = 'nuevo' AND julianday('now') - julianday(created_at) > 1 THEN 1 ELSE 0 END) AS sin_contactar,
          SUM(CASE WHEN julianday('now') - julianday(updated_at) > 7 THEN 1 ELSE 0 END) AS sin_movimiento,
          -- Normalizado a ISO-UTC antes de comparar: un MAX() sobre los dos
          -- formatos crudos ordena mal (la 'T' pesa más que el espacio).
          MAX(strftime('%Y-%m-%dT%H:%M:%SZ', updated_at)) AS ultimo_movimiento
        FROM leads
        WHERE org_id = ? AND COALESCE(pipeline, 'vendedor') = ?
        GROUP BY assigned_to, stage
      `)
      .bind(orgId, pipeline)
      .all()).results as any[]

    const won = WON_STAGE[pipeline]
    const byAgent = new Map<string | null, AgentLeadAggregate>()

    for (const row of rows) {
      const agentId: string | null = row.agent_id ?? null
      let agg = byAgent.get(agentId)
      if (!agg) {
        agg = { agent_id: agentId, by_stage: {}, total: 0, sin_contactar_24h: 0, sin_movimiento_7d: 0, ultimo_movimiento: null }
        byAgent.set(agentId, agg)
      }
      const count = Number(row.total) || 0
      agg.by_stage[row.stage] = (agg.by_stage[row.stage] ?? 0) + count
      agg.total += count

      // Un lead ganado o descartado no está atrasado: nadie le debe una
      // llamada. El filtro va acá y no en el SQL para no repetir en la query
      // la lista de etapas terminales, que vive en el dominio.
      const closed = row.stage === won || isTerminalStage(row.stage, pipeline)
      if (!closed) {
        agg.sin_contactar_24h += Number(row.sin_contactar) || 0
        agg.sin_movimiento_7d += Number(row.sin_movimiento) || 0
        if (row.ultimo_movimiento && (!agg.ultimo_movimiento || row.ultimo_movimiento > agg.ultimo_movimiento)) {
          agg.ultimo_movimiento = row.ultimo_movimiento
        }
      }
    }

    return Array.from(byAgent.values())
  }

  /**
   * Tiempo hasta el primer contacto, por agente.
   *
   * Dos queries porque son dos preguntas distintas: los conteos salen de un
   * GROUP BY común, y la mediana necesita ordenar los tiempos de cada agente
   * (se saca con el truco clásico de `ROW_NUMBER`: el valor del medio, o el
   * promedio de los dos del medio cuando la cantidad es par).
   *
   * Todo con `julianday` — ver el comentario de `aggregateLeadsByAgent` sobre
   * los dos formatos de fecha que conviven en la base.
   */
  async aggregateFirstResponseByAgent(orgId: string, pipeline: LeadPipeline): Promise<AgentFirstResponse[]> {
    const horas = `(julianday(first_contact_at) - julianday(created_at)) * 24.0`
    const scope = `org_id = ? AND COALESCE(pipeline, 'vendedor') = ? AND assigned_to IS NOT NULL`

    const [conteos, medianas] = await Promise.all([
      this.db.prepare(`
        SELECT
          assigned_to AS agent_id,
          SUM(CASE WHEN first_contact_at IS NOT NULL THEN 1 ELSE 0 END) AS medidos,
          SUM(CASE WHEN first_contact_at IS NOT NULL AND ${horas} <= 24 THEN 1 ELSE 0 END) AS en_24h,
          SUM(CASE WHEN first_contact_at IS NULL AND stage = 'nuevo'
                    AND julianday('now') - julianday(created_at) > 1 THEN 1 ELSE 0 END) AS nunca_contactados,
          SUM(CASE WHEN first_contact_at IS NULL AND stage <> 'nuevo' THEN 1 ELSE 0 END) AS sin_dato
        FROM leads
        WHERE ${scope}
        GROUP BY assigned_to
      `).bind(orgId, pipeline).all(),

      this.db.prepare(`
        WITH tiempos AS (
          SELECT
            assigned_to AS agent_id,
            ${horas} AS horas,
            ROW_NUMBER() OVER (PARTITION BY assigned_to ORDER BY ${horas}) AS fila,
            COUNT(*) OVER (PARTITION BY assigned_to) AS n
          FROM leads
          WHERE ${scope} AND first_contact_at IS NOT NULL
        )
        SELECT agent_id, AVG(horas) AS mediana
        FROM tiempos
        WHERE fila IN ((n + 1) / 2, (n + 2) / 2)
        GROUP BY agent_id
      `).bind(orgId, pipeline).all(),
    ])

    const medianaPorAgente = new Map<string, number>()
    for (const row of (medianas.results as any[])) {
      if (row.mediana !== null) medianaPorAgente.set(row.agent_id, Number(row.mediana))
    }

    return (conteos.results as any[]).map(row => ({
      agent_id: row.agent_id ?? null,
      medidos: Number(row.medidos) || 0,
      en_24h: Number(row.en_24h) || 0,
      nunca_contactados: Number(row.nunca_contactados) || 0,
      sin_dato: Number(row.sin_dato) || 0,
      mediana_horas: medianaPorAgente.get(row.agent_id) ?? null,
    }))
  }
}
