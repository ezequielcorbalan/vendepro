import { InlineEditable } from './InlineEditable'
import { ImageEditControls } from './ImageEditControls'

interface Data {
  url?: string | null
  caption?: string
  width?: 'full' | 'wide' | 'medium'
  align?: 'left' | 'center' | 'right'
}
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const WIDTH: Record<string, string> = {
  full: 'max-w-none',
  wide: 'max-w-4xl',
  medium: 'max-w-xl',
}
const ALIGN: Record<string, string> = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto' }

export function ImageBlock({ data, edit, ...attrs }: Props) {
  const widthCls = WIDTH[data.width ?? 'wide']
  const alignCls = ALIGN[data.align ?? 'center']

  return (
    <section {...attrs} className="px-6 py-4 md:px-12 md:py-6">
      <figure className={`${widthCls} ${alignCls}`}>
        {data.url ? (
          <img src={data.url} alt={data.caption ?? ''} className="w-full rounded-2xl object-cover shadow-sm" />
        ) : edit ? (
          <ImageEditControls onUploaded={(url) => edit.onChange({ url })} />
        ) : null}

        {edit && data.url && (
          <div className="mt-2">
            <ImageEditControls compact onUploaded={(url) => edit.onChange({ url })} />
          </div>
        )}

        {edit ? (
          <InlineEditable
            as="p"
            plaintext
            value={data.caption ?? ''}
            placeholder="Epígrafe (opcional)…"
            className="mt-2 text-center text-sm text-slate-500"
            onCommit={(caption) => edit.onChange({ caption })}
          />
        ) : data.caption ? (
          <figcaption className="mt-2 text-center text-sm text-slate-500">{data.caption}</figcaption>
        ) : null}
      </figure>
    </section>
  )
}
