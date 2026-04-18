'use client'
import { useState } from 'react'
import type { LeadFormData } from '@/lib/landings/types'

interface Props {
  data: LeadFormData
  mode?: 'public' | 'editor'
  onSubmit?: (values: Record<string, string>) => Promise<void>   // Fase C lo conecta; si no, el form es no-op
}

export default function LeadFormBlock({ data, mode, onSubmit }: Props) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'editor') return
    if (!onSubmit) return
    setLoading(true); setError(null)
    try {
      await onSubmit(values)
      setSuccess(data.success_message)
    } catch (err: any) {
      setError(err.message ?? 'No pudimos enviar tu consulta. Probá de nuevo.')
    } finally { setLoading(false) }
  }

  return (
    <section id="form" className="bg-gradient-to-br from-[#ff007c] to-[#ff8017] py-14 px-6 text-white">
      <div className="max-w-md mx-auto">
        <h2 className="text-2xl md:text-3xl font-bold mb-2">{data.title}</h2>
        {data.subtitle && <p className="opacity-90 mb-6">{data.subtitle}</p>}

        {success ? (
          <div className="bg-white text-gray-900 rounded-2xl p-6 text-center">
            <p className="font-medium">{success}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3" aria-disabled={mode === 'editor'}>
            {data.fields.map((field) => (
              <div key={field.key}>
                <label className="sr-only" htmlFor={`f_${field.key}`}>{field.label}</label>
                <input
                  id={`f_${field.key}`}
                  type={field.key === 'email' ? 'email' : field.key === 'phone' ? 'tel' : 'text'}
                  placeholder={field.label + (field.required ? ' *' : '')}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                  required={field.required}
                  disabled={mode === 'editor'}
                  className="w-full rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 px-4 py-3 outline-none focus:ring-2 focus:ring-white"
                />
              </div>
            ))}
            {data.fields.some(f => f.key === 'message') ? null : null}
            {error && <p className="text-sm bg-white/15 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading || mode === 'editor'} className="w-full bg-white text-[#ff007c] font-semibold rounded-full py-3 hover:bg-white/95 disabled:opacity-70">
              {loading ? 'Enviando…' : data.submit_label}
            </button>
            {data.privacy_note && <p className="text-xs opacity-80 text-center mt-2">{data.privacy_note}</p>}
          </form>
        )}
      </div>
    </section>
  )
}
