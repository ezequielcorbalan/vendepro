import { ValidationError } from '../errors/validation-error'

// Alfabeto sin caracteres ambiguos (sin 0/o/1/l/i)
export const SLUG_SUFFIX_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const SLUG_BASE_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const SLUG_SUFFIX_LENGTH = 5
const SUFFIX_RE = new RegExp(`^[${SLUG_SUFFIX_ALPHABET}]{${SLUG_SUFFIX_LENGTH}}$`)

export interface LandingSlugProps {
  slug_base: string
  slug_suffix: string
}

export class LandingSlug {
  private constructor(
    readonly slug_base: string,
    readonly slug_suffix: string,
  ) {}

  static create(props: LandingSlugProps): LandingSlug {
    const { slug_base, slug_suffix } = props
    if (!slug_base || slug_base.length < 3 || slug_base.length > 60) {
      throw new ValidationError('slug_base debe tener entre 3 y 60 caracteres')
    }
    if (!SLUG_BASE_RE.test(slug_base)) {
      throw new ValidationError('slug_base solo acepta a-z, 0-9 y guiones (no puede empezar/terminar con guión)')
    }
    if (!SUFFIX_RE.test(slug_suffix)) {
      throw new ValidationError(`slug_suffix inválido: debe ser ${SLUG_SUFFIX_LENGTH} chars del alfabeto permitido`)
    }
    return new LandingSlug(slug_base, slug_suffix)
  }

  get full(): string {
    return `${this.slug_base}-${this.slug_suffix}`
  }

  toString(): string {
    return this.full
  }
}

export function generateSlugSuffix(): string {
  const bytes = new Uint8Array(SLUG_SUFFIX_LENGTH)
  crypto.getRandomValues(bytes)
  let out = ''
  for (let i = 0; i < SLUG_SUFFIX_LENGTH; i++) {
    out += SLUG_SUFFIX_ALPHABET[bytes[i] % SLUG_SUFFIX_ALPHABET.length]
  }
  return out
}
