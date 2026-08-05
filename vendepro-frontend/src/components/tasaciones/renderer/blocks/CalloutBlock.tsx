import { InlineEditable } from './InlineEditable'

interface Data { text?: string; tone?: 'info' | 'accent' }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

export function CalloutBlock({ data, edit, ...attrs }: Props) {
  const accent = (data.tone ?? 'accent') === 'accent'
  const wrapCls = accent
    ? 'border-l-4 bg-rose-50/60 text-ink'
    : 'border-l-4 border-slate-300 bg-slate-50 text-ink'
  const borderColor = accent ? 'var(--brand-color, #ff007c)' : undefined

  const textCls = 'text-lg font-medium leading-snug md:text-xl'

  if (!edit && !data.text?.trim()) return null

  return (
    <section {...attrs} className="px-6 py-4 md:px-12 md:py-6">
      <div className="mx-auto max-w-4xl">
        <div className={`rounded-r-2xl px-6 py-5 ${wrapCls}`} style={borderColor ? { borderColor } : undefined}>
          {edit ? (
            <InlineEditable
              as="p"
              plaintext
              value={data.text ?? ''}
              placeholder="Escribí una idea para destacar…"
              className={textCls}
              onCommit={(text) => edit.onChange({ text })}
            />
          ) : (
            <p className={textCls}>{data.text}</p>
          )}
        </div>
      </div>
    </section>
  )
}
