import { sanitizeRichText } from '../sanitize-html'
import { RichTextEditor } from './RichTextEditor'

interface Data { html?: string }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

export function RichTextBlock({ data, edit, ...attrs }: Props) {
  if (edit) {
    return (
      <section {...attrs} className="px-6 py-4 md:px-12 md:py-6">
        <div className="mx-auto max-w-4xl">
          <RichTextEditor html={data.html ?? ''} onCommit={(html) => edit.onChange({ html })} />
        </div>
      </section>
    )
  }

  const clean = sanitizeRichText(data.html)
  if (!clean.trim()) return null
  return (
    <section {...attrs} className="px-6 py-4 md:px-12 md:py-6">
      <div
        className="te-richtext mx-auto max-w-4xl text-base leading-relaxed text-slate-700 md:text-lg"
        dangerouslySetInnerHTML={{ __html: clean }}
      />
    </section>
  )
}
