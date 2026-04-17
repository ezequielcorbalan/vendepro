import { ValidationError } from '../errors/validation-error'

export interface RoleProps {
  id: number
  name: string
  label: string
}

export class Role {
  private constructor(private props: RoleProps) {}

  static create(props: RoleProps): Role {
    if (!props.name || !/^[a-z_]+$/.test(props.name)) {
      throw new ValidationError('Nombre de rol inválido (sólo minúsculas y guiones bajos)', {
        name: 'Formato inválido',
      })
    }
    if (!props.label || props.label.trim().length === 0) {
      throw new ValidationError('Label es requerido', { label: 'Requerido' })
    }
    return new Role({ ...props })
  }

  get id() { return this.props.id }
  get name() { return this.props.name }
  get label() { return this.props.label }

  toObject(): RoleProps {
    return { ...this.props }
  }
}
