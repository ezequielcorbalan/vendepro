interface Props {
  type: string
  [key: `data-${string}`]: string | undefined
}

export function UnknownBlock({ type, ...dataAttrs }: Props) {
  if (process.env.NODE_ENV !== 'production') {
    return (
      <section {...dataAttrs} className="my-6 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50 p-6 text-sm text-amber-900">
        <strong>Bloque desconocido:</strong> {type}
      </section>
    )
  }
  return null
}
