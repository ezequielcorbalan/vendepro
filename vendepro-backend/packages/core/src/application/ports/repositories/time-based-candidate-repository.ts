/**
 * Candidatos para los triggers time-based del motor de automatizaciones.
 *
 * Cada método devuelve ids de entidades que HOY cumplen la condición del
 * trigger, excluyendo las que ya tienen un run de esa automatización desde
 * `notRunSince` (`null` = desde siempre, para scope 'once'). El filtro evita
 * dos males: reclamar el dedupe una y otra vez en cada tick, y que los mismos
 * N viejos taponen el `limit` y los nuevos nunca entren. Excepción: un run
 * salteado por `rate_limited` no cuenta — ese skip es "ahora no", no "nunca".
 */
export interface TimeBasedCandidateRepository {
  /** Leads que siguen sin contactar (etapa nuevo/asignado) hace más de N horas. */
  findLeadsWithoutContact(
    orgId: string,
    automationId: string,
    notRunSince: string | null,
    hours: number,
    now: Date,
    limit: number,
  ): Promise<string[]>

  /** Leads abiertos sin ninguna actividad registrada en los últimos N días. */
  findLeadsWithoutActivity(
    orgId: string,
    automationId: string,
    notRunSince: string | null,
    days: number,
    now: Date,
    limit: number,
  ): Promise<string[]>

  /** Propiedades activas cuyo mandato (auth_start_date + auth_duration_days)
   *  vence dentro de los próximos N días. */
  findPropertiesWithExpiringAuthorization(
    orgId: string,
    automationId: string,
    notRunSince: string | null,
    daysAhead: number,
    now: Date,
    limit: number,
  ): Promise<string[]>
}
