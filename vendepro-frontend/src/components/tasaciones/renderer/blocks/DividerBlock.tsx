interface Data { style?: 'line' | 'space'; size?: 'sm' | 'md' | 'lg' }
interface Props {
  data: Data
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const SPACE: Record<string, string> = { sm: 'py-4', md: 'py-8', lg: 'py-16' }

export function DividerBlock({ data, edit: _edit, ...attrs }: Props) {
  const size = data.size ?? 'md'
  if ((data.style ?? 'line') === 'space') {
    return <div {...attrs} className={SPACE[size]} aria-hidden />
  }
  return (
    <div {...attrs} className={`px-6 md:px-12 ${SPACE[size]}`}>
      <hr className="mx-auto max-w-4xl border-t border-slate-200" />
    </div>
  )
}
