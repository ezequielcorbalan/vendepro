import { InlineEditable } from './InlineEditable'

interface Data { text?: string; level?: 1 | 2 | 3; align?: 'left' | 'center' | 'right' }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const SIZE: Record<number, string> = {
  1: 'text-3xl md:text-5xl',
  2: 'text-2xl md:text-4xl',
  3: 'text-xl md:text-2xl',
}
const ALIGN: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' }

export function HeadingBlock({ data, edit, ...attrs }: Props) {
  const level = data.level ?? 2
  const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
  const cls = `font-poppins font-bold leading-tight text-ink ${SIZE[level]} ${ALIGN[data.align ?? 'left']}`

  return (
    <section {...attrs} className="px-6 py-4 md:px-12 md:py-6">
      <div className="mx-auto max-w-4xl">
        {edit ? (
          <InlineEditable
            as={Tag}
            plaintext
            value={data.text ?? ''}
            placeholder="Escribí un título…"
            className={cls}
            onCommit={(text) => edit.onChange({ text })}
          />
        ) : data.text ? (
          <Tag className={cls}>{data.text}</Tag>
        ) : null}
      </div>
    </section>
  )
}
