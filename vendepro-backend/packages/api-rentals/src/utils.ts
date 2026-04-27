export function createId(): string {
  const buf = new Uint8Array(12)
  crypto.getRandomValues(buf)
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function dateStr(d?: string | null): string | null {
  return d ? new Date(d).toISOString().slice(0, 10) : null
}

/** Add N months to a date string (YYYY-MM-DD) */
export function addMonths(date: string, months: number): string {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

/** Current period as "YYYY-MM" */
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7)
}
