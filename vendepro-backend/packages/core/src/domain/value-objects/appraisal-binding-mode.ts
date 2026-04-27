import { ValidationError } from '../errors/validation-error'

export const BINDING_MODES = ['system', 'org-static', 'org-variable', 'tasacion', 'default-override'] as const
export type BindingMode = typeof BINDING_MODES[number]

export function assertBindingMode(value: string): asserts value is BindingMode {
  if (!(BINDING_MODES as readonly string[]).includes(value)) {
    throw new ValidationError(`binding_mode inválido: "${value}"`)
  }
}
