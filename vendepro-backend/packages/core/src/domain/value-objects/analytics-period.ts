export type AnalyticsPeriod = 'week' | 'month' | 'quarter' | 'year'

export const ANALYTICS_PERIODS: readonly AnalyticsPeriod[] = [
  'week',
  'month',
  'quarter',
  'year',
] as const

export function parseAnalyticsPeriod(raw: string | null | undefined): AnalyticsPeriod {
  return ANALYTICS_PERIODS.includes(raw as AnalyticsPeriod) ? (raw as AnalyticsPeriod) : 'month'
}

export function periodStartDate(period: AnalyticsPeriod, now: Date = new Date()): string {
  const d = new Date(now)
  switch (period) {
    case 'week': d.setDate(d.getDate() - 7); break
    case 'month': d.setMonth(d.getMonth() - 1); break
    case 'quarter': d.setMonth(d.getMonth() - 3); break
    case 'year': d.setFullYear(d.getFullYear() - 1); break
  }
  return d.toISOString().split('T')[0] ?? ''
}
