interface Data { title?: string; body?: string; image_url?: string | null; highlight_text?: string }
interface Props { data: Data; [key: `data-${string}`]: string | undefined }

export function MethodologyBlock({ data, ...attrs }: Props) {
  return (
    <section {...attrs} className="bg-slate-50 px-6 py-10 md:px-12 md:py-16">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="font-poppins text-2xl font-bold md:text-3xl">{data.title ?? 'Nuestra metodología'}</h2>
          {data.body && <p className="mt-4 whitespace-pre-line text-sm text-slate-700 md:text-base">{data.body}</p>}
          {data.highlight_text && (
            <p className="mt-6 border-l-4 border-[var(--brand-color,#ff007c)] bg-white px-4 py-3 text-lg font-semibold italic text-slate-900">
              {data.highlight_text}
            </p>
          )}
        </div>
        {data.image_url && <img src={data.image_url} alt="" className="w-full rounded-lg object-cover" />}
      </div>
    </section>
  )
}
