import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileInput } from '../FileInput'
import { ColorInput } from '../ColorInput'

function archivo(nombre = 'foto.png') {
  return new File(['x'], nombre, { type: 'image/png' })
}

describe('FileInput', () => {
  it('el disparador abre el input', () => {
    const onFiles = vi.fn()
    render(
      <FileInput onFiles={onFiles} aria-label="Subir foto">
        {abrir => <button onClick={abrir}>Subir</button>}
      </FileInput>,
    )
    const input = screen.getByLabelText('Subir foto')
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Subir' }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('el input queda foco-eable, no con display:none', () => {
    // Éste es el bug 2 del docblock: los tres lugares que tenían esto a mano
    // usaban `className="hidden"`, o sea `display: none`, que saca al input del
    // tab order. Con `sr-only` sigue invisible pero el teclado lo encuentra.
    render(
      <FileInput onFiles={() => {}} aria-label="Subir foto">
        {abrir => <button onClick={abrir}>Subir</button>}
      </FileInput>,
    )
    const input = screen.getByLabelText('Subir foto')
    expect(input.className).toContain('sr-only')
    expect(input.className).not.toContain('hidden')
  })

  it('entrega los archivos como array', () => {
    const onFiles = vi.fn()
    render(
      <FileInput onFiles={onFiles} multiple aria-label="Subir fotos">
        {abrir => <button onClick={abrir}>Subir</button>}
      </FileInput>,
    )
    const a = archivo('a.png'), b = archivo('b.png')
    fireEvent.change(screen.getByLabelText('Subir fotos'), { target: { files: [a, b] } })
    expect(onFiles).toHaveBeenCalledWith([a, b])
  })

  it('no avisa si el usuario cancela el diálogo', () => {
    const onFiles = vi.fn()
    render(
      <FileInput onFiles={onFiles} aria-label="Subir foto">
        {abrir => <button onClick={abrir}>Subir</button>}
      </FileInput>,
    )
    fireEvent.change(screen.getByLabelText('Subir foto'), { target: { files: [] } })
    expect(onFiles).not.toHaveBeenCalled()
  })

  it('deshabilitado no abre nada', () => {
    render(
      <FileInput onFiles={() => {}} disabled aria-label="Subir foto">
        {abrir => <button onClick={abrir}>Subir</button>}
      </FileInput>,
    )
    const input = screen.getByLabelText('Subir foto')
    const click = vi.spyOn(input, 'click')
    fireEvent.click(screen.getByRole('button', { name: 'Subir' }))
    expect(click).not.toHaveBeenCalled()
    expect(input).toBeDisabled()
  })

  // El bug 1 del docblock —que la misma foto no se pueda elegir dos veces— NO
  // está testeado, y vale decirlo en vez de escribir un test que no prueba
  // nada: jsdom no deja asignar el `value` de un input de archivo (es una
  // restricción de seguridad real de los navegadores), así que arranca en ''
  // pase lo que pase y la aserción pasaría igual sin el arreglo.
})

describe('ColorInput', () => {
  it('muestra el fallback cuando no hay color elegido', () => {
    render(<ColorInput value={null} fallback="#ff007c" onChange={() => {}} aria-label="Color de la etapa" />)
    expect(screen.getByLabelText('Color de la etapa')).toHaveValue('#ff007c')
  })

  it('muestra el color cuando hay uno', () => {
    render(<ColorInput value="#123456" onChange={() => {}} aria-label="Color de fondo" />)
    expect(screen.getByLabelText('Color de fondo')).toHaveValue('#123456')
  })

  it('avisa el color nuevo', () => {
    const onChange = vi.fn()
    render(<ColorInput value={null} onChange={onChange} aria-label="Color de fondo" />)
    fireEvent.change(screen.getByLabelText('Color de fondo'), { target: { value: '#00ff00' } })
    expect(onChange).toHaveBeenCalledWith('#00ff00')
  })

  it('siempre tiene nombre accesible', () => {
    // `aria-label` es obligatorio en el tipo: un selector de color no tiene
    // texto visible, así que sin label es un control sin nombre. En
    // FunnelChartForm no lo tenía.
    render(<ColorInput value="#000000" onChange={() => {}} aria-label="Color de la etapa 1" />)
    expect(screen.getByLabelText('Color de la etapa 1')).toBeInTheDocument()
  })
})
