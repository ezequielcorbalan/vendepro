'use client'

import { useRef, type ReactNode } from 'react'

/**
 * El `<input type="file">` y nada más: la plomería, no el botón.
 *
 * El disparador lo pone el que llama, porque los tres lugares que tenían esto a
 * mano lo tienen distinto y con razón — un `Button variant="outline"` en el
 * formulario de cierres, un dropzone con pegar y arrastrar en `ComparableCard`,
 * y un botón de borde punteado a lo ancho en `ImageUpload`. Lo que se repetía
 * de verdad es el input escondido, y ahí había dos bugs:
 *
 * 1. **La misma foto no se podía elegir dos veces.** El evento `change` no
 *    dispara si el `value` no cambió, así que elegir un archivo, borrarlo y
 *    volver a elegir EL MISMO no hacía nada. `ComparableCard` y
 *    `SoldPropertyForm` lo resolvían con un `e.target.value = ''`;
 *    `ImageUpload` no, y ahí el bug estaba vivo. Acá se hace siempre.
 *
 * 2. **`className="hidden"` lo saca del tab order.** `display: none` no es
 *    foco-eable, así que al input sólo se llegaba por el disparador. Y dos de
 *    los tres disparadores tampoco funcionaban con teclado: el `<span>` de
 *    borde punteado de `ImageUpload` no es foco-eable, y el dropzone de
 *    `ComparableCard` es un `div` con `tabIndex` cuyo `onClick` no se dispara
 *    con Enter. Acá el input va `sr-only`: invisible pero donde el teclado lo
 *    encuentra, así el control se puede usar sin mouse pase lo que pase con el
 *    disparador.
 *
 *   <FileInput accept="image/*" onFiles={subir}>
 *     {abrir => <Button variant="outline" onClick={abrir}>Subir</Button>}
 *   </FileInput>
 */
interface FileInputProps {
  /** Los archivos elegidos, ya normalizados a array. Nunca se llama con [] vacío. */
  onFiles: (files: File[]) => void
  /** Filtro del diálogo del sistema, por ejemplo `image/*` o `.pdf`. */
  accept?: string
  multiple?: boolean
  disabled?: boolean
  /**
   * El disparador. Recibe `abrir`, que abre el diálogo del sistema — llamalo
   * desde el `onClick` de un control que ya sea foco-eable (un `Button`, o un
   * `div` con `tabIndex`), no desde un `<span>`.
   */
  children: (abrir: () => void) => ReactNode
  /** Nombre del control para lectores de pantalla. */
  'aria-label': string
}

export function FileInput({
  onFiles, accept, multiple = false, disabled = false, children,
  'aria-label': ariaLabel,
}: FileInputProps) {
  const ref = useRef<HTMLInputElement>(null)

  const abrir = () => {
    if (disabled) return
    ref.current?.click()
  }

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        aria-label={ariaLabel}
        className="sr-only"
        onChange={e => {
          const files = Array.from(e.target.files ?? [])
          // Antes de avisar, no después: si el consumidor tira, el input tiene
          // que quedar limpio igual para que se pueda reintentar con el mismo
          // archivo.
          e.target.value = ''
          if (files.length) onFiles(files)
        }}
      />
      {children(abrir)}
    </>
  )
}
