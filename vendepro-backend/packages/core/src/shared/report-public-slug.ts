import type { IdGenerator } from '../application/ports/id-generator'

const slugify = (input: string): string =>
  input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

export function sanitizePeriodLabel(input: string): string {
  return input
    .replace(/[^\p{L}\p{N}\s()\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function makeReportPublicSlug(
  address: string,
  periodLabel: string,
  idGen: IdGenerator,
): string {
  const addressPart = slugify(address) || 'reporte'
  const periodPart = slugify(periodLabel) || 'periodo'
  const uid = idGen.generate().replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || 'xxxxxx'
  return `${addressPart}-${periodPart}-${uid}`
}
