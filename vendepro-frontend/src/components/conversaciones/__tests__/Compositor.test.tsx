import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Compositor } from '../Compositor'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/auth', () => ({ getCurrentUser: () => ({ id: 'u1', full_name: 'Marcela Genta', role: 'admin' }) }))
vi.mock('@/lib/whatsapp-templates', async (importOriginal) => {
  const real = await importOriginal() as any
  return {
    ...real,
    useWhatsAppTemplates: () => ({
      loading: false,
      orgName: 'MG Inmobiliaria',
      templates: [
        { id: 't1', name: 'Primer contacto', body: 'Hola {{nombre}}, te escribo de {{inmobiliaria}}.' },
        { id: 't2', name: 'Seguimiento', body: 'Hola {{nombre}}, ¿pudiste ver la propiedad?' },
        { id: 't3', name: 'Coordinar visita', body: '¿Qué día te queda bien para visitar?' },
      ],
    }),
  }
})

function Envoltorio({ onEnviar = vi.fn() }: { onEnviar?: () => void }) {
  const [texto, setTexto] = useState('')
  return (
    <Compositor
      canal="whatsapp" ventanaAbierta nombreContacto="Juan Pérez"
      texto={texto} onTexto={setTexto} onEnviar={onEnviar} enviando={false} puedeConfigurar={false}
    />
  )
}

const caja = () => screen.getByPlaceholderText(/Escribí tu respuesta/) as HTMLTextAreaElement

describe('Compositor — atajo /', () => {
  it('"/" muestra las respuestas rápidas y filtra al seguir escribiendo', () => {
    render(<Envoltorio />)
    fireEvent.change(caja(), { target: { value: '/' } })
    expect(screen.getAllByRole('option')).toHaveLength(3)

    fireEvent.change(caja(), { target: { value: '/seg' } })
    expect(screen.getAllByRole('option').map(o => o.textContent)).toEqual([expect.stringContaining('Seguimiento')])
  })

  // "/visita" encuentra "Coordinar visita": se busca adentro del nombre, sin tildes.
  it('busca en cualquier parte del nombre', () => {
    render(<Envoltorio />)
    fireEvent.change(caja(), { target: { value: '/VISITA' } })
    expect(screen.getAllByRole('option')[0].textContent).toContain('Coordinar visita')
  })

  it('Enter pega el mensaje con las variables resueltas, sin mandarlo', () => {
    const onEnviar = vi.fn()
    render(<Envoltorio onEnviar={onEnviar} />)
    fireEvent.change(caja(), { target: { value: '/prim' } })
    fireEvent.keyDown(caja(), { key: 'Enter' })

    expect(caja().value).toBe('Hola Juan, te escribo de MG Inmobiliaria.')
    expect(onEnviar).not.toHaveBeenCalled()
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('las flechas eligen otra sugerencia', () => {
    render(<Envoltorio />)
    fireEvent.change(caja(), { target: { value: '/' } })
    fireEvent.keyDown(caja(), { key: 'ArrowDown' })
    fireEvent.keyDown(caja(), { key: 'Enter' })
    expect(caja().value).toBe('Hola Juan, ¿pudiste ver la propiedad?')
  })

  it('Escape cancela el atajo', () => {
    render(<Envoltorio />)
    fireEvent.change(caja(), { target: { value: '/se' } })
    fireEvent.keyDown(caja(), { key: 'Escape' })
    expect(caja().value).toBe('')
  })

  // Mandar "/seg" por error sería un mensaje raro para el cliente.
  it('no deja enviar mientras el texto es un atajo', () => {
    render(<Envoltorio />)
    fireEvent.change(caja(), { target: { value: '/xyz' } })
    expect(screen.getByRole('button', { name: /Enviar/ })).toBeDisabled()
  })
})
