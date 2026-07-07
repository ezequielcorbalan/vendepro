import type { HydratedBlock, AppraisalContext, RenderMode } from './types'
import { blockDataAttrs } from './block-utils'
import { UnknownBlock } from './blocks/UnknownBlock'
import { CoverBlock } from './blocks/CoverBlock'
import { PropertyDataBlock } from './blocks/PropertyDataBlock'
import { SwotBlock } from './blocks/SwotBlock'
import { WorkConditionsBlock } from './blocks/WorkConditionsBlock'
import { ComparablesListBlock } from './blocks/ComparablesListBlock'
import { ProposalCommercialBlock } from './blocks/ProposalCommercialBlock'
import { ServicesGridBlock } from './blocks/ServicesGridBlock'
import { MarketStatsBlock } from './blocks/MarketStatsBlock'
import { FunnelChartBlock } from './blocks/FunnelChartBlock'
import { MethodologyBlock } from './blocks/MethodologyBlock'
import { NotaryChartsBlock } from './blocks/NotaryChartsBlock'
import { ZoneMapBlock } from './blocks/ZoneMapBlock'
import { PriceProjectionBlock } from './blocks/PriceProjectionBlock'
import { VideoGalleryBlock } from './blocks/VideoGalleryBlock'
import { ExtraMediaBlock } from './blocks/ExtraMediaBlock'
import { CtaWhatsappBlock } from './blocks/CtaWhatsappBlock'
import { AgentContactCardBlock } from './blocks/AgentContactCardBlock'
import { HeadingBlock } from './blocks/HeadingBlock'
import { RichTextBlock } from './blocks/RichTextBlock'
import { ImageBlock } from './blocks/ImageBlock'
import { GalleryBlock } from './blocks/GalleryBlock'
import { DividerBlock } from './blocks/DividerBlock'
import { CalloutBlock } from './blocks/CalloutBlock'
import { ButtonLinkBlock } from './blocks/ButtonLinkBlock'

interface Props {
  block: HydratedBlock
  mode: RenderMode
  appraisal: AppraisalContext
}

// Tipos que ya aplican background_color por su cuenta (tienen un `style` propio
// en su elemento raíz que pisaría un wrapper genérico). El resto no define
// `style` en su raíz, así que el wrapper de abajo alcanza sin tocar cada uno.
const SELF_MANAGES_BACKGROUND = new Set(['cover', 'price_projection'])

export function BlockRenderer({ block, mode, appraisal }: Props) {
  const attrs = blockDataAttrs(block)
  const data = block.resolved_data
  const backgroundColor = (data as { background_color?: string | null }).background_color || undefined

  let content: React.ReactNode
  switch (block.type) {
    case 'cover':
      content = <CoverBlock data={data as any} appraisal={appraisal} {...attrs} />
      break
    case 'property_data':
      content = <PropertyDataBlock data={data as any} {...attrs} />
      break
    case 'swot':
      content = <SwotBlock data={data as any} {...attrs} />
      break
    case 'work_conditions':
      content = <WorkConditionsBlock data={data as any} {...attrs} />
      break
    case 'comparables_list':
      content = <ComparablesListBlock data={data as any} {...attrs} />
      break
    case 'proposal_commercial':
      content = <ProposalCommercialBlock data={data as any} {...attrs} />
      break
    case 'services_grid':
      content = <ServicesGridBlock data={data as any} {...attrs} />
      break
    case 'market_stats':
      content = <MarketStatsBlock data={data as any} {...attrs} />
      break
    case 'funnel_chart':
      content = <FunnelChartBlock data={data as any} {...attrs} />
      break
    case 'methodology':
      content = <MethodologyBlock data={data as any} {...attrs} />
      break
    case 'notary_charts':
      content = <NotaryChartsBlock data={data as any} {...attrs} />
      break
    case 'zone_map':
      content = <ZoneMapBlock data={data as any} {...attrs} />
      break
    case 'price_projection':
      content = <PriceProjectionBlock data={data as any} {...attrs} />
      break
    case 'video_gallery':
      content = <VideoGalleryBlock data={data as any} {...attrs} />
      break
    case 'extra_media':
      content = <ExtraMediaBlock data={data as any} {...attrs} />
      break
    case 'cta_whatsapp':
      content = <CtaWhatsappBlock data={data as any} {...attrs} />
      break
    case 'agent_contact_card':
      content = <AgentContactCardBlock data={data as any} appraisal={appraisal} {...attrs} />
      break
    case 'heading':
      content = <HeadingBlock data={data as any} {...attrs} />
      break
    case 'rich_text':
      content = <RichTextBlock data={data as any} {...attrs} />
      break
    case 'image':
      content = <ImageBlock data={data as any} {...attrs} />
      break
    case 'gallery':
      content = <GalleryBlock data={data as any} {...attrs} />
      break
    case 'divider':
      content = <DividerBlock data={data as any} {...attrs} />
      break
    case 'callout':
      content = <CalloutBlock data={data as any} {...attrs} />
      break
    case 'button_link':
      content = <ButtonLinkBlock data={data as any} {...attrs} />
      break
    default:
      content = <UnknownBlock type={block.type} {...attrs} />
  }

  if (!backgroundColor || SELF_MANAGES_BACKGROUND.has(block.type)) return content
  return <div style={{ backgroundColor }}>{content}</div>
}
