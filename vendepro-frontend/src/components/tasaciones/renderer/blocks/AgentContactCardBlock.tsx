import { Phone, Mail, MessageCircle, User } from 'lucide-react'
import type { AppraisalContext } from '../types'
import { InlineEditable } from './InlineEditable'
import { ImageEditControls } from './ImageEditControls'

interface Data { avatar_url?: string | null; name?: string; phone?: string; email?: string; whatsapp_link?: string | null; background_color?: string | null }
interface Props {
  data: Data
  appraisal: AppraisalContext
  edit?: { onChange: (patch: Partial<Data>) => void }
  [key: `data-${string}`]: string | undefined
}

const BRAND_GRADIENT =
  'linear-gradient(180deg, var(--brand-color, #ff007c) 0%, var(--brand-accent-color, #e17a2a) 100%)'

export function AgentContactCardBlock({ data, appraisal, edit, ...attrs }: Props) {
  const agent = appraisal.agent
  const name = data.name ?? agent?.name
  const phone = data.phone ?? agent?.phone ?? undefined
  const email = data.email ?? agent?.email ?? undefined
  const avatar = data.avatar_url ?? agent?.avatar_url

  if (!edit && !name) return null

  return (
    <section {...attrs} className="bg-white px-6 py-16 md:px-12 md:py-24">
      <div className="mx-auto max-w-3xl">
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em] md:text-sm"
          style={{ color: 'var(--brand-color, #ff007c)' }}
        >
          Tu asesor
        </p>
        <h2 className="mt-2 font-poppins text-3xl font-bold leading-tight text-slate-900 md:text-5xl">
          ¿Hablamos?
        </h2>

        <article className="mt-10 overflow-hidden rounded-3xl bg-[#f2f2f2] shadow-sm md:mt-12">
          <div className="grid grid-cols-1 md:grid-cols-5">
            <div
              className="relative flex items-center justify-center p-8 md:col-span-2 md:p-10"
              style={{ backgroundImage: BRAND_GRADIENT }}
            >
              {avatar ? (
                <img
                  src={avatar}
                  alt={name ?? ''}
                  className="h-32 w-32 rounded-full object-cover ring-4 ring-white/40 md:h-40 md:w-40"
                />
              ) : (
                <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white/20 text-white md:h-40 md:w-40">
                  <User className="h-12 w-12 md:h-16 md:w-16" strokeWidth={1.5} />
                </div>
              )}
              {edit && (
                <div className="absolute bottom-2 right-2">
                  <ImageEditControls compact={!!avatar} onUploaded={(url) => edit.onChange({ avatar_url: url })} />
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center p-8 md:col-span-3 md:p-12">
              <p
                className="text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ color: 'var(--brand-color, #ff007c)' }}
              >
                Asesor inmobiliario
              </p>
              {edit ? (
                <InlineEditable
                  as="p"
                  plaintext
                  value={name ?? ''}
                  placeholder="Nombre del asesor"
                  className="mt-2 font-poppins text-2xl font-bold leading-tight text-slate-900 md:text-3xl"
                  onCommit={(v) => edit.onChange({ name: v })}
                />
              ) : (
                <p className="mt-2 font-poppins text-2xl font-bold leading-tight text-slate-900 md:text-3xl">
                  {name}
                </p>
              )}

              <ul className="mt-6 space-y-3">
                {(edit || phone) && (
                  <li className="flex items-center gap-3 text-sm text-slate-700 md:text-base">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"
                      style={{ color: 'var(--brand-color, #ff007c)' }}
                    >
                      <Phone className="h-4 w-4" />
                    </span>
                    {edit ? (
                      <input
                        type="tel"
                        defaultValue={phone ?? ''}
                        placeholder="Teléfono"
                        onBlur={(e) => edit.onChange({ phone: e.target.value.trim() })}
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    ) : (
                      <a href={`tel:${phone}`} className="hover:underline">{phone}</a>
                    )}
                  </li>
                )}
                {(edit || email) && (
                  <li className="flex items-center gap-3 text-sm text-slate-700 md:text-base">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white"
                      style={{ color: 'var(--brand-color, #ff007c)' }}
                    >
                      <Mail className="h-4 w-4" />
                    </span>
                    {edit ? (
                      <input
                        type="email"
                        defaultValue={email ?? ''}
                        placeholder="Email"
                        onBlur={(e) => edit.onChange({ email: e.target.value.trim() })}
                        className="rounded border border-slate-200 px-2 py-1 text-sm"
                      />
                    ) : (
                      <a href={`mailto:${email}`} className="hover:underline">{email}</a>
                    )}
                  </li>
                )}
              </ul>

              {(edit || data.whatsapp_link) && !edit && data.whatsapp_link && (
                <a
                  href={data.whatsapp_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-8 inline-flex items-center justify-center gap-2 self-start rounded-full bg-[#25D366] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <MessageCircle className="h-4 w-4" />
                  Escribir por WhatsApp
                </a>
              )}
              {edit && (
                <label className="mt-6 flex flex-col gap-1 text-xs text-slate-500">
                  Link de WhatsApp (opcional)
                  <input
                    type="url"
                    defaultValue={data.whatsapp_link ?? ''}
                    placeholder="https://wa.me/…"
                    onBlur={(e) => edit.onChange({ whatsapp_link: e.target.value.trim() || null })}
                    className="rounded border border-slate-200 px-2 py-1 text-sm"
                  />
                </label>
              )}
            </div>
          </div>
        </article>
      </div>
    </section>
  )
}
