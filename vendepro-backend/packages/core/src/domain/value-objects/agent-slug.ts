import { ValidationError } from '../errors/validation-error'
import { slugify } from '../../shared/utils'

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export class AgentSlug {
  private constructor(readonly value: string) {}

  static create(value: string): AgentSlug {
    if (typeof value !== 'string' || value.length < 3 || value.length > 60) {
      throw new ValidationError('slug inválido: debe tener entre 3 y 60 caracteres')
    }
    if (!SLUG_RE.test(value)) {
      throw new ValidationError('slug inválido: solo minúsculas, números y guiones simples entre medio')
    }
    return new AgentSlug(value)
  }
}

/** Propone un slug a partir del nombre. No garantiza unicidad — eso lo hace el índice (org_id, slug). */
export function slugifyName(fullName: string): string {
  return slugify(fullName)
}
