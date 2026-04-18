'use client'
import { useCallback } from 'react'
import BlockRenderer from '@/components/landings/BlockRenderer'
import Tracker from './Tracker'
import type { Block } from '@/lib/landings/types'
import { submitLandingForm, recordLandingEvent } from '@/lib/landings/public-api'
import { getOrCreateVisitorId, getOrCreateSessionId, readUtmFromUrl } from '@/lib/landings/tracker'

export default function PublicLandingShell({ slug, blocks }: { slug: string; blocks: Block[] }) {
  const onFormSubmit = useCallback(async (values: Record<string, string>) => {
    const visitorId = getOrCreateVisitorId()
    const utm = readUtmFromUrl()
    await submitLandingForm(slug, {
      name: values.name ?? '',
      phone: values.phone ?? '',
      email: values.email ?? null,
      address: values.address ?? null,
      message: values.message ?? null,
      visitorId,
      utm,
    })
    recordLandingEvent(slug, { type: 'form_submit', visitorId, sessionId: getOrCreateSessionId(), utm }).catch(() => {})
  }, [slug])

  return (
    <>
      <Tracker slug={slug} />
      <BlockRenderer blocks={blocks} mode="public" onFormSubmit={onFormSubmit} />
    </>
  )
}
