import { InlineEditable } from './InlineEditable'

interface Data { label?: string; url?: string | null }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const BTN = 'inline-flex items-center rounded-full px-7 py-3 text-sm font-semibold text-white shadow-sm md:text-base'
const BTN_STYLE = { backgroundColor: 'var(--brand-color, #ff007c)' }

export function ButtonLinkBlock({ data, edit, ...attrs }: Props) {
  if (edit) {
    return (
      <section {...attrs} className="px-6 py-4 text-center md:px-12 md:py-6">
        <span className={BTN} style={BTN_STYLE}>
          <InlineEditable
            as="span"
            plaintext
            value={data.label ?? ''}
            placeholder="Texto del botón…"
            className="min-w-[3rem]"
            onCommit={(label) => edit.onChange({ label })}
          />
        </span>
        {!data.url && (
          <p className="mt-2 text-xs text-amber-600">Definí el enlace del botón en la barra de arriba.</p>
        )}
      </section>
    )
  }

  if (!data.label?.trim() || !data.url) return null
  return (
    <section {...attrs} className="px-6 py-4 text-center md:px-12 md:py-6">
      <a href={data.url} target="_blank" rel="noopener noreferrer" className={BTN} style={BTN_STYLE}>
        {data.label}
      </a>
    </section>
  )
}
