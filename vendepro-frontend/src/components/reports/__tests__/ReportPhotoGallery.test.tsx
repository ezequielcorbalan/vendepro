import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReportPhotoGallery } from '../ReportPhotoGallery'

const PHOTOS = [
  { id: 'p1', photo_url: 'https://cdn.test/1.jpg', caption: 'Living' },
  { id: 'p2', photo_url: 'https://cdn.test/2.jpg', caption: null },
  { id: 'p3', photo_url: 'https://cdn.test/3.jpg', caption: 'Cocina' },
]

describe('ReportPhotoGallery', () => {
  it('renderiza la grilla sin lightbox abierto', () => {
    render(<ReportPhotoGallery photos={PHOTOS} />)
    expect(screen.getAllByRole('button', { name: /Ampliar/ })).toHaveLength(3)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('click en una foto abre el lightbox con esa foto ampliada', () => {
    render(<ReportPhotoGallery photos={PHOTOS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar Cocina' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // La imagen grande del lightbox es la tercera; el contador lo confirma.
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    expect(screen.getByText('Cocina')).toBeInTheDocument()
  })

  it('navega con las flechas en pantalla, con wrap-around', () => {
    render(<ReportPhotoGallery photos={PHOTOS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar Living' }))
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Foto anterior' }))
    fireEvent.click(screen.getByRole('button', { name: 'Foto anterior' }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('navega con las flechas del teclado', () => {
    render(<ReportPhotoGallery photos={PHOTOS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar Living' }))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('cierra con el botón Cerrar y con Escape', () => {
    render(<ReportPhotoGallery photos={PHOTOS} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar Living' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Ampliar Living' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('con una sola foto no muestra flechas ni contador', () => {
    render(<ReportPhotoGallery photos={[PHOTOS[0]]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ampliar Living' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).toBeNull()
    expect(screen.queryByText('1 / 1')).toBeNull()
  })
})
