import type { AppraisalContext } from '../types'

interface Data { avatar_url?: string | null; name?: string; phone?: string; email?: string; whatsapp_link?: string | null }
interface Props { data: Data; appraisal: AppraisalContext; [key: `data-${string}`]: string | undefined }

export function AgentContactCardBlock({ data, appraisal, ...attrs }: Props) {
  const agent = appraisal.agent
  const name = data.name ?? agent?.name
  const phone = data.phone ?? agent?.phone ?? undefined
  const email = data.email ?? agent?.email ?? undefined
  const avatar = data.avatar_url ?? agent?.avatar_url
  if (!name) return null
  return (
    <section {...attrs} className="px-6 py-10 md:px-12 md:py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl bg-slate-50 p-8 text-center">
        {avatar && <img src={avatar} alt="" className="h-24 w-24 rounded-full object-cover" />}
        <div>
          <p className="text-xl font-bold">{name}</p>
          {phone && <p className="mt-1 text-sm text-slate-600">{phone}</p>}
          {email && <p className="text-sm text-slate-600">{email}</p>}
        </div>
        {data.whatsapp_link && (
          <a href={data.whatsapp_link} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#25D366] px-5 py-2 text-sm font-semibold text-white">
            WhatsApp
          </a>
        )}
      </div>
    </section>
  )
}
