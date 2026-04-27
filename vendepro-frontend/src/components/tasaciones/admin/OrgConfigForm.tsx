'use client'
import { useEffect, useState } from 'react'
import { listVariables, createVariable, updateVariable } from '../shared/api'
import ImageUpload from '@/components/landings/ImageUpload'

const SIGNATURE_KEY = 'custom.org_signature_url'
const DISCLAIMER_KEY = 'custom.org_disclaimer_legal'

export function OrgConfigForm() {
  const [signatureVar, setSignatureVar] = useState<any>(null)
  const [disclaimerVar, setDisclaimerVar] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savingDisclaimer, setSavingDisclaimer] = useState(false)
  const [disclaimerText, setDisclaimerText] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const all = await listVariables()
        let sig = all.find((v: any) => v.key === SIGNATURE_KEY)
        let dis = all.find((v: any) => v.key === DISCLAIMER_KEY)
        if (!sig) {
          const { id } = await createVariable({
            key: SIGNATURE_KEY,
            label: 'Firma del titular',
            value: '',
            value_type: 'image_url',
            namespace: 'custom',
          })
          if (!id) throw new Error('No se pudo crear la variable de firma')
          sig = { id, key: SIGNATURE_KEY, label: 'Firma', value: '', value_type: 'image_url', namespace: 'custom' }
        }
        if (!dis) {
          const { id } = await createVariable({
            key: DISCLAIMER_KEY,
            label: 'Disclaimer legal',
            value: '',
            value_type: 'text',
            namespace: 'custom',
          })
          if (!id) throw new Error('No se pudo crear la variable de disclaimer')
          dis = { id, key: DISCLAIMER_KEY, label: 'Disclaimer', value: '', value_type: 'text', namespace: 'custom' }
        }
        setSignatureVar(sig)
        setDisclaimerVar(dis)
        setDisclaimerText(dis.value ?? '')
      } catch (e: any) {
        setError(e?.message ?? 'Error al inicializar configuración general')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
  if (error) return <div className="rounded border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800">{error}</div>

  const updateSig = async (url: string) => {
    try {
      await updateVariable(signatureVar.id, { value: url })
      setSignatureVar({ ...signatureVar, value: url })
    } catch (e: any) {
      alert(e?.message ?? 'Error al guardar firma')
    }
  }

  const updateDis = async () => {
    setSavingDisclaimer(true)
    try {
      await updateVariable(disclaimerVar.id, { value: disclaimerText })
      setDisclaimerVar({ ...disclaimerVar, value: disclaimerText })
    } catch (e: any) {
      alert(e?.message ?? 'Error al guardar disclaimer')
    } finally {
      setSavingDisclaimer(false)
    }
  }

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Firma del titular</h3>
        <p className="mt-1 text-xs text-slate-500">Se usa en los bloques que la referencien.</p>
        <div className="mt-3">
          <ImageUpload value={signatureVar.value} onChange={updateSig} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Disclaimer legal</h3>
        <p className="mt-1 text-xs text-slate-500">Texto que aparece al pie de las tasaciones.</p>
        <textarea
          value={disclaimerText}
          onChange={e => setDisclaimerText(e.target.value)}
          rows={6}
          className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={updateDis}
            disabled={savingDisclaimer || disclaimerText === disclaimerVar.value}
            className="rounded bg-[#ff007c] px-4 py-2 text-sm text-white disabled:opacity-40"
          >
            {savingDisclaimer ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
