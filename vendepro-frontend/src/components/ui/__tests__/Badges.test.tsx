import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '../Badge'
import { PropertyStageBadge } from '../PropertyStageBadge'
import { OperationBadge } from '../OperationBadge'

describe('Badge (tonos semánticos)', () => {
  it('success usa el patrón -100/-800 (unificado con etapas) — regresión', () => {
    render(<Badge tone="success">ok</Badge>)
    const cls = screen.getByText('ok').className
    expect(cls).toContain('bg-green-100')
    expect(cls).toContain('text-green-800')
  })

  it('danger usa rojo', () => {
    render(<Badge tone="danger">x</Badge>)
    expect(screen.getByText('x').className).toContain('text-red-800')
  })
})

describe('PropertyStageBadge', () => {
  it('lee label y color desde PROPERTY_STAGES', () => {
    render(<PropertyStageBadge stage="reservada" />)
    const el = screen.getByText('Reservada')
    expect(el.className).toContain('bg-purple-100')
  })

  it('cae a fallback gris con un stage desconocido (no rompe)', () => {
    render(<PropertyStageBadge stage="inexistente" />)
    expect(screen.getByText('inexistente').className).toContain('bg-gray-100')
  })
})

describe('OperationBadge', () => {
  it('lee label desde OPERATION_TYPES', () => {
    render(<OperationBadge operation="venta" />)
    expect(screen.getByText('Venta')).toBeInTheDocument()
  })
})
