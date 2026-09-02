'use client'
import { useState } from 'react'
import { Save } from 'lucide-react'
import { landingsApi } from '@/lib/landings/api'
import { slugifyBase, isValidSlugBase, publicLandingHostPath } from '@/lib/landings/slug'
import type { Landing } from '@/lib/landings/types'
import { Field, Input, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Drawer } from '@/components/ui/Drawer'
import { Alert } from '@/components/ui/Alert'

export default function ConfigDrawer({
  landing,
  onClose,
  onSaved,
}: {
  landing: Landing
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [slugBase, setSlugBase] = useState(landing.slug_base)
  const [brandVoice, setBrandVoice] = useState(landing.brand_voice ?? '')
  const [seoTitle, setSeoTitle] = useState(landing.seo_title ?? '')
  const [seoDesc, setSeoDesc] = useState(landing.seo_description ?? '')
  const [ogImage, setOgImage] = useState(landing.og_image_url ?? '')
  const [leadRulesJson, setLeadRulesJson] = useState(
    JSON.stringify(landing.lead_rules ?? {}, null, 2)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const normSlug = slugifyBase(slugBase)
    if (!isValidSlugBase(normSlug)) {
      setError('Slug inválido')
      return
    }
    let leadRules
    try {
      leadRules = leadRulesJson.trim() ? JSON.parse(leadRulesJson) : null
    } catch {
      setError('Lead rules JSON inválido')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await landingsApi.updateMetadata(landing.id, {
        slug_base: normSlug !== landing.slug_base ? normSlug : (undefined as any),
        brand_voice: brandVoice || null,
        seo_title: seoTitle || null,
        seo_description: seoDesc || null,
        og_image_url: ogImage || null,
        lead_rules: leadRules,
      })
      await onSaved()
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Configuración"
      width="w-[460px]"
      footer={
        <Button onClick={save} loading={saving} fullWidth icon={<Save className="w-4 h-4" />}>
          Guardar
        </Button>
      }
    >
        <div className="space-y-4">
          <Field label="Slug">
            <Input value={slugBase} onChange={e => setSlugBase(e.target.value)} />
            <p className="text-xs text-gray-500 mt-1">
              URL: <code>{publicLandingHostPath(`${slugifyBase(slugBase)}-${landing.slug_suffix}`)}</code>
            </p>
          </Field>
          <Field label="Brand voice (para la IA)">
            <Textarea
              value={brandVoice}
              onChange={e => setBrandVoice(e.target.value)}
              maxLength={300}
              placeholder="ej: cálido, cercano, profesional"
              className="min-h-[80px]"
            />
          </Field>
          <Field label="SEO Title">
            <Input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} maxLength={60} />
          </Field>
          <Field label="SEO Description">
            <Textarea value={seoDesc} onChange={e => setSeoDesc(e.target.value)} maxLength={160} />
          </Field>
          <Field label="OG Image URL">
            <Input value={ogImage} onChange={e => setOgImage(e.target.value)} />
          </Field>
          <Field label="Lead rules (JSON)">
            <Textarea
              value={leadRulesJson}
              onChange={e => setLeadRulesJson(e.target.value)}
              className="text-xs font-mono min-h-[120px]"
            />
            <p className="text-xs text-gray-500 mt-1">
              Ej: <code>{'{"assigned_agent_id":"u_123","tags":["palermo"],"campaign":"Q2","notify_channels":["email"]}'}</code>
            </p>
          </Field>

          {error && <Alert tone="danger">{error}</Alert>}
        </div>
    </Drawer>
  )
}
