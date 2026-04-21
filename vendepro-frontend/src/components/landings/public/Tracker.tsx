'use client'
import { useEffect } from 'react'
import { recordLandingEvent } from '@/lib/landings/public-api'
import { getOrCreateVisitorId, getOrCreateSessionId, readUtmFromUrl } from '@/lib/landings/tracker'

export default function Tracker({ slug }: { slug: string }) {
  useEffect(() => {
    const visitorId = getOrCreateVisitorId()
    const sessionId = getOrCreateSessionId()
    const utm = readUtmFromUrl()

    recordLandingEvent(slug, { type: 'pageview', visitorId, sessionId, utm })

    function onClickCta(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a, button') as HTMLElement | null
      if (!target) return
      const href = target.getAttribute('href')
      const isCta = href === '#form' || target.dataset.cta === 'true'
      if (isCta) {
        recordLandingEvent(slug, { type: 'cta_click', visitorId, sessionId, utm }).catch(() => {})
      }
    }

    function onFormFocus(e: FocusEvent) {
      const t = e.target as HTMLElement
      const form = t.closest('#form') || t.closest('form')
      if (form) {
        recordLandingEvent(slug, { type: 'form_start', visitorId, sessionId, utm }).catch(() => {})
        document.removeEventListener('focusin', onFormFocus, true)
      }
    }

    document.addEventListener('click', onClickCta, true)
    document.addEventListener('focusin', onFormFocus, true)
    return () => {
      document.removeEventListener('click', onClickCta, true)
      document.removeEventListener('focusin', onFormFocus, true)
    }
  }, [slug])

  return null
}
