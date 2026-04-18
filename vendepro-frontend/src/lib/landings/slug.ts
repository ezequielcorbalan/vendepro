export function slugifyBase(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
}

export function isValidSlugBase(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s) && s.length >= 3 && s.length <= 60
}

const LANDINGS_HOST = process.env.NEXT_PUBLIC_LANDINGS_HOST ?? 'landings.vendepro.com.ar'

export function publicLandingUrl(fullSlug: string): string {
  return `https://${LANDINGS_HOST}/l/${fullSlug}`
}

export function publicLandingHostPath(fullSlug: string): string {
  return `${LANDINGS_HOST}/l/${fullSlug}`
}
